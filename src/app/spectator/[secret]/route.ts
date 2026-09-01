import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { createSpectatorSession } from "@/lib/auth/session";
import { clientIp, rateLimit } from "@/lib/rateLimit";

export async function GET(_request: Request, { params }: { params: Promise<{ secret: string }> }) {
  const { secret } = await params;

  const rl = await rateLimit(`secret:${clientIp(_request)}`, { limit: 30, windowSec: 300 });
  if (!rl.ok) {
    return NextResponse.json({ error: "RATE_LIMITED", message: "Too many attempts" }, { status: 429 });
  }

  const game = await prisma.game.findUnique({ where: { spectatorSecret: secret } });
  if (!game) {
    return NextResponse.json({ error: "NOT_FOUND", message: "Invalid or unknown spectator link" }, { status: 404 });
  }

  await createSpectatorSession(game.id);

  return NextResponse.redirect(new URL("/spectator", _request.url));
}
