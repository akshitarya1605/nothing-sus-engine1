# Security

## The browser is never authoritative

Every mutating route handler follows the same shape:

```ts
export async function POST(request: Request) {
  return handleRoute(async () => {
    const session = await requireX();           // WHO — from a verified session, never the body
    const input = await parseJsonBody(request, schema); // WHAT — zod-validated
    const result = await Engine.action(session.gameId, input); // re-derives/validates everything else
    return NextResponse.json(result);
  });
}
```

`playerId` and `role` are never read from a request body — they come
from `getSession()` (a verified, `httpOnly` JWT cookie; see
`src/lib/auth/session.ts`). `taskId`/`meetingId`/`targetPlayerId` *are*
client-supplied, but every action re-validates them against the actual
database rows (task belongs to this game and the player's current
round, target is alive and in this game, etc.) rather than trusting
them. See the "Never trust from the client" list in
`src/lib/game/validators.ts`'s file comment.

## Role privacy

- `getPlayerGameState` returns `ownRole` — the caller's own role — and
  nothing else with a `role` field. There is no route a `PLAYER`
  session can hit that returns another player's role.
- `getProjectorState` never touches `Player.role` at all; alive/
  eliminated counts come from `Player.status`, not from grouping by
  role. Verified structurally in
  `tests/integration/roles-and-privacy.test.ts` (asserts the serialized
  projector payload contains no `ENGINEER`/`IMPOSTER` string).
- `getAdminGameState` does include every player's role — that's the
  admin's job — gated behind `requireAdmin()`.
- Realtime: `YOUR_ROLE_ASSIGNED` and `ROLE_REVEAL_PENDING` are
  `PLAYER`/`ADMIN`-visibility events; only `ROLE_REVEALED` (fired once,
  by an explicit admin action, after `PLAYER_ELIMINATED` has already
  gone out separately) is `PUBLIC`. See `docs/REALTIME.md`.

## Vote privacy

- `castVote` never returns a tally, and no `PLAYER`-visibility route
  returns one either.
- `VOTE_CAST` (fired on every vote, to update a live "N of M voted"
  admin display) is `ADMIN`-visibility only, and its payload is just a
  count — not who voted or for whom.
- Individual `Vote` rows are never queried by a `PLAYER` session; the
  only route that touches `Vote` for a non-admin is `castVote` itself,
  which does a single `create` and returns `{ ok: true }`.
- Duplicate voting is prevented by a real unique constraint
  (`@@unique([meetingId, voterId])`), not a check-then-insert race —
  see `tests/integration/voting-and-elimination.test.ts`'s concurrent
  duplicate-vote test, which fires two requests at once and asserts
  both against the DB row count.

## RLS — and why this stack doesn't use it

The brief assumes Supabase-style Postgres RLS policies. This project is
Prisma + a plain Postgres connection (see `docs/REALTIME.md` for why),
which doesn't have a `auth.uid()`-equivalent session context inside the
database to write RLS policies against. Enforcement instead happens at
the query-construction layer: `src/lib/game/state.ts`'s three functions
are the *only* code path that builds a `Player`/`Vote`/`Task` query for
a given audience, and every route handler goes through one of them (or
through a narrow, single-purpose action) rather than exposing a general
"query the database" capability.

This is a real trade-off, not a wash: RLS enforces at the database
connection level regardless of application code correctness — a bug in
a new route can't accidentally bypass it. The query-layer approach here
means a new route that queries `prisma.player.findMany()` directly
*could* bypass the filtering by mistake. Mitigations in place: (1) the
data contracts in `state.ts` are the only sanctioned read path and this
is documented here and in `docs/GAME_ENGINE.md`; (2) the security tests
in `tests/integration/roles-and-privacy.test.ts` assert the actual
serialized output rather than just unit-testing the filter function, so
a future route that leaks data would need to also break these
assertions. If this moves to Supabase later, the RLS policies map
directly onto the same three-audience model already established here.

