import { describe, it, expect } from "vitest";
import { GameStatus, ParticipantStatus } from "@prisma/client";
import {
  assertGameStatus,
  assertParticipantAlive,
  assertParticipantInGame,
  assertRoundIsCurrent,
  assertRolesLocked,
} from "@/lib/game/permissions";
import { GameEngineError } from "@/lib/game/errors";

describe("permission guards", () => {
  it("assertParticipantAlive rejects an eliminated participant", () => {
    expect(() => assertParticipantAlive({ status: ParticipantStatus.ELIMINATED })).toThrow(GameEngineError);
    expect(() => assertParticipantAlive({ status: ParticipantStatus.ALIVE })).not.toThrow();
  });

  it("assertGameStatus rejects a status outside the allowed set", () => {
    expect(() => assertGameStatus({ status: GameStatus.SETUP }, [GameStatus.LIVE])).toThrow(GameEngineError);
    expect(() => assertGameStatus({ status: GameStatus.LIVE }, [GameStatus.LIVE, GameStatus.MEETING])).not.toThrow();
  });

  it("assertParticipantInGame rejects a participant from a different game", () => {
    expect(() => assertParticipantInGame({ gameId: "game-a" }, "game-b")).toThrow(GameEngineError);
    expect(() => assertParticipantInGame({ gameId: "game-a" }, "game-a")).not.toThrow();
  });

  it("assertRoundIsCurrent rejects a task from a non-current round (the brief's exact example)", () => {
    // "Participant cannot complete a Round 3 task during Round 1"
    expect(() => assertRoundIsCurrent({ number: 3 }, { currentRoundNumber: 1 })).toThrow(GameEngineError);
    expect(() => assertRoundIsCurrent({ number: 1 }, { currentRoundNumber: 1 })).not.toThrow();
  });

  it("assertRolesLocked enforces the expected lock state in either direction", () => {
    expect(() => assertRolesLocked({ rolesLocked: false }, true)).toThrow(GameEngineError);
    expect(() => assertRolesLocked({ rolesLocked: true }, false)).toThrow(GameEngineError);
    expect(() => assertRolesLocked({ rolesLocked: true }, true)).not.toThrow();
  });
});
