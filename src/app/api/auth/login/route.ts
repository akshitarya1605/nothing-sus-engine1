import { NextResponse } from "next/server";
import { handleRoute, parseJsonBody } from "@/lib/api/respond";
import { prismaWrite } from "@/lib/db/prisma";
import { z } from "zod";
import { GameEngineError } from "@/lib/game/errors";
import { verifyPassword } from "@/lib/auth/passwords";
import { createStudentSession } from "@/lib/auth/studentSession";
import { clientIp, rateLimit } from "@/lib/rateLimit";

const loginSchema = z.object({
  collegeRegId: z.string().min(1, "College Registration ID is required"),
  password: z.string().min(1, "Password is required"),
});

export async function POST(request: Request) {
  return handleRoute(async () => {
    const rl = await rateLimit(`login:${clientIp(request)}`, { limit: 15, windowSec: 300 });
    if (!rl.ok) {
      throw new GameEngineError("VALIDATION", `Too many attempts. Try again in ${rl.retryAfter}s.`);
    }

    const { collegeRegId, password } = await parseJsonBody(request, loginSchema);
    const formattedRegId = collegeRegId.trim().toUpperCase();

    const account = await prismaWrite.studentAccount.findUnique({
      where: { collegeRegId: formattedRegId },
    });

    if (!account) {
      throw new GameEngineError("VALIDATION", "Invalid College Registration ID or Password.");
    }

    const isValid = verifyPassword(password, account.passwordHash);
    if (!isValid) {
      throw new GameEngineError("VALIDATION", "Invalid College Registration ID or Password.");
    }

    if (account.approvalStatus !== "APPROVED") {
      throw new GameEngineError(
        "FORBIDDEN",
        "Your account is pending ISA approval. Please show your Student ID at the ISA Desk to get approved."
      );
    }

    await createStudentSession(account.id);

    return NextResponse.json({
      success: true,
      account: {
        id: account.id,
        fullName: account.fullName,
        collegeRegId: account.collegeRegId,
        approvalStatus: account.approvalStatus,
      },
    });
  });
}
