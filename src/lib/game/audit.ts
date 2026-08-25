import type { Prisma } from "@prisma/client";
import { ActorType } from "@prisma/client";

type TxClient = Prisma.TransactionClient;

export interface AuditInput {
  gameId: string;
  actorType: ActorType;
  /** admin: "admin" (no per-admin accounts yet, see docs/SECURITY.md);
   * player: the player's id; system: null. */
  actorId: string | null;
  action: string;
  targetType?: string;
  targetId?: string;
  metadata?: unknown;
}

/** Every privileged mutation writes exactly one of these in the same
 * transaction as the change itself. Players cannot write or modify
 * this table — there is no route that exposes AuditLog writes to a
 * PLAYER session. */
export async function writeAuditLog(tx: TxClient, input: AuditInput): Promise<void> {
  await tx.auditLog.create({
    data: {
      gameId: input.gameId,
      actorType: input.actorType,
      actorId: input.actorId,
      action: input.action,
      targetType: input.targetType,
      targetId: input.targetId,
      metadata: input.metadata as Prisma.InputJsonValue,
    },
  });
}

export { ActorType };
