import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/guards";
import { handleRoute, parseJsonBody } from "@/lib/api/respond";
import { prismaWrite } from "@/lib/db/prisma";
import { GameEngineError } from "@/lib/game/errors";
import { generateUniqueGameBadge } from "@/lib/game/badges";
import { publishEvent } from "@/lib/game/events/publisher";
import { randomInt } from "node:crypto";
import { z } from "zod";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return handleRoute(async () => {
    await requireAdmin();

    const url = new URL(request.url);
    const search = url.searchParams.get("search")?.trim() || "";
    const filter = url.searchParams.get("filter")?.trim().toUpperCase() || "ALL";

    // 1. Fetch all student accounts with their latest participations and active games
    const accounts = await prismaWrite.studentAccount.findMany({
      where: search
        ? {
            OR: [
              { fullName: { contains: search, mode: "insensitive" } },
              { collegeRegId: { contains: search, mode: "insensitive" } },
            ],
          }
        : undefined,
      orderBy: { createdAt: "desc" },
      include: {
        participations: {
          orderBy: { createdAt: "desc" },
          take: 1,
          include: {
            game: {
              select: {
                id: true,
                roomCode: true,
                status: true,
              },
            },
          },
        },
      },
    });

    // 2. Format records and determine if active in game
    const formatted = accounts.map((acc) => {
      const latestPart = acc.participations[0];
      const isInActiveGame =
        latestPart &&
        latestPart.game &&
        latestPart.game.status !== "FINISHED" &&
        latestPart.status !== "DISQUALIFIED";

      return {
        id: acc.id,
        fullName: acc.fullName,
        collegeRegId: acc.collegeRegId,
        approvalStatus: acc.approvalStatus,
        approvedAt: acc.approvedAt ? acc.approvedAt.toISOString() : null,
        createdAt: acc.createdAt.toISOString(),
        activeParticipation: isInActiveGame
          ? {
              participantId: latestPart.id,
              gameId: latestPart.game.id,
              roomCode: latestPart.game.roomCode,
              gameStatus: latestPart.game.status,
              playerNumber: latestPart.playerNumber,
              role: latestPart.role,
              status: latestPart.status,
            }
          : null,
      };
    });

    // 3. Filter client records
    let filtered = formatted;
    if (filter === "PENDING") {
      filtered = formatted.filter((a) => a.approvalStatus === "PENDING");
    } else if (filter === "APPROVED") {
      filtered = formatted.filter((a) => a.approvalStatus === "APPROVED");
    } else if (filter === "REJECTED") {
      filtered = formatted.filter((a) => a.approvalStatus === "REJECTED");
    } else if (filter === "IN_GAME") {
      filtered = formatted.filter((a) => a.activeParticipation !== null);
    } else if (filter === "NOT_IN_GAME") {
      filtered = formatted.filter((a) => a.activeParticipation === null);
    }

    // 4. Compute overall stats
    const totalAccounts = accounts.length;
    const pendingCount = accounts.filter((a) => a.approvalStatus === "PENDING").length;
    const approvedCount = accounts.filter((a) => a.approvalStatus === "APPROVED").length;
    const inGameCount = formatted.filter((a) => a.activeParticipation !== null).length;

    return NextResponse.json({
      accounts: filtered,
      stats: {
        totalAccounts,
        pendingCount,
        approvedCount,
        inGameCount,
      },
    });
  });
}

const peopleActionSchema = z.object({
  action: z.enum(["approve", "reject", "reset_pending", "kick_game", "delete_account", "add_to_game"]),
  accountId: z.string().optional(),
  participantId: z.string().optional(),
});

