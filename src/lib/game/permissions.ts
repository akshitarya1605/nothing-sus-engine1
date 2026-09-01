import type { Game, Participant, Round } from "@prisma/client";
import { GameStatus, ParticipantStatus } from "@prisma/client";
import { GameEngineError } from "./errors";

/** Small, composable guards used by lib/game/actions/*. Each one throws
 * a typed GameEngineError with a clear reason instead of returning a
 * boolean — callers don't need to remember to check a return value. */

export function assertGameStatus(game: Pick<Game, "status">, allowed: GameStatus[]): void {
  if (!allowed.includes(game.status)) {
    throw new GameEngineError(
      "CONFLICT",
      `Action not allowed while game status is ${game.status} (requires one of: ${allowed.join(", ")})`,
    );
  }
}

export function assertParticipantAlive(participant: Pick<Participant, "status">): void {
  if (participant.status !== ParticipantStatus.ALIVE) {
    throw new GameEngineError("FORBIDDEN", `Participant is not ALIVE (status: ${participant.status})`);
  }
}

export function assertParticipantInGame(participant: Pick<Participant, "gameId">, gameId: string): void {
  if (participant.gameId !== gameId) {
    throw new GameEngineError("FORBIDDEN", "Participant does not belong to this game");
  }
}

export function assertRoundIsCurrent(
  round: Pick<Round, "number">,
  game: Pick<Game, "currentRoundNumber">,
): void {
  if (round.number !== game.currentRoundNumber) {
    throw new GameEngineError(
      "FORBIDDEN",
      `Round ${round.number} is not the current round (current: ${game.currentRoundNumber})`,
    );
  }
}

export function assertRolesLocked(game: Pick<Game, "rolesLocked">, shouldBeLocked: boolean): void {
  if (game.rolesLocked !== shouldBeLocked) {
    throw new GameEngineError(
      "CONFLICT",
      shouldBeLocked ? "Roles are not locked yet" : "Roles are already locked",
    );
  }
}

/** SETUP/READY have no round in play, so most gameplay actions live
 * behind this rather than repeating a literal status list everywhere. */
export const LIVE_PLAY_STATUSES: GameStatus[] = [
  GameStatus.LIVE,
  GameStatus.MEETING,
  GameStatus.VOTING,
  GameStatus.REVEAL,
];
