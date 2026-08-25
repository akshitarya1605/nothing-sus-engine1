# Game Engine

Nothing Sus's game engine is the single source of truth for game state.
The Player, Admin, and Projector clients never compute game logic
locally — they call the engine and render what it returns.

```
        UI (player / admin / projector page)
                     |
                     v
     Route handler (src/app/api/**/route.ts)
        - auth guard (src/lib/auth/guards.ts)
        - zod-validated input (src/lib/game/validators.ts)
                     |
                     v
     Game engine (src/lib/game/engine.ts -> actions/*)
        - state machine guard (transitions.ts)
        - business guards (permissions.ts)
        - one Prisma transaction per action
                     |
        +------------+------------+
        v                         v
    Postgres                 GameEvent row
  (Player/Task/Vote/...)    + pg_notify (realtime)
```

## Layout

```
src/lib/game/
  engine.ts        barrel — the only import path route handlers use
  state.ts          the three data contracts (see below)
  permissions.ts     small guard functions (assertPlayerAlive, etc.)
  constants.ts        default config, event schedule seed data
  transitions.ts        the game-status state graph
  validators.ts           zod schemas for every action's input
  scoring.ts                task progress calculation (one formula)
  timers.ts                   server-timestamp-derived round/voting timing
  audit.ts                      writeAuditLog, called by every privileged action
  errors.ts                      GameEngineError + HTTP status mapping
  actions/
    players.ts    create, role assignment/locking, restore
    rounds.ts      ready/start/pause/resume/complete/finish, checkAutoAdvance
    tasks.ts        start/complete/setStatus, server-side validation
    meetings.ts       callMeeting, startVoting
    voting.ts          castVote, closeVoting, revealResult, resolveTie, tallyVotes
    eliminations.ts     eliminatePlayer(Tx), revealRole
    locations.ts          scanLocation (QR token), exitLocation
    announcements.ts       createAnnouncement
  events/
    types.ts       GameEventType union, payload types, visibility table
    publisher.ts     publishEvent — the only place GameEvent rows are created
```

## Game state

`Game` holds: `status`, `currentRoundNumber`, `currentPhase`,
`pausedFromStatus` / `pausedAt` / `pauseReason`, `rolesLocked` /
`rolesLockedAt`. See `docs/GAME_STATE_MACHINE.md` for the full state
graph and every transition's guard.

Nothing about round *timing* is a stored "time remaining" value —
`Round.startedAt` and `Round.durationMinutes` are stored, and
`src/lib/game/timers.ts::computeRoundTiming` derives remaining time and
whether the automatic meeting is due, purely as a function of those
timestamps vs. `now`. See `docs/GAME_STATE_MACHINE.md` "automatic
meeting rule" for how this replaces a browser-side timer.

## Event schedule / round configuration

The four-round schedule (10am/12pm/2pm/4pm) from the brief lives in
`src/lib/game/constants.ts::DEFAULT_ROUND_SCHEDULE` — it's **seed data**
consumed by `prisma/seed.ts` to create `Round` rows, not a constant read
by any UI component or engine function. Once seeded, `Round.scheduledStartAt`
/ `durationMinutes` / `meetingAfterMinutes` are ordinary database columns;
changing them (an admin "edit schedule" UI) is a schema-supported,
not-yet-built feature — see "Known limitations" in `docs/SECURITY.md`.

## Task progress — one formula, one place

```
percentage = completed PlayerTask rows
              ÷
             PlayerTask rows with status in {AVAILABLE, IN_PROGRESS, COMPLETED}
```

`LOCKED` instances aren't counted in either side — they haven't been
unlocked for anyone yet, so they're not "in play." This is implemented
exactly once, in `src/lib/game/scoring.ts`, and both
`getAdminGameState` and `getProjectorState` (and a player's own
progress, scoped to their rows) call it. There is no second place that
computes a percentage.

## Data contracts

Three functions in `src/lib/game/state.ts`, each the *only* sanctioned
way its audience reads game state:

- **`getPlayerGameState(prisma, playerId)`** — identity, own role, own
  status, own tasks/progress, own location, a notification feed
  (public events + events targeted at this player only).
- **`getAdminGameState(prisma, gameId)`** — full roster with roles,
  round list, global task progress, the active meeting's vote *count*
  (not who voted for whom), recent audit log.
- **`getProjectorState(prisma, gameId)`** — round/phase/timer, global
  progress, alive/eliminated *counts* (never role breakdowns), meeting
  status, public event feed, final result once the game is `FINISHED`.
  Never touches `Player.role` or the `Vote` table.

See `docs/SECURITY.md` for exactly what's withheld from each and why.

## Idempotency

| Action | Second call | Mechanism |
|---|---|---|
| `startTask` | no-op success (returns existing row) if `IN_PROGRESS`; `CONFLICT` if `COMPLETED` | status check |
| `completeTask` | no-op success (returns existing row) if already `COMPLETED` | status check |
| `castVote` | `CONFLICT` | `@@unique([meetingId, voterId])` — even under a race, the DB constraint rejects it, not a check-then-insert |
| `startRound` | `CONFLICT` | round must be `SCHEDULED`; already-`ACTIVE` rejects |
| `callMeeting` | `CONFLICT` | one meeting per round; a second call while one exists rejects |
| `eliminatePlayer` | `CONFLICT` | player must be `ALIVE`; already-`ELIMINATED` rejects |
| `revealRole` | `CONFLICT` | must be `PENDING`; already-`REVEALED` rejects |
| `checkAutoAdvance` | no-op | only fires if no meeting exists yet for the round |

Task actions are true no-ops (second call succeeds harmlessly) because a
flaky connection retrying a "mark complete" tap shouldn't surface an
error to the player. Everything else that represents a one-time game
event (a vote, a round start, an elimination) rejects the duplicate
outright, because a second "success" there would be state corruption,
not a harmless retry.

## Transactions

Every multi-step mutation runs inside `prisma.$transaction`. Where one
action's write needs to compose with another (e.g. `revealResult`
eliminating a player *and* closing out the meeting), the inner logic
takes an already-open transaction client (`eliminatePlayerTx`) instead
of opening a second, separate transaction — see the note in
`src/lib/game/actions/eliminations.ts`. A rolled-back mutation never
produces a `GameEvent` or `AuditLog` row nobody's state agrees with,
because the event/audit writes happen inside the same transaction.

## Win conditions

Configured per-game in `GameConfig` (`engineerWinCondition`,
`imposterWinCondition`, `voteTiePolicy`) rather than hardcoded.
`RoundsEngine.finishGame` currently implements a straightforward,
explicit rule (not a generic rule engine — see "Known limitations" in
the final report): imposters all eliminated -> engineers win; imposters
outnumber-or-equal remaining engineers -> imposters win; otherwise, all
tasks completed -> engineers win; otherwise no decisive winner. The
result (`GameWinner`, reason, top scorer, runner-up, stats) is written
once to `GameResult` by the server — never computed client-side.
