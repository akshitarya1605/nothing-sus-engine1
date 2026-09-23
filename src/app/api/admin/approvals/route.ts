import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/guards";
import { handleRoute, parseJsonBody } from "@/lib/api/respond";
import { prismaWrite } from "@/lib/db/prisma";
import { z } from "zod";
import { GameEngineError } from "@/lib/game/errors";

const approvalActionSchema = z.object({
  accountId: z.string().optional(),
  action: z.enum(["approve", "reject"]).default("approve"),
  approveAll: z.boolean().optional(),
});

export async function GET() {
  return handleRoute(async () => {
    await requireAdmin();

    const pending = await prismaWrite.studentAccount.findMany({
      where: { approvalStatus: "PENDING" },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        fullName: true,
        collegeRegId: true,
        approvalStatus: true,
        createdAt: true,
      },
    });

    const approvedCount = await prismaWrite.studentAccount.count({
      where: { approvalStatus: "APPROVED" },
    });

    return NextResponse.json({
      pending,
      pendingCount: pending.length,
      approvedCount,
    });
  });
}

export async function POST(request: Request) {
  return handleRoute(async () => {
    await requireAdmin();
    const { accountId, action, approveAll } = await parseJsonBody(request, approvalActionSchema);

    const targetStatus = action === "approve" ? "APPROVED" : "REJECTED";

    if (approveAll) {
      const result = await prismaWrite.studentAccount.updateMany({
        where: { approvalStatus: "PENDING" },
        data: {
          approvalStatus: targetStatus,
          approvedAt: targetStatus === "APPROVED" ? new Date() : null,
        },
      });

      return NextResponse.json({
        success: true,
        count: result.count,
        status: targetStatus,
      });
    }

    if (!accountId) {
      throw new GameEngineError("VALIDATION", "accountId or approveAll required.");
    }

    const updated = await prismaWrite.studentAccount.update({
      where: { id: accountId },
      data: {
        approvalStatus: targetStatus,
        approvedAt: targetStatus === "APPROVED" ? new Date() : null,
      },
    });

    return NextResponse.json({
      success: true,
      account: {
        id: updated.id,
        fullName: updated.fullName,
        collegeRegId: updated.collegeRegId,
        approvalStatus: updated.approvalStatus,
      },
    });
  });
}
