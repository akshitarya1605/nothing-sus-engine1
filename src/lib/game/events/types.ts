import { EventVisibility } from "@prisma/client";

/**
 * Every realtime/announcement event the engine can emit, and exactly
 * what its payload contains. This is the enforcement point for "never
 * send a role or a vote total over a channel a participant can subscribe
 * to" — a payload type here simply does not have a `role` field on the
 * PUBLIC-visibility events, so there's nothing to accidentally leak.
 */
export const GAME_EVENT_TYPES = [
  "GAME_STARTED",
  "ROUND_STARTED",
  "ROUND_PAUSED",
  "ROUND_RESUMED",
  "ROUND_ENDING",
  "ROUND_ENDED",
  "ROUND_COMPLETE",

  "TASK_STARTED",
  "TASK_COMPLETED",

  "PLAYER_JOINED",
  "PLAYER_ELIMINATED",
  "PLAYER_RESTORED",
  "PLAYER_DISQUALIFIED",
  "PLAYER_LOCATION_CHANGED",

  "MEETING_STARTED",
  "VOTING_STARTED",
  "VOTE_CAST",
  "VOTING_CLOSED",
  "ROLE_REVEAL_PENDING",
  "ROLE_REVEALED",

  "GAME_PAUSED",
  "GAME_RESUMED",
  "GAME_FINISHED",

  "ANNOUNCEMENT_CREATED",

  // MEETING-visibility only (all participants + admin, never spectator)
  "CHAT_MESSAGE_CREATED",

  // PARTICIPANT-visibility only
  "YOUR_ROLE_ASSIGNED",
] as const;

export type GameEventType = (typeof GAME_EVENT_TYPES)[number];

export interface GameEventPayloads {
  GAME_STARTED: { gameId: string };
  ROUND_STARTED: { roundNumber: number; roundName: string; startedAt: string };
  ROUND_PAUSED: { roundNumber: number; reason: string | null };
  ROUND_RESUMED: { roundNumber: number };
  ROUND_ENDING: { roundNumber: number; secondsRemaining: number };
  ROUND_ENDED: { roundNumber: number };
  ROUND_COMPLETE: { roundNumber: number };

  TASK_STARTED: { participantId: string; taskId: string };
  TASK_COMPLETED: { participantId: string; taskId: string; globalProgressPercentage: number };

  PLAYER_JOINED: { participantId: string; name: string };
  PLAYER_ELIMINATED: { participantId: string; name: string; status: "ELIMINATED" };
  PLAYER_RESTORED: { participantId: string; name: string; status: "ALIVE" };
  PLAYER_DISQUALIFIED: { participantId: string; name: string; reason: string | null };
  PLAYER_LOCATION_CHANGED: { participantId: string; locationId: string; locationName: string };

  MEETING_STARTED: { meetingId: string; type: string; reason: string | null };
  VOTING_STARTED: { meetingId: string };
  VOTE_CAST: { meetingId: string; voterCount: number };
  VOTING_CLOSED: { meetingId: string };
  ROLE_REVEAL_PENDING: { eliminationId: string; participantId: string };
  ROLE_REVEALED: { eliminationId: string; participantId: string; role: "ENGINEER" | "IMPOSTER" };

  GAME_PAUSED: { reason: string | null };
  GAME_RESUMED: Record<string, never>;
  GAME_FINISHED: { winner: string; reason: string };

  ANNOUNCEMENT_CREATED: { message: string };

  CHAT_MESSAGE_CREATED: {
    id: string;
    meetingId: string;
    senderId: string;
    senderName: string;
    message: string;
    createdAt: string;
  };

  YOUR_ROLE_ASSIGNED: { role: "ENGINEER" | "IMPOSTER" };
}

/** The default (and, for most types, only legal) visibility. Individual
 * publishes may still narrow further with targetParticipantId — see
 * publisher.ts — but must never widen past what's listed here. */
export const EVENT_VISIBILITY: Record<GameEventType, EventVisibility> = {
  GAME_STARTED: EventVisibility.PUBLIC,
  ROUND_STARTED: EventVisibility.PUBLIC,
  ROUND_PAUSED: EventVisibility.PUBLIC,
  ROUND_RESUMED: EventVisibility.PUBLIC,
  ROUND_ENDING: EventVisibility.PUBLIC,
  ROUND_ENDED: EventVisibility.PUBLIC,
  ROUND_COMPLETE: EventVisibility.PUBLIC,

  TASK_STARTED: EventVisibility.ADMIN,
  TASK_COMPLETED: EventVisibility.PUBLIC,

  PLAYER_JOINED: EventVisibility.ADMIN,
  PLAYER_ELIMINATED: EventVisibility.PUBLIC,
  PLAYER_RESTORED: EventVisibility.PUBLIC,
  PLAYER_DISQUALIFIED: EventVisibility.PUBLIC,
  PLAYER_LOCATION_CHANGED: EventVisibility.ADMIN,

  MEETING_STARTED: EventVisibility.PUBLIC,
  VOTING_STARTED: EventVisibility.PUBLIC,
  VOTE_CAST: EventVisibility.ADMIN,
  VOTING_CLOSED: EventVisibility.PUBLIC,
  ROLE_REVEAL_PENDING: EventVisibility.ADMIN,
  ROLE_REVEALED: EventVisibility.PUBLIC,

  GAME_PAUSED: EventVisibility.PUBLIC,
  GAME_RESUMED: EventVisibility.PUBLIC,
  GAME_FINISHED: EventVisibility.PUBLIC,

  ANNOUNCEMENT_CREATED: EventVisibility.PUBLIC,

  CHAT_MESSAGE_CREATED: EventVisibility.MEETING,

  YOUR_ROLE_ASSIGNED: EventVisibility.PARTICIPANT,
};

export interface PublishInput<T extends GameEventType> {
  gameId: string;
  type: T;
  payload: GameEventPayloads[T];
  /** required (and only meaningful) when EVENT_VISIBILITY[type] === PARTICIPANT */
  targetParticipantId?: string;
}
