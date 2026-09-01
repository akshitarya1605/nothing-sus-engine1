import { prisma } from "@/lib/db/prisma";
import * as ParticipantsEngine from "@/lib/game/actions/participants";
import { generateSecret } from "@/lib/auth/tokens";

/** Creates a minimal real game (with config + one round + N participants) in
 * the actual test database. Integration tests exercise the engine
 * against real Postgres, not mocks — the whole point is proving
 * transactions, unique constraints, and query-level filtering actually
 * work, not just that the TypeScript compiles. */
export async function createTestGame(participantCount = 6) {
  const game = await prisma.game.create({
    data: {
      name: `test-game-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      adminSecret: generateSecret(),
      spectatorSecret: generateSecret(),
      config: { create: {} },
    },
  });

  const round1 = await prisma.round.create({
    data: {
      gameId: game.id,
      number: 1,
      name: "Round 1",
      scheduledStartAt: new Date(),
      durationMinutes: 120,
    },
  });

  const participants = [];
  for (let i = 0; i < participantCount; i++) {
    participants.push(await ParticipantsEngine.createParticipant(game.id, { name: `Participant ${i}` }, prisma));
  }

  return { game, round1, participants };
}

export async function cleanupTestGame(gameId: string) {
  await prisma.game.delete({ where: { id: gameId } }).catch(() => {
    // already cleaned up
  });
}
