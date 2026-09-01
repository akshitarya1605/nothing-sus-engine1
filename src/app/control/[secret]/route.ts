import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { createAdminSession } from "@/lib/auth/session";
import { clientIp, rateLimit } from "@/lib/rateLimit";

/**
 * Exchanges the secret admin URL for a session cookie, then redirects
 * to the clean /control dashboard — the secret itself never appears in
 * that URL or in any subsequent request. This is the ONLY way an admin
 * session is created; there is no passphrase form. See
 * docs/SECURITY.md "Admin access".
 */
export async function GET(_request: Request, { params }: { params: Promise<{ secret: string }> }) {
  const { secret } = await params;

  const rl = await rateLimit(`secret:${clientIp(_request)}`, { limit: 30, windowSec: 300 });
  if (!rl.ok) {
    return NextResponse.json({ error: "RATE_LIMITED", message: "Too many attempts" }, { status: 429 });
  }

  const game = await prisma.game.findUnique({ where: { adminSecret: secret } });
  if (!game) {
    return NextResponse.json({ error: "NOT_FOUND", message: "Invalid or unknown admin link" }, { status: 404 });
  }

  await createAdminSession(game.id);

  return NextResponse.redirect(new URL("/control", _request.url));
}
