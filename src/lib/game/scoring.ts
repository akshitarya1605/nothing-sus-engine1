import type { Prisma, PrismaClient } from "@prisma/client";
import { PlayerTaskStatus } from "@prisma/client";

/** Accepts either the top-level client or an active transaction client
 * — both expose the same `.playerTask` query methods used here. */
type Queryable = PrismaClient | Prisma.TransactionClient;

/**
 * Task progress — ONE definition, used by every caller (admin dashboard,
 * projector, player view). Nothing else in the codebase should compute
 * a percentage independently.
 *
 * Global progress = completed PlayerTask instances
 *                    ÷
 *                    PlayerTask instances that are AVAILABLE, IN_PROGRESS,
 *                    or COMPLETED (i.e. everything that has been unlocked
 *                    for at least one player — LOCKED instances aren't in
 *                    play yet and don't belong in either side of the
 *                    ratio).
 *
 * Player progress uses the same rule, scoped to that player's own
 * PlayerTask rows.
 */

const IN_PLAY_STATUSES = [
  PlayerTaskStatus.AVAILABLE,
  PlayerTaskStatus.IN_PROGRESS,
  PlayerTaskStatus.COMPLETED,
] as const;

export interface TaskProgress {
  completed: number;
  inPlay: number;
  percentage: number;
}

function toProgress(completed: number, inPlay: number): TaskProgress {
  return {
    completed,
    inPlay,
    percentage: inPlay === 0 ? 0 : Math.round((completed / inPlay) * 1000) / 10,
  };
}

export async function computeGlobalTaskProgress(
  prisma: Queryable,
  gameId: string,
): Promise<TaskProgress> {
  const [completed, inPlay] = await Promise.all([
    prisma.playerTask.count({
      where: { status: PlayerTaskStatus.COMPLETED, task: { gameId } },
    }),
    prisma.playerTask.count({
      where: { status: { in: [...IN_PLAY_STATUSES] }, task: { gameId } },
    }),
  ]);
  return toProgress(completed, inPlay);
}

export async function computePlayerTaskProgress(
  prisma: Queryable,
  playerId: string,
): Promise<TaskProgress> {
  const [completed, inPlay] = await Promise.all([
    prisma.playerTask.count({
      where: { playerId, status: PlayerTaskStatus.COMPLETED },
    }),
    prisma.playerTask.count({
      where: { playerId, status: { in: [...IN_PLAY_STATUSES] } },
    }),
  ]);
  return toProgress(completed, inPlay);
}
