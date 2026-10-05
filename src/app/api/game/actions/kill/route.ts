import { NextResponse } from "next/server";
import { requireParticipant } from "@/lib/auth/guards";
import { eliminateByBadge } from "@/lib/game/actions/eliminations";
import { handleRoute, parseJsonBody } from "@/lib/api/respond";
import { z } from "zod";
import { prismaWrite } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

const killSchema = z.object({
  targetBadge: z.string().optional(),
  badge: z.string().optional(),
  targetParticipantId: z.string().optional(),
});

export async function POST(request: Request) {
  return handleRoute(async () => {
    const session = await requireParticipant();
    const body = await parseJsonBody(request, killSchema);

    let targetBadge = (body.targetBadge || body.badge || "").trim();

    // If targetParticipantId was provided instead of badge, look it up
    if (!targetBadge && body.targetParticipantId) {
      const target = await prismaWrite.participant.findUnique({
        where: { id: body.targetParticipantId },
        select: { badge: true },
      });
      if (target?.badge) {
        targetBadge = target.badge;
      }
    }

    if (!targetBadge) {
      return NextResponse.json(
        { ok: false, error: "VALIDATION", message: "Target Badge ID is required" },
        { status: 400 },
      );
    }

    const result = await eliminateByBadge(session.gameId, {
      impostorId: session.participantId,
      targetBadge,
    });

    return NextResponse.json({ ok: true, ...result });
  });
}
