import { NextRequest, NextResponse } from "next/server";
import { getAuthUser, sql } from "../../../../lib/db";
import { clubEvents } from "../../../../lib/events";
import type { SignalingMessage } from "../../../../lib/webrtc";

export const runtime = "nodejs";

// GET /api/meetings/[code]/signal - Real-time SSE Signaling Stream
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ code: string }> }
) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const { code: meetingCode } = await context.params;

    // Verify meeting exists
    const meetingRows = await sql`
      SELECT id, status, event_id, club_id FROM event_meetings
      WHERE meeting_code = ${meetingCode}
      LIMIT 1
    `;

    if (meetingRows.length === 0) {
      return NextResponse.json({ success: false, message: "Meeting not found" }, { status: 404 });
    }

    const meeting = meetingRows[0];
    const signalChannel = `meeting:${meetingCode}:signal`;

    let cleanup: (() => void) | null = null;

    const stream = new ReadableStream({
      start(controller) {
        const encoder = new TextEncoder();

        // Initial connected handshake
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: "connected", userId: user.id, meetingId: meeting.id })}\n\n`)
        );

        const onSignal = (msg: SignalingMessage) => {
          try {
            // If message targets a specific user and it's not this user, skip
            if (msg.targetId && msg.targetId !== user.id) {
              return;
            }
            // If sender is current user and not an echo-desired broadcast, skip
            if (msg.senderId === user.id && msg.type !== "peer_join") {
              return;
            }

            controller.enqueue(encoder.encode(`data: ${JSON.stringify(msg)}\n\n`));
          } catch (err) {
            console.error("Error pushing WebRTC signal through SSE:", err);
          }
        };

        clubEvents.on(signalChannel, onSignal);

        // Keep-alive heartbeat every 15s
        const heartbeat = setInterval(() => {
          try {
            controller.enqueue(encoder.encode(`: ping\n\n`));
          } catch {
            clearInterval(heartbeat);
          }
        }, 15000);

        cleanup = () => {
          clubEvents.off(signalChannel, onSignal);
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
    console.error("Error in WebRTC SSE signaling route:", error);
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : "Signaling stream error" },
      { status: 500 }
    );
  }
}

// POST /api/meetings/[code]/signal - Broadcast WebRTC Signaling Message
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ code: string }> }
) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const { code: meetingCode } = await context.params;
    const body: SignalingMessage = await request.json();

    if (!body || !body.type) {
      return NextResponse.json({ success: false, message: "Invalid signaling payload" }, { status: 400 });
    }

    // Attach verified server-side sender attributes
    const outgoingMessage: SignalingMessage = {
      ...body,
      meetingCode,
      senderId: user.id,
      senderName: user.full_name || body.senderName || "Member",
    };

    clubEvents.emit(`meeting:${meetingCode}:signal`, outgoingMessage);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error in POST WebRTC signal:", error);
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : "Error broadcasting signal" },
      { status: 500 }
    );
  }
}
