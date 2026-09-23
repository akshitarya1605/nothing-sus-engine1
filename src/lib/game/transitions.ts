import { GameStatus } from "@prisma/client";
import { GameEngineError } from "./errors";

/**
 * The only edges the game status is allowed to move along. This is the
 * single source of truth for "is X -> Y even a legal shape of move" —
 * see lib/game/engine.ts and docs/GAME_STATE_MACHINE.md for the
 * additional contextual guards (e.g. "only if voting has closed") layered
 * on top of each edge.
 *
 *   SETUP -> READY -> LIVE <-> PAUSED
 *                       |
 *                       v
 *                    MEETING <-> PAUSED
 *                       |
 *                       v
 *                    VOTING <-> PAUSED
 *                       |
 *                       v
 *                    REVEAL <-> PAUSED
 *                       |
 *                       v
 *                ROUND_COMPLETE --(more rounds)--> LIVE
 *                       |
 *                       (final round)
 *                       v
 *                   FINISHED
 *
 * PAUSED is reachable from every "in-play" status and resumes back into
 * exactly the status it was paused from (Game.pausedFromStatus) — it is
 * not a generic hub you can pause-then-jump-elsewhere from.
 */
const TRANSITIONS: Record<GameStatus, GameStatus[]> = {
  SETUP: [GameStatus.READY, GameStatus.LIVE, GameStatus.FINISHED],
  READY: [GameStatus.LIVE, GameStatus.SETUP, GameStatus.FINISHED],
  LIVE: [GameStatus.MEETING, GameStatus.PAUSED, GameStatus.FINISHED],
  MEETING: [GameStatus.VOTING, GameStatus.PAUSED, GameStatus.FINISHED],
  VOTING: [GameStatus.REVEAL, GameStatus.PAUSED, GameStatus.FINISHED],
  REVEAL: [GameStatus.ROUND_COMPLETE, GameStatus.PAUSED, GameStatus.FINISHED],
  ROUND_COMPLETE: [GameStatus.LIVE, GameStatus.FINISHED],
  PAUSED: [
    GameStatus.LIVE,
    GameStatus.MEETING,
    GameStatus.VOTING,
    GameStatus.REVEAL,
    GameStatus.FINISHED,
  ],
  FINISHED: [GameStatus.SETUP],
};

export function isValidTransition(from: GameStatus, to: GameStatus): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

/** Throws if `from -> to` is not an edge in the state graph. Callers in
 * lib/game/engine.ts still need to check the contextual guard for the
 * specific edge (e.g. voting is actually closed) before calling this —
 * this function only enforces the shape of the graph. */
export function assertValidTransition(from: GameStatus, to: GameStatus): void {
  if (!isValidTransition(from, to)) {
    throw new GameEngineError(
      "INVALID_TRANSITION",
      `Cannot transition game status from ${from} to ${to}`,
    );
  }
}
