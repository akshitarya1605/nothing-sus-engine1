import { describe, it, expect, vi } from "vitest";
import { EVENT_VISIBILITY } from "@/lib/game/events/types";
import { publishEvent } from "@/lib/game/events/publisher";
import { GameEngineError } from "@/lib/game/errors";

describe("event visibility table", () => {
  it("never marks a role- or vote-carrying event as PUBLIC", () => {
    // these are exactly the two things the brief calls out as must-never-leak
    expect(EVENT_VISIBILITY.VOTE_CAST).not.toBe("PUBLIC");
    expect(EVENT_VISIBILITY.ROLE_REVEAL_PENDING).not.toBe("PUBLIC");
    expect(EVENT_VISIBILITY.YOUR_ROLE_ASSIGNED).toBe("PLAYER");
  });

  it("PLAYER_ELIMINATED (public) is a distinct event from ROLE_REVEALED (also public, but only fired on explicit admin action)", () => {
    // both end up PUBLIC, but they are separate calls in eliminations.ts —
    // PLAYER_ELIMINATED never carries a role field in its payload type
    // (see GameEventPayloads in events/types.ts), so there's nothing to
    // leak even though it's public.
    expect(EVENT_VISIBILITY.PLAYER_ELIMINATED).toBe("PUBLIC");
    expect(EVENT_VISIBILITY.ROLE_REVEALED).toBe("PUBLIC");
  });
});

function fakeTx() {
  return {
    gameEvent: { create: vi.fn().mockResolvedValue({}) },
    $executeRaw: vi.fn().mockResolvedValue(undefined),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

describe("publishEvent", () => {
  it("rejects a PLAYER-visibility event with no targetPlayerId", async () => {
    await expect(
      publishEvent(fakeTx(), { gameId: "g1", type: "YOUR_ROLE_ASSIGNED", payload: { role: "ENGINEER" } }),
    ).rejects.toThrow(GameEngineError);
  });

  it("rejects a targetPlayerId on a non-PLAYER-visibility event", async () => {
    await expect(
      publishEvent(fakeTx(), {
        gameId: "g1",
        type: "GAME_STARTED",
        payload: { gameId: "g1" },
        targetPlayerId: "someone",
      }),
    ).rejects.toThrow(GameEngineError);
  });

  it("accepts a correctly-scoped PLAYER event", async () => {
    await expect(
      publishEvent(fakeTx(), {
        gameId: "g1",
        type: "YOUR_ROLE_ASSIGNED",
        payload: { role: "IMPOSTER" },
        targetPlayerId: "player-1",
      }),
    ).resolves.toBeUndefined();
  });
});
