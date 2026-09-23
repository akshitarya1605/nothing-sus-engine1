import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/guards";
import { handleRoute, parseJsonBody } from "@/lib/api/respond";
import { prismaWrite } from "@/lib/db/prisma";
import { z } from "zod";

const createRoundSchema = z.object({
  name: z.string().min(1).max(80),
  durationMinutes: z.number().int().min(5).max(480).default(20),
  meetingAfterMinutes: z.number().int().min(1).max(480).optional(),
});

export async function POST(request: Request) {
  return handleRoute(async () => {
    const session = await requireAdmin();
    const { name, durationMinutes, meetingAfterMinutes } = await parseJsonBody(request, createRoundSchema);

    // Count existing rounds to determine the next number
    const existing = await prismaWrite.round.count({ where: { gameId: session.gameId } });
    const number = existing + 1;

    const round = await prismaWrite.round.create({
      data: {
        gameId: session.gameId,
        number,
        name,
        durationMinutes,
        meetingAfterMinutes: meetingAfterMinutes ?? null,
        scheduledStartAt: new Date(),
      },
    });

    return NextResponse.json(round);
  });
}
