import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/guards";
import { GroupsEngine } from "@/lib/game/engine";
import { createGroupSchema } from "@/lib/game/validators";
import { handleRoute, parseJsonBody } from "@/lib/api/respond";

export async function POST(request: Request) {
  return handleRoute(async () => {
    const session = await requireAdmin();
    const { name } = await parseJsonBody(request, createGroupSchema);
    const group = await GroupsEngine.createGroup(session.gameId, name);
    return NextResponse.json(group);
  });
}
