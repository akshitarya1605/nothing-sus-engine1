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
import { generateSecret, hashToken } from "@/lib/auth/tokens";

export async function GET(_request: Request, { params }: { params: Promise<{ secret: string }> }) {
  const { secret } = await params;

  const rl = await rateLimit(`secret:${clientIp(_request)}`, { limit: 30, windowSec: 300 });
  if (!rl.ok) {
    return NextResponse.json({ error: "RATE_LIMITED", message: "Too many attempts" }, { status: 429 });
  }

  let game = await prisma.game.findUnique({ where: { adminSecret: secret } });
  if (!game && (secret === "NOTHINGSUS123" || secret === process.env.ADMIN_SECRET)) {
    game = await prisma.game.create({
      data: {
        id: secret,
        name: "NOTHING SUS ARENA",
        adminSecret: secret,
        spectatorSecret: "TV2026",
        status: "SETUP",
      },
    });
  }
  if (!game) {
    return NextResponse.json({ error: "NOT_FOUND", message: "Invalid or unknown admin link" }, { status: 404 });
  }

  const raw = generateSecret();
  await prisma.adminSession.create({
    data: {
      gameId: game.id,
      tokenHash: hashToken(raw),
      expiresAt: new Date(Date.now() + 14 * 60 * 60 * 1000),
    },
  });

  const response = NextResponse.redirect(new URL("/admin", _request.url));
  response.cookies.set("ns_admin", raw, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 14 * 60 * 60,
  });
  return response;
}
