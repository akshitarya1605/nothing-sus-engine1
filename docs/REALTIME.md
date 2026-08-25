# Realtime

## Why Postgres LISTEN/NOTIFY + SSE, not Supabase Realtime

The brief's default assumption is Supabase. This repo isn't on Supabase
— it's Next.js + Prisma + plain Postgres, and no real hosting account of
any kind (Supabase, Pusher, Ably, Vercel) exists for this project yet
(see the "Known limitations" section of the final report for why that
call was made). Rather than fabricate credentials or leave realtime
unimplemented, the engine uses a pattern that needs nothing beyond the
Postgres connection it already has: `LISTEN/NOTIFY` for server-side
wakeups, fanned out to clients over Server-Sent Events.

## How it works

```
 mutation (e.g. completeTask)
        |
        v
 prisma.$transaction(tx => {
   ...write rows...
   publishEvent(tx, {...})   <-- src/lib/game/events/publisher.ts
     - tx.gameEvent.create(...)                 (the durable record)
     - tx.$executeRaw`SELECT pg_notify(...)`     (the wakeup signal)
 })
        |
        v  (Postgres holds delivery until COMMIT — a rolled-back
        |   transaction never notifies anyone)
        v
 GameEventListener (src/lib/realtime/listener.ts)
   a single dedicated pg.Client with `LISTEN game_events`,
   fans the notification out to in-process subscribers
        |
        v
 GET /api/realtime (src/app/api/realtime/route.ts)
   one open SSE connection per client, subscribed by gameId;
   on wakeup, re-queries GameEvent for anything newer than its
   cursor, filtered to what this session's role/playerId may see,
   and streams each row as an SSE `data:` line
```

**The NOTIFY payload is just a `gameId`, never event data.** Postgres's
`NOTIFY` payload is capped at ~8000 bytes and this design doesn't want
to reason about which payloads might approach that; more importantly,
putting nothing but an opaque wakeup signal on the bus means there's
nothing to leak even if the channel design changes later. The actual
event content only ever leaves the database through a query the SSE
route already applies its permission filter to.

## Recovery, not "trust the stream"

- Every `GameEvent` has a monotonic `sequenceNumber` (`BigInt
  @default(autoincrement())`).
- A client connects (or reconnects) with `?since=<lastSeenSequence>`
  and the route immediately queries+streams anything newer before
  waiting for the next `NOTIFY` — a client that was disconnected for
  five minutes doesn't miss anything.
- If the SSE connection itself drops (network blip, tab backgrounded),
  the client reconnects with its last-seen cursor and catches up the
  same way.
- Realtime is **only** a delivery optimization. `GET /api/game/state`
  (the permission-filtered snapshot — see `docs/GAME_ENGINE.md`) is the
  actual source of truth and is safe to call on its own at any time;
  every player/admin/projector page calls it once on mount and again
  whenever an SSE message arrives, rather than trying to reconstruct
  state purely from the event stream.

## Permission filtering

The SSE route reads the verified session (`getSession()`), then applies
exactly the same visibility rule the whole system uses
(`EventVisibility`: `PUBLIC` / `ADMIN` / `PROJECTOR` / `PLAYER`):

- `PLAYER` sessions only ever receive `PUBLIC` events and `PLAYER`
  events where `targetPlayerId` matches their own id.
- `PROJECTOR` sessions receive `PUBLIC` and `PROJECTOR`.
- `ADMIN` sessions receive `PUBLIC`, `ADMIN`, and `PROJECTOR`.

There is one stream implementation and one filter; a player cannot
subscribe to "the admin channel" because there isn't a separate
connection to subscribe to — the same endpoint enforces the boundary
per-request from the session, not from a client-chosen channel name.

## Known limitation: this needs a long-lived process

`GameEventListener` holds one persistent `pg.Client` with an open
`LISTEN` and an in-memory `Set` of subscriber callbacks. That works
under `next dev` and under `next start` on any host that keeps the Node
process alive (a VM, a container, Railway/Fly/Render, etc.).

It does **not** work on classic stateless Vercel serverless functions —
each invocation is a fresh, isolated process with no shared memory and
no guarantee of staying alive between requests, so there's nothing to
`LISTEN` from or fan out to across invocations.

If "host it on Vercel" ends up meaning classic serverless functions
(rather than a Vercel deployment target that keeps a process alive),
the fix is contained to two files:

1. Swap `src/lib/realtime/listener.ts` for a hosted pub/sub client
   (Pusher, Ably, or Supabase Realtime used purely as a message bus).
2. `src/lib/game/events/publisher.ts` calls `channel.trigger(...)`
   instead of `pg_notify`; `src/app/api/realtime/route.ts`'s query-based
   catch-up logic (the `flush()` function) doesn't change at all, since
   it already treats the notification as "go check the database," not
   as the payload itself.

Nothing about the game engine, the permission model, or the event log
needs to change either way — this is purely a transport swap.
