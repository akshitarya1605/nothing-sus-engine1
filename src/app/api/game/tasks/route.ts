import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/guards";
import { handleRoute, parseJsonBody } from "@/lib/api/respond";
import { prismaWrite } from "@/lib/db/prisma";
import { z } from "zod";
import { randomInt } from "node:crypto";
import { hashOtp } from "@/lib/game/otp";

export const dynamic = "force-dynamic";

const createTaskSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().min(1, "Description is required"),
  requiresPhoto: z.boolean().default(false),
  requiresAnswer: z.boolean().default(false),
  forImposter: z.boolean().default(false),
  difficulty: z.enum(["EASY", "MEDIUM", "HARD", "EXPERT"]).default("EASY"),
  points: z.number().int().min(1).default(10),
});

export async function GET() {
  return handleRoute(async () => {
    const session = await requireAdmin();
    const tasks = await prismaWrite.task.findMany({
      where: { gameId: session.gameId },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ success: true, tasks });
  });
}

export async function POST(request: Request) {
  return handleRoute(async () => {
    const session = await requireAdmin();
    const data = await parseJsonBody(request, createTaskSchema);

    // Find a round to attach it to, ideally Round 1 (this can be adjusted if rounds are strictly managed)
    const round1 = await prismaWrite.round.findFirst({
      where: { gameId: session.gameId, number: 1 },
    });

    if (!round1) {
      throw new Error("No rounds exist for this game yet. Start setup first.");
    }

    const otpPlain = String(randomInt(1000, 9999));
    const otpHash = hashOtp(otpPlain);

    const task = await prismaWrite.task.create({
      data: {
        gameId: session.gameId,
        roundId: round1.id,
        title: data.title,
        description: data.description,
        requiresPhoto: data.requiresPhoto,
        requiresAnswer: data.requiresAnswer,
        forImposter: data.forImposter,
        difficulty: data.difficulty,
        points: data.points,
        estimatedMinutes: 5,
        otpHash,
        status: "AVAILABLE",
      },
    });

    return NextResponse.json({ success: true, task });
  });
}
