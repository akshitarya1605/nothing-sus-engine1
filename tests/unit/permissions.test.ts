import { describe, it, expect } from "vitest";
import { GameStatus, PlayerStatus } from "@prisma/client";
import {
  assertGameStatus,
  assertPlayerAlive,
  assertPlayerInGame,
  assertRoundIsCurrent,
  assertRolesLocked,
} from "@/lib/game/permissions";
import { GameEngineError } from "@/lib/game/errors";

describe("permission guards", () => {
  it("assertPlayerAlive rejects an eliminated player", () => {
    expect(() => assertPlayerAlive({ status: PlayerStatus.ELIMINATED })).toThrow(GameEngineError);
    expect(() => assertPlayerAlive({ status: PlayerStatus.ALIVE })).not.toThrow();
  });

  it("assertGameStatus rejects a status outside the allowed set", () => {
    expect(() => assertGameStatus({ status: GameStatus.SETUP }, [GameStatus.LIVE])).toThrow(GameEngineError);
    expect(() => assertGameStatus({ status: GameStatus.LIVE }, [GameStatus.LIVE, GameStatus.MEETING])).not.toThrow();
  });

  it("assertPlayerInGame rejects a player from a different game", () => {
    expect(() => assertPlayerInGame({ gameId: "game-a" }, "game-b")).toThrow(GameEngineError);
    expect(() => assertPlayerInGame({ gameId: "game-a" }, "game-a")).not.toThrow();
  });

  it("assertRoundIsCurrent rejects a task from a non-current round (the brief's exact example)", () => {
    // "Player cannot complete a Round 3 task during Round 1"
    expect(() => assertRoundIsCurrent({ number: 3 }, { currentRoundNumber: 1 })).toThrow(GameEngineError);
    expect(() => assertRoundIsCurrent({ number: 1 }, { currentRoundNumber: 1 })).not.toThrow();
  });

  it("assertRolesLocked enforces the expected lock state in either direction", () => {
    expect(() => assertRolesLocked({ rolesLocked: false }, true)).toThrow(GameEngineError);
    expect(() => assertRolesLocked({ rolesLocked: true }, false)).toThrow(GameEngineError);
    expect(() => assertRolesLocked({ rolesLocked: true }, true)).not.toThrow();
  });
});
