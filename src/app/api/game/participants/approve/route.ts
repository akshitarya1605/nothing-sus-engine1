import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/guards";
import { handleRoute, parseJsonBody } from "@/lib/api/respond";
import { prismaWrite } from "@/lib/db/prisma";
import { z } from "zod";
import { GameEngineError } from "@/lib/game/errors";

const approveSchema = z.object({
  participantId: z.string().optional(),
  approveAll: z.boolean().optional(),
  action: z.enum(["approve", "disapprove"]).default("approve"),
});

export async function POST(request: Request) {
  return handleRoute(async () => {
    const session = await requireAdmin();
    const { participantId, approveAll, action } = await parseJsonBody(request, approveSchema);

    const isApproved = action === "approve";

    if (approveAll) {
      const updated = await prismaWrite.participant.updateMany({
        where: { gameId: session.gameId, isApproved: !isApproved },
        data: { isApproved, approvedAt: isApproved ? new Date() : null },
      });
      return NextResponse.json({ success: true, count: updated.count, isApproved });
    }

    if (!participantId) {
      throw new GameEngineError("VALIDATION", "participantId or approveAll required");
    }

    const participant = await prismaWrite.participant.update({
      where: { id: participantId },
      data: { isApproved, approvedAt: isApproved ? new Date() : null },
    });

    return NextResponse.json({ success: true, participant, isApproved });
  });
}
