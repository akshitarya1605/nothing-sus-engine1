import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/guards";
import { handleRoute, parseJsonBody } from "@/lib/api/respond";
import { prismaWrite } from "@/lib/db/prisma";
import { z } from "zod";

const deletePresetSchema = z.object({
  presetId: z.string().min(1),
});

export async function POST(request: Request) {
  return handleRoute(async () => {
    await requireAdmin();
    const { presetId } = await parseJsonBody(request, deletePresetSchema);
    await prismaWrite.gamePreset.delete({ where: { id: presetId } });
    return NextResponse.json({ success: true });
  });
}
