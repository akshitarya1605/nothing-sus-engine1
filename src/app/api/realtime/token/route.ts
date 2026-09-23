import { NextResponse } from "next/server";
import { getSessionAs } from "@/lib/auth/session";
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
export async function GET(request: Request) {
  return handleRoute(async () => {
    const as = new URL(request.url).searchParams.get("as");
    const session = await getSessionAs(as);
    if (!session) throw new GameEngineError("UNAUTHENTICATED", "No active session");

    const minted = await mintRealtimeToken(session);
    // gameId is also embedded in the token claims; returned here so the
    // client can set up its channel filter without a second round-trip.
    return NextResponse.json({ ...minted, gameId: session.gameId });
  });
}
