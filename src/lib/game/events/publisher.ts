import type { Prisma } from "@prisma/client";
import { GameEngineError } from "../errors";
import { EVENT_VISIBILITY, type GameEventType, type PublishInput } from "./types";

/** Prisma client or an active `$transaction` callback client — publishing
 * inside the same transaction as the state change it announces means a
 * rolled-back mutation never produces an event nobody's state agrees
 * with. Postgres also holds NOTIFY delivery until COMMIT, so a listener
 * never sees the notification before the row is actually visible. */
type TxClient = Prisma.TransactionClient;

/**
 * Writes the GameEvent row and wakes up the realtime listener. This is
 * the ONLY place that should call `prisma.gameEvent.create` — every
 * mutation in lib/game/actions goes through this so the event log and
 * the realtime channel can never drift apart.
 */
export async function publishEvent<T extends GameEventType>(
  tx: TxClient,
  input: PublishInput<T>,
): Promise<void> {
  const visibility = EVENT_VISIBILITY[input.type];

  if (visibility === "PLAYER" && !input.targetPlayerId) {
    throw new GameEngineError(
      "VALIDATION",
      `Event ${input.type} requires targetPlayerId (visibility = PLAYER)`,
    );
  }
  if (visibility !== "PLAYER" && input.targetPlayerId) {
    throw new GameEngineError(
      "VALIDATION",
      `Event ${input.type} must not set targetPlayerId (visibility = ${visibility})`,
    );
  }

  await tx.gameEvent.create({
    data: {
      gameId: input.gameId,
      type: input.type,
      visibility,
      targetPlayerId: input.targetPlayerId ?? null,
      payload: input.payload as Prisma.InputJsonValue,
    },
  });

  // NOTIFY payload is just the game id — a wakeup signal, not a data
  // channel. Listeners re-query GameEvent for anything newer than their
  // cursor, filtered to what they're allowed to see. This also sidesteps
  // Postgres's ~8000 byte NOTIFY payload limit entirely.
  await tx.$executeRaw`SELECT pg_notify('game_events', ${input.gameId})`;
}
