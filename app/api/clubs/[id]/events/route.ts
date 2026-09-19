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
    const isLeader = club.leader_id === user.id;

    let isMember = isLeader;
    if (!isLeader) {
      const memberRows = await sql`
        SELECT id FROM club_members WHERE club_id = ${clubId} AND user_id = ${user.id} LIMIT 1
      `;
      isMember = memberRows.length > 0;
    }

    if (!isMember) {
      return NextResponse.json(
        { success: false, message: "Access denied. Only club members or leaders can connect to real-time events." },
        { status: 403 }
      );
    }

    const encoder = new TextEncoder();
    const requestChannel = `club:${clubId}:request`;
    const taskChannel = `club:${clubId}:tasks`;
    const eventChannel = `club:${clubId}:events`;

    let cleanup: (() => void) | null = null;

    const stream = new ReadableStream({
      start(controller) {
        // Send initial connected confirmation event
        controller.enqueue(
          encoder.encode(`event: connected\ndata: ${JSON.stringify({ clubId, isLeader, status: "live" })}\n\n`)
        );

        // Real-time join request handler (leaders only)
        const onRequest = (payload: RealtimeJoinRequestEvent) => {
          if (!isLeader) return;
          try {
            controller.enqueue(
              encoder.encode(`event: new_join_request\ndata: ${JSON.stringify(payload)}\n\n`)
            );
          } catch (err) {
            console.error("Error streaming SSE join request:", err);
          }
        };

        // Real-time task handler
        const onTask = (payload: any) => {
          try {
            controller.enqueue(
              encoder.encode(`event: task_updated\ndata: ${JSON.stringify(payload)}\n\n`)
            );
          } catch (err) {
            console.error("Error streaming SSE task:", err);
          }
        };

        // Real-time event announcement handler
        const onEventUpdate = (payload: any) => {
          try {
            controller.enqueue(
              encoder.encode(`event: club_event_updated\ndata: ${JSON.stringify(payload)}\n\n`)
            );
          } catch (err) {
            console.error("Error streaming SSE event update:", err);
          }
        };

        if (isLeader) {
          clubEvents.on(requestChannel, onRequest);
        }
        clubEvents.on(taskChannel, onTask);
        clubEvents.on(eventChannel, onEventUpdate);

        // Keep-alive heartbeat every 15 seconds
        const heartbeat = setInterval(() => {
          try {
            controller.enqueue(encoder.encode(`: ping\n\n`));
          } catch {
            clearInterval(heartbeat);
          }
        }, 15000);

        cleanup = () => {
          if (isLeader) {
            clubEvents.off(requestChannel, onRequest);
          }
          clubEvents.off(taskChannel, onTask);
          clubEvents.off(eventChannel, onEventUpdate);
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
