import { Client } from "pg";

/**
 * A single dedicated Postgres connection that LISTENs on the
 * `game_events` channel and fans NOTIFYs out to in-process subscribers.
 *
 * This is a wakeup bus, not a data channel: the notification payload is
 * just a gameId, and each subscriber re-queries GameEvent for anything
 * newer than its own cursor (see app/api/realtime/route.ts). That means
 * a dropped notification is harmless — the next one still triggers a
 * catch-up query, and a client that missed the gap entirely can always
 * reconnect and replay by sequence number.
 *
 * Known limitation: this requires a long-lived Node process (works under
 * `next dev` and under `next start` on a persistent host). Classic
 * stateless Vercel serverless functions cannot hold a LISTEN connection
 * or an in-memory subscriber map across invocations — see
 * docs/REALTIME.md for the production deployment note and the swap-in
 * path to a hosted pub/sub (Pusher/Ably) if that's the target.
 */

type Subscriber = (gameId: string) => void;

declare global {
  var __gameEventListener: GameEventListener | undefined;
}

class GameEventListener {
  private client: Client | null = null;
  private connecting: Promise<void> | null = null;
  private subscribers = new Set<Subscriber>();

  private async ensureConnected(): Promise<void> {
    if (this.client) return;
    if (this.connecting) return this.connecting;

    this.connecting = (async () => {
      const connectionString = process.env.DATABASE_URL;
      if (!connectionString) throw new Error("DATABASE_URL is not set");

      const client = new Client({ connectionString });
      await client.connect();
      await client.query("LISTEN game_events");

      client.on("notification", (msg) => {
        if (msg.channel !== "game_events" || !msg.payload) return;
        for (const sub of this.subscribers) sub(msg.payload);
      });

      client.on("error", (err) => {
        console.error("[realtime] listener connection error", err);
        this.client = null;
        this.connecting = null;
      });

      this.client = client;
    })();

    return this.connecting;
  }

  /** Registers a callback invoked with `gameId` whenever that game has
   * new events. Returns an unsubscribe function. Connects lazily on the
   * first subscriber so importing this module never opens a DB
   * connection by itself (safe during build/typecheck). */
  subscribe(callback: Subscriber): () => void {
    void this.ensureConnected();
    this.subscribers.add(callback);
    return () => {
      this.subscribers.delete(callback);
    };
  }
}

export function getGameEventListener(): GameEventListener {
  if (!globalThis.__gameEventListener) {
    globalThis.__gameEventListener = new GameEventListener();
  }
  return globalThis.__gameEventListener;
}
