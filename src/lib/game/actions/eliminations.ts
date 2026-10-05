import type { Prisma, PrismaClient } from "@prisma/client";
import { EliminationMethod, ParticipantRole, ParticipantStatus, RoleRevealStatus } from "@prisma/client";
import { prismaWrite as defaultPrisma } from "../../db/prisma";
import { GameEngineError } from "../errors";
import { writeAuditLog, ActorType } from "../audit";
import { publishEvent } from "../events/publisher";
import { LIVE_PLAY_STATUSES } from "../permissions";
import { finalizeGameTx } from "./rounds";

type TxClient = Prisma.TransactionClient;

/**
 * The core elimination logic, taking an already-open transaction client
 * so callers that need to do more in the same transaction (voting.ts's
 * revealResult also closes out the meeting) can compose it in rather
 * than nesting a second `$transaction`. Participant status, the Elimination
 * row, the audit log entry, and the PLAYER_ELIMINATED event all commit
 * together or not at all.
 */
export async function eliminateParticipantTx(
  tx: TxClient,
  gameId: string,
  input: { participantId: string; meetingId?: string; method: EliminationMethod; actorId: string | null },
) {
  const participant = await tx.participant.findUnique({ where: { id: input.participantId } });
  if (!participant || participant.gameId !== gameId) {
    throw new GameEngineError("NOT_FOUND", "Participant not found");
  }
  if (participant.status !== ParticipantStatus.ALIVE) {
    // idempotency guard — eliminating twice is a no-op conflict, not a
    // second elimination record
    throw new GameEngineError("CONFLICT", `Participant is not ALIVE (status: ${participant.status})`);
  }

  await tx.participant.update({ where: { id: participant.id }, data: { status: ParticipantStatus.ELIMINATED } });

  const elimination = await tx.elimination.create({
    data: {
      gameId,
      meetingId: input.meetingId,
      participantId: participant.id,
      method: input.method,
      roleRevealStatus: RoleRevealStatus.PENDING,
    },
  });

  await writeAuditLog(tx, {
    gameId,
    actorType: input.method === EliminationMethod.VOTE ? ActorType.SYSTEM : ActorType.ADMIN,
    actorId: input.actorId,
    action: "participant_eliminated",
    targetType: "Participant",
    targetId: participant.id,
    metadata: { method: input.method, meetingId: input.meetingId },
  });

  await publishEvent(tx, {
    gameId,
    type: "PLAYER_ELIMINATED",
    payload: { participantId: participant.id, name: participant.name, status: "ELIMINATED" },
  });

  await publishEvent(tx, {
    gameId,
    type: "ROLE_REVEAL_PENDING",
    payload: { eliminationId: elimination.id, participantId: participant.id },
  });

  return elimination;
}

/** Standalone entry point for direct admin eliminations (no meeting in
 * play) — opens its own transaction around eliminateParticipantTx. */
export async function eliminateParticipant(
  gameId: string,
  input: { participantId: string; meetingId?: string; method: EliminationMethod; actorId: string | null },
  prisma: PrismaClient = defaultPrisma,
) {
  return prisma.$transaction((tx) => eliminateParticipantTx(tx, gameId, input));
}

/**
 * Host removes a player from the game entirely (cheating, no-show, left
 * early). Distinct from an in-game elimination: status becomes
 * DISQUALIFIED, which the win-condition counts (ALIVE only) ignore, and it
 * fires no role-reveal. Works from any status ALIVE or ELIMINATED.
 */
