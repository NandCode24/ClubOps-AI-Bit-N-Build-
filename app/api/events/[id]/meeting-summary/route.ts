import { NextRequest, NextResponse } from "next/server";
import { getAuthUser, sql } from "../../../../lib/db";
import { analyzeMeetingAudioWithGemini } from "../../../../lib/gemini";
import type { EventParticipantInfo } from "../../../../lib/groq";

export const runtime = "nodejs";

// Max file size: 25MB (Whisper audio standard limit)
const MAX_FILE_SIZE = 25 * 1024 * 1024;

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json(
        { success: false, message: "Unauthorized. Please sign in." },
        { status: 401 }
      );
    }

    const { id: eventId } = await context.params;

    // Verify event exists and retrieve leader & club details
    const eventRows = await sql`
      SELECT e.id, e.name as event_name, e.club_id, c.name as club_name, c.leader_id
      FROM events e
      JOIN clubs c ON c.id = e.club_id
      WHERE e.id = ${eventId}
      LIMIT 1
    `;

    if (eventRows.length === 0) {
      return NextResponse.json(
        { success: false, message: "Event not found." },
        { status: 404 }
      );
    }

    const event = eventRows[0];

    // Only Club Leader can access AI meeting summarizer and task extraction
    if (event.leader_id !== user.id) {
      return NextResponse.json(
        {
          success: false,
          message: "Access denied. Only the Club Leader can analyze meeting audio and extract tasks.",
        },
        { status: 403 }
      );
    }

    // Parse multipart form data
    const formData = await request.formData();
    const audioFile = formData.get("audio") as File | null;

    if (!audioFile || typeof audioFile.size !== "number" || audioFile.size === 0) {
      return NextResponse.json(
        { success: false, message: "Please provide a valid audio file to analyze." },
        { status: 400 }
      );
    }

    if (audioFile.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        {
          success: false,
          message: "Audio file exceeds maximum size limit (25MB). Please upload a shorter or compressed audio clip.",
        },
        { status: 400 }
      );
    }

    // Fetch event participants for intelligent name matching
    const participantRows = await sql`
      SELECT 
        ep.user_id as id,
        u.full_name as name,
        u.email,
        ep.assigned_role as role,
        u.skills
      FROM event_participants ep
      JOIN users u ON u.id = ep.user_id
      WHERE ep.event_id = ${eventId}
    `;

    // Also fetch club members as backup participants if event roster is sparse
    const clubMemberRows = await sql`
      SELECT 
        u.id,
        u.full_name as name,
        u.email,
        cm.assigned_role as role,
        u.skills
      FROM club_members cm
      JOIN users u ON u.id = cm.user_id
      WHERE cm.club_id = ${event.club_id}
    `;

    // Combine participants uniquely
    const participantMap = new Map<string, EventParticipantInfo>();
    for (const p of participantRows) {
      participantMap.set(String(p.id), {
        id: String(p.id),
        name: String(p.name),
        email: String(p.email),
        role: p.role ? String(p.role) : undefined,
        skills: Array.isArray(p.skills) ? p.skills : [],
      });
    }

    for (const cm of clubMemberRows) {
      if (!participantMap.has(String(cm.id))) {
        participantMap.set(String(cm.id), {
          id: String(cm.id),
          name: String(cm.name),
          email: String(cm.email),
          role: cm.role ? String(cm.role) : undefined,
          skills: Array.isArray(cm.skills) ? cm.skills : [],
        });
      }
    }

    const participants = Array.from(participantMap.values());

    // Convert uploaded audio to Buffer for Whisper processing
    const arrayBuffer = await audioFile.arrayBuffer();
    const audioBuffer = Buffer.from(arrayBuffer);

    // Multimodal Audio Analysis with Google Gemini (Transcription + Executive Summary + Task Delegation)
    const analysis = await analyzeMeetingAudioWithGemini(
      audioBuffer,
      audioFile.name || "meeting.wav",
      participants,
      event.event_name
    );

    return NextResponse.json({
      success: true,
      ...analysis,
      fileName: audioFile.name,
      fileSize: audioFile.size,
    });
  } catch (error) {
    console.error("Error in POST /api/events/[id]/meeting-summary:", error);
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Failed to analyze meeting audio.",
      },
      { status: 500 }
    );
  }
}
