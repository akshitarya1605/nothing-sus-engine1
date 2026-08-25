import { z } from "zod";

/**
 * Every route handler parses its body through one of these before it
 * touches the engine. Note what's conspicuously absent from most of
 * them: playerId, role, score, and completion status are never accepted
 * from the client — those come from the session or are computed
 * server-side. See docs/SECURITY.md "Never trust from the client".
 */

export const joinGameSchema = z.object({
  playerCode: z.string().min(1).max(64),
});

export const startTaskSchema = z.object({
  taskId: z.string().min(1),
});

export const completeTaskSchema = z.object({
  taskId: z.string().min(1),
  verificationData: z.unknown().optional(),
});

export const scanLocationSchema = z.object({
  qrToken: z.string().min(1),
});

export const callMeetingSchema = z.object({
  reason: z.string().max(280).optional(),
  emergency: z.boolean().optional().default(false),
});

export const castVoteSchema = z.object({
  meetingId: z.string().min(1),
  /** null/omitted = explicit skip vote */
  targetPlayerId: z.string().min(1).nullable().optional(),
});

export const eliminatePlayerSchema = z.object({
  playerId: z.string().min(1),
  meetingId: z.string().min(1).optional(),
});

export const revealRoleSchema = z.object({
  eliminationId: z.string().min(1),
});

export const configureRolesSchema = z.object({
  imposterCount: z.number().int().min(0),
});

export const createPlayerSchema = z.object({
  displayName: z.string().min(1).max(64),
  email: z.string().email().optional(),
  team: z.string().max(64).optional(),
});

export const updateGameConfigSchema = z.object({
  totalRounds: z.number().int().min(1).max(20).optional(),
  meetingAfterMinutes: z.number().int().min(1).max(180).optional(),
  allowEmergencyMeeting: z.boolean().optional(),
  revealRoleAfterVote: z.boolean().optional(),
  allowImposterElimination: z.boolean().optional(),
  engineerWinCondition: z.enum(["ENGINEERS_COMPLETE_TASKS", "FINAL_ROUND_RESULT"]).optional(),
  imposterWinCondition: z.enum(["IMPOSTERS_REMAIN", "FINAL_ROUND_RESULT"]).optional(),
  voteTiePolicy: z.enum(["NO_ELIMINATION", "ADMIN_RESOLVES"]).optional(),
});

export const adminLoginSchema = z.object({
  gameId: z.string().min(1),
  passphrase: z.string().min(1),
  role: z.enum(["ADMIN", "PROJECTOR"]),
});
