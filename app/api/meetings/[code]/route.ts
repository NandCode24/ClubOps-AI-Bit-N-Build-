import { NextRequest, NextResponse } from "next/server";
import { getAuthUser, sql } from "../../../lib/db";

export const runtime = "nodejs";

// GET /api/meetings/[code] - Resolve meeting metadata, event, club, and permissions
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ code: string }> }
) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ success: false, message: "Unauthorized. Please sign in." }, { status: 401 });
    }

    const { code: meetingCode } = await context.params;

    const rows = await sql`
      SELECT 
        m.id,
        m.event_id,
        m.club_id,
        m.title,
        m.meeting_code,
        m.status,
        m.scheduled_time,
        m.started_at,
        m.ended_at,
        m.duration_seconds,
        m.recording_url,
        m.processing_status,
        m.is_summary_published,
        m.created_by,
        m.created_at,
        e.name as event_name,
        e.mode as event_mode,
        e.venue as event_venue,
        c.name as club_name,
        c.club_code,
        c.leader_id,
        u.full_name as creator_name
      FROM event_meetings m
      JOIN events e ON e.id = m.event_id
      JOIN clubs c ON c.id = m.club_id
      LEFT JOIN users u ON u.id = m.created_by
      WHERE m.meeting_code = ${meetingCode}
      LIMIT 1
    `;

    if (rows.length === 0) {
      return NextResponse.json({ success: false, message: "Meeting not found or invalid code." }, { status: 404 });
    }

    const meeting = rows[0];
    const isLeader = meeting.leader_id === user.id;
    const isCreator = meeting.created_by === user.id;
    const isHost = isLeader || isCreator;

    // Fetch existing meeting participants
    const participants = await sql`
      SELECT emp.id, emp.user_id, emp.display_name, emp.role, emp.joined_at, u.photo_url
      FROM event_meeting_participants emp
      LEFT JOIN users u ON u.id = emp.user_id
      WHERE emp.meeting_id = ${meeting.id}
      ORDER BY emp.joined_at ASC
    `;

    return NextResponse.json({
      success: true,
      meeting: {
        ...meeting,
        isHost,
        isLeader,
        currentUserId: user.id,
        currentUserName: user.full_name,
        currentUserPhoto: user.photo_url,
        participants,
      },
    });
  } catch (error) {
    console.error("Error resolving meeting:", error);
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : "Failed to resolve meeting." },
      { status: 500 }
    );
  }
}

// PATCH /api/meetings/[code] - Update meeting state (start, leave, update)
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ code: string }> }
) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const { code: meetingCode } = await context.params;
    const body = await request.json();

    const meetingRows = await sql`
      SELECT m.id, m.status, m.created_by, c.leader_id
      FROM event_meetings m
      JOIN clubs c ON c.id = m.club_id
      WHERE m.meeting_code = ${meetingCode}
      LIMIT 1
    `;

    if (meetingRows.length === 0) {
      return NextResponse.json({ success: false, message: "Meeting not found" }, { status: 404 });
    }

    const meeting = meetingRows[0];
    const isHost = meeting.leader_id === user.id || meeting.created_by === user.id;

    if (body.action === "join") {
      // Record participant entry
      await sql`
        INSERT INTO event_meeting_participants (
          meeting_id,
          user_id,
          display_name,
          role
        ) VALUES (
          ${meeting.id},
          ${user.id},
          ${user.full_name || "Participant"},
          ${isHost ? "host" : "participant"}
        )
      `;

      // If scheduled, transition to live
      if (meeting.status === "scheduled") {
        await sql`
          UPDATE event_meetings
          SET status = 'live', started_at = NOW()
          WHERE id = ${meeting.id}
        `;
      }
    }

    if (body.action === "leave") {
      await sql`
        UPDATE event_meeting_participants
        SET left_at = NOW()
        WHERE meeting_id = ${meeting.id} AND user_id = ${user.id} AND left_at IS NULL
      `;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error updating meeting:", error);
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : "Failed to update meeting" },
      { status: 500 }
    );
  }
}
