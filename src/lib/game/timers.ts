import type { Round } from "@prisma/client";

/**
 * Every timer in this file is derived from stored timestamps compared
 * against `now` — never from a client-reported "time left" value, and
 * never from setTimeout/setInterval as a source of truth. A client that
 * refreshes mid-round just recomputes the same numbers from the same
 * rows; nothing about game state depends on a browser tab staying open.
 */

export interface RoundTiming {
  /** ms remaining in the round itself, clamped to 0. Null if the round
   * hasn't started yet (no startedAt) or has already ended. */
  roundMsRemaining: number | null;
  /** wall-clock time the automatic meeting phase should begin. */
  meetingDueAt: Date | null;
  /** true once `now` has passed meetingDueAt and the meeting hasn't
   * started yet — the engine's tick/transition check uses this. */
  meetingIsDue: boolean;
}

export function computeRoundTiming(
  round: Pick<Round, "startedAt" | "endedAt" | "durationMinutes" | "meetingAfterMinutes">,
  meetingAfterMinutesFallback: number,
  now: Date = new Date(),
): RoundTiming {
  if (!round.startedAt || round.endedAt) {
    return { roundMsRemaining: null, meetingDueAt: null, meetingIsDue: false };
  }

  const startedAtMs = round.startedAt.getTime();
  const nowMs = now.getTime();

  const roundEndMs = startedAtMs + round.durationMinutes * 60_000;
  const roundMsRemaining = Math.max(0, roundEndMs - nowMs);

  const meetingAfterMinutes = round.meetingAfterMinutes ?? meetingAfterMinutesFallback;
  const meetingDueAt = new Date(startedAtMs + meetingAfterMinutes * 60_000);
  const meetingIsDue = nowMs >= meetingDueAt.getTime();

  return { roundMsRemaining, meetingDueAt, meetingIsDue };
}

export interface VotingTiming {
  /** null when no explicit voting window is enforced (voting stays open
   * until admin closes it, or until everyone alive has voted). */
  votingMsRemaining: number | null;
}

export function computeVotingTiming(
  votingStartedAt: Date | null,
  votingWindowSeconds: number | null,
  now: Date = new Date(),
): VotingTiming {
  if (!votingStartedAt || votingWindowSeconds === null) {
    return { votingMsRemaining: null };
  }
  const endMs = votingStartedAt.getTime() + votingWindowSeconds * 1000;
  return { votingMsRemaining: Math.max(0, endMs - now.getTime()) };
}
