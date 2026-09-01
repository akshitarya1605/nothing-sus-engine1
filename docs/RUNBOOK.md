# Nothing Sus — Event Runbook

Everything the host needs to run a night. Keep this open on your phone.

## Before the event

### 1. Deploy (one-time)

- **Supabase (hosted):** create a project. From the dashboard:
  - Settings → API: copy the **Project URL**, **anon key**, **JWT secret**.
  - Connect → **Transaction pooler**: copy the connection string (port 6543).
  - Connect → **Direct connection**: copy that string (port 5432).
- **Run migrations against hosted:**
  ```
  DIRECT_URL="<direct 5432 url>" npx prisma migrate deploy
  ```
  This creates the schema, the RLS policies, and adds `GameEvent` to the
  realtime publication.
- **Lock down the Data API:** Supabase dashboard → Settings → API → "Exposed
  schemas" — remove `public`. The app never uses PostgREST; this closes the
  one path where a spectator token could read a role column over REST.
- **Vercel:** import the repo (branch `milestone-2`). Set env vars:
  | var | value |
  |---|---|
  | `DATABASE_URL` | pooler url + `?pgbouncer=true&connection_limit=1` |
  | `DIRECT_URL` | direct 5432 url |
  | `NEXT_PUBLIC_SUPABASE_URL` | project URL |
  | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon key |
  | `SUPABASE_JWT_SECRET` | JWT secret (server-only!) |
  | `NEXT_PUBLIC_SITE_URL` | your Vercel/prod URL |
  | `AUTH_SECRET` | `openssl rand -base64 32` |
  | `CRON_SECRET` | `openssl rand -hex 32` |
- Deploy. The cron (`vercel.json`) that advances round timers registers
  automatically.

### 2. Create the game

Run the seed against the hosted DB (edit `prisma/seed.ts` first for real
player names, or add them in the control room):
```
DATABASE_URL="<pooler url>" npm run db:seed
```
It prints the **admin link**, **spectator link**, and player codes. The
admin/spectator links are the only way in — keep them private.

### 3. Set up players

- Control room → **Setup** tab → add players (or **bulk import**, one name
  per line).
- **Open printable code cards** → print → cut up → one card per player.
  Each card has a QR that deep-links to their filled-in login.
- Setup tab → **Roles**: set the imposter count → **Assign roles** →
  **Lock roles** → **Mark game ready**.
- Create tasks (Setup → Tasks) or seed them. Each task has a 4-digit code
  the player enters when they finish it in real life. "New OTP" regenerates.

### 4. The room

- Put the **spectator link** on the projector. Before the game starts it
  shows a big join QR and the URL.
- Hand out the code cards.

## Running the night (Control room → Run tab)

| To do this | Do |
|---|---|
| Start a round | **Start round N** |
| End a round early | **End round** |
| Pause everything (break, problem) | **Pause game** → **Resume game** |
| Call a discussion | **Call a meeting** |
| Open voting | **Open voting** (players vote on their phones) |
| Close voting | **Close voting** |
| Apply the vote result | **Confirm result** (eliminates who the vote hit) |
| Reveal an eliminated player's role on the projector | **Role reveal** — paste the elimination id from the audit log |
| Broadcast a message to everyone | **Announcement** |
| End the game | **Finish game** (computes the winner, no undo) |

The **Monitor** tab shows every player's role/status, task completion, and
the audit log live.

## Recovering from problems

| Problem | Fix |
|---|---|
| A player's phone died / they got a new one | Setup tab → that player → **reset code**, give them the new one. Or **force logout** then they re-use the same code. |
| "Code already active on another device" | The player is logged in elsewhere. **force logout** them, or **reset code**. |
| A player's screen is stuck / blank | They refresh. State always re-syncs from the server; nothing is lost. |
| Realtime says "reconnecting" for a while | Usually venue WiFi. The app keeps polling and catches up; a refresh forces it. |
| Round timer looks frozen on the projector | The per-minute cron advances it; worst case, use **End round** / **Start round** manually. |
| You fumbled a role assignment before lock | Setup → re-assign (only works before **Lock roles**). After lock, there's a "recovery unlock" — it's logged. |
| The whole app is unreachable | Check the Vercel deployment and the Supabase project status pages. The game state is all in Postgres — redeploying loses nothing. |

## What players see

- **/** — the landing page (marketing).
- **/play** or their QR — the login. One code, one device.
- After login: lobby → hold-to-reveal role → round view (timer, their tasks,
  a 4-digit code box per task, an emergency-meeting button) → meeting view
  (tap a player to vote, discussion chat) → ghost view if eliminated.
