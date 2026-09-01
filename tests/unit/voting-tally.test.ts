import { describe, it, expect } from "vitest";
import { tallyVotes } from "@/lib/game/actions/voting";

describe("tallyVotes", () => {
  it("picks the strict plurality winner", () => {
    const tally = tallyVotes([
      { targetParticipantId: "a" },
      { targetParticipantId: "a" },
      { targetParticipantId: "b" },
    ]);
    expect(tally.winner).toBe("a");
    expect(tally.isTie).toBe(false);
    expect(tally.totalVotes).toBe(3);
  });

  it("never silently picks a winner on a tie", () => {
    const tally = tallyVotes([{ targetParticipantId: "a" }, { targetParticipantId: "b" }]);
    expect(tally.winner).toBeNull();
    expect(tally.isTie).toBe(true);
  });

  it("treats a 3-way tie the same way as a 2-way tie", () => {
    const tally = tallyVotes([
      { targetParticipantId: "a" },
      { targetParticipantId: "b" },
      { targetParticipantId: "c" },
    ]);
    expect(tally.winner).toBeNull();
    expect(tally.isTie).toBe(true);
  });

  it("excludes skip votes from the target counts but includes them in totalVotes", () => {
    const tally = tallyVotes([
      { targetParticipantId: "a" },
      { targetParticipantId: null },
      { targetParticipantId: null },
    ]);
    expect(tally.winner).toBe("a");
    expect(tally.skipCount).toBe(2);
    expect(tally.totalVotes).toBe(3);
  });

  it("no votes at all is not a tie and has no winner", () => {
    const tally = tallyVotes([]);
    expect(tally.winner).toBeNull();
    expect(tally.isTie).toBe(false);
  });

  it("all skip votes has no winner and is not a tie", () => {
    const tally = tallyVotes([{ targetParticipantId: null }, { targetParticipantId: null }]);
    expect(tally.winner).toBeNull();
    expect(tally.isTie).toBe(false);
  });
});
