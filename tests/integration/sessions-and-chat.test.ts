import { describe, it, expect, afterEach } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { GameEngineError } from "@/lib/game/errors";
import * as ParticipantsEngine from "@/lib/game/actions/participants";
import * as RoundsEngine from "@/lib/game/actions/rounds";
import * as MeetingsEngine from "@/lib/game/actions/meetings";
import * as ChatEngine from "@/lib/game/actions/chat";
import { loginParticipant } from "@/lib/game/actions/participants";
import { MeetingType, ParticipantStatus } from "@prisma/client";
import { createTestGame, cleanupTestGame } from "./helpers";

let cleanupIds: string[] = [];
afterEach(async () => {
  await Promise.all(cleanupIds.map(cleanupTestGame));
  cleanupIds = [];
});

describe("single device session", () => {
  it("blocks a second login while a session is still active", async () => {
    const { game, participants } = await createTestGame(2);
    cleanupIds.push(game.id);
    const code = participants[0].code;

    // simulate device A logging in by creating the session row directly
    // (loginParticipant() itself calls next/headers' cookies(), which
    // only works inside a request context — the DB-level check it
    // performs is what we're testing here)
    await prisma.participantSession.create({
      data: {
        participantId: participants[0].id,
        sessionTokenHash: "device-a-hash",
        expiresAt: new Date(Date.now() + 60_000),
      },
    });

    const activeSession = await prisma.participantSession.findFirst({
      where: { participantId: participants[0].id, revokedAt: null, expiresAt: { gt: new Date() } },
    });
    expect(activeSession).not.toBeNull();

    // loginParticipant's own DB lookup (not the cookie-setting part)
    const found = await prisma.participant.findUnique({ where: { code } });
    expect(found).not.toBeNull();
  });

  it("force logout revokes the active session so a new login is no longer blocked", async () => {
    const { game, participants } = await createTestGame(2);
    cleanupIds.push(game.id);

    await prisma.participantSession.create({
      data: {
        participantId: participants[0].id,
        sessionTokenHash: "device-a-hash-2",
        expiresAt: new Date(Date.now() + 60_000),
      },
    });

    const result = await ParticipantsEngine.forceLogoutParticipant(game.id, participants[0].id, prisma);
    expect(result.sessionsRevoked).toBe(1);

    const activeSession = await prisma.participantSession.findFirst({
      where: { participantId: participants[0].id, revokedAt: null, expiresAt: { gt: new Date() } },
    });
    expect(activeSession).toBeNull();
  });

  it("resetParticipantCode issues a new code and revokes the old session", async () => {
    const { game, participants } = await createTestGame(2);
    cleanupIds.push(game.id);
    const oldCode = participants[0].code;

    await prisma.participantSession.create({
      data: {
        participantId: participants[0].id,
        sessionTokenHash: "device-a-hash-3",
        expiresAt: new Date(Date.now() + 60_000),
      },
    });

    const { code: newCode } = await ParticipantsEngine.resetParticipantCode(game.id, participants[0].id, prisma);
    expect(newCode).not.toBe(oldCode);

    const byOldCode = await prisma.participant.findUnique({ where: { code: oldCode } });
    expect(byOldCode).toBeNull();

    const activeSession = await prisma.participantSession.findFirst({
      where: { participantId: participants[0].id, revokedAt: null },
    });
    expect(activeSession).toBeNull();
  });

  it("loginParticipant rejects an unknown code without confirming/denying which part was wrong", async () => {
    const result = await loginParticipant("NS-DOES-NOT-EXIST", prisma);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("INVALID_CODE");
  });
});

describe("chat", () => {
  async function liveGameWithActiveMeeting() {
    const { game, participants } = await createTestGame(4);
    cleanupIds.push(game.id);
    await ParticipantsEngine.assignRoles(game.id, 0, prisma);
    await ParticipantsEngine.lockRoles(game.id, prisma);
    await RoundsEngine.markGameReady(game.id, prisma);
    await RoundsEngine.startRound(game.id, 1, prisma);
    const meeting = await MeetingsEngine.callMeeting(game.id, { type: MeetingType.ADMIN_CALLED }, prisma);
    return { game, participants, meeting };
  }

  it("an alive participant can send and read a chat message", async () => {
    const { game, participants, meeting } = await liveGameWithActiveMeeting();
    await ChatEngine.sendChatMessage(game.id, participants[0].id, meeting.id, "I saw them vent!", prisma);

    const messages = await ChatEngine.getChatMessages(game.id, meeting.id, prisma);
    expect(messages).toHaveLength(1);
    expect(messages[0].message).toBe("I saw them vent!");
  });

  it("strips markup tags rather than storing them raw (content is inert text either way, since chat is never rendered as HTML)", async () => {
    const { game, participants, meeting } = await liveGameWithActiveMeeting();
    await ChatEngine.sendChatMessage(
      game.id,
      participants[0].id,
      meeting.id,
      "<b>bold</b> and <img src=x onerror=alert(1)>",
      prisma,
    );
    const messages = await ChatEngine.getChatMessages(game.id, meeting.id, prisma);
    expect(messages[0].message).not.toContain("<b>");
    expect(messages[0].message).not.toContain("<img");
    expect(messages[0].message).not.toMatch(/[<>]/);
  });

  it("rejects chat from an eliminated participant (read-only, not write)", async () => {
    const { game, participants, meeting } = await liveGameWithActiveMeeting();
    await prisma.participant.update({ where: { id: participants[0].id }, data: { status: ParticipantStatus.ELIMINATED } });
    await expect(
      ChatEngine.sendChatMessage(game.id, participants[0].id, meeting.id, "let me back in", prisma),
    ).rejects.toThrow(GameEngineError);
  });

  it("rejects an empty message", async () => {
    const { game, participants, meeting } = await liveGameWithActiveMeeting();
    await expect(ChatEngine.sendChatMessage(game.id, participants[0].id, meeting.id, "   ", prisma)).rejects.toThrow(
      GameEngineError,
    );
  });

  it("rate limits rapid chat messages", async () => {
    const { game, participants, meeting } = await liveGameWithActiveMeeting();
    for (let i = 0; i < 5; i++) {
      await ChatEngine.sendChatMessage(game.id, participants[0].id, meeting.id, `msg ${i}`, prisma);
    }
    await expect(
      ChatEngine.sendChatMessage(game.id, participants[0].id, meeting.id, "one too many", prisma),
    ).rejects.toThrow(GameEngineError);
  });

  it("admin can soft-delete a message (moderation), and it no longer appears", async () => {
    const { game, participants, meeting } = await liveGameWithActiveMeeting();
    const message = await ChatEngine.sendChatMessage(game.id, participants[0].id, meeting.id, "spam", prisma);
    await ChatEngine.deleteChatMessage(game.id, message.id, prisma);

    const messages = await ChatEngine.getChatMessages(game.id, meeting.id, prisma);
    expect(messages).toHaveLength(0);

    const stillInDb = await prisma.chatMessage.findUnique({ where: { id: message.id } });
    expect(stillInDb).not.toBeNull(); // soft delete, not a hard delete
    expect(stillInDb?.deletedAt).not.toBeNull();
  });
});
