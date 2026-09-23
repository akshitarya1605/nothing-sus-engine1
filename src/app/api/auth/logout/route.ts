import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import {
  getParticipantSession,
  getAdminSession,
  getSpectatorSession,
  clearParticipantSessionCookie,
  clearAdminSessionCookie,
  clearSpectatorSessionCookie,
} from "@/lib/auth/session";
import { handleRoute } from "@/lib/api/respond";
import { hashToken } from "@/lib/auth/tokens";
import { cookies } from "next/headers";

/**
 * Logs out of every session cookie present on this device, not just one.
 *
 * All three session cookies (participant/admin/spectator) are independent
 * and routinely coexist in the same browser — a host who also opens the
 * player join link, or previews the projector screen, ends up holding all
 * three at once. The shared `/api/game/state` endpoint used to resolve
 * "whichever session is active" by a fixed priority order, so a leftover
 * cookie from one role could silently shadow another (see getSessionAs in
 * lib/auth/session.ts) — the previous fix for that is per-request; this
 * route is the self-serve escape hatch for a device that's accumulated
 * stale sessions: one call clears all of them, no manual cookie-clearing
 * required.
 */
export async function POST() {
  return handleRoute(async () => {
    const store = await cookies();

    const participant = await getParticipantSession();
    if (participant) {
      const raw = store.get("ns_participant")?.value;
      if (raw) {
        await prisma.participantSession.updateMany({
          where: { sessionTokenHash: hashToken(raw), revokedAt: null },
          data: { revokedAt: new Date(), revokedBy: "RELOGIN" },
        });
      }
    }
    await clearParticipantSessionCookie();

    const admin = await getAdminSession();
    if (admin) {
      const raw = store.get("ns_admin")?.value;
      if (raw) {
        await prisma.adminSession.updateMany({
          where: { tokenHash: hashToken(raw), revokedAt: null },
          data: { revokedAt: new Date() },
        });
      }
    }
    await clearAdminSessionCookie();

    const spectator = await getSpectatorSession();
    if (spectator) {
      const raw = store.get("ns_spectator")?.value;
      if (raw) {
        await prisma.spectatorSession.updateMany({
          where: { tokenHash: hashToken(raw), revokedAt: null },
          data: { revokedAt: new Date() },
        });
      }
    }
    await clearSpectatorSessionCookie();

    const { destroyStudentSession } = await import("@/lib/auth/studentSession");
    await destroyStudentSession();

    return NextResponse.json({ ok: true });
  });
}
