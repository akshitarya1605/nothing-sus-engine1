import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/guards";
import { handleRoute } from "@/lib/api/respond";
import { prismaWrite } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return handleRoute(async () => {
    const session = await requireAdmin();
    const resolvedParams = await params;
    
    // Ensure the task belongs to the game
    const task = await prismaWrite.task.findUnique({
      where: { id: resolvedParams.id },
    });
    
    if (!task || task.gameId !== session.gameId) {
      throw new Error("Task not found or does not belong to this game");
    }
    
    await prismaWrite.task.delete({
      where: { id: resolvedParams.id },
    });
    
    return NextResponse.json({ success: true });
  });
}
