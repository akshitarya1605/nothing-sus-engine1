import { NextResponse } from "next/server";
import { handleRoute, parseJsonBody } from "@/lib/api/respond";
import { prismaWrite } from "@/lib/db/prisma";
import { z } from "zod";
import { GameEngineError } from "@/lib/game/errors";
import { hashPassword } from "@/lib/auth/passwords";

const registerSchema = z.object({
  fullName: z.string().min(2, "Full name must be at least 2 characters").max(100),
  collegeRegId: z.string().min(3, "Registration ID is required").max(50),
  password: z.string().min(4, "Password must be at least 4 characters").max(100),
});

export async function POST(request: Request) {
  return handleRoute(async () => {
    const { fullName, collegeRegId, password } = await parseJsonBody(request, registerSchema);

    const formattedRegId = collegeRegId.trim().toUpperCase();
    const formattedName = fullName.trim();

    // Check if account already exists
    const existing = await prismaWrite.studentAccount.findUnique({
      where: { collegeRegId: formattedRegId },
    });

    if (existing) {
      if (existing.approvalStatus === "APPROVED") {
        throw new GameEngineError(
          "CONFLICT",
          "An account with this College Registration ID already exists and is approved. Please log in."
        );
      }
      throw new GameEngineError(
        "CONFLICT",
        "An account with this College Registration ID is already registered and waiting for ISA approval."
      );
    }

    const passwordHash = hashPassword(password);

    const account = await prismaWrite.studentAccount.create({
      data: {
        fullName: formattedName,
        collegeRegId: formattedRegId,
        passwordHash,
        approvalStatus: "PENDING",
      },
    });

    return NextResponse.json({
      success: true,
      message: "Account created! Your account is waiting for ISA approval. You can log in after approval.",
      account: {
        id: account.id,
        fullName: account.fullName,
        collegeRegId: account.collegeRegId,
        approvalStatus: account.approvalStatus,
      },
    });
  });
}
