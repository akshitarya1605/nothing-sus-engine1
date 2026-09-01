import { NextResponse } from "next/server";
import { requireParticipant } from "@/lib/auth/guards";
import { ChatEngine } from "@/lib/game/engine";
import { sendChatMessageSchema } from "@/lib/game/validators";
import { handleRoute, parseJsonBody } from "@/lib/api/respond";

export async function POST(request: Request) {
  return handleRoute(async () => {
    const session = await requireParticipant();
    const { meetingId, message } = await parseJsonBody(request, sendChatMessageSchema);
    const chatMessage = await ChatEngine.sendChatMessage(session.gameId, session.participantId, meetingId, message);
    return NextResponse.json(chatMessage);
  });
}
