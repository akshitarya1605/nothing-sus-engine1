import type { Prisma, PrismaClient } from "@prisma/client";
import { ParticipantRole, ParticipantStatus } from "@prisma/client";
import { randomInt } from "node:crypto";
import { prisma as defaultPrisma } from "../../db/prisma";
import { GameEngineError } from "../errors";
import { writeAuditLog, ActorType } from "../audit";
import { publishEvent } from "../events/publisher";
import { createParticipantSession } from "../../auth/session";

type TxClient = Prisma.TransactionClient;

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I

/** Cryptographically random — uses node:crypto's randomInt (rejection
 * sampling under the hood), not Math.random(). Format matches the
 * brief's example: "NS-7K4P92". */
function generateParticipantCode(): string {
  let suffix = "";
  for (let i = 0; i < 6; i++) {
    suffix += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  }
  return `NS-${suffix}`;
}

async function uniqueParticipantCode(tx: TxClient): Promise<string> {
  let code = generateParticipantCode();
  // extremely unlikely, but guard the unique constraint anyway
  for (let attempts = 0; attempts < 5; attempts++) {
    const existing = await tx.participant.findUnique({ where: { code } });
    if (!existing) break;
    code = generateParticipantCode();
  }
  return code;
}

export async function createParticipant(
  gameId: string,
  input: { name: string; groupId?: string | null },
  prisma: PrismaClient = defaultPrisma,
) {
  return prisma.$transaction(async (tx) => {
    const code = await uniqueParticipantCode(tx);

    const participant = await tx.participant.create({
      data: { gameId, code, name: input.name, groupId: input.groupId ?? null, status: ParticipantStatus.ALIVE },
    });

    await writeAuditLog(tx, {
      gameId,
      actorType: ActorType.ADMIN,
      actorId: "admin",
      action: "participant_created",
      targetType: "Participant",
      targetId: participant.id,
    });

    await publishEvent(tx, {
      gameId,
      type: "PLAYER_JOINED",
      payload: { participantId: participant.id, name: participant.name },
    });

    return participant;
  });
}

/** Admin bulk import — one call, many participants, each gets a fresh
 * unique code. Returns the created rows (with codes) for the admin to
 * print/distribute. */
export async function bulkImportParticipants(
  gameId: string,
  names: string[],
  prisma: PrismaClient = defaultPrisma,
) {
  return prisma.$transaction(async (tx) => {
    const created = [];
    for (const name of names) {
      const code = await uniqueParticipantCode(tx);
      created.push(
        await tx.participant.create({
          data: { gameId, code, name, status: ParticipantStatus.ALIVE },
        }),
      );
    }

    await writeAuditLog(tx, {
      gameId,
      actorType: ActorType.ADMIN,
      actorId: "admin",
      action: "participants_bulk_imported",
      metadata: { count: created.length },
    });

    return created;
  });
}

export async function updateParticipant(
  gameId: string,
  participantId: string,
  input: { name?: string; groupId?: string | null },
  prisma: PrismaClient = defaultPrisma,
) {
  return prisma.$transaction(async (tx) => {
    const participant = await tx.participant.findUnique({ where: { id: participantId } });
    if (!participant || participant.gameId !== gameId) {
      throw new GameEngineError("NOT_FOUND", "Participant not found");
    }

    await tx.participant.update({
      where: { id: participantId },
      data: { name: input.name, groupId: input.groupId },
    });

    await writeAuditLog(tx, {
      gameId,
      actorType: ActorType.ADMIN,
      actorId: "admin",
      action: "participant_updated",
      targetType: "Participant",
      targetId: participantId,
      metadata: input,
    });
  });
}

/** Manual, single-participant role assignment — for touch-ups after
 * (or instead of) the bulk AUTO ASSIGN pass. Blocked once roles are
 * locked, same as assignRoles. */