export async function POST(request: Request) {
  return handleRoute(async () => {
    await requireAdmin();
    const data = await parseJsonBody(request, peopleActionSchema);

    if (data.action === "approve") {
      if (!data.accountId) throw new GameEngineError("VALIDATION", "accountId required");
      await prismaWrite.studentAccount.update({
        where: { id: data.accountId },
        data: { approvalStatus: "APPROVED", approvedAt: new Date() },
      });
      return NextResponse.json({ success: true, message: "Account approved" });
    }

    if (data.action === "reject") {
      if (!data.accountId) throw new GameEngineError("VALIDATION", "accountId required");
      await prismaWrite.studentAccount.update({
        where: { id: data.accountId },
        data: { approvalStatus: "REJECTED", approvedAt: null },
      });
      return NextResponse.json({ success: true, message: "Account rejected" });
    }

    if (data.action === "reset_pending") {
      if (!data.accountId) throw new GameEngineError("VALIDATION", "accountId required");
      await prismaWrite.studentAccount.update({
        where: { id: data.accountId },
        data: { approvalStatus: "PENDING", approvedAt: null },
      });
      return NextResponse.json({ success: true, message: "Account reset to pending" });
    }

    if (data.action === "kick_game") {
      if (!data.participantId) throw new GameEngineError("VALIDATION", "participantId required");
      await prismaWrite.participant.delete({
        where: { id: data.participantId },
      });
      return NextResponse.json({ success: true, message: "Player removed from room" });
    }

    if (data.action === "delete_account") {
      if (!data.accountId) throw new GameEngineError("VALIDATION", "accountId required");
      await prismaWrite.studentAccount.delete({
        where: { id: data.accountId },
      });
      return NextResponse.json({ success: true, message: "Account deleted" });
    }

    if (data.action === "add_to_game") {
      if (!data.accountId) throw new GameEngineError("VALIDATION", "accountId required");
      const student = await prismaWrite.studentAccount.findUnique({
        where: { id: data.accountId },
      });
      if (!student) throw new GameEngineError("NOT_FOUND", "Student account not found");

      const activeGame = await prismaWrite.game.findFirst({
        where: { status: { not: "FINISHED" } },
        orderBy: { createdAt: "desc" },
      });
      if (!activeGame) {
        throw new GameEngineError("NOT_FOUND", "No active game room. Create a room first.");
      }

      const existing = await prismaWrite.participant.findFirst({
        where: { gameId: activeGame.id, accountId: student.id },
      });
      if (existing) {
        return NextResponse.json({ success: true, message: `${student.fullName} is already in the game.` });
      }

      const count = await prismaWrite.participant.count({ where: { gameId: activeGame.id } });
      const badge = await generateUniqueGameBadge(prismaWrite, activeGame.id);
      const isMidgame = activeGame.status !== "SETUP" && activeGame.status !== "READY";

      const participant = await prismaWrite.participant.create({
        data: {
          gameId: activeGame.id,
          accountId: student.id,
          name: student.fullName,
          fullName: student.fullName,
          collegeRegId: student.collegeRegId,
          code: `NS-${randomInt(100000, 999999)}`,
          badge,
          playerNumber: count + 1,
          isApproved: true,
          status: "ALIVE",
          role: isMidgame ? "ENGINEER" : null,
        },
      });

      if (isMidgame) {
        const activeTasks = await prismaWrite.task.findMany({
          where: { gameId: activeGame.id, status: "AVAILABLE" },
        });
        for (const t of activeTasks) {
          await prismaWrite.participantTask.upsert({
            where: { participantId_taskId: { participantId: participant.id, taskId: t.id } },
            update: {},
            create: {
              participantId: participant.id,
              taskId: t.id,
              status: "AVAILABLE",
            },
          });
        }
      }

      try {
        await publishEvent(prismaWrite, {
          gameId: activeGame.id,
          type: "PLAYER_JOINED",
          payload: { participantId: participant.id, name: student.fullName },
        });
      } catch {
        /* non-fatal */
      }

      return NextResponse.json({
        success: true,
        message: `Injected ${student.fullName} into Game (#${badge})`,
      });
    }

    throw new GameEngineError("VALIDATION", "Unknown action");
  });
}
