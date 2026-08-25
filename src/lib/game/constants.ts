import {
  GameStatus,
  RoundPhase,
  RoundStatus,
  PlayerStatus,
  PlayerRole,
  TaskStatus,
  PlayerTaskStatus,
  MeetingStatus,
  MeetingType,
  EliminationMethod,
  RoleRevealStatus,
  EventVisibility,
} from "@prisma/client";

export {
  GameStatus,
  RoundPhase,
  RoundStatus,
  PlayerStatus,
  PlayerRole,
  TaskStatus,
  PlayerTaskStatus,
  MeetingStatus,
  MeetingType,
  EliminationMethod,
  RoleRevealStatus,
  EventVisibility,
};

/** Defaults for a newly-created GameConfig row. Nothing outside this
 * file (or the config row itself) should hardcode these numbers. */
export const DEFAULT_GAME_CONFIG = {
  totalRounds: 4,
  meetingAfterMinutes: 20,
  imposterCount: 0,
  allowEmergencyMeeting: true,
  revealRoleAfterVote: true,
  allowImposterElimination: true,
  engineerWinCondition: "ENGINEERS_COMPLETE_TASKS" as const,
  imposterWinCondition: "IMPOSTERS_REMAIN" as const,
  voteTiePolicy: "NO_ELIMINATION" as const,
};

export const ENGINEER_WIN_CONDITIONS = ["ENGINEERS_COMPLETE_TASKS", "FINAL_ROUND_RESULT"] as const;
export const IMPOSTER_WIN_CONDITIONS = ["IMPOSTERS_REMAIN", "FINAL_ROUND_RESULT"] as const;
export const VOTE_TIE_POLICIES = ["NO_ELIMINATION", "ADMIN_RESOLVES"] as const;

export type EngineerWinCondition = (typeof ENGINEER_WIN_CONDITIONS)[number];
export type ImposterWinCondition = (typeof IMPOSTER_WIN_CONDITIONS)[number];
export type VoteTiePolicy = (typeof VOTE_TIE_POLICIES)[number];

/** The default event schedule referenced in the brief. This is seed data,
 * not a hardcoded UI constant — the admin can change round rows in the DB
 * after seeding. Nothing in lib/game or the UI reads this array directly. */
export const DEFAULT_ROUND_SCHEDULE = [
  { number: 1, name: "Round 1", hour: 10, minute: 0, durationMinutes: 120 },
  { number: 2, name: "Round 2", hour: 12, minute: 0, durationMinutes: 120 },
  { number: 3, name: "Round 3", hour: 14, minute: 0, durationMinutes: 120 },
  { number: 4, name: "Round 4 / Final Round", hour: 16, minute: 0, durationMinutes: 120 },
] as const;
