import type { Prisma, PrismaClient } from "@prisma/client";
import { EliminationMethod, PlayerStatus, RoleRevealStatus } from "@prisma/client";
import { prisma as defaultPrisma } from "../../db/prisma";
import { GameEngineError } from "../errors";
import { writeAuditLog, ActorType } from "../audit";
import { publishEvent } from "../events/publisher";

type TxClient = Prisma.TransactionClient;

/**
 * The core elimination logic, taking an already-open transaction client
 * so callers that need to do more in the same transaction (voting.ts's
 * revealResult also closes out the meeting) can compose it in rather
 * than nesting a second `$transaction`. Player status, the Elimination
 * row, the audit log entry, and the PLAYER_ELIMINATED event all commit
 * together or not at all.
 */
export async function eliminatePlayerTx(
  tx: TxClient,
  gameId: string,
  input: { playerId: string; meetingId?: string; method: EliminationMethod; actorId: string | null },
) {
  const player = await tx.player.findUnique({ where: { id: input.playerId } });
  if (!player || player.gameId !== gameId) {
    throw new GameEngineError("NOT_FOUND", "Player not found");
  }
  if (player.status !== PlayerStatus.ALIVE) {
    // idempotency guard — eliminating twice is a no-op conflict, not a
    // second elimination record
    throw new GameEngineError("CONFLICT", `Player is not ALIVE (status: ${player.status})`);
  }

  await tx.player.update({ where: { id: player.id }, data: { status: PlayerStatus.ELIMINATED } });

  const elimination = await tx.elimination.create({
    data: {
      gameId,
      meetingId: input.meetingId,
      playerId: player.id,
      method: input.method,
      roleRevealStatus: RoleRevealStatus.PENDING,
    },
  });

  await writeAuditLog(tx, {
    gameId,
    actorType: input.method === EliminationMethod.VOTE ? ActorType.SYSTEM : ActorType.ADMIN,
    actorId: input.actorId,
    action: "player_eliminated",
    targetType: "Player",
    targetId: player.id,
    metadata: { method: input.method, meetingId: input.meetingId },
  });

  await publishEvent(tx, {
    gameId,
    type: "PLAYER_ELIMINATED",
    payload: { playerId: player.id, displayName: player.displayName, status: "ELIMINATED" },
  });

  await publishEvent(tx, {
    gameId,
    type: "ROLE_REVEAL_PENDING",
    payload: { eliminationId: elimination.id, playerId: player.id },
  });

  return elimination;
}

/** Standalone entry point for direct admin eliminations (no meeting in
 * play) — opens its own transaction around eliminatePlayerTx. */
export async function eliminatePlayer(
  gameId: string,
  input: { playerId: string; meetingId?: string; method: EliminationMethod; actorId: string | null },
  prisma: PrismaClient = defaultPrisma,
) {
  return prisma.$transaction((tx) => eliminatePlayerTx(tx, gameId, input));
}

/** Admin-triggered role reveal — the ONLY place ROLE_REVEALED (which
 * carries the actual role, PUBLIC visibility) is published. */
export async function revealRole(
  gameId: string,
  eliminationId: string,
  prisma: PrismaClient = defaultPrisma,
) {
  return prisma.$transaction(async (tx) => {
    const elimination = await tx.elimination.findUnique({
      where: { id: eliminationId },
      include: { player: true },
    });
    if (!elimination || elimination.gameId !== gameId) {
      throw new GameEngineError("NOT_FOUND", "Elimination not found");
    }
    if (elimination.roleRevealStatus !== RoleRevealStatus.PENDING) {
      throw new GameEngineError("CONFLICT", "Role has already been revealed (idempotency guard)");
    }
    if (!elimination.player.role) {
      throw new GameEngineError("VALIDATION", "Player has no assigned role to reveal");
    }

    await tx.elimination.update({
      where: { id: eliminationId },
      data: { roleRevealStatus: RoleRevealStatus.REVEALED, revealedAt: new Date() },
    });

    await writeAuditLog(tx, {
      gameId,
      actorType: ActorType.ADMIN,
      actorId: "admin",
      action: "role_revealed",
      targetType: "Player",
      targetId: elimination.playerId,
    });

    await publishEvent(tx, {
      gameId,
      type: "ROLE_REVEALED",
      payload: {
        eliminationId,
        playerId: elimination.playerId,
        role: elimination.player.role,
      },
    });
  });
}
