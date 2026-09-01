import { z } from "zod";

/**
 * Every route handler parses its body through one of these before it
 * touches the engine. Note what's conspicuously absent from most of
 * them: participantId, role, score, completion status, and OTPs-to-
 * compare-against are never accepted from the client — those come from
 * the session or are computed server-side. See docs/SECURITY.md "Never
 * trust from the client".
 */

export const participantLoginSchema = z.object({
  code: z.string().min(1).max(64),
});

export const startTaskSchema = z.object({
  taskId: z.string().min(1),
});

export const submitOtpSchema = z.object({
  taskId: z.string().min(1),
  otp: z.string().regex(/^\d{4}$/, "OTP must be 4 digits"),
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
  targetParticipantId: z.string().min(1).nullable().optional(),
});

export const eliminateParticipantSchema = z.object({
  participantId: z.string().min(1),
  meetingId: z.string().min(1).optional(),
});

export const revealRoleSchema = z.object({
  eliminationId: z.string().min(1),
});

export const disqualifyParticipantSchema = z.object({
  participantId: z.string().min(1),
  reason: z.string().max(280).optional(),
});

export const declareWinnerSchema = z.object({
  winner: z.enum(["ENGINEERS", "IMPOSTERS", "NONE"]),
  reason: z.string().max(280).optional(),
  championParticipantId: z.string().min(1).nullable().optional(),
});

export const configureRolesSchema = z.object({
  imposterCount: z.number().int().min(0),
});

export const setParticipantRoleSchema = z.object({
  participantId: z.string().min(1),
  role: z.enum(["ENGINEER", "IMPOSTER"]),
});

export const createParticipantSchema = z.object({
  name: z.string().min(1).max(64),
  groupId: z.string().min(1).optional(),
});

export const bulkImportParticipantsSchema = z.object({
  names: z.array(z.string().min(1).max(64)).min(1).max(500),
});

export const updateParticipantSchema = z.object({
  participantId: z.string().min(1),
  name: z.string().min(1).max(64).optional(),
  groupId: z.string().min(1).nullable().optional(),
});

export const participantIdSchema = z.object({
  participantId: z.string().min(1),
});

export const createGroupSchema = z.object({
  name: z.string().min(1).max(64),
});

export const assignGroupSchema = z.object({
  participantId: z.string().min(1),
  groupId: z.string().min(1).nullable(),
});

export const createTaskSchema = z.object({
  roundId: z.string().min(1),
  groupId: z.string().min(1).nullable().optional(),
  title: z.string().min(1).max(120),
  description: z.string().min(1).max(2000),
  locationId: z.string().min(1).nullable().optional(),
  difficulty: z.enum(["EASY", "MEDIUM", "HARD", "EXPERT"]),
  estimatedMinutes: z.number().int().min(1).max(240),
  points: z.number().int().min(0).max(1000),
});

export const taskIdSchema = z.object({
  taskId: z.string().min(1),
});

export const assignTaskToGroupSchema = z.object({
  taskId: z.string().min(1),
  groupId: z.string().min(1).nullable(),
});

export const assignTaskToParticipantSchema = z.object({
  taskId: z.string().min(1),
  participantId: z.string().min(1),
});

export const sendChatMessageSchema = z.object({
  meetingId: z.string().min(1),
  message: z.string().min(1).max(500),
});

export const deleteChatMessageSchema = z.object({
  messageId: z.string().min(1),
});

export const updateGameConfigSchema = z.object({
  totalRounds: z.number().int().min(1).max(20).optional(),
  meetingAfterMinutes: z.number().int().min(1).max(180).optional(),
  allowEmergencyMeeting: z.boolean().optional(),
  revealRoleAfterVote: z.boolean().optional(),
  allowImposterElimination: z.boolean().optional(),
  engineerWinCondition: z.enum(["ENGINEERS_COMPLETE_TASKS", "FINAL_ROUND_RESULT"]).optional(),
  imposterWinCondition: z.enum(["IMPOSTERS_REMAIN", "FINAL_ROUND_RESULT"]).optional(),
  voteTiePolicy: z.enum(["NO_ELIMINATION", "ADMIN_DECISION"]).optional(),
  otpRateLimitMax: z.number().int().min(1).max(100).optional(),
  otpRateLimitWindowSeconds: z.number().int().min(1).max(3600).optional(),
});
