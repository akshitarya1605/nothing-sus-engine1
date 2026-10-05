import { NextResponse } from "next/server";
import { requireParticipant } from "@/lib/auth/guards";
import { submitPuzzleTask } from "@/lib/game/actions/tasks";
import { handleRoute, parseJsonBody } from "@/lib/api/respond";
import { z } from "zod";

export const dynamic = "force-dynamic";

const submitPuzzleSchema = z.object({
  answer: z.string().optional(),
  taskId: z.string().optional(),
  solved: z.boolean().optional(),
});

export async function POST(request: Request) {
  return handleRoute(async () => {
    const session = await requireParticipant();
    const body = await parseJsonBody(request, submitPuzzleSchema);
    const result = await submitPuzzleTask(session.participantId, body);
    return NextResponse.json(result);
  });
}
