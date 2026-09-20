import { NextRequest, NextResponse } from "next/server";
import { getAuthUser, sql } from "../../../../lib/db";

export const runtime = "nodejs";

// GET /api/meetings/[code]/summary - Fetch full meeting intelligence summary
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

    const rows = await sql`
      SELECT 
        m.id,
        m.meeting_code,
        m.event_id,
        m.club_id,
        m.title,
        m.status,
        m.scheduled_time,
        m.started_at,
        m.ended_at,
        m.duration_seconds,
        m.transcript,
        m.summary_title,
        m.summary_content,
        m.summary_decisions,
        m.extracted_tasks,
        m.summary_risks,
        m.summary_next_steps,
        m.recording_url,
        m.recording_mime,
        m.recording_size,
        m.processing_status,
        m.processing_error,
        m.is_summary_published,
        m.published_announcement_id,
        m.created_by,
        m.created_at,
        e.name as event_name,
        c.name as club_name,
        c.leader_id
      FROM event_meetings m
      JOIN events e ON e.id = m.event_id
      JOIN clubs c ON c.id = m.club_id
      WHERE m.meeting_code = ${meetingCode}
      LIMIT 1
    `;

    if (rows.length === 0) {
      return NextResponse.json({ success: false, message: "Meeting not found" }, { status: 404 });
    }

    const meeting = rows[0];
    const isLeader = meeting.leader_id === user.id;

    // Fetch meeting participants
    const participants = await sql`
      SELECT emp.id, emp.user_id, emp.display_name, emp.role, emp.joined_at, u.photo_url
      FROM event_meeting_participants emp
      LEFT JOIN users u ON u.id = emp.user_id
      WHERE emp.meeting_id = ${meeting.id}
      ORDER BY emp.joined_at ASC
    `;

    return NextResponse.json({
      success: true,
      summary: {
        ...meeting,
        isLeader,
        participants,
      },
    });
  } catch (error) {
    console.error("Error fetching meeting summary:", error);
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : "Failed to load summary" },
      { status: 500 }
    );
  }
}