export async function disqualifyParticipant(
  gameId: string,
  input: { participantId: string; reason?: string; actorId: string | null },
  prisma: PrismaClient = defaultPrisma,
) {
  return prisma.$transaction(async (tx) => {
    const participant = await tx.participant.findUnique({ where: { id: input.participantId } });
    if (!participant || participant.gameId !== gameId) {
      throw new GameEngineError("NOT_FOUND", "Participant not found");
    }
    if (participant.status === ParticipantStatus.DISQUALIFIED) {
      throw new GameEngineError("CONFLICT", "Participant is already disqualified");
    }

    await tx.participant.update({
      where: { id: participant.id },
      data: { status: ParticipantStatus.DISQUALIFIED },
    });

    const elimination = await tx.elimination.create({
      data: {
        gameId,
        participantId: participant.id,
        method: EliminationMethod.DISQUALIFIED,
        roleRevealStatus: RoleRevealStatus.REVEALED, // no reveal moment for a DQ
        revealedAt: new Date(),
      },
    });

    await writeAuditLog(tx, {
      gameId,
      actorType: ActorType.ADMIN,
      actorId: input.actorId,
      action: "participant_disqualified",
      targetType: "Participant",
      targetId: participant.id,
      metadata: { reason: input.reason ?? null },
    });

    await publishEvent(tx, {
      gameId,
      type: "PLAYER_DISQUALIFIED",
      payload: { participantId: participant.id, name: participant.name, reason: input.reason ?? null },
    });

    return elimination;
  });
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
      include: { participant: true },
    });
    if (!elimination || elimination.gameId !== gameId) {
      throw new GameEngineError("NOT_FOUND", "Elimination not found");
    }
    if (elimination.roleRevealStatus !== RoleRevealStatus.PENDING) {
      throw new GameEngineError("CONFLICT", "Role has already been revealed (idempotency guard)");
    }
    if (!elimination.participant.role) {
      throw new GameEngineError("VALIDATION", "Participant has no assigned role to reveal");
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
      targetType: "Participant",
      targetId: elimination.participantId,
    });

    await publishEvent(tx, {
      gameId,
      type: "ROLE_REVEALED",
      payload: {
        eliminationId,
        participantId: elimination.participantId,
        role: elimination.participant.role,
      },
    });
  });
}

/**
 * Impostor-triggered elimination by entering the victim's wearable Player Number (#01-#30).
 * Enforces weapon unlock check and 60-second kill cooldown.
 */
export async function eliminateByPlayerNumber(
  gameId: string,
  input: { impostorId: string; targetPlayerNumber: number },
  prisma: PrismaClient = defaultPrisma,
) {
  return prisma.$transaction(async (tx) => {
    const impostor = await tx.participant.findUnique({ where: { id: input.impostorId } });
    if (!impostor || impostor.gameId !== gameId) {
      throw new GameEngineError("NOT_FOUND", "Impostor not found");
    }
    if (impostor.role !== ParticipantRole.IMPOSTER) {
      throw new GameEngineError("FORBIDDEN", "Only Impostors can perform eliminations");
    }
    if (impostor.status !== ParticipantStatus.ALIVE) {
      throw new GameEngineError("FORBIDDEN", "Eliminated Impostors cannot perform kills");
    }
    if (!impostor.weaponUnlocked) {
      throw new GameEngineError("FORBIDDEN", "Must find and scan the physical murder weapon first");
    }

    const config = await tx.gameConfig.findUnique({ where: { gameId } });
    const cooldownMs = (config?.killCooldownSeconds ?? 60) * 1000;
    if (impostor.lastKillAt) {
      const elapsed = Date.now() - new Date(impostor.lastKillAt).getTime();
      if (elapsed < cooldownMs) {
        const remainingSec = Math.ceil((cooldownMs - elapsed) / 1000);
        throw new GameEngineError("CONFLICT", `Kill on cooldown! Wait ${remainingSec} seconds`);
      }
    }

    const target = await tx.participant.findFirst({
      where: {
        gameId,
        playerNumber: input.targetPlayerNumber,
      },
    });

    if (!target) {
      throw new GameEngineError("NOT_FOUND", `No player found with Number #${input.targetPlayerNumber}`);
    }
    if (target.status !== ParticipantStatus.ALIVE) {
      throw new GameEngineError("CONFLICT", `Player #${input.targetPlayerNumber} is already eliminated`);
    }
    if (target.id === impostor.id) {
      throw new GameEngineError("VALIDATION", "You cannot eliminate yourself");
    }
    if (target.role === ParticipantRole.IMPOSTER) {
      throw new GameEngineError("FORBIDDEN", "Cannot eliminate a fellow Impostor");
    }

    await tx.participant.update({
      where: { id: impostor.id },
      data: { lastKillAt: new Date() },
    });

    const elimination = await eliminateParticipantTx(tx, gameId, {
      participantId: target.id,
      method: EliminationMethod.ABILITY,
      actorId: impostor.id,
    });

    return { target, elimination };
  });
}

/**
 * Unlocks murder weapon for Impostor when scanning weapon QR code or secret key.
 */
export async function unlockWeapon(
  gameId: string,
  input: { impostorId: string; qrCode: string },
  prisma: PrismaClient = defaultPrisma,
) {
  return prisma.$transaction(async (tx) => {
    const impostor = await tx.participant.findUnique({ where: { id: input.impostorId } });
    if (!impostor || impostor.gameId !== gameId) {
      throw new GameEngineError("NOT_FOUND", "Participant not found");
    }
    if (impostor.role !== ParticipantRole.IMPOSTER) {
      throw new GameEngineError("FORBIDDEN", "Only Impostors can unlock murder weapons");
    }

    const config = await tx.gameConfig.findUnique({ where: { gameId } });
    const expectedQr = config?.weaponQrCode ?? "WEAPON-SUS-2026";

    if (input.qrCode.trim().toUpperCase() !== expectedQr.trim().toUpperCase()) {
      throw new GameEngineError("VALIDATION", "Invalid Weapon QR Code or Secret Code");
    }

    await tx.participant.update({
      where: { id: impostor.id },
      data: { weaponUnlocked: true },
    });

    return { success: true };
  });
}

