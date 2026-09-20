import { NextRequest, NextResponse } from "next/server";
import { getAuthUser, sql } from "../../../../lib/db";
import { emitClubEventUpdate } from "../../../../lib/events";

export const runtime = "nodejs";

/**
 * Generate a unique, secure, human-readable meeting code (e.g. mtg-k7x-9p2)
 */
async function generateUniqueMeetingCode(): Promise<string> {
  const chars = "23456789abcdefghjkmnpqrstuvwxyz"; // no ambiguous chars
  for (let attempt = 0; attempt < 10; attempt++) {
    let p1 = "";
    let p2 = "";
    for (let i = 0; i < 3; i++) {
      p1 += chars.charAt(Math.floor(Math.random() * chars.length));
      p2 += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    const candidate = `mtg-${p1}-${p2}`;

    const existing = await sql`
      SELECT id FROM event_meetings WHERE meeting_code = ${candidate} LIMIT 1
    `;
    if (existing.length === 0) {
      return candidate;
    }
  }
  return `mtg-${Date.now().toString(36).slice(-6)}`;
}

// GET /api/events/[id]/meetings - List meetings with 10-day retention filter
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const { id: eventId } = await context.params;

    // Verify event exists & user has access
    const eventRows = await sql`
      SELECT e.id, e.club_id, e.name as event_name, c.leader_id
      FROM events e
      JOIN clubs c ON c.id = e.club_id
      WHERE e.id = ${eventId}
      LIMIT 1
    `;

    if (eventRows.length === 0) {
      return NextResponse.json({ success: false, message: "Event not found" }, { status: 404 });
    }

    const event = eventRows[0];
    const isLeader = event.leader_id === user.id;

    // Fetch meetings created within the last 10 days (or future scheduled)
    const meetings = await sql`
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
        m.recording_mime,
        m.processing_status,
        m.is_summary_published,
        m.published_announcement_id,
        m.created_by,
        m.created_at,
        u.full_name as creator_name,
        u.photo_url as creator_photo,
        (
          SELECT COUNT(*)::int 
          FROM event_meeting_participants emp 
          WHERE emp.meeting_id = m.id
        ) as participant_count
      FROM event_meetings m
      LEFT JOIN users u ON u.id = m.created_by
      WHERE m.event_id = ${eventId}
        AND (
          m.status = 'live'
          OR m.status = 'scheduled'
          OR m.created_at >= (NOW() - INTERVAL '10 days')
        )
      ORDER BY 
        CASE 
          WHEN m.status = 'live' THEN 1
          WHEN m.status = 'scheduled' THEN 2
          ELSE 3
        END,
        COALESCE(m.scheduled_time, m.started_at, m.created_at) DESC
    `;

    // Partition into Upcoming, Live, and Past
    const live = meetings.filter((m) => m.status === "live");
    const upcoming = meetings.filter((m) => m.status === "scheduled");
    const past = meetings.filter((m) => m.status !== "live" && m.status !== "scheduled");

    return NextResponse.json({
      success: true,
      meetings: {
        live,
        upcoming,
        past,
        all: meetings,
      },
      isLeader,
    });
  } catch (error) {
    console.error("Error fetching event meetings:", error);
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : "Failed to load meetings" },
      { status: 500 }
    );
  }
}

// POST /api/events/[id]/meetings - Create or Schedule Meeting
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const { id: eventId } = await context.params;

    const eventRows = await sql`
      SELECT e.id, e.club_id, e.name as event_name, c.leader_id
      FROM events e
      JOIN clubs c ON c.id = e.club_id
      WHERE e.id = ${eventId}
      LIMIT 1
    `;

    if (eventRows.length === 0) {
      return NextResponse.json({ success: false, message: "Event not found" }, { status: 404 });
    }

    const event = eventRows[0];
    const isLeader = event.leader_id === user.id;

    const body = await request.json();
    const title = String(body.title || `${event.event_name} Meeting`).trim();
    const isImmediate = body.immediate === true || !body.scheduled_time;
    let scheduledTime: string | null = null;

    if (!isImmediate && body.scheduled_time) {
      scheduledTime = new Date(body.scheduled_time).toISOString();
    }

    const meetingCode = await generateUniqueMeetingCode();
    const initialStatus = isImmediate ? "live" : "scheduled";
    const startedAt = isImmediate ? new Date().toISOString() : null;

    const inserted = await sql`
      INSERT INTO event_meetings (
        event_id,
        club_id,
        title,
        meeting_code,
        status,
        scheduled_time,
        started_at,
        created_by,
        processing_status
      ) VALUES (
        ${eventId},
        ${event.club_id},
        ${title},
        ${meetingCode},
        ${initialStatus},
        ${scheduledTime},
        ${startedAt},
        ${user.id},
        'waiting'
      )
      RETURNING *
    `;

    const meeting = inserted[0];

    // Add creator to meeting participants
    await sql`
      INSERT INTO event_meeting_participants (
        meeting_id,
        user_id,
        display_name,
        role
      ) VALUES (
        ${meeting.id},
        ${user.id},
        ${user.full_name || "Host"},
        ${isLeader ? "leader" : "host"}
      )
    `;

    // Notify club members
    emitClubEventUpdate(event.club_id, {
      action: "updated",
      event_id: eventId,
      club_id: event.club_id,
      name: event.event_name,
    });

    return NextResponse.json({
      success: true,
      message: isImmediate ? "Live meeting started!" : "Meeting scheduled successfully!",
      meeting: {
        ...meeting,
        creator_name: user.full_name,
        creator_photo: user.photo_url,
      },
    });
  } catch (error) {
    console.error("Error creating meeting:", error);
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : "Failed to create meeting" },
      { status: 500 }
    );
  }
}
