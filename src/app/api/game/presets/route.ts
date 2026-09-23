import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/guards";
import { handleRoute, parseJsonBody } from "@/lib/api/respond";
import { prismaWrite } from "@/lib/db/prisma";
import { z } from "zod";

const taskItemSchema = z.object({
  title: z.string().min(1).max(120),
  description: z.string().min(1).max(1000),
  roomName: z.string().optional(),
  difficulty: z.enum(["EASY", "MEDIUM", "HARD", "EXPERT"]).default("EASY"),
  points: z.number().int().min(1).max(500).default(10),
  estimatedMinutes: z.number().int().min(1).max(120).default(5),
  roundNumber: z.number().int().min(1).max(10).default(1),
});

const createPresetSchema = z.object({
  name: z.string().min(2).max(100),
  description: z.string().optional(),
  maxPlayers: z.number().int().min(1).max(100).default(30),
  imposterCount: z.number().int().min(1).max(20).default(3),
  killCooldownSeconds: z.number().int().min(5).max(600).default(60),
  weaponLocation: z.string().optional(),
  weaponClue: z.string().optional(),
  weaponQrCode: z.string().optional(),
  totalRounds: z.number().int().min(1).max(10).default(4),
  tasks: z.array(taskItemSchema).default([]),
});

export async function GET() {
  return handleRoute(async () => {
    const presets = await prismaWrite.gamePreset.findMany({
      include: { tasks: true },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(presets);
  });
}

export async function POST(request: Request) {
  return handleRoute(async () => {
    await requireAdmin();
    const data = await parseJsonBody(request, createPresetSchema);

    const preset = await prismaWrite.gamePreset.create({
      data: {
        name: data.name,
        description: data.description,
        maxPlayers: data.maxPlayers,
        imposterCount: data.imposterCount,
        killCooldownSeconds: data.killCooldownSeconds,
        weaponLocation: data.weaponLocation,
        weaponClue: data.weaponClue,
        weaponQrCode: data.weaponQrCode || "WEAPON-SUS-2026",
        totalRounds: data.totalRounds,
        tasks: {
          create: data.tasks.map((t) => ({
            title: t.title,
            description: t.description,
            roomName: t.roomName || null,
            difficulty: t.difficulty,
            points: t.points,
            estimatedMinutes: t.estimatedMinutes,
            roundNumber: t.roundNumber,
          })),
        },
      },
      include: { tasks: true },
    });

    return NextResponse.json({ success: true, preset });
  });
}
