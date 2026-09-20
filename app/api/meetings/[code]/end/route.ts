import { NextRequest, NextResponse } from "next/server";
import { getAuthUser, sql } from "../../../../lib/db";
import { saveMeetingRecording } from "../../../../lib/storage";
import { processMeetingAudioPipeline } from "../../../../lib/meeting-ai";

export const runtime = "nodejs";

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

    const meetingRows = await sql`
      SELECT m.id, m.status, m.started_at, m.created_by, c.leader_id
      FROM event_meetings m
      JOIN clubs c ON c.id = m.club_id
      WHERE m.meeting_code = ${meetingCode}
      LIMIT 1
    `;

    if (meetingRows.length === 0) {
      return NextResponse.json({ success: false, message: "Meeting not found" }, { status: 404 });
    }

    const meeting = meetingRows[0];

    // Compute duration if started
    let durationSeconds = 0;
    if (meeting.started_at) {
      const startMs = new Date(meeting.started_at).getTime();
      durationSeconds = Math.max(0, Math.floor((Date.now() - startMs) / 1000));
    }

    // Check if multipart form data contains recorded audio
    const contentType = request.headers.get("content-type") || "";
    let audioBuffer: Buffer | null = null;
    let fileName = `meeting-${meetingCode}.webm`;
    let mimeType = "audio/webm";

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const file = formData.get("audio") as File | null;
      const durationParam = formData.get("duration");
      if (durationParam) {
        const parsed = parseInt(String(durationParam), 10);
        if (!isNaN(parsed) && parsed > 0) durationSeconds = parsed;
      }

      if (file && typeof file.size === "number" && file.size > 0) {
        fileName = file.name || fileName;
        mimeType = file.type || mimeType;
        const arrayBuf = await file.arrayBuffer();
        audioBuffer = Buffer.from(arrayBuf);
      }
    }

    let storedRecording = null;
    if (audioBuffer && audioBuffer.length > 0) {
      try {
        storedRecording = await saveMeetingRecording(audioBuffer, fileName, mimeType);
      } catch (storageErr) {
        console.error("Storage upload failed, continuing with meeting wrap-up:", storageErr);
      }
    }

    // Update meeting record to completed & transcribing
    const updated = await sql`
      UPDATE event_meetings
      SET 
        status = 'completed',
        ended_at = NOW(),
        duration_seconds = ${durationSeconds},
        recording_url = ${storedRecording?.url || null},
        recording_mime = ${storedRecording?.mimeType || mimeType},
        recording_size = ${storedRecording?.sizeBytes || (audioBuffer ? audioBuffer.length : 0)},
        processing_status = ${audioBuffer ? "transcribing" : "completed"},
        updated_at = NOW()
      WHERE id = ${meeting.id}
      RETURNING *
    `;

    // Mark participants departed
    await sql`
      UPDATE event_meeting_participants
      SET left_at = NOW()
      WHERE meeting_id = ${meeting.id} AND left_at IS NULL
    `;

    // If audio is present, trigger AI processing pipeline asynchronously!
    if (audioBuffer && audioBuffer.length > 0) {
      // Run in background without awaiting HTTP response
      setImmediate(() => {
        processMeetingAudioPipeline(meeting.id, audioBuffer!, fileName).catch((err: unknown) => {
          console.error("Background AI processing error:", err);
        });
      });
    }

    return NextResponse.json({
      success: true,
      message: "Meeting ended. Audio recording uploaded and AI analysis in progress.",
      meeting: updated[0],
    });
  } catch (error) {
    console.error("Error in POST /api/meetings/[code]/end:", error);
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : "Failed to end meeting" },
      { status: 500 }
    );
  }
}
