import { describe, it, expect, afterEach } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { withAudienceContext } from "@/lib/db/rlsContext";
import type { AnySession } from "@/lib/auth/session";
import * as ParticipantsEngine from "@/lib/game/actions/participants";
import * as RoundsEngine from "@/lib/game/actions/rounds";
import { getAdminGameState, getParticipantGameState, getProjectorState } from "@/lib/game/state";
import { createTestGame, cleanupTestGame } from "./helpers";

/**
 * The RLS backstop (Milestone 1, step 2). The TypeScript contracts in
 * src/lib/game/state.ts are the primary privacy filter; this proves the
 * DB-level policy on "GameEvent" actually denies something real when a
 * read runs under the downgraded `authenticated` role.
 */

let cleanupIds: string[] = [];
afterEach(async () => {
  await Promise.all(cleanupIds.map(cleanupTestGame));
  cleanupIds = [];
});

function participantSession(gameId: string, participantId: string): AnySession {
  return { kind: "PARTICIPANT", gameId, participantId };
}
const adminSession = (gameId: string): AnySession => ({ kind: "ADMIN", gameId });
const spectatorSession = (gameId: string): AnySession => ({ kind: "SPECTATOR", gameId });

describe("GameEvent RLS backstop", () => {
  it("a PARTICIPANT-targeted event is invisible to a different participant under RLS", async () => {
    const { game, participants } = await createTestGame(3);
    cleanupIds.push(game.id);
    const [alice, bob] = participants;

    const secret = await prisma.gameEvent.create({
      data: {
        gameId: game.id,
        type: "YOUR_ROLE_ASSIGNED",
        visibility: "PARTICIPANT",
        targetParticipantId: alice.id,
        payload: { role: "IMPOSTER" },
      },
    });
    const publicEvt = await prisma.gameEvent.create({
      data: { gameId: game.id, type: "GAME_STARTED", visibility: "PUBLIC", payload: { gameId: game.id } },
    });

    const bobRows = await withAudienceContext(participantSession(game.id, bob.id), (tx) =>
      tx.gameEvent.findMany({ where: { gameId: game.id } }),
    );
    const bobIds = bobRows.map((r) => r.id);
    expect(bobIds).toContain(publicEvt.id); // public still flows
    expect(bobIds).not.toContain(secret.id); // the backstop backstops

    const aliceRows = await withAudienceContext(participantSession(game.id, alice.id), (tx) =>
      tx.gameEvent.findMany({ where: { gameId: game.id } }),
    );
    expect(aliceRows.map((r) => r.id)).toEqual(expect.arrayContaining([publicEvt.id, secret.id]));
  });

  it("events from another game are invisible even to a matching session kind", async () => {
    const a = await createTestGame(2);
    const b = await createTestGame(2);
    cleanupIds.push(a.game.id, b.game.id);

    await prisma.gameEvent.create({
      data: { gameId: b.game.id, type: "GAME_STARTED", visibility: "PUBLIC", payload: { gameId: b.game.id } },
    });

    const rows = await withAudienceContext(participantSession(a.game.id, a.participants[0].id), (tx) =>
      tx.gameEvent.findMany({ where: { gameId: b.game.id } }),
    );
    expect(rows).toHaveLength(0);
  });

  it("under a participant context, the roster query cannot see other participants", async () => {
    const { game, participants } = await createTestGame(4);
    cleanupIds.push(game.id);
    await ParticipantsEngine.assignRoles(game.id, 1, prisma);

    const rows = await withAudienceContext(participantSession(game.id, participants[0].id), (tx) =>
      tx.participant.findMany({ where: { gameId: game.id } }),
    );
    // exactly the caller — this is the "prisma.participant.findMany() in an
    // unsanctioned route" failure mode docs/SECURITY.md names.
    expect(rows.map((r) => r.id)).toEqual([participants[0].id]);
  });

  it("the three state contracts still return complete data through withAudienceContext", async () => {
    const { game, participants } = await createTestGame(4);
    cleanupIds.push(game.id);
    await ParticipantsEngine.assignRoles(game.id, 1, prisma);
    await ParticipantsEngine.lockRoles(game.id, prisma);
    await RoundsEngine.markGameReady(game.id, prisma);
    await RoundsEngine.startRound(game.id, 1, prisma);

    const admin = await withAudienceContext(adminSession(game.id), (tx) => getAdminGameState(tx, game.id));
    expect(admin.participants).toHaveLength(4);
    expect(admin.participants.every((p) => p.role !== null)).toBe(true);

    const projector = await withAudienceContext(spectatorSession(game.id), (tx) =>
      getProjectorState(tx, game.id),
    );
    expect(projector.aliveCount).toBe(4);

    const self = await withAudienceContext(participantSession(game.id, participants[0].id), (tx) =>
      getParticipantGameState(tx, participants[0].id),
    );
    expect(self.identity.id).toBe(participants[0].id);
    expect(self.ownRole).not.toBeNull();
  });
});
