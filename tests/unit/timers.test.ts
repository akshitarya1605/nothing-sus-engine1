import { describe, it, expect } from "vitest";
import { computeRoundTiming } from "@/lib/game/timers";

describe("computeRoundTiming", () => {
  it("returns nulls for a round that hasn't started", () => {
    const timing = computeRoundTiming(
      { startedAt: null, endedAt: null, durationMinutes: 120, meetingAfterMinutes: null },
      20,
    );
    expect(timing.roundMsRemaining).toBeNull();
    expect(timing.meetingIsDue).toBe(false);
  });

  it("computes remaining time purely from stored timestamps, not a client clock", () => {
    const startedAt = new Date("2026-01-01T10:00:00Z");
    const now = new Date("2026-01-01T10:30:00Z"); // 30 minutes in
    const timing = computeRoundTiming(
      { startedAt, endedAt: null, durationMinutes: 120, meetingAfterMinutes: null },
      20,
      now,
    );
    expect(timing.roundMsRemaining).toBe(90 * 60_000); // 90 minutes left of 120
  });

  it("flags the automatic meeting as due once meetingAfterMinutes has elapsed", () => {
    const startedAt = new Date("2026-01-01T10:00:00Z");
    const before = new Date("2026-01-01T10:19:00Z");
    const after = new Date("2026-01-01T10:21:00Z");

    const beforeTiming = computeRoundTiming(
      { startedAt, endedAt: null, durationMinutes: 120, meetingAfterMinutes: null },
      20,
      before,
    );
    const afterTiming = computeRoundTiming(
      { startedAt, endedAt: null, durationMinutes: 120, meetingAfterMinutes: null },
      20,
      after,
    );

    expect(beforeTiming.meetingIsDue).toBe(false);
    expect(afterTiming.meetingIsDue).toBe(true);
  });

  it("a per-round override takes precedence over the game-level default", () => {
    const startedAt = new Date("2026-01-01T10:00:00Z");
    const now = new Date("2026-01-01T10:06:00Z");
    const timing = computeRoundTiming(
      { startedAt, endedAt: null, durationMinutes: 120, meetingAfterMinutes: 5 },
      20,
      now,
    );
    expect(timing.meetingIsDue).toBe(true); // 6 min > 5 min override, even though < 20 min default
  });

  it("never goes negative once the round has run past its duration", () => {
    const startedAt = new Date("2026-01-01T10:00:00Z");
    const now = new Date("2026-01-01T13:00:00Z"); // 3h in, round is 2h
    const timing = computeRoundTiming(
      { startedAt, endedAt: null, durationMinutes: 120, meetingAfterMinutes: null },
      20,
      now,
    );
    expect(timing.roundMsRemaining).toBe(0);
  });
});
