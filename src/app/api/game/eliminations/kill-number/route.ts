import { NextResponse } from "next/server";
import { requireParticipant } from "@/lib/auth/guards";
import { EliminationsEngine } from "@/lib/game/engine";
import { handleRoute, parseJsonBody } from "@/lib/api/respond";
import { z } from "zod";

const killNumberSchema = z.object({
  targetPlayerNumber: z.coerce.number().int().min(1).max(999),
});

export async function POST(request: Request) {
  return handleRoute(async () => {
    const session = await requireParticipant();
    const { targetPlayerNumber } = await parseJsonBody(request, killNumberSchema);
    const result = await EliminationsEngine.eliminateByPlayerNumber(session.gameId, {
      impostorId: session.participantId,
      targetPlayerNumber,
    });
    return NextResponse.json(result);
  });
}
