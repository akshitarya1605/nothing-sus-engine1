import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/guards";
import { PlayersEngine } from "@/lib/game/engine";
import { handleRoute, parseJsonBody } from "@/lib/api/respond";

const schema = z.object({ reason: z.string().min(1) });

/** The explicit, audited, reason-required recovery path — see
 * PlayersEngine.unlockRolesForRecovery and docs/SECURITY.md. */
export async function POST(request: Request) {
  return handleRoute(async () => {
    const session = await requireAdmin();
    const { reason } = await parseJsonBody(request, schema);
    await PlayersEngine.unlockRolesForRecovery(session.gameId, reason);
    return NextResponse.json({ ok: true });
  });
}
