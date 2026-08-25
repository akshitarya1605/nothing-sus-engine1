import { describe, it, expect, afterEach } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { GameEngineError } from "@/lib/game/errors";
import * as PlayersEngine from "@/lib/game/actions/players";
import * as RoundsEngine from "@/lib/game/actions/rounds";
import * as MeetingsEngine from "@/lib/game/actions/meetings";
import * as VotingEngine from "@/lib/game/actions/voting";
import * as EliminationsEngine from "@/lib/game/actions/eliminations";
import { EliminationMethod, MeetingType, PlayerStatus } from "@prisma/client";
import { createTestGame, cleanupTestGame } from "./helpers";

let cleanupIds: string[] = [];
afterEach(async () => {
  await Promise.all(cleanupIds.map(cleanupTestGame));
  cleanupIds = [];
});

async function liveGameWithVotingMeeting(playerCount = 5) {
  const { game, players } = await createTestGame(playerCount);
  cleanupIds.push(game.id);
  await PlayersEngine.assignRoles(game.id, 1, prisma);
  await PlayersEngine.lockRoles(game.id, prisma);
  await RoundsEngine.markGameReady(game.id, prisma);
  await RoundsEngine.startRound(game.id, 1, prisma);

  const meeting = await MeetingsEngine.callMeeting(game.id, { type: MeetingType.ADMIN_CALLED }, prisma);
  await MeetingsEngine.startVoting(game.id, meeting.id, prisma);

  return { game, players, meeting };
}

describe("voting", () => {
  it("records one vote per alive player", async () => {
    const { game, players, meeting } = await liveGameWithVotingMeeting();
    await VotingEngine.castVote(game.id, players[0].id, { meetingId: meeting.id, targetPlayerId: players[1].id }, prisma);
    const count = await prisma.vote.count({ where: { meetingId: meeting.id } });
    expect(count).toBe(1);
  });

  it("rejects a duplicate vote from the same player, even racing", async () => {
    const { game, players, meeting } = await liveGameWithVotingMeeting();
    await VotingEngine.castVote(game.id, players[0].id, { meetingId: meeting.id, targetPlayerId: players[1].id }, prisma);

    // fire two "duplicate" attempts concurrently — the DB unique
    // constraint (not a check-then-insert race) is what must catch this
    const results = await Promise.allSettled([
      VotingEngine.castVote(game.id, players[0].id, { meetingId: meeting.id, targetPlayerId: players[2].id }, prisma),
      VotingEngine.castVote(game.id, players[0].id, { meetingId: meeting.id, targetPlayerId: players[3].id }, prisma),
    ]);
    expect(results.every((r) => r.status === "rejected")).toBe(true);

    const count = await prisma.vote.count({ where: { meetingId: meeting.id, voterId: players[0].id } });
    expect(count).toBe(1);
  });

  it("rejects a vote from an eliminated player", async () => {
    const { game, players, meeting } = await liveGameWithVotingMeeting();
    await prisma.player.update({ where: { id: players[0].id }, data: { status: PlayerStatus.ELIMINATED } });
    await expect(
      VotingEngine.castVote(game.id, players[0].id, { meetingId: meeting.id, targetPlayerId: players[1].id }, prisma),
    ).rejects.toThrow(GameEngineError);
  });

  it("rejects a vote for a player who isn't alive", async () => {
    const { game, players, meeting } = await liveGameWithVotingMeeting();
    await prisma.player.update({ where: { id: players[1].id }, data: { status: PlayerStatus.ELIMINATED } });
    await expect(
      VotingEngine.castVote(game.id, players[0].id, { meetingId: meeting.id, targetPlayerId: players[1].id }, prisma),
    ).rejects.toThrow(GameEngineError);
  });

  it("rejects voting for yourself", async () => {
    const { game, players, meeting } = await liveGameWithVotingMeeting();
    await expect(
      VotingEngine.castVote(game.id, players[0].id, { meetingId: meeting.id, targetPlayerId: players[0].id }, prisma),
    ).rejects.toThrow(GameEngineError);
  });

  it("rejects voting once voting has closed", async () => {
    const { game, players, meeting } = await liveGameWithVotingMeeting();
    await VotingEngine.closeVoting(game.id, meeting.id, prisma);
    await expect(
      VotingEngine.castVote(game.id, players[0].id, { meetingId: meeting.id, targetPlayerId: players[1].id }, prisma),
    ).rejects.toThrow(GameEngineError);
  });

  it("a clear plurality is eliminated on reveal", async () => {
    const { game, players, meeting } = await liveGameWithVotingMeeting();
    await VotingEngine.castVote(game.id, players[0].id, { meetingId: meeting.id, targetPlayerId: players[4].id }, prisma);
    await VotingEngine.castVote(game.id, players[1].id, { meetingId: meeting.id, targetPlayerId: players[4].id }, prisma);
    await VotingEngine.castVote(game.id, players[2].id, { meetingId: meeting.id, targetPlayerId: players[3].id }, prisma);

    await VotingEngine.closeVoting(game.id, meeting.id, prisma);
    const outcome = await VotingEngine.revealResult(game.id, meeting.id, prisma);

    expect(outcome.outcome).toBe("ELIMINATED");
    expect(outcome.eliminatedPlayerId).toBe(players[4].id);

    const eliminated = await prisma.player.findUniqueOrThrow({ where: { id: players[4].id } });
    expect(eliminated.status).toBe("ELIMINATED");
  });

  it("a tie under the default NO_ELIMINATION policy eliminates nobody", async () => {
    const { game, players, meeting } = await liveGameWithVotingMeeting();
    await VotingEngine.castVote(game.id, players[0].id, { meetingId: meeting.id, targetPlayerId: players[3].id }, prisma);
    await VotingEngine.castVote(game.id, players[1].id, { meetingId: meeting.id, targetPlayerId: players[4].id }, prisma);

    await VotingEngine.closeVoting(game.id, meeting.id, prisma);
    const outcome = await VotingEngine.revealResult(game.id, meeting.id, prisma);

    expect(outcome.outcome).toBe("NO_ELIMINATION");
    const p3 = await prisma.player.findUniqueOrThrow({ where: { id: players[3].id } });
    const p4 = await prisma.player.findUniqueOrThrow({ where: { id: players[4].id } });
    expect(p3.status).toBe("ALIVE");
    expect(p4.status).toBe("ALIVE");
  });

  it("under ADMIN_RESOLVES, a tie stops and waits rather than guessing", async () => {
    const { game, players, meeting } = await liveGameWithVotingMeeting();
    await prisma.gameConfig.update({ where: { gameId: game.id }, data: { voteTiePolicy: "ADMIN_RESOLVES" } });

    await VotingEngine.castVote(game.id, players[0].id, { meetingId: meeting.id, targetPlayerId: players[3].id }, prisma);
    await VotingEngine.castVote(game.id, players[1].id, { meetingId: meeting.id, targetPlayerId: players[4].id }, prisma);
    await VotingEngine.closeVoting(game.id, meeting.id, prisma);

    const outcome = await VotingEngine.revealResult(game.id, meeting.id, prisma);
    expect(outcome.outcome).toBe("TIE_NEEDS_ADMIN");

    await VotingEngine.resolveTie(game.id, meeting.id, { eliminatePlayerId: players[3].id }, prisma);
    const p3 = await prisma.player.findUniqueOrThrow({ where: { id: players[3].id } });
    expect(p3.status).toBe("ELIMINATED");
  });
});

