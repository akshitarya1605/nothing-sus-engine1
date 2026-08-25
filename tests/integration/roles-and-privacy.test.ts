import { describe, it, expect, afterEach } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { GameEngineError } from "@/lib/game/errors";
import * as PlayersEngine from "@/lib/game/actions/players";
import * as RoundsEngine from "@/lib/game/actions/rounds";
import { getPlayerGameState, getAdminGameState, getProjectorState } from "@/lib/game/state";
import { createTestGame, cleanupTestGame } from "./helpers";

let cleanupIds: string[] = [];
afterEach(async () => {
  await Promise.all(cleanupIds.map(cleanupTestGame));
  cleanupIds = [];
});

describe("role assignment", () => {
  it("assigns every player exactly one role, with the exact configured imposter count", async () => {
    const { game, players } = await createTestGame(20);
    cleanupIds.push(game.id);

    const result = await PlayersEngine.assignRoles(game.id, 5, prisma);
    expect(result.totalPlayers).toBe(20);
    expect(result.imposterCount).toBe(5);

    const rows = await prisma.player.findMany({ where: { gameId: game.id } });
    expect(rows.every((p) => p.role !== null)).toBe(true);

    const imposters = rows.filter((p) => p.role === "IMPOSTER");
    const engineers = rows.filter((p) => p.role === "ENGINEER");
    expect(imposters).toHaveLength(5);
    expect(engineers).toHaveLength(15);
    expect(imposters.length + engineers.length).toBe(players.length); // no duplicates, none missing
  });

  it("rejects an imposterCount outside [0, playerCount]", async () => {
    const { game } = await createTestGame(4);
    cleanupIds.push(game.id);
    await expect(PlayersEngine.assignRoles(game.id, 5, prisma)).rejects.toThrow(GameEngineError);
    await expect(PlayersEngine.assignRoles(game.id, -1, prisma)).rejects.toThrow(GameEngineError);
  });

  it("lockRoles rejects if any player is missing a role", async () => {
    const { game } = await createTestGame(4);
    cleanupIds.push(game.id);
    await expect(PlayersEngine.lockRoles(game.id, prisma)).rejects.toThrow(GameEngineError);
  });

  it("locking prevents further reassignment through the normal path", async () => {
    const { game } = await createTestGame(4);
    cleanupIds.push(game.id);
    await PlayersEngine.assignRoles(game.id, 1, prisma);
    await PlayersEngine.lockRoles(game.id, prisma);
    await expect(PlayersEngine.assignRoles(game.id, 2, prisma)).rejects.toThrow(GameEngineError);
  });

  it("the recovery unlock requires a reason and is the only way back in once locked", async () => {
    const { game } = await createTestGame(4);
    cleanupIds.push(game.id);
    await PlayersEngine.assignRoles(game.id, 1, prisma);
    await PlayersEngine.lockRoles(game.id, prisma);

    await expect(PlayersEngine.unlockRolesForRecovery(game.id, "", prisma)).rejects.toThrow(GameEngineError);
    await PlayersEngine.unlockRolesForRecovery(game.id, "misconfigured imposter count", prisma);
    await expect(PlayersEngine.assignRoles(game.id, 2, prisma)).resolves.toBeDefined();
  });

  it("writes an audit log entry for every privileged role operation", async () => {
    const { game } = await createTestGame(4);
    cleanupIds.push(game.id);
    await PlayersEngine.assignRoles(game.id, 1, prisma);
    await PlayersEngine.lockRoles(game.id, prisma);

    const actions = (await prisma.auditLog.findMany({ where: { gameId: game.id } })).map((a) => a.action);
    expect(actions).toContain("roles_assigned");
    expect(actions).toContain("roles_locked");
  });
});

describe("role and vote privacy in the data contracts", () => {
  it("a player's own state never includes any other player's role", async () => {
    const { game, players } = await createTestGame(3);
    cleanupIds.push(game.id);
    await PlayersEngine.assignRoles(game.id, 1, prisma);
    await PlayersEngine.lockRoles(game.id, prisma);
    await RoundsEngine.markGameReady(game.id, prisma);
    await RoundsEngine.startRound(game.id, 1, prisma);

    const state = await getPlayerGameState(prisma, players[0].id);
    const serialized = JSON.stringify(state);

    // the player's own role is expected to appear once (ownRole); no
    // other player id should be associated with a role anywhere in the
    // payload — the type doesn't even have a slot for it, but assert
    // the actual serialized shape too
    expect(state.ownRole).not.toBeNull();
    expect(Object.keys(state)).not.toContain("players");
    expect(serialized).not.toMatch(
      /"role"\s*:\s*"(ENGINEER|IMPOSTER)"[\s\S]*"role"\s*:\s*"(ENGINEER|IMPOSTER)"/,
    );
  });

  it("admin state legitimately includes every player's role", async () => {
    const { game } = await createTestGame(4);
    cleanupIds.push(game.id);
    await PlayersEngine.assignRoles(game.id, 1, prisma);
    await PlayersEngine.lockRoles(game.id, prisma);

    const state = await getAdminGameState(prisma, game.id);
    expect(state.players.every((p) => p.role !== null)).toBe(true);
  });

  it("projector state never contains a role field at all", async () => {
    const { game } = await createTestGame(4);
    cleanupIds.push(game.id);
    await PlayersEngine.assignRoles(game.id, 1, prisma);
    await PlayersEngine.lockRoles(game.id, prisma);
    await RoundsEngine.markGameReady(game.id, prisma);
    await RoundsEngine.startRound(game.id, 1, prisma);

    const state = await getProjectorState(prisma, game.id);
    const serialized = JSON.stringify(state);
    expect(serialized).not.toMatch(/ENGINEER|IMPOSTER/);
    expect(state.aliveCount).toBeGreaterThan(0);
  });
});
