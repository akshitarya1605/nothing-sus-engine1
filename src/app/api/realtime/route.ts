import { EventVisibility } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getSession } from "@/lib/auth/session";
import { getGameEventListener } from "@/lib/realtime/listener";

export const dynamic = "force-dynamic";

/**
 * Server-Sent Events stream, permission-filtered per the connected
 * session. This is a delivery mechanism only — every event it forwards
 * already exists as a GameEvent row (see lib/game/events/publisher.ts),
 * and a client that reconnects replays anything it missed via `?since=`
 * rather than assuming the stream never dropped a message.
 *
 * See lib/realtime/listener.ts for the LISTEN/NOTIFY plumbing and its
 * production-deployment caveat on stateless serverless hosts.
 */
export async function GET(request: Request) {
  const session = await getSession();
  if (!session) {
    return new Response("Unauthorized", { status: 401 });
  }

  const url = new URL(request.url);
  const since = BigInt(url.searchParams.get("since") ?? "0");

  const encoder = new TextEncoder();
  let cursor = since;
  let closed = false;

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: { id: string; type: string; payload: unknown; sequenceNumber: bigint }) => {
        if (closed) return;
        const line = `id: ${event.sequenceNumber}\ndata: ${JSON.stringify({
          id: event.id,
          type: event.type,
          payload: event.payload,
          sequenceNumber: event.sequenceNumber.toString(),
        })}\n\n`;
        controller.enqueue(encoder.encode(line));
      };

      const flush = async () => {
        const rows = await prisma.gameEvent.findMany({
          where: {
            gameId: session.gameId,
            sequenceNumber: { gt: cursor },
            OR: [
              { visibility: EventVisibility.PUBLIC },
              ...(session.role === "ADMIN" ? [{ visibility: EventVisibility.ADMIN }] : []),
              ...(session.role === "ADMIN" || session.role === "PROJECTOR"
                ? [{ visibility: EventVisibility.PROJECTOR }]
                : []),
              ...(session.role === "PLAYER" && session.playerId
                ? [{ visibility: EventVisibility.PLAYER, targetPlayerId: session.playerId }]
                : []),
            ],
          },
          orderBy: { sequenceNumber: "asc" },
        });
        for (const row of rows) {
          send(row);
          cursor = row.sequenceNumber;
        }
      };

      // catch up on anything since `since` immediately, don't wait for
      // the next NOTIFY
      await flush();

      const unsubscribe = getGameEventListener().subscribe((gameId) => {
        if (gameId === session.gameId) void flush();
      });

      const heartbeat = setInterval(() => {
        if (closed) return;
        controller.enqueue(encoder.encode(": heartbeat\n\n"));
      }, 25_000);

      const abort = () => {
        if (closed) return;
        closed = true;
        clearInterval(heartbeat);
        unsubscribe();
        try {
          controller.close();
        } catch {
          // already closed
        }
      };

      request.signal.addEventListener("abort", abort);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
