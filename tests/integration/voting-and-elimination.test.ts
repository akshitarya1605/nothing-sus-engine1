import { describe, it, expect, afterEach } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { GameEngineError } from "@/lib/game/errors";
import * as ParticipantsEngine from "@/lib/game/actions/participants";
import * as RoundsEngine from "@/lib/game/actions/rounds";
import * as MeetingsEngine from "@/lib/game/actions/meetings";
import * as VotingEngine from "@/lib/game/actions/voting";
import * as EliminationsEngine from "@/lib/game/actions/eliminations";
import { EliminationMethod, MeetingType, ParticipantStatus } from "@prisma/client";
import { createTestGame, cleanupTestGame } from "./helpers";

let cleanupIds: string[] = [];
afterEach(async () => {
  await Promise.all(cleanupIds.map(cleanupTestGame));
  cleanupIds = [];
});

async function liveGameWithVotingMeeting(participantCount = 5) {
  const { game, participants } = await createTestGame(participantCount);
  cleanupIds.push(game.id);
  await ParticipantsEngine.assignRoles(game.id, 1, prisma);
  await ParticipantsEngine.lockRoles(game.id, prisma);
  await RoundsEngine.markGameReady(game.id, prisma);
  await RoundsEngine.startRound(game.id, 1, prisma);

  const meeting = await MeetingsEngine.callMeeting(game.id, { type: MeetingType.ADMIN_CALLED }, prisma);
  await MeetingsEngine.startVoting(game.id, meeting.id, prisma);

  return { game, participants, meeting };
}

describe("voting", () => {
  it("records one vote per alive participant", async () => {
    const { game, participants, meeting } = await liveGameWithVotingMeeting();
    await VotingEngine.castVote(game.id, participants[0].id, { meetingId: meeting.id, targetParticipantId: participants[1].id }, prisma);
    const count = await prisma.vote.count({ where: { meetingId: meeting.id } });
    expect(count).toBe(1);
  });

  it("rejects a duplicate vote from the same participant, even racing", async () => {
    const { game, participants, meeting } = await liveGameWithVotingMeeting();
    await VotingEngine.castVote(game.id, participants[0].id, { meetingId: meeting.id, targetParticipantId: participants[1].id }, prisma);

    // fire two "duplicate" attempts concurrently — the DB unique
    // constraint (not a check-then-insert race) is what must catch this
    const results = await Promise.allSettled([
      VotingEngine.castVote(game.id, participants[0].id, { meetingId: meeting.id, targetParticipantId: participants[2].id }, prisma),
      VotingEngine.castVote(game.id, participants[0].id, { meetingId: meeting.id, targetParticipantId: participants[3].id }, prisma),
    ]);
    expect(results.every((r) => r.status === "rejected")).toBe(true);

    const count = await prisma.vote.count({ where: { meetingId: meeting.id, voterId: participants[0].id } });
    expect(count).toBe(1);
  });

  it("rejects a vote from an eliminated participant", async () => {
    const { game, participants, meeting } = await liveGameWithVotingMeeting();
    await prisma.participant.update({ where: { id: participants[0].id }, data: { status: ParticipantStatus.ELIMINATED } });
    await expect(
      VotingEngine.castVote(game.id, participants[0].id, { meetingId: meeting.id, targetParticipantId: participants[1].id }, prisma),
    ).rejects.toThrow(GameEngineError);
  });

  it("rejects a vote for a participant who isn't alive", async () => {
    const { game, participants, meeting } = await liveGameWithVotingMeeting();
    await prisma.participant.update({ where: { id: participants[1].id }, data: { status: ParticipantStatus.ELIMINATED } });
    await expect(
      VotingEngine.castVote(game.id, participants[0].id, { meetingId: meeting.id, targetParticipantId: participants[1].id }, prisma),
    ).rejects.toThrow(GameEngineError);
  });

  it("rejects voting for yourself", async () => {
    const { game, participants, meeting } = await liveGameWithVotingMeeting();
    await expect(
      VotingEngine.castVote(game.id, participants[0].id, { meetingId: meeting.id, targetParticipantId: participants[0].id }, prisma),
    ).rejects.toThrow(GameEngineError);
  });

  it("rejects voting once voting has closed", async () => {
    const { game, participants, meeting } = await liveGameWithVotingMeeting();
    await VotingEngine.closeVoting(game.id, meeting.id, prisma);
    await expect(
      VotingEngine.castVote(game.id, participants[0].id, { meetingId: meeting.id, targetParticipantId: participants[1].id }, prisma),
    ).rejects.toThrow(GameEngineError);
  });

  it("a clear plurality is eliminated on reveal", async () => {
    const { game, participants, meeting } = await liveGameWithVotingMeeting();
    await VotingEngine.castVote(game.id, participants[0].id, { meetingId: meeting.id, targetParticipantId: participants[4].id }, prisma);
    await VotingEngine.castVote(game.id, participants[1].id, { meetingId: meeting.id, targetParticipantId: participants[4].id }, prisma);
    await VotingEngine.castVote(game.id, participants[2].id, { meetingId: meeting.id, targetParticipantId: participants[3].id }, prisma);

    await VotingEngine.closeVoting(game.id, meeting.id, prisma);
    const outcome = await VotingEngine.revealResult(game.id, meeting.id, prisma);

    expect(outcome.outcome).toBe("ELIMINATED");
    expect(outcome.eliminatedParticipantId).toBe(participants[4].id);

    const eliminated = await prisma.participant.findUniqueOrThrow({ where: { id: participants[4].id } });
    expect(eliminated.status).toBe("ELIMINATED");
  });

  it("a tie under the default NO_ELIMINATION policy eliminates nobody", async () => {
    const { game, participants, meeting } = await liveGameWithVotingMeeting();
    await VotingEngine.castVote(game.id, participants[0].id, { meetingId: meeting.id, targetParticipantId: participants[3].id }, prisma);
    await VotingEngine.castVote(game.id, participants[1].id, { meetingId: meeting.id, targetParticipantId: participants[4].id }, prisma);

    await VotingEngine.closeVoting(game.id, meeting.id, prisma);
    const outcome = await VotingEngine.revealResult(game.id, meeting.id, prisma);

    expect(outcome.outcome).toBe("NO_ELIMINATION");
    const p3 = await prisma.participant.findUniqueOrThrow({ where: { id: participants[3].id } });
    const p4 = await prisma.participant.findUniqueOrThrow({ where: { id: participants[4].id } });
    expect(p3.status).toBe("ALIVE");
    expect(p4.status).toBe("ALIVE");
  });

  it("under ADMIN_DECISION, a tie stops and waits rather than guessing", async () => {
    const { game, participants, meeting } = await liveGameWithVotingMeeting();
    await prisma.gameConfig.update({ where: { gameId: game.id }, data: { voteTiePolicy: "ADMIN_DECISION" } });

    await VotingEngine.castVote(game.id, participants[0].id, { meetingId: meeting.id, targetParticipantId: participants[3].id }, prisma);
    await VotingEngine.castVote(game.id, participants[1].id, { meetingId: meeting.id, targetParticipantId: participants[4].id }, prisma);
    await VotingEngine.closeVoting(game.id, meeting.id, prisma);

    const outcome = await VotingEngine.revealResult(game.id, meeting.id, prisma);
    expect(outcome.outcome).toBe("TIE_NEEDS_ADMIN");

    await VotingEngine.resolveTie(game.id, meeting.id, { eliminateParticipantId: participants[3].id }, prisma);
    const p3 = await prisma.participant.findUniqueOrThrow({ where: { id: participants[3].id } });
    expect(p3.status).toBe("ELIMINATED");
  });
});

