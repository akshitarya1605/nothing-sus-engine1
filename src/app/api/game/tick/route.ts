import { NextResponse } from "next/server";
import { GameStatus } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { checkAutoAdvance } from "@/lib/game/engine";

export const dynamic = "force-dynamic";

/**
 * Time-based progression tick. `checkAutoAdvance` normally runs on every
 * `/api/game/state` read, but round timers must still advance when nobody
 * is polling (all phones asleep between rounds). A Vercel Cron
 * (see vercel.json) hits this every minute.
 *
 * Auth: Vercel Cron sends `Authorization: Bearer $CRON_SECRET` when the
 * CRON_SECRET env var is set. Locally, call it with that header or leave
 * CRON_SECRET unset to allow it.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    }
  }

  const live = await prisma.game.findMany({
    where: { status: GameStatus.LIVE },
    select: { id: true },
  });

  const results = await Promise.allSettled(live.map((g) => checkAutoAdvance(g.id)));
  const advanced = results.filter((r) => r.status === "fulfilled").length;
  const failed = results.filter((r) => r.status === "rejected").length;

  return NextResponse.json({ checked: live.length, advanced, failed });
}
