import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { createSpectatorSession } from "@/lib/auth/session";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const roomCode = url.searchParams.get("roomCode")?.trim().toUpperCase();

  if (!roomCode) {
    return NextResponse.json({ error: "VALIDATION", message: "roomCode required" }, { status: 400 });
  }

  const game = await prisma.game.findFirst({
    where: {
      OR: [
        { roomCode },
        { spectatorSecret: roomCode },
        { adminSecret: roomCode },
      ],
    },
  });

  if (!game) {
    return NextResponse.json({ error: "NOT_FOUND", message: "Game room not found" }, { status: 404 });
  }

  await createSpectatorSession(game.id);

  return NextResponse.json({ success: true, gameId: game.id, roomCode: game.roomCode });
}
