import type { Prisma } from "@prisma/client";
import { GameEngineError } from "../errors";
import { EVENT_VISIBILITY, type GameEventType, type PublishInput } from "./types";

/** Prisma client or an active `$transaction` callback client — publishing
 * inside the same transaction as the state change it announces means a
 * rolled-back mutation never produces an event nobody's state agrees
 * with. The GameEvent row is on the `supabase_realtime` publication, so
 * the INSERT itself (visible only on COMMIT) is what fans out to
 * subscribed clients via Supabase Realtime "Postgres Changes". */
type TxClient = Prisma.TransactionClient;

/**
 * Writes the GameEvent row. This is the ONLY place that should call
 * `prisma.gameEvent.create` — every mutation in lib/game/actions goes
 * through this so the event log and the realtime channel (Supabase
 * Realtime, subscribed to this table) can never drift apart.
 */
export async function publishEvent<T extends GameEventType>(
  tx: TxClient,
  input: PublishInput<T>,
): Promise<void> {
  const visibility = EVENT_VISIBILITY[input.type];

  if (visibility === "PARTICIPANT" && !input.targetParticipantId) {
    throw new GameEngineError(
      "VALIDATION",
      `Event ${input.type} requires targetParticipantId (visibility = PARTICIPANT)`,
    );
  }
  if (visibility !== "PARTICIPANT" && input.targetParticipantId) {
    throw new GameEngineError(
      "VALIDATION",
      `Event ${input.type} must not set targetParticipantId (visibility = ${visibility})`,
    );
  }

  await tx.gameEvent.create({
    data: {
      gameId: input.gameId,
      type: input.type,
      visibility,
      targetParticipantId: input.targetParticipantId ?? null,
      payload: input.payload as Prisma.InputJsonValue,
    },
  });
}