describe("elimination", () => {
  it("a valid direct elimination sets status and creates a PENDING role reveal", async () => {
    const { game, players } = await createTestGame(3);
    cleanupIds.push(game.id);
    await PlayersEngine.assignRoles(game.id, 1, prisma);
    await PlayersEngine.lockRoles(game.id, prisma);

    const result = await EliminationsEngine.eliminatePlayer(
      game.id,
      { playerId: players[0].id, method: EliminationMethod.ADMIN, actorId: "admin" },
      prisma,
    );
    expect(result.roleRevealStatus).toBe("PENDING");

    const player = await prisma.player.findUniqueOrThrow({ where: { id: players[0].id } });
    expect(player.status).toBe("ELIMINATED");
  });

  it("rejects eliminating an already-eliminated player", async () => {
    const { game, players } = await createTestGame(3);
    cleanupIds.push(game.id);
    await PlayersEngine.assignRoles(game.id, 1, prisma);
    await PlayersEngine.lockRoles(game.id, prisma);

    await EliminationsEngine.eliminatePlayer(
      game.id,
      { playerId: players[0].id, method: EliminationMethod.ADMIN, actorId: "admin" },
      prisma,
    );
    await expect(
      EliminationsEngine.eliminatePlayer(
        game.id,
        { playerId: players[0].id, method: EliminationMethod.ADMIN, actorId: "admin" },
        prisma,
      ),
    ).rejects.toThrow(GameEngineError);
  });

  it("rejects eliminating a player from a different game", async () => {
    const gameA = await createTestGame(2);
    const gameB = await createTestGame(2);
    cleanupIds.push(gameA.game.id, gameB.game.id);

    await expect(
      EliminationsEngine.eliminatePlayer(
        gameA.game.id,
        { playerId: gameB.players[0].id, method: EliminationMethod.ADMIN, actorId: "admin" },
        prisma,
      ),
    ).rejects.toThrow(GameEngineError);
  });

  it("role reveal is one-shot: PENDING -> REVEALED, then rejected", async () => {
    const { game, players } = await createTestGame(3);
    cleanupIds.push(game.id);
    await PlayersEngine.assignRoles(game.id, 1, prisma);
    await PlayersEngine.lockRoles(game.id, prisma);

    const elimination = await EliminationsEngine.eliminatePlayer(
      game.id,
      { playerId: players[0].id, method: EliminationMethod.ADMIN, actorId: "admin" },
      prisma,
    );

    await EliminationsEngine.revealRole(game.id, elimination.id, prisma);
    const revealed = await prisma.elimination.findUniqueOrThrow({ where: { id: elimination.id } });
    expect(revealed.roleRevealStatus).toBe("REVEALED");

    await expect(EliminationsEngine.revealRole(game.id, elimination.id, prisma)).rejects.toThrow(GameEngineError);
  });
});
