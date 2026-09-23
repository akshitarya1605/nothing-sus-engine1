import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/guards";
import { ParticipantsEngine } from "@/lib/game/engine";
import { handleRoute, parseJsonBody } from "@/lib/api/respond";
import { z } from "zod";

const generateBatchSchema = z.object({
  count: z.number().int().min(1).max(100).default(30),
  batchNumber: z.number().int().min(1).default(1),
});

export async function POST(request: Request) {
  return handleRoute(async () => {
    const session = await requireAdmin();
    const { count, batchNumber } = await parseJsonBody(request, generateBatchSchema);
    const created = await ParticipantsEngine.generateBatchPINs(session.gameId, { count, batchNumber });
    return NextResponse.json({ success: true, count: created.length, participants: created });
  });
}
