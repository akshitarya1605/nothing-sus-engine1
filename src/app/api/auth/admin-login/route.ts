import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { adminLoginSchema } from "@/lib/game/validators";
import { setSessionCookie } from "@/lib/auth/session";
import { handleRoute, parseJsonBody } from "@/lib/api/respond";
import { GameEngineError } from "@/lib/game/errors";

function safeCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/** Shared-passphrase auth for ADMIN and PROJECTOR — see
 * docs/SECURITY.md "Known limitations" for why there's no per-admin
 * account table yet. The comparison is constant-time to avoid a timing
 * side-channel on the passphrase. */
export async function POST(request: Request) {
  return handleRoute(async () => {
    const { gameId, passphrase, role } = await parseJsonBody(request, adminLoginSchema);

    const expected = role === "ADMIN" ? process.env.ADMIN_PASSPHRASE : process.env.PROJECTOR_PASSPHRASE;
    if (!expected || !safeCompare(passphrase, expected)) {
      throw new GameEngineError("UNAUTHENTICATED", "Invalid passphrase");
    }

    await setSessionCookie({ role, gameId });

    return NextResponse.json({ role, gameId });
  });
}
