import { describe, it, expect } from "vitest";
import { GameStatus } from "@prisma/client";
import { assertValidTransition, isValidTransition } from "@/lib/game/transitions";
import { GameEngineError } from "@/lib/game/errors";

describe("game status state machine", () => {
  it("allows the documented happy-path edges", () => {
    expect(isValidTransition(GameStatus.SETUP, GameStatus.READY)).toBe(true);
    expect(isValidTransition(GameStatus.READY, GameStatus.LIVE)).toBe(true);
    expect(isValidTransition(GameStatus.LIVE, GameStatus.MEETING)).toBe(true);
    expect(isValidTransition(GameStatus.MEETING, GameStatus.VOTING)).toBe(true);
    expect(isValidTransition(GameStatus.VOTING, GameStatus.REVEAL)).toBe(true);
    expect(isValidTransition(GameStatus.REVEAL, GameStatus.ROUND_COMPLETE)).toBe(true);
    expect(isValidTransition(GameStatus.ROUND_COMPLETE, GameStatus.LIVE)).toBe(true);
    expect(isValidTransition(GameStatus.ROUND_COMPLETE, GameStatus.FINISHED)).toBe(true);
  });

  it("rejects skipping straight to VOTING from ROUND_ACTIVE-equivalent LIVE", () => {
    // the brief's exact example: ROUND_ACTIVE -> VOTING must fail
    expect(isValidTransition(GameStatus.LIVE, GameStatus.VOTING)).toBe(false);
  });

  it("rejects arbitrary jumps", () => {
    expect(isValidTransition(GameStatus.SETUP, GameStatus.LIVE)).toBe(false);
    expect(isValidTransition(GameStatus.SETUP, GameStatus.FINISHED)).toBe(false);
    expect(isValidTransition(GameStatus.MEETING, GameStatus.REVEAL)).toBe(false);
  });

  it("FINISHED is terminal", () => {
    expect(isValidTransition(GameStatus.FINISHED, GameStatus.LIVE)).toBe(false);
    expect(isValidTransition(GameStatus.FINISHED, GameStatus.SETUP)).toBe(false);
  });

  it("PAUSED can only resume into an in-play status, not SETUP/FINISHED", () => {
    expect(isValidTransition(GameStatus.PAUSED, GameStatus.LIVE)).toBe(true);
    expect(isValidTransition(GameStatus.PAUSED, GameStatus.MEETING)).toBe(true);
    expect(isValidTransition(GameStatus.PAUSED, GameStatus.SETUP)).toBe(false);
    expect(isValidTransition(GameStatus.PAUSED, GameStatus.FINISHED)).toBe(false);
  });

  it("every in-play status can pause", () => {
    for (const status of [GameStatus.LIVE, GameStatus.MEETING, GameStatus.VOTING, GameStatus.REVEAL]) {
      expect(isValidTransition(status, GameStatus.PAUSED)).toBe(true);
    }
  });

  it("assertValidTransition throws a typed GameEngineError on an invalid edge", () => {
    expect(() => assertValidTransition(GameStatus.LIVE, GameStatus.VOTING)).toThrow(GameEngineError);
    try {
      assertValidTransition(GameStatus.LIVE, GameStatus.VOTING);
    } catch (err) {
      expect(err).toBeInstanceOf(GameEngineError);
      expect((err as GameEngineError).code).toBe("INVALID_TRANSITION");
    }
  });

  it("assertValidTransition does not throw on a valid edge", () => {
    expect(() => assertValidTransition(GameStatus.SETUP, GameStatus.READY)).not.toThrow();
  });
});
