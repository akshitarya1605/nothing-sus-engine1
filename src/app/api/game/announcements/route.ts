import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/guards";
import { AnnouncementsEngine } from "@/lib/game/engine";
import { handleRoute, parseJsonBody } from "@/lib/api/respond";

const schema = z.object({ message: z.string().min(1).max(280) });

export async function POST(request: Request) {
  return handleRoute(async () => {
    const session = await requireAdmin();
    const { message } = await parseJsonBody(request, schema);
    await AnnouncementsEngine.createAnnouncement(session.gameId, message);
    return NextResponse.json({ ok: true });
  });
}
