import { describe, it, expect, vi } from "vitest";
import { computeGlobalTaskProgress, computePlayerTaskProgress } from "@/lib/game/scoring";

function fakePrisma(completed: number, inPlay: number) {
  return {
    playerTask: {
      count: vi.fn().mockResolvedValueOnce(completed).mockResolvedValueOnce(inPlay),
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

describe("computeGlobalTaskProgress / computePlayerTaskProgress", () => {
  it("divides completed by in-play instances, not by all task definitions", async () => {
    const progress = await computeGlobalTaskProgress(fakePrisma(3, 10), "game1");
    expect(progress.completed).toBe(3);
    expect(progress.inPlay).toBe(10);
    expect(progress.percentage).toBe(30);
  });

  it("returns 0% (not NaN) when nothing is in play yet", async () => {
    const progress = await computeGlobalTaskProgress(fakePrisma(0, 0), "game1");
    expect(progress.percentage).toBe(0);
  });

  it("player progress uses the same formula", async () => {
    const progress = await computePlayerTaskProgress(fakePrisma(1, 4), "player1");
    expect(progress.percentage).toBe(25);
  });

  it("rounds to one decimal place rather than truncating", async () => {
    const progress = await computeGlobalTaskProgress(fakePrisma(1, 3), "game1");
    expect(progress.percentage).toBe(33.3);
  });
});
