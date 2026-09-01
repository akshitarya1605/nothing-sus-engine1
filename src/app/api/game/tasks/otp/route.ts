import { NextResponse } from "next/server";
import { requireParticipant } from "@/lib/auth/guards";
import { TasksEngine } from "@/lib/game/engine";
import { submitOtpSchema } from "@/lib/game/validators";
import { handleRoute, parseJsonBody } from "@/lib/api/respond";

/** The primary physical-task verification path — never returns or
 * accepts the correct OTP, only whether the submitted one matched. */
export async function POST(request: Request) {
  return handleRoute(async () => {
    const session = await requireParticipant();
    const { taskId, otp } = await parseJsonBody(request, submitOtpSchema);
    const result = await TasksEngine.submitTaskOtp(session.participantId, taskId, otp);
    return NextResponse.json(result);
  });
}
