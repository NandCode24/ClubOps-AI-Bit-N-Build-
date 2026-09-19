import { NextRequest, NextResponse } from "next/server";
import { getAuthUser, sql } from "../../../../lib/db";
import { emitClubEventUpdate } from "../../../../lib/events";

export const runtime = "nodejs";

// GET /api/clubs/[id]/announcements - Fetch all historical announcements for a club
// Visible to newly joined members as well as older members
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

    // Verify club exists
    const clubRows = await sql`
      SELECT id, name, leader_id FROM clubs WHERE id = ${clubId} LIMIT 1
    `;
    if (clubRows.length === 0) {
      return NextResponse.json({ success: false, message: "Club not found." }, { status: 404 });
    }

    const club = clubRows[0];
    const isLeader = club.leader_id === user.id;

    // Verify user is club member or leader
    if (!isLeader) {
      const memberRows = await sql`
        SELECT id FROM club_members WHERE club_id = ${clubId} AND user_id = ${user.id} LIMIT 1
      `;
      if (memberRows.length === 0) {
        return NextResponse.json(
          { success: false, message: "Access denied. Only club members can view announcements." },
          { status: 403 }
        );
      }
    }

    // Fetch all announcements for this club (including event-linked announcements with event names)
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
        e.name as event_name,
        u.full_name as author_name,
        u.photo_url as author_photo
      FROM announcements a
      LEFT JOIN events e ON e.id = a.event_id
      LEFT JOIN users u ON u.id = a.created_by
      WHERE a.club_id = ${clubId}
      ORDER BY a.created_at DESC
    `;

    return NextResponse.json({
      success: true,
      announcements,
      isLeader,
    });
  } catch (error) {
    console.error("Error fetching club announcements:", error);
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : "Failed to load announcements." },
      { status: 500 }
    );
  }
}

// POST /api/clubs/[id]/announcements - Post a club-wide broadcast (LEADER ONLY)
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
    }

    const { id: clubId } = await context.params;

    const clubRows = await sql`
      SELECT id, name, leader_id FROM clubs WHERE id = ${clubId} LIMIT 1
    `;
    if (clubRows.length === 0) {
      return NextResponse.json({ success: false, message: "Club not found." }, { status: 404 });
    }

    const club = clubRows[0];
    if (club.leader_id !== user.id) {
      return NextResponse.json(
        { success: false, message: "Access denied. Only the Club Leader can post announcements." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const title = String(body.title || "Club Announcement").trim();
    const content = String(body.content || "").trim();
    const eventId = body.event_id ? String(body.event_id).trim() : null;

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
      ) VALUES (
        ${clubId},
        ${eventId},
        ${title},
        ${content},
        ${body.audio_url || null},
        ${user.id}
      )
      RETURNING id, club_id, event_id, title, content, audio_url, created_by, created_at
    `;

    const newAnnouncement = inserted[0];

    // Real-time broadcast
    emitClubEventUpdate(clubId, {
      action: "announcement_posted",
      club_id: clubId,
      announcement: {
        ...newAnnouncement,
        author_name: user.full_name,
        author_photo: user.photo_url,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Announcement broadcasted to all club members.",
      announcement: {
        ...newAnnouncement,
        author_name: user.full_name,
        author_photo: user.photo_url,
      },
    });
  } catch (error) {
    console.error("Error creating club announcement:", error);
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : "Failed to post announcement." },
      { status: 500 }
    );
  }
}
