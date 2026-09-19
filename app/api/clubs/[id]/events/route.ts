import { NextRequest, NextResponse } from "next/server";
import { getAuthUser, sql } from "../../../../lib/db";
import { clubEvents, RealtimeJoinRequestEvent } from "../../../../lib/events";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
    }

    const { id: clubId } = await context.params;

    // Verify user is the leader
    const clubRows = await sql`
      SELECT id, name, leader_id FROM clubs WHERE id = ${clubId} LIMIT 1
    `;

    if (clubRows.length === 0) {
      return NextResponse.json({ success: false, message: "Club not found." }, { status: 404 });
    }

    const club = clubRows[0];
    if (club.leader_id !== user.id) {
      return NextResponse.json(
        { success: false, message: "Only the club leader can stream club real-time events." },
        { status: 403 }
      );
    }

    const encoder = new TextEncoder();
    const eventChannel = `club:${clubId}:request`;

    let cleanup: (() => void) | null = null;

    const stream = new ReadableStream({
      start(controller) {
        // Send initial connected confirmation event
        controller.enqueue(
          encoder.encode(`event: connected\ndata: ${JSON.stringify({ clubId, status: "live" })}\n\n`)
        );

        // Real-time join request handler
        const onRequest = (payload: RealtimeJoinRequestEvent) => {
          try {
            controller.enqueue(
              encoder.encode(`event: new_join_request\ndata: ${JSON.stringify(payload)}\n\n`)
            );
          } catch (err) {
            console.error("Error streaming SSE event:", err);
          }
        };

        clubEvents.on(eventChannel, onRequest);

        // Keep-alive heartbeat every 15 seconds
        const heartbeat = setInterval(() => {
          try {
            controller.enqueue(encoder.encode(`: ping\n\n`));
          } catch {
            clearInterval(heartbeat);
          }
        }, 15000);

        cleanup = () => {
          clubEvents.off(eventChannel, onRequest);
          clearInterval(heartbeat);
        };
      },
      cancel() {
        if (cleanup) cleanup();
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "Content-Encoding": "none",
      },
    });
  } catch (error) {
    console.error("Error in SSE events route:", error);
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Failed to open stream.",
      },
      { status: 500 }
    );
  }
}
