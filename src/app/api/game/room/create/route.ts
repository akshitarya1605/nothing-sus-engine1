import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/guards";
import { handleRoute, parseJsonBody } from "@/lib/api/respond";
import { prismaWrite } from "@/lib/db/prisma";
import { z } from "zod";
import { randomInt } from "node:crypto";
import { hashOtp } from "@/lib/game/otp";

const createRoomSchema = z.object({
  presetId: z.string().optional(),
  maxPlayers: z.number().int().min(1).max(100).default(30),
  imposterCount: z.number().int().min(1).max(20).default(3),
  killCooldownSeconds: z.number().int().min(5).max(600).default(60),
  weaponLocation: z.string().optional(),
  weaponClue: z.string().optional(),
});

function generateRoomCode(): string {
  const num = randomInt(1000, 9999);
  return `SUS-${num}`;
}

export async function POST(request: Request) {
  return handleRoute(async () => {
    const session = await requireAdmin();
    const data = await parseJsonBody(request, createRoomSchema);

    const roomCode = generateRoomCode();

    let presetTasks: Array<{
      title: string;
      description: string;
      roomName?: string | null;
      difficulty: "EASY" | "MEDIUM" | "HARD" | "EXPERT";
      points: number;
      estimatedMinutes: number;
      roundNumber: number;
    }> = [];

    let totalRounds = 4;
    let imposterCount = data.imposterCount;
    let killCooldownSeconds = data.killCooldownSeconds;
    let weaponLocation = data.weaponLocation;
    let weaponClue = data.weaponClue;
    let weaponQrCode = "WEAPON-SUS-2026";

    // If preset selected, pull config and tasks from preset
    if (data.presetId) {
      const preset = await prismaWrite.gamePreset.findUnique({
        where: { id: data.presetId },
        include: { tasks: true },
      });
      if (preset) {
        imposterCount = preset.imposterCount;
        killCooldownSeconds = preset.killCooldownSeconds;
        weaponLocation = preset.weaponLocation || weaponLocation;
        weaponClue = preset.weaponClue || weaponClue;
        weaponQrCode = preset.weaponQrCode || weaponQrCode;
        totalRounds = preset.totalRounds;
        presetTasks = preset.tasks;
      }
    }

    // Clean up previous match data for this game instance so lobby starts fresh (0 players)
    await prismaWrite.participant.deleteMany({ where: { gameId: session.gameId } });
    await prismaWrite.gameResult.deleteMany({ where: { gameId: session.gameId } });
    await prismaWrite.meeting.deleteMany({ where: { gameId: session.gameId } });
    await prismaWrite.task.deleteMany({ where: { gameId: session.gameId } });
    await prismaWrite.round.deleteMany({ where: { gameId: session.gameId } });

    // Update Game with new roomCode, maxPlayers, reset status to SETUP
    const updatedGame = await prismaWrite.game.upsert({
      where: { id: session.gameId },
      update: {
        roomCode,
        maxPlayers: data.maxPlayers,
        presetId: data.presetId || null,
        status: "SETUP",
        rolesLocked: false,
        currentRoundNumber: 0,
      },
      create: {
        id: session.gameId,
        name: "NOTHING SUS ARENA",
        adminSecret: "ARSH235",
        spectatorSecret: "TV2026",
        roomCode,
        maxPlayers: data.maxPlayers,
        presetId: data.presetId || null,
        status: "SETUP",
        rolesLocked: false,
        currentRoundNumber: 0,
      },
    });

    // Update GameConfig
    await prismaWrite.gameConfig.upsert({
      where: { gameId: session.gameId },
      update: {
        imposterCount,
        killCooldownSeconds,
        weaponLocation,
        weaponClue,
        weaponQrCode,
        totalRounds,
      },
      create: {
        gameId: session.gameId,
        imposterCount,
        killCooldownSeconds,
        weaponLocation,
        weaponClue,
        weaponQrCode,
        totalRounds,
      },
    });

    // If preset provided, generate rounds and tasks
    if (presetTasks.length > 0) {
      // Create initial rounds
      const roundMap = new Map<number, string>();
      for (let r = 1; r <= totalRounds; r++) {
        const round = await prismaWrite.round.upsert({
          where: { gameId_number: { gameId: session.gameId, number: r } },
          update: { name: `Round ${r}`, durationMinutes: 20, status: "SCHEDULED" },
          create: {
            gameId: session.gameId,
            number: r,
            name: `Round ${r}`,
            durationMinutes: 20,
            scheduledStartAt: new Date(),
            status: "SCHEDULED",
          },
        });
        roundMap.set(r, round.id);
      }

      // Populate tasks
      for (const pt of presetTasks) {
        const roundId = roundMap.get(pt.roundNumber) || roundMap.get(1)!;
        const otpPlain = String(randomInt(1000, 9999));
        const otpHash = hashOtp(otpPlain);

        await prismaWrite.task.create({
          data: {
            gameId: session.gameId,
            roundId,
            title: pt.title,
            description: pt.description,
            difficulty: pt.difficulty,
            points: pt.points,
            estimatedMinutes: pt.estimatedMinutes,
            otpHash,
            status: "AVAILABLE",
          },
        });
      }
    }

    return NextResponse.json({
      success: true,
      roomCode,
      game: updatedGame,
    });
  });
}
