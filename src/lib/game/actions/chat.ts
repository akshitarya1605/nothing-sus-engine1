import type { PrismaClient } from "@prisma/client";
import { MeetingStatus, ParticipantStatus } from "@prisma/client";
import { prismaWrite as defaultPrisma } from "../../db/prisma";
import { GameEngineError } from "../errors";
import { publishEvent } from "../events/publisher";

const MAX_MESSAGE_LENGTH = 500;
const RATE_LIMIT_MAX_MESSAGES = 5;
const RATE_LIMIT_WINDOW_SECONDS = 10;

/** Strips markup rather than escaping it — chat is always rendered as
 * plain text on every client (never dangerouslySetInnerHTML'd), so
 * this is defense in depth, not the only thing standing between a
 * participant and a script tag. */
function sanitize(raw: string): string {
  return raw.replace(/<[^>]*>/g, "").trim();
}

/**
 * Alive participants only, and only while their meeting hasn't closed
 * (spec: discussion continues through the voting window). Eliminated
 * participants are read-only — enforced here, not just hidden in the
 * UI. Never delivered to the spectator/projector channel.
 */
export async function sendChatMessage(
  gameId: string,
  senderId: string,
  meetingId: string,
  rawMessage: string,
  prisma: PrismaClient = defaultPrisma,
) {
  const message = sanitize(rawMessage);
  if (!message) throw new GameEngineError("VALIDATION", "Message is empty");
  if (message.length > MAX_MESSAGE_LENGTH) {
    throw new GameEngineError("VALIDATION", `Message exceeds ${MAX_MESSAGE_LENGTH} characters`);
  }

  return prisma.$transaction(async (tx) => {
    const sender = await tx.participant.findUnique({ where: { id: senderId } });
    if (!sender || sender.gameId !== gameId) throw new GameEngineError("NOT_FOUND", "Participant not found");
    if (sender.status !== ParticipantStatus.ALIVE) {
      throw new GameEngineError("FORBIDDEN", "Eliminated participants cannot send chat messages");
    }

    const meeting = await tx.meeting.findUnique({ where: { id: meetingId } });
    if (!meeting || meeting.gameId !== gameId) throw new GameEngineError("NOT_FOUND", "Meeting not found");
    if (meeting.status !== MeetingStatus.ACTIVE && meeting.status !== MeetingStatus.VOTING) {
      throw new GameEngineError("CONFLICT", "This meeting's chat is closed");
    }

    const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_SECONDS * 1000);
    const recentCount = await tx.chatMessage.count({
      where: { senderId, meetingId, createdAt: { gte: windowStart } },
    });
    if (recentCount >= RATE_LIMIT_MAX_MESSAGES) {
      throw new GameEngineError(
        "CONFLICT",
        `Sending too fast — max ${RATE_LIMIT_MAX_MESSAGES} messages per ${RATE_LIMIT_WINDOW_SECONDS}s`,
      );
    }

    const chatMessage = await tx.chatMessage.create({
      data: { meetingId, senderId, message },
    });

    await publishEvent(tx, {
      gameId,
      type: "CHAT_MESSAGE_CREATED",
      payload: {
        id: chatMessage.id,
        meetingId,
        senderId,
        senderName: sender.name,
        message,
        createdAt: chatMessage.createdAt.toISOString(),
      },
    });

    return chatMessage;
  });
}

/** Admin moderation — soft delete, never a hard delete, so there's
 * still an audit trail of what was said. */
export async function deleteChatMessage(gameId: string, messageId: string, prisma: PrismaClient = defaultPrisma) {
  return prisma.$transaction(async (tx) => {
    const message = await tx.chatMessage.findUnique({ where: { id: messageId }, include: { meeting: true } });
    if (!message || message.meeting.gameId !== gameId) {
      throw new GameEngineError("NOT_FOUND", "Message not found");
    }
    await tx.chatMessage.update({ where: { id: messageId }, data: { deletedAt: new Date() } });
  });
}

/** Alive participants (their own game's meeting) and admin only —
 * never the spectator/projector. */
export async function getChatMessages(
  gameId: string,
  meetingId: string,
  prisma: PrismaClient = defaultPrisma,
) {
  const meeting = await prisma.meeting.findUnique({ where: { id: meetingId } });
  if (!meeting || meeting.gameId !== gameId) throw new GameEngineError("NOT_FOUND", "Meeting not found");

  const messages = await prisma.chatMessage.findMany({
    where: { meetingId, deletedAt: null },
    include: { sender: { select: { id: true, name: true } } },
    orderBy: { createdAt: "asc" },
    take: 200,
  });

  return messages.map((m) => ({
    id: m.id,
    senderId: m.sender.id,
    senderName: m.sender.name,
    message: m.message,
    createdAt: m.createdAt.toISOString(),
  }));
}