## What the security tests actually verify

`tests/integration/` runs against a real (local) Postgres, not mocks —
the goal is proving the unique constraints, transactions, and query
filters actually work, not that the TypeScript compiles:

- a player cannot vote twice, even racing two concurrent requests
  (`voting-and-elimination.test.ts`)
- an eliminated player cannot vote or perform task actions
  (`voting-and-elimination.test.ts`, `rounds-and-tasks.test.ts`)
- a task belonging to a different round than the player is currently in
  is rejected (`rounds-and-tasks.test.ts` — the brief's exact example)
- a player from a different game cannot be eliminated by another game's
  admin (`voting-and-elimination.test.ts`)
- a tie is never silently resolved — both tie policies are tested
  explicitly (`voting-and-elimination.test.ts`)
- role assignment produces exactly one role per player, exactly the
  configured imposter count, no duplicates
  (`roles-and-privacy.test.ts`)
- locked roles reject the normal reassignment path; only the explicit,
  reason-required recovery path can unlock them
  (`roles-and-privacy.test.ts`)
- the player/admin/projector payloads' actual JSON never contain a role
  they shouldn't (`roles-and-privacy.test.ts`)
- an invalid `GameStatus` transition is rejected before touching the
  database (`tests/unit/transitions.test.ts`)
- `publishEvent` refuses to construct a `PLAYER`-visibility event
  without a target, and refuses a target on anything else
  (`tests/unit/event-privacy.test.ts`)

Not yet covered by an automated test (manually verified via
`curl`/browser during QA instead — see the final report): the HTTP-layer
guards (`requireAdmin`/`requirePlayer` returning 401/403) end-to-end
through the Next.js route handlers, since that requires either a running
server or mocking `next/headers` — a reasonable follow-up, not skipped
out of an oversight.

## Known limitations

- **No per-admin accounts.** `ADMIN` and `PROJECTOR` sessions are
  granted by a single shared passphrase per role, from
  `ADMIN_PASSPHRASE`/`PROJECTOR_PASSPHRASE` (compared with
  `crypto.timingSafeEqual`, not `===`, to avoid a timing side-channel).
  There's no audit trail of *which* admin did something — `AuditLog.actorId`
  is literally the string `"admin"` for every admin-attributed action.
  For a real multi-admin event, this needs a real admin user table with
  individual credentials before launch. Everything downstream (audit
  log schema, session shape) already supports adding that without a
  redesign — `actorId` just becomes a real user id instead of a
  constant.
- **QR location verification is architecturally in place but not
  cryptographically hardened.** `Location.qrToken` is an opaque
  `cuid()`, not a guessable id, and `scanLocation` validates it
  server-side against the actual row — but it's a static token, not a
  signed/rotating one, so a photographed QR code is valid indefinitely
  until an admin deactivates that location. Fine for "prove you were
  near this room within a game," not fine as strong access control.
- **Imposter abilities are schema-only.** The `Ability`/`AbilityUse`
  tables exist with an `enabled` flag defaulting to `false` and no
  action module implements any of `SABOTAGE`/`ROOM_LOCK`/
  `TASK_DISRUPTION` — per the brief, these aren't built until the actual
  rules are finalized.
- **Win condition logic is a fixed rule, not a generic engine.**
  `finishGame` implements one explicit precedence (imposters eliminated
  -> engineers win; imposters >= engineers alive -> imposters win; else
  all tasks complete -> engineers win; else no decisive winner) reading
  from `GameConfig`'s win-condition strings, but doesn't yet interpret
  those strings as a pluggable rule set. Sufficient for the four
  described conditions; would need real work to support an admin adding
  a new condition without a code change.
- **`AuditLog.actorId` for votes is `null`** by design (votes are
  private — see above) but this means the audit log can't answer "did
  player X vote" even for the admin who ran the event; that's
  intentional (vote privacy), documented here so it isn't mistaken for
  a gap.
