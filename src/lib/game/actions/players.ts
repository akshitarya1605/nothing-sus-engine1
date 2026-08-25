import type { PrismaClient } from "@prisma/client";
import { PlayerRole, PlayerStatus } from "@prisma/client";
import { randomInt } from "node:crypto";
import { prisma as defaultPrisma } from "../../db/prisma";
import { GameEngineError } from "../errors";
import { writeAuditLog, ActorType } from "../audit";
import { publishEvent } from "../events/publisher";

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I

/** Cryptographically random — uses node:crypto's randomInt (rejection
 * sampling under the hood), not Math.random(). */
function generatePlayerCode(): string {
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  }
  return `${code.slice(0, 3)}-${code.slice(3)}`;
}

export async function createPlayer(
  gameId: string,
  input: { displayName: string; email?: string; team?: string },
  prisma: PrismaClient = defaultPrisma,
) {
  return prisma.$transaction(async (tx) => {
    let playerCode = generatePlayerCode();
    // extremely unlikely, but guard the unique constraint anyway
    for (let attempts = 0; attempts < 5; attempts++) {
      const existing = await tx.player.findUnique({ where: { playerCode } });
      if (!existing) break;
      playerCode = generatePlayerCode();
    }

    const player = await tx.player.create({
      data: {
        gameId,
        playerCode,
        displayName: input.displayName,
        email: input.email,
        team: input.team,
        status: PlayerStatus.ALIVE,
      },
    });

    await writeAuditLog(tx, {
      gameId,
      actorType: ActorType.ADMIN,
      actorId: "admin",
      action: "player_created",
      targetType: "Player",
      targetId: player.id,
    });

    await publishEvent(tx, {
      gameId,
      type: "PLAYER_JOINED",
      payload: { playerId: player.id, displayName: player.displayName },
    });

    return player;
  });
}

/**
 * Cryptographically-random role assignment (Fisher-Yates using
 * node:crypto.randomInt, not Math.random()). Every player gets exactly
 * one role, no duplicates are possible since this overwrites the whole
 * roster in one pass. Rejects if the game's roles are already locked —
 * see unlockRolesForRecovery for the explicit, audited override.
 */
export async function assignRoles(
  gameId: string,
  imposterCount: number,
  prisma: PrismaClient = defaultPrisma,
) {
  return prisma.$transaction(async (tx) => {
    const game = await tx.game.findUnique({ where: { id: gameId } });
    if (!game) throw new GameEngineError("NOT_FOUND", "Game not found");
    if (game.rolesLocked) {
      throw new GameEngineError("CONFLICT", "Roles are locked — use the recovery operation");
    }

    const players = await tx.player.findMany({ where: { gameId }, select: { id: true } });
    if (players.length === 0) {
      throw new GameEngineError("VALIDATION", "No players to assign roles to");
    }
    if (imposterCount < 0 || imposterCount > players.length) {
      throw new GameEngineError(
        "VALIDATION",
        `imposterCount must be between 0 and ${players.length}`,
      );
    }

    // Fisher-Yates with a CSPRNG
    const shuffled = [...players];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = randomInt(i + 1);
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    const imposterIds = new Set(shuffled.slice(0, imposterCount).map((p) => p.id));

    await Promise.all(
      shuffled.map((p) =>
        tx.player.update({
          where: { id: p.id },
          data: { role: imposterIds.has(p.id) ? PlayerRole.IMPOSTER : PlayerRole.ENGINEER },
        }),
      ),
    );

    await tx.gameConfig.update({ where: { gameId }, data: { imposterCount } });

    await writeAuditLog(tx, {
      gameId,
      actorType: ActorType.ADMIN,
      actorId: "admin",
      action: "roles_assigned",
      metadata: {
        totalPlayers: players.length,
        imposterCount,
        // full mapping kept for audit/recovery — admin-only table
        assignment: shuffled.map((p) => ({
          playerId: p.id,
          role: imposterIds.has(p.id) ? "IMPOSTER" : "ENGINEER",
        })),
      },
    });

    return { totalPlayers: players.length, imposterCount };
  });
}

export async function lockRoles(gameId: string, prisma: PrismaClient = defaultPrisma) {
  return prisma.$transaction(async (tx) => {
    const game = await tx.game.findUnique({ where: { id: gameId } });
    if (!game) throw new GameEngineError("NOT_FOUND", "Game not found");
    if (game.rolesLocked) {
      throw new GameEngineError("CONFLICT", "Roles are already locked");
    }

    const unassignedCount = await tx.player.count({ where: { gameId, role: null } });
    if (unassignedCount > 0) {
      throw new GameEngineError(
        "VALIDATION",
        `${unassignedCount} player(s) have no role assigned yet`,
      );
    }

    await tx.game.update({
      where: { id: gameId },
      data: { rolesLocked: true, rolesLockedAt: new Date() },
    });

    await writeAuditLog(tx, {
      gameId,
      actorType: ActorType.ADMIN,
      actorId: "admin",
      action: "roles_locked",
    });

    // Notify each player of their own role now that it's final — a
    // PLAYER-visibility event per player, never a broadcast a player
    // could subscribe to and read someone else's role from.
    const players = await tx.player.findMany({ where: { gameId }, select: { id: true, role: true } });
    for (const p of players) {
      if (!p.role) continue;
      await publishEvent(tx, {
        gameId,
        type: "YOUR_ROLE_ASSIGNED",
        payload: { role: p.role },
        targetPlayerId: p.id,
      });
    }
  });
}

/**
 * The explicit "privileged recovery operation" the brief calls for —
 * distinct from the normal admin flow, requires a reason, and is
 * audited. Nothing about the UI naming should make this look like a
 * routine action.
 */
export async function unlockRolesForRecovery(
  gameId: string,
  reason: string,
  prisma: PrismaClient = defaultPrisma,
) {
  if (!reason.trim()) {
    throw new GameEngineError("VALIDATION", "A reason is required to unlock roles");
  }
  return prisma.$transaction(async (tx) => {
    const game = await tx.game.findUnique({ where: { id: gameId } });
    if (!game) throw new GameEngineError("NOT_FOUND", "Game not found");
    if (!game.rolesLocked) {
      throw new GameEngineError("CONFLICT", "Roles are not locked");
    }

    await tx.game.update({
      where: { id: gameId },
      data: { rolesLocked: false, rolesLockedAt: null },
    });

    await writeAuditLog(tx, {
      gameId,
      actorType: ActorType.ADMIN,
      actorId: "admin",
      action: "roles_unlocked_recovery",
      metadata: { reason },
    });
  });
}

export async function restorePlayer(gameId: string, playerId: string, prisma: PrismaClient = defaultPrisma) {
  return prisma.$transaction(async (tx) => {
    const player = await tx.player.findUnique({ where: { id: playerId } });
    if (!player || player.gameId !== gameId) {
      throw new GameEngineError("NOT_FOUND", "Player not found");
    }
    if (player.status !== PlayerStatus.ELIMINATED) {
      throw new GameEngineError("CONFLICT", `Player is not ELIMINATED (status: ${player.status})`);
    }

    await tx.player.update({ where: { id: playerId }, data: { status: PlayerStatus.ALIVE } });

    await writeAuditLog(tx, {
      gameId,
      actorType: ActorType.ADMIN,
      actorId: "admin",
      action: "player_restored",
      targetType: "Player",
      targetId: playerId,
    });

    await publishEvent(tx, {
      gameId,
      type: "PLAYER_RESTORED",
      payload: { playerId, displayName: player.displayName, status: "ALIVE" },
    });
  });
}
