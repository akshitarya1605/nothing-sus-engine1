# Game State Machine

`Game.status` is the top-level authoritative state. The only place that
knows which transitions are legal is `src/lib/game/transitions.ts` —
every action in `src/lib/game/actions/*` calls `assertValidTransition`
before doing anything else, so an illegal move (e.g. jumping straight
from `LIVE` to `VOTING`) is rejected before any row is touched.

```
   SETUP
     |
     v
   READY
     |
     v
   LIVE  <----------------------+
     |                          |
     v                          |
  MEETING <---------------------+
     |                          |
     v                          |
  VOTING  <---------------------+  (PAUSED resumes into
     |                          |   whichever of these four
     v                          |   statuses it was paused from)
  REVEAL  <---------------------+
     |
     v
ROUND_COMPLETE ----(more rounds)----> LIVE (next round)
     |
  (final round)
     v
  FINISHED
```

`PAUSED` is reachable from every one of `LIVE / MEETING / VOTING /
REVEAL` and resumes back into exactly the status it was paused from
(`Game.pausedFromStatus`) — it is not a hub you can pause-then-jump
elsewhere from. `FINISHED` is terminal.

## Round-scoped phase

`Game.currentPhase` (`ROUND | MEETING | VOTING | REVEAL`) mirrors the
meeting lifecycle within a round, kept in sync with `status` by the same
action that changes `status`. `Round.status` (`SCHEDULED | ACTIVE |
MEETING | VOTING | REVEAL | COMPLETE`) tracks the individual round row.

## Contextual guards on top of the graph

The graph in `transitions.ts` only enforces the *shape* of a move. Each
action additionally checks the specific precondition for that edge:

| Edge | Action | Guard |
|---|---|---|
| `SETUP -> READY` | `markGameReady` | roles locked, at least one round exists |
| `READY -> LIVE` | `startRound(1)` | round 1 exists and is `SCHEDULED` |
| `LIVE -> MEETING` | `callMeeting` | no meeting already exists for the current round (idempotency) |
| `MEETING -> VOTING` | `startVoting` | meeting is `ACTIVE` |
| `VOTING -> REVEAL` | `closeVoting` | meeting is `VOTING` |
| `REVEAL -> ROUND_COMPLETE` | `completeRound` | (admin-triggered once satisfied with reveals) |
| `ROUND_COMPLETE -> LIVE` | `startRound(n+1)` | `n+1` is the immediate next round |
| `ROUND_COMPLETE -> FINISHED` | `finishGame` | computes and stores `GameResult` |
| `* -> PAUSED` | `pauseGame` | any in-play status |
| `PAUSED -> *` | `resumeGame` | must equal `pausedFromStatus` |

## Voting -> elimination -> role reveal is three separate admin steps

This is intentionally not one action:

1. **`closeVoting`** — locks the ballot. Tally is *not* computed yet;
   nothing is announced.
2. **`revealResult`** — tallies the closed ballot, applies the
   configured tie policy (`NO_ELIMINATION` or `ADMIN_RESOLVES`), and —
   only if there's a clear plurality — eliminates that player
   (`PLAYER_ELIMINATED`, public) and marks their role
   `ROLE_REVEAL_PENDING` (admin-only). A tie under `ADMIN_RESOLVES`
   stops here and returns `TIE_NEEDS_ADMIN` — nothing is silently
   decided; the admin calls `resolveTie` next.
3. **`revealRole`** — a separate, later admin action that publishes
   `ROLE_REVEALED` (public, carries the actual role). Nothing reveals a
   role automatically.

See `src/lib/game/actions/voting.ts` and `eliminations.ts`.

## The automatic meeting rule, without a browser timer

`checkAutoAdvance(gameId)` (`src/lib/game/actions/rounds.ts`) is a pure
function of stored timestamps vs. `now`: if the game is `LIVE` and more
than `Round.meetingAfterMinutes ?? GameConfig.meetingAfterMinutes` has
elapsed since `Round.startedAt`, and no meeting exists yet for that
round, it calls `callMeeting` with `type: AUTOMATIC`.

It is called at the top of **every** `GET /api/game/state` request (see
`app/api/game/state/route.ts`), for every client (player, admin,
projector). There is no `setTimeout`/`setInterval` anywhere driving this
— whichever client happens to poll first after the deadline passes is
what advances the state, and every other client sees the result on its
next read. A refresh, at any point, in any client, recomputes from the
same rows and lands on the same answer.

## Idempotency guards, not silent no-ops disguised as errors

Every action that could plausibly be double-submitted (double-tap on a
slow connection, a retried request) is guarded so the *second* call is
rejected with a clear `CONFLICT`/`INVALID_TRANSITION` rather than
corrupting state — see `docs/GAME_ENGINE.md` "Idempotency" for the full
list and which ones are true no-ops (task start/complete) vs. rejected
duplicates (round start, vote, elimination).
