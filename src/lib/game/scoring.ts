import type { Prisma, PrismaClient } from "@prisma/client";
import { ParticipantTaskStatus } from "@prisma/client";

/** Accepts either the top-level client or an active transaction client
 * — both expose the same `.participantTask` query methods used here. */
type Queryable = PrismaClient | Prisma.TransactionClient;

/**
 * Task progress — ONE definition, used by every caller (admin dashboard,
 * projector, participant view). Nothing else in the codebase should compute
 * a percentage independently.
 *
 * Global progress = completed ParticipantTask instances
 *                    ÷
 *                    ParticipantTask instances that are AVAILABLE, IN_PROGRESS,
 *                    or COMPLETED (i.e. everything that has been unlocked
 *                    for at least one participant — LOCKED instances aren't in
 *                    play yet and don't belong in either side of the
 *                    ratio).
 *
 * Participant progress uses the same rule, scoped to that participant's own
 * ParticipantTask rows.
 */

const IN_PLAY_STATUSES = [
  ParticipantTaskStatus.AVAILABLE,
  ParticipantTaskStatus.IN_PROGRESS,
  ParticipantTaskStatus.COMPLETED,
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
  // sequential, not Promise.all — this can run on a transaction client
  // (state.ts under withAudienceContext) where concurrent queries are unsafe
  const completed = await prisma.participantTask.count({
    where: { status: ParticipantTaskStatus.COMPLETED, task: { gameId } },
  });
  const inPlay = await prisma.participantTask.count({
    where: { status: { in: [...IN_PLAY_STATUSES] }, task: { gameId } },
  });
  return toProgress(completed, inPlay);
}

export async function computeParticipantTaskProgress(
  prisma: Queryable,
  participantId: string,
): Promise<TaskProgress> {
  const completed = await prisma.participantTask.count({
    where: { participantId, status: ParticipantTaskStatus.COMPLETED },
  });
  const inPlay = await prisma.participantTask.count({
    where: { participantId, status: { in: [...IN_PLAY_STATUSES] } },
  });
  return toProgress(completed, inPlay);
}
