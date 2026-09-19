import { NextRequest, NextResponse } from "next/server";
import { getAuthUser, sql } from "../../../../lib/db";

export const runtime = "nodejs";

// GET /api/events/[id]/announcements - Fetch all announcements for an event
export async function GET(
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

    // Verify event exists
    const eventRows = await sql`
      SELECT e.id, e.club_id, c.leader_id 
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
    const isLeader = event.leader_id === user.id;

    // Verify user is leader, event participant, or club member
    let isAuthorized = isLeader;
    if (!isAuthorized) {
      const participantRows = await sql`
        SELECT id FROM event_participants 
        WHERE event_id = ${eventId} AND user_id = ${user.id} 
        LIMIT 1
      `;
      if (participantRows.length > 0) {
        isAuthorized = true;
      } else {
        const memberRows = await sql`
          SELECT id FROM club_members 
          WHERE club_id = ${event.club_id} AND user_id = ${user.id} 
          LIMIT 1
        `;
        isAuthorized = memberRows.length > 0;
      }
    }

    if (!isAuthorized) {
      return NextResponse.json(
        { success: false, message: "Access denied. Only event members can view announcements." },
        { status: 403 }
      );
    }

    // Fetch announcements
    const announcements = await sql`
      SELECT 
        a.id,
        a.club_id,
        a.event_id,
        a.title,
        a.content,
        a.audio_url,
        a.created_by,
        a.created_at,
        u.full_name as author_name,
        u.photo_url as author_photo
      FROM announcements a
      LEFT JOIN users u ON u.id = a.created_by
      WHERE a.event_id = ${eventId}
      ORDER BY a.created_at DESC
    `;

    return NextResponse.json({
      success: true,
      announcements,
      isLeader,
    });
  } catch (error) {
    console.error("Error fetching announcements:", error);
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Failed to load announcements.",
      },
      { status: 500 }
    );
  }
}

// POST /api/events/[id]/announcements - Post an announcement (LEADER ONLY)
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

    // Verify event and strictly verify Club Leader identity
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

    // SECURITY CHECK: Only the Club Leader can post announcements
    if (event.leader_id !== user.id) {
      return NextResponse.json(
        { success: false, message: "Access denied. Only the Club Leader can broadcast announcements for this event." },
        { status: 403 }
      );
    }

    let body: { title?: string; content?: string; audio_url?: string } = {};
    try {
      body = await request.json();
    } catch {
      body = {};
    }

    const title = String(body.title || "Leader Announcement").trim();
    const content = String(body.content || "").trim();

    if (!content) {
      return NextResponse.json(
        { success: false, message: "Announcement content is required." },
        { status: 400 }
      );
    }

    const inserted = await sql`
      INSERT INTO announcements (
        club_id,
        event_id,
        title,
        content,
        audio_url,
        created_by
      )
      VALUES (
        ${event.club_id},
        ${eventId},
        ${title},
        ${content},
        ${body.audio_url || null},
        ${user.id}
      )
      RETURNING id, club_id, event_id, title, content, audio_url, created_by, created_at
    `;

    const newAnnouncement = inserted[0];

    return NextResponse.json({
      success: true,
      message: "Announcement broadcasted to all event members.",
      announcement: {
        ...newAnnouncement,
        author_name: user.full_name,
        author_photo: user.photo_url,
      },
    });
  } catch (error) {
    console.error("Error creating announcement:", error);
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Failed to post announcement.",
      },
      { status: 500 }
    );
  }
}