describe("elimination", () => {
  it("a valid direct elimination sets status and creates a PENDING role reveal", async () => {
    const { game, participants } = await createTestGame(3);
    cleanupIds.push(game.id);
    await ParticipantsEngine.assignRoles(game.id, 1, prisma);
    await ParticipantsEngine.lockRoles(game.id, prisma);

    const result = await EliminationsEngine.eliminateParticipant(
      game.id,
      { participantId: participants[0].id, method: EliminationMethod.ADMIN, actorId: "admin" },
      prisma,
    );
    expect(result.roleRevealStatus).toBe("PENDING");

    const participant = await prisma.participant.findUniqueOrThrow({ where: { id: participants[0].id } });
    expect(participant.status).toBe("ELIMINATED");
  });

  it("rejects eliminating an already-eliminated participant", async () => {
    const { game, participants } = await createTestGame(3);
    cleanupIds.push(game.id);
    await ParticipantsEngine.assignRoles(game.id, 1, prisma);
    await ParticipantsEngine.lockRoles(game.id, prisma);

    await EliminationsEngine.eliminateParticipant(
      game.id,
      { participantId: participants[0].id, method: EliminationMethod.ADMIN, actorId: "admin" },
      prisma,
    );
    await expect(
      EliminationsEngine.eliminateParticipant(
        game.id,
        { participantId: participants[0].id, method: EliminationMethod.ADMIN, actorId: "admin" },
        prisma,
      ),
    ).rejects.toThrow(GameEngineError);
  });

  it("rejects eliminating a participant from a different game", async () => {
    const gameA = await createTestGame(2);
    const gameB = await createTestGame(2);
    cleanupIds.push(gameA.game.id, gameB.game.id);

    await expect(
      EliminationsEngine.eliminateParticipant(
        gameA.game.id,
        { participantId: gameB.participants[0].id, method: EliminationMethod.ADMIN, actorId: "admin" },
        prisma,
      ),
    ).rejects.toThrow(GameEngineError);
  });

  it("role reveal is one-shot: PENDING -> REVEALED, then rejected", async () => {
    const { game, participants } = await createTestGame(3);
    cleanupIds.push(game.id);
    await ParticipantsEngine.assignRoles(game.id, 1, prisma);
    await ParticipantsEngine.lockRoles(game.id, prisma);

    const elimination = await EliminationsEngine.eliminateParticipant(
      game.id,
      { participantId: participants[0].id, method: EliminationMethod.ADMIN, actorId: "admin" },
      prisma,
    );

    await EliminationsEngine.revealRole(game.id, elimination.id, prisma);
    const revealed = await prisma.elimination.findUniqueOrThrow({ where: { id: elimination.id } });
    expect(revealed.roleRevealStatus).toBe("REVEALED");

    await expect(EliminationsEngine.revealRole(game.id, elimination.id, prisma)).rejects.toThrow(GameEngineError);
  });
});
