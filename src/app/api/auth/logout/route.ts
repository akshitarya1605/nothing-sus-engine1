import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getParticipantSession, clearParticipantSessionCookie } from "@/lib/auth/session";
import { handleRoute } from "@/lib/api/respond";
import { hashToken } from "@/lib/auth/tokens";
import { cookies } from "next/headers";

/** Participant logout — revokes the session row (not just the cookie),
 * so someone handing off a device can't leave a live session behind
 * that the code could still be "already active" against. */
export async function POST() {
  return handleRoute(async () => {
    const session = await getParticipantSession();
    if (session) {
      const store = await cookies();
      const raw = store.get("ns_participant")?.value;
      if (raw) {
        await prisma.participantSession.updateMany({
          where: { sessionTokenHash: hashToken(raw), revokedAt: null },
          data: { revokedAt: new Date(), revokedBy: "RELOGIN" },
        });
      }
    }
    await clearParticipantSessionCookie();
    return NextResponse.json({ ok: true });
  });
}