export async function setParticipantRole(
  gameId: string,
  participantId: string,
  role: ParticipantRole,
  prisma: PrismaClient = defaultPrisma,
) {
  return prisma.$transaction(async (tx) => {
    const game = await tx.game.findUnique({ where: { id: gameId } });
    if (!game) throw new GameEngineError("NOT_FOUND", "Game not found");
    if (game.rolesLocked) {
      throw new GameEngineError("CONFLICT", "Roles are locked — use the recovery operation");
    }
    const participant = await tx.participant.findUnique({ where: { id: participantId } });
    if (!participant || participant.gameId !== gameId) {
      throw new GameEngineError("NOT_FOUND", "Participant not found");
    }

    await tx.participant.update({ where: { id: participantId }, data: { role } });

    await writeAuditLog(tx, {
      gameId,
      actorType: ActorType.ADMIN,
      actorId: "admin",
      action: "participant_role_set_manually",
      targetType: "Participant",
      targetId: participantId,
      metadata: { role },
    });
  });
}

/** Admin recovery tool for a lost/replaced device — issues a fresh
 * code and revokes any active session, so the old code stops working
 * immediately. */
export async function resetParticipantCode(
  gameId: string,
  participantId: string,
  prisma: PrismaClient = defaultPrisma,
) {
  return prisma.$transaction(async (tx) => {
    const participant = await tx.participant.findUnique({ where: { id: participantId } });
    if (!participant || participant.gameId !== gameId) {
      throw new GameEngineError("NOT_FOUND", "Participant not found");
    }

    const code = await uniqueParticipantCode(tx);
    await tx.participant.update({ where: { id: participantId }, data: { code } });
    await tx.participantSession.updateMany({
      where: { participantId, revokedAt: null },
      data: { revokedAt: new Date(), revokedBy: "ADMIN" },
    });

    await writeAuditLog(tx, {
      gameId,
      actorType: ActorType.ADMIN,
      actorId: "admin",
      action: "participant_code_reset",
      targetType: "Participant",
      targetId: participantId,
    });

    return { code };
  });
}

/**
 * Recovery from a lost phone / crashed browser / device swap — revokes
 * any active session(s) for this participant so their code can be used
 * to log in again elsewhere. See docs/SECURITY.md "Single device
 * session".
 */
export async function forceLogoutParticipant(
  gameId: string,
  participantId: string,
  prisma: PrismaClient = defaultPrisma,
) {
  return prisma.$transaction(async (tx) => {
    const participant = await tx.participant.findUnique({ where: { id: participantId } });
    if (!participant || participant.gameId !== gameId) {
      throw new GameEngineError("NOT_FOUND", "Participant not found");
    }

    const result = await tx.participantSession.updateMany({
      where: { participantId, revokedAt: null },
      data: { revokedAt: new Date(), revokedBy: "ADMIN" },
    });

    await writeAuditLog(tx, {
      gameId,
      actorType: ActorType.ADMIN,
      actorId: "admin",
      action: "participant_force_logout",
      targetType: "Participant",
      targetId: participantId,
      metadata: { sessionsRevoked: result.count },
    });

    return { sessionsRevoked: result.count };
  });
}

export interface LoginResult {
  ok: true;
  participantId: string;
  name: string;
}
export interface LoginBlocked {
  ok: false;
  reason: "ALREADY_ACTIVE" | "INVALID_CODE";
}

/**
 * ONE code, no password. Server derives the participant from the code
 * (never trusts a participantId from the client) and enforces "one
 * active device at a time": a second login attempt while a session is
 * still live is blocked outright, not silently allowed to steal the
 * first device's session.
 */
