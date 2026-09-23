import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/guards";
import { handleRoute, parseJsonBody } from "@/lib/api/respond";
import { prismaWrite } from "@/lib/db/prisma";
import { z } from "zod";

const updateConfigSchema = z.object({
  // Weapon / impostor
  killCooldownSeconds: z.number().int().min(5).max(600).optional(),
  weaponLocation: z.string().nullable().optional(),
  weaponClue: z.string().nullable().optional(),
  weaponQrCode: z.string().nullable().optional(),
  // Game rules
  totalRounds: z.number().int().min(1).max(20).optional(),
  meetingAfterMinutes: z.number().int().min(1).max(180).optional(),
  imposterCount: z.number().int().min(0).max(20).optional(),
  allowEmergencyMeeting: z.boolean().optional(),
  revealRoleAfterVote: z.boolean().optional(),
  allowImposterElimination: z.boolean().optional(),
  voteTiePolicy: z.enum(["NO_ELIMINATION", "ADMIN_DECISION"]).optional(),
  engineerWinCondition: z.enum(["ENGINEERS_COMPLETE_TASKS", "FINAL_ROUND_RESULT"]).optional(),
  imposterWinCondition: z.enum(["IMPOSTERS_REMAIN", "FINAL_ROUND_RESULT"]).optional(),
  otpRateLimitMax: z.number().int().min(1).max(100).optional(),
  otpRateLimitWindowSeconds: z.number().int().min(10).max(3600).optional(),
});

export async function POST(request: Request) {
  return handleRoute(async () => {
    const session = await requireAdmin();
    const data = await parseJsonBody(request, updateConfigSchema);

    // Build update payload — only include defined fields
    const payload: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(data)) {
      if (v !== undefined) payload[k] = v;
    }

    // Upsert so it works even if GameConfig row doesn't exist yet
    const updated = await prismaWrite.gameConfig.upsert({
      where: { gameId: session.gameId },
      update: payload,
      create: { gameId: session.gameId, ...payload },
    });

    return NextResponse.json({ success: true, config: updated });
  });
}
