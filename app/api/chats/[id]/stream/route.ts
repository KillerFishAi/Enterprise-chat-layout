import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthTokenFromRequest, verifyAuthToken } from "@/lib/auth";
import { subscribeChatMessages } from "@/lib/chat-events";

type RouteParams = {
  params: Promise<{ id: string }>;
};

export async function GET(req: NextRequest, { params }: RouteParams) {
  const token = getAuthTokenFromRequest(req);
  if (!token) {
    return new Response("Unauthorized", { status: 401 });
  }
  const payload = verifyAuthToken(token);
  if (!payload) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { id } = await params;

  const isMember = await prisma.conversationMember.findFirst({
    where: { conversationId: id, userId: payload.userId },
  });

  if (!isMember) {
    return new Response("Forbidden", { status: 403 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      const send = (data: unknown) => {
        const json = JSON.stringify(data);
        controller.enqueue(encoder.encode(`data: ${json}\n\n`));
      };

      const unsubscribe = subscribeChatMessages(id, (message) => {
        send(message);
      });

      const heartbeat = setInterval(() => {
        controller.enqueue(encoder.encode(":\n\n"));
      }, 25000);

      controller.enqueue(encoder.encode('event: open\ndata: "ok"\n\n'));

      const close = () => {
        clearInterval(heartbeat);
        unsubscribe();
        try {
          controller.close();
        } catch {
          // already closed
        }
      };

      req.signal?.addEventListener("abort", close);
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
