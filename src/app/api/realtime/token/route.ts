import { NextResponse } from "next/server";
import { getAnySession } from "@/lib/auth/session";
import { mintRealtimeToken } from "@/lib/realtime/token";
import { GameEngineError } from "@/lib/game/errors";
import { handleRoute } from "@/lib/api/respond";

export const dynamic = "force-dynamic";

/**
 * Mints the short-lived JWT the browser uses to authenticate its Supabase
 * Realtime subscription. Derived entirely from the caller's existing
 * (opaque, cookie-backed) session — no body, nothing persisted. The client
 * calls this on mount and again whenever the socket needs to reconnect.
 */
export async function GET() {
  return handleRoute(async () => {
    const session = await getAnySession();
    if (!session) throw new GameEngineError("UNAUTHENTICATED", "No active session");

    const minted = await mintRealtimeToken(session);
    return NextResponse.json(minted);
  });
}
