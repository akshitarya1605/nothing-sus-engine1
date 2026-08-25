import { NextResponse } from "next/server";
import { requirePlayerSession } from "@/lib/auth/guards";
import { LocationsEngine } from "@/lib/game/engine";
import { scanLocationSchema } from "@/lib/game/validators";
import { handleRoute, parseJsonBody } from "@/lib/api/respond";

export async function POST(request: Request) {
  return handleRoute(async () => {
    const session = await requirePlayerSession();
    const { qrToken } = await parseJsonBody(request, scanLocationSchema);
    const result = await LocationsEngine.scanLocation(session.gameId, session.playerId, qrToken);
    return NextResponse.json(result);
  });
}
