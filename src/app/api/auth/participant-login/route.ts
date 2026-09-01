import { NextResponse } from "next/server";
import { z } from "zod";
import { loginParticipant } from "@/lib/game/actions/participants";
import { handleRoute, parseJsonBody } from "@/lib/api/respond";
import { GameEngineError } from "@/lib/game/errors";
import { clientIp, rateLimit } from "@/lib/rateLimit";

const schema = z.object({ code: z.string().min(1) });

/** ONE code, no password, no gameId — the code alone identifies both
 * the game and the participant (globally unique). Blocks a second
 * concurrent device outright rather than silently taking over the
 * session — see lib/game/actions/participants.ts::loginParticipant and
 * docs/SECURITY.md "Single device session". */
export async function POST(request: Request) {
  return handleRoute(async () => {
    // 20 attempts / 5 min per IP — generous for a fat-fingered player,
    // tight enough that brute-forcing the code space is hopeless.
    const rl = await rateLimit(`login:${clientIp(request)}`, { limit: 20, windowSec: 300 });
    if (!rl.ok) {
      throw new GameEngineError("VALIDATION", `Too many attempts. Try again in ${rl.retryAfter}s.`);
    }

    const { code } = await parseJsonBody(request, schema);
    const result = await loginParticipant(code.trim().toUpperCase());

    if (!result.ok) {
      if (result.reason === "ALREADY_ACTIVE") {
        throw new GameEngineError(
          "CONFLICT",
          "This participant code is already active on another device.",
        );
      }
      // same error for "no such code" as any other validation failure —
      // never confirm/deny whether a code exists
      throw new GameEngineError("VALIDATION", "Invalid participant code");
    }

    return NextResponse.json({ participantId: result.participantId, name: result.name });
  });
}