/**
 * Impostor-triggered elimination by entering the victim's 4-char Badge ID (e.g. K7Q4).
 * Validates role, alive status, game state, badge existence, cooldown, atomic elimination,
 * and immediate win condition check.
 */
export async function eliminateByBadge(
  gameId: string,
  input: { impostorId: string; targetBadge: string },
  prisma: PrismaClient = defaultPrisma,
) {
  return prisma.$transaction(async (tx) => {
    const game = await tx.game.findUnique({ where: { id: gameId }, include: { config: true } });
    if (!game) throw new GameEngineError("NOT_FOUND", "Game not found");
    if (!LIVE_PLAY_STATUSES.includes(game.status)) {
      throw new GameEngineError("CONFLICT", `Game is not in active play (status: ${game.status})`);
    }

    const impostor = await tx.participant.findUnique({ where: { id: input.impostorId } });
    if (!impostor || impostor.gameId !== gameId) {
      throw new GameEngineError("NOT_FOUND", "Impostor not found in this game");
    }
    if (impostor.role !== ParticipantRole.IMPOSTER) {
      throw new GameEngineError("FORBIDDEN", "Only Impostors can perform player actions");
    }
    if (impostor.status !== ParticipantStatus.ALIVE) {
      throw new GameEngineError("FORBIDDEN", "Eliminated players cannot perform actions");
    }

    const cooldownSeconds = game.config?.killCooldownSeconds ?? 60;
    const cooldownMs = cooldownSeconds * 1000;
    if (impostor.lastKillAt) {
      const elapsed = Date.now() - new Date(impostor.lastKillAt).getTime();
      if (elapsed < cooldownMs) {
        const remainingSec = Math.ceil((cooldownMs - elapsed) / 1000);
        throw new GameEngineError("CONFLICT", `Action on cooldown! Wait ${remainingSec}s`);
      }
    }

    const normalizedBadge = input.targetBadge.trim().toUpperCase().replace(/^#/, "");
    if (!normalizedBadge || normalizedBadge.length < 2) {
      throw new GameEngineError("VALIDATION", "Invalid target badge ID");
    }

    const target = await tx.participant.findFirst({
      where: {
        gameId,
        badge: normalizedBadge,
      },
    });

    if (!target) {
      throw new GameEngineError("NOT_FOUND", `No player found with Badge #${normalizedBadge}`);
    }
    if (target.id === impostor.id) {
      throw new GameEngineError("VALIDATION", "You cannot target your own badge");
    }
    if (target.role === ParticipantRole.IMPOSTER) {
      throw new GameEngineError("FORBIDDEN", "Cannot eliminate a fellow Impostor");
    }
    if (target.status !== ParticipantStatus.ALIVE) {
      throw new GameEngineError("CONFLICT", `Player #${normalizedBadge} is already eliminated`);
    }

    await tx.participant.update({
      where: { id: impostor.id },
      data: { lastKillAt: new Date() },
    });

    const elimination = await eliminateParticipantTx(tx, gameId, {
      participantId: target.id,
      method: EliminationMethod.ABILITY,
      actorId: impostor.id,
    });

    const [aliveEngineers, aliveImposters] = await Promise.all([
      tx.participant.count({ where: { gameId, status: ParticipantStatus.ALIVE, role: ParticipantRole.ENGINEER } }),
      tx.participant.count({ where: { gameId, status: ParticipantStatus.ALIVE, role: ParticipantRole.IMPOSTER } }),
    ]);

    let gameEnded = false;
    if (aliveImposters >= aliveEngineers) {
      // Impostors win! Decisive eliminator is the single winner!
      await finalizeGameTx(tx, gameId, "IMPOSTERS", "Impostors equal or outnumber remaining engineers.", {
        declaredByHost: false,
        championParticipantId: impostor.id,
        actorId: impostor.id,
      });
      gameEnded = true;
    }

    return {
      success: true,
      target: { id: target.id, name: target.name, badge: target.badge },
      elimination,
      gameEnded,
      aliveEngineers,
      aliveImposters,
    };
  });
}


