import { NextResponse } from "next/server";
import { z } from "zod";
import { loginParticipant } from "@/lib/game/actions/participants";
import { handleRoute, parseJsonBody } from "@/lib/api/respond";
import { GameEngineError } from "@/lib/game/errors";
import { clientIp, rateLimit } from "@/lib/rateLimit";

const schema = z.object({
  code: z.string().min(1),
  roomCode: z.string().optional(),
});

export async function POST(request: Request) {
  return handleRoute(async () => {
    const rl = await rateLimit(`login:${clientIp(request)}`, { limit: 20, windowSec: 300 });
    if (!rl.ok) {
      throw new GameEngineError("VALIDATION", `Too many attempts. Try again in ${rl.retryAfter}s.`);
    }

    const { code, roomCode } = await parseJsonBody(request, schema);
    const result = await loginParticipant(code.trim().toUpperCase(), roomCode);

    if (!result.ok) {
      if (result.reason === "NOT_APPROVED") {
        throw new GameEngineError(
          "FORBIDDEN",
          "Your account is pending admin approval. Please ask the ISA host to approve your registration.",
        );
      }
      if (result.reason === "ALREADY_ACTIVE") {
        throw new GameEngineError(
          "CONFLICT",
          "This participant code is already active on another device.",
        );
      }
      throw new GameEngineError("VALIDATION", "Invalid PIN code or Registration ID");
    }

    return NextResponse.json({ participantId: result.participantId, name: result.name });
  });
}