export async function loginParticipant(
  code: string,
  prisma: PrismaClient = defaultPrisma,
): Promise<LoginResult | LoginBlocked> {
  const participant = await prisma.participant.findUnique({ where: { code } });
  if (!participant) return { ok: false, reason: "INVALID_CODE" };

  const activeSession = await prisma.participantSession.findFirst({
    where: { participantId: participant.id, revokedAt: null, expiresAt: { gt: new Date() } },
  });
  if (activeSession) return { ok: false, reason: "ALREADY_ACTIVE" };

  await createParticipantSession(participant.id);
  return { ok: true, participantId: participant.id, name: participant.name };
}

/**
 * Cryptographically-random role assignment (Fisher-Yates using
 * node:crypto.randomInt, not Math.random()). Every participant gets exactly
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

    const participants = await tx.participant.findMany({ where: { gameId }, select: { id: true } });
    if (participants.length === 0) {
      throw new GameEngineError("VALIDATION", "No participants to assign roles to");
    }
    if (imposterCount < 0 || imposterCount > participants.length) {
      throw new GameEngineError(
        "VALIDATION",
        `imposterCount must be between 0 and ${participants.length}`,
      );
    }

    // Fisher-Yates with a CSPRNG
    const shuffled = [...participants];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = randomInt(i + 1);
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    const imposterIds = new Set(shuffled.slice(0, imposterCount).map((p) => p.id));

    await Promise.all(
      shuffled.map((p) =>
        tx.participant.update({
          where: { id: p.id },
          data: { role: imposterIds.has(p.id) ? ParticipantRole.IMPOSTER : ParticipantRole.ENGINEER },
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
        totalParticipants: participants.length,
        imposterCount,
        // full mapping kept for audit/recovery — admin-only table
        assignment: shuffled.map((p) => ({
          participantId: p.id,
          role: imposterIds.has(p.id) ? "IMPOSTER" : "ENGINEER",
        })),
      },
    });

    return { totalParticipants: participants.length, imposterCount };
  });
}

export async function lockRoles(gameId: string, prisma: PrismaClient = defaultPrisma) {
  return prisma.$transaction(async (tx) => {
    const game = await tx.game.findUnique({ where: { id: gameId } });
    if (!game) throw new GameEngineError("NOT_FOUND", "Game not found");
    if (game.rolesLocked) {
      throw new GameEngineError("CONFLICT", "Roles are already locked");
    }

    const unassignedCount = await tx.participant.count({ where: { gameId, role: null } });
    if (unassignedCount > 0) {
      throw new GameEngineError(
        "VALIDATION",
        `${unassignedCount} participant(s) have no role assigned yet`,
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

    // Notify each participant of their own role now that it's final — a
    // PARTICIPANT-visibility event per participant, never a broadcast a participant
    // could subscribe to and read someone else's role from.
    const participants = await tx.participant.findMany({ where: { gameId }, select: { id: true, role: true } });
    for (const p of participants) {
      if (!p.role) continue;
      await publishEvent(tx, {
        gameId,
        type: "YOUR_ROLE_ASSIGNED",
        payload: { role: p.role },
        targetParticipantId: p.id,
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

export async function restoreParticipant(gameId: string, participantId: string, prisma: PrismaClient = defaultPrisma) {
  return prisma.$transaction(async (tx) => {
    const participant = await tx.participant.findUnique({ where: { id: participantId } });
    if (!participant || participant.gameId !== gameId) {
      throw new GameEngineError("NOT_FOUND", "Participant not found");
    }
    if (participant.status !== ParticipantStatus.ELIMINATED) {
      throw new GameEngineError("CONFLICT", `Participant is not ELIMINATED (status: ${participant.status})`);
    }

    await tx.participant.update({ where: { id: participantId }, data: { status: ParticipantStatus.ALIVE } });

    await writeAuditLog(tx, {
      gameId,
      actorType: ActorType.ADMIN,
      actorId: "admin",
      action: "participant_restored",
      targetType: "Participant",
      targetId: participantId,
    });

    await publishEvent(tx, {
      gameId,
      type: "PLAYER_RESTORED",
      payload: { participantId, name: participant.name, status: "ALIVE" },
    });
  });
}
