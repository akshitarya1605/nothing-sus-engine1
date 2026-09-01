import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/guards";
import { ParticipantsEngine } from "@/lib/game/engine";
import { bulkImportParticipantsSchema } from "@/lib/game/validators";
import { handleRoute, parseJsonBody } from "@/lib/api/respond";

export async function POST(request: Request) {
  return handleRoute(async () => {
    const session = await requireAdmin();
    const { names } = await parseJsonBody(request, bulkImportParticipantsSchema);
    const created = await ParticipantsEngine.bulkImportParticipants(session.gameId, names);
    return NextResponse.json(created);
  });
}
