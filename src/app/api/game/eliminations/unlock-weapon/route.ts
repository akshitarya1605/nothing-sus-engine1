import { NextResponse } from "next/server";
import { requireParticipant } from "@/lib/auth/guards";
import { EliminationsEngine } from "@/lib/game/engine";
import { handleRoute, parseJsonBody } from "@/lib/api/respond";
import { z } from "zod";

const unlockWeaponSchema = z.object({
  qrCode: z.string().min(1),
});

export async function POST(request: Request) {
  return handleRoute(async () => {
    const session = await requireParticipant();
    const { qrCode } = await parseJsonBody(request, unlockWeaponSchema);
    const result = await EliminationsEngine.unlockWeapon(session.gameId, {
      impostorId: session.participantId,
      qrCode,
    });
    return NextResponse.json(result);
  });
}
