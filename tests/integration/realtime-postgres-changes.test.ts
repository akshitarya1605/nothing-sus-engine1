import { describe, it, expect, afterEach, beforeAll } from "vitest";
import { createClient, type RealtimeChannel, type SupabaseClient } from "@supabase/supabase-js";
import { prisma } from "@/lib/db/prisma";
import { mintRealtimeToken } from "@/lib/realtime/token";
import type { AnySession } from "@/lib/auth/session";
import * as ParticipantsEngine from "@/lib/game/actions/participants";
import * as RoundsEngine from "@/lib/game/actions/rounds";
import { createTestGame, cleanupTestGame } from "./helpers";

/**
 * The authoritative regression test for the 5-audience event model working
 * *over the wire* on Supabase Realtime "Postgres Changes" — complements
 * tests/unit/event-privacy.test.ts (payload shape only) and
 * tests/integration/rls-backstop.test.ts (the same RLS policy exercised
 * through a Prisma transaction rather than a websocket).
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

interface Received {
  type: string;
  targetParticipantId: string | null;
  gameId: string;
}

const settle = (ms = 2500) => new Promise((r) => setTimeout(r, ms));

/** Opens an audience-scoped Realtime subscription on "GameEvent" and
 * collects the inserts RLS lets through. */
async function openFeed(session: AnySession, gameId: string) {
  const { token } = await mintRealtimeToken(session);
  const client: SupabaseClient = createClient(SUPABASE_URL, ANON_KEY, {
    realtime: { params: { eventsPerSecond: 20 } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  await client.realtime.setAuth(token);

  const received: Received[] = [];
  const channel: RealtimeChannel = client.channel(`test-${session.kind}-${Math.random()}`, {
    config: { private: false },
  });

  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${session.kind} channel never subscribed`)), 10_000);
    channel
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "GameEvent", filter: `gameId=eq.${gameId}` },
        (payload) => {
          const row = payload.new as Record<string, unknown>;
          received.push({
            type: row.type as string,
            targetParticipantId: (row.targetParticipantId as string | null) ?? null,
            gameId: row.gameId as string,
          });
        },
      )
      .subscribe((status, err) => {
        if (status === "SUBSCRIBED") {
          clearTimeout(timer);
          resolve();
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          clearTimeout(timer);
          reject(err ?? new Error(`channel status ${status}`));
        }
      });
  });

  // The CDC poller needs a beat after SUBSCRIBED before it reliably
  // includes this subscription's filter in the replication stream;
  // inserts in that window are missed.
  await settle(1500);

  return {
    received,
    async close() {
      await client.removeChannel(channel);
      await client.realtime.disconnect();
    },
  };
}

let cleanupIds: string[] = [];
let feedClosers: Array<() => Promise<void>> = [];

beforeAll(() => {
  if (!SUPABASE_URL || !ANON_KEY) {
    throw new Error("SUPABASE_URL / SUPABASE_ANON_KEY must be set — is `npx supabase start` running?");
  }
});

afterEach(async () => {
  await Promise.all(feedClosers.map((c) => c().catch(() => {})));
  feedClosers = [];
  await Promise.all(cleanupIds.map(cleanupTestGame));
  cleanupIds = [];
});

describe("Supabase Realtime — Postgres Changes on GameEvent", () => {
  it("delivers PUBLIC events to every audience and PARTICIPANT events only to their target", async () => {
    const { game, participants } = await createTestGame(3);
    cleanupIds.push(game.id);
    const [alice, bob] = participants;

    const aliceFeed = await openFeed({ kind: "PARTICIPANT", gameId: game.id, participantId: alice.id }, game.id);
    const bobFeed = await openFeed({ kind: "PARTICIPANT", gameId: game.id, participantId: bob.id }, game.id);
    const spectatorFeed = await openFeed({ kind: "SPECTATOR", gameId: game.id }, game.id);
    feedClosers.push(aliceFeed.close, bobFeed.close, spectatorFeed.close);

    // drives YOUR_ROLE_ASSIGNED (PARTICIPANT, one per participant) then
    // GAME_STARTED + ROUND_STARTED (PUBLIC)
    await ParticipantsEngine.assignRoles(game.id, 1, prisma);
    await ParticipantsEngine.lockRoles(game.id, prisma);
    await RoundsEngine.markGameReady(game.id, prisma);
    await RoundsEngine.startRound(game.id, 1, prisma);

    await settle(4000);

    // PUBLIC reaches everyone
    for (const feed of [aliceFeed, bobFeed, spectatorFeed]) {
      expect(feed.received.map((r) => r.type)).toContain("ROUND_STARTED");
    }

    // Alice sees exactly her own YOUR_ROLE_ASSIGNED
    const aliceRoleEvents = aliceFeed.received.filter((r) => r.type === "YOUR_ROLE_ASSIGNED");
    expect(aliceRoleEvents).toHaveLength(1);
    expect(aliceRoleEvents[0].targetParticipantId).toBe(alice.id);

    // Bob never sees Alice's; spectator sees no participant-targeted event at all
    expect(bobFeed.received.some((r) => r.targetParticipantId === alice.id)).toBe(false);
    expect(spectatorFeed.received.some((r) => r.type === "YOUR_ROLE_ASSIGNED")).toBe(false);
  }, 45_000);

  it("does not leak events across games", async () => {
    const mine = await createTestGame(2);
    const other = await createTestGame(2);
    cleanupIds.push(mine.game.id, other.game.id);

    const feed = await openFeed(
      { kind: "PARTICIPANT", gameId: mine.game.id, participantId: mine.participants[0].id },
      mine.game.id,
    );
    feedClosers.push(feed.close);

    await ParticipantsEngine.assignRoles(other.game.id, 1, prisma);
    await ParticipantsEngine.lockRoles(other.game.id, prisma);
    await RoundsEngine.markGameReady(other.game.id, prisma);
    await RoundsEngine.startRound(other.game.id, 1, prisma);

    await settle(4000);
    expect(feed.received).toHaveLength(0);
  }, 45_000);
});
