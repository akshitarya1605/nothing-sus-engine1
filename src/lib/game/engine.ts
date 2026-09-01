/**
 * The single entry point route handlers import from. Nothing outside
 * lib/game should import from lib/game/actions/* directly — this file
 * is the boundary between "UI / route handler" and "game service", per
 * docs/GAME_ENGINE.md's layering:
 *
 *   UI -> route handler -> game engine (this file) -> database -> realtime event
 */

export * as ParticipantsEngine from "./actions/participants";
export * as RoundsEngine from "./actions/rounds";
export * as TasksEngine from "./actions/tasks";
export * as MeetingsEngine from "./actions/meetings";
export * as VotingEngine from "./actions/voting";
export * as EliminationsEngine from "./actions/eliminations";
export * as LocationsEngine from "./actions/locations";
export * as AnnouncementsEngine from "./actions/announcements";
export * as GroupsEngine from "./actions/groups";
export * as ChatEngine from "./actions/chat";

export { getParticipantGameState, getAdminGameState, getProjectorState } from "./state";
export { checkAutoAdvance } from "./actions/rounds";

export { GameEngineError, HTTP_STATUS_BY_CODE } from "./errors";
