import { NextRequest, NextResponse } from "next/server";
import { getAuthUser, sql } from "../../../../lib/db";
import { emitClubEventUpdate } from "../../../../lib/events";

export const runtime = "nodejs";

// GET /api/events/[id]/participants - List participants and all club members for selection
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
    }

    const { id: eventId } = await context.params;

    // Verify event exists and get club_id & leader_id
    const eventRows = await sql`
      SELECT e.id, e.club_id, e.name as event_name, c.leader_id 
      FROM events e 
      JOIN clubs c ON c.id = e.club_id 
      WHERE e.id = ${eventId} 
      LIMIT 1
    `;

    if (eventRows.length === 0) {
      return NextResponse.json({ success: false, message: "Event not found." }, { status: 404 });
    }

    const event = eventRows[0];
    const isLeader = event.leader_id === user.id;

    // Current participants of this event
    const participantRows = await sql`
      SELECT 
        ep.id as participant_id,
        ep.user_id,
        ep.assigned_role,
        ep.created_at as joined_event_at,
        u.full_name,
        u.email,
        u.photo_url,
        u.skills,
        u.is_available,
        u.unavailable_until,
        u.unavailable_reason
      FROM event_participants ep
      JOIN users u ON u.id = ep.user_id
      WHERE ep.event_id = ${eventId}
      ORDER BY 
        CASE WHEN ep.user_id = ${event.leader_id} THEN 0 ELSE 1 END,
        u.full_name ASC
    `;

    const participants = participantRows.map((p: Record<string, any>) => {
      let isActive = true;
      if (p.is_available === false) {
        if (p.unavailable_until) {
          const until = new Date(p.unavailable_until).getTime();
          isActive = !isNaN(until) && until <= Date.now();
        } else {
          isActive = false;
        }
      }
      return {
        participant_id: String(p.participant_id),
        user_id: String(p.user_id),
        assigned_role: p.assigned_role ? String(p.assigned_role) : null,
        joined_event_at: String(p.joined_event_at),
        full_name: String(p.full_name || "Member"),
        email: String(p.email || ""),
        photo_url: p.photo_url ? String(p.photo_url) : null,
        skills: Array.isArray(p.skills) ? p.skills : [],
        is_available: p.is_available !== false,
        unavailable_until: p.unavailable_until ? String(p.unavailable_until) : null,
        unavailable_reason: p.unavailable_reason ? String(p.unavailable_reason) : null,
        is_active: isActive,
      };
    });

    // If caller is leader, also fetch ALL club members with their event participation flag
    let allClubMembers: any[] = [];
    if (isLeader) {
      const participantUserIds = new Set(participants.map((p) => p.user_id));

      const clubMemberRows = await sql`
        SELECT 
          cm.id as membership_id,
          cm.user_id,
          cm.role_type,
          cm.assigned_role,
          cm.joined_at,
          u.full_name,
          u.email,
          u.photo_url,
          u.skills,
          u.is_available,
          u.unavailable_until,
          u.unavailable_reason
        FROM club_members cm
        JOIN users u ON u.id = cm.user_id
        WHERE cm.club_id = ${event.club_id}
        ORDER BY 
          CASE WHEN cm.role_type = 'leader' THEN 0 ELSE 1 END,
          u.full_name ASC
      `;

      allClubMembers = clubMemberRows.map((m: Record<string, any>) => {
        let isActive = true;
        if (m.is_available === false) {
          if (m.unavailable_until) {
            const until = new Date(m.unavailable_until).getTime();
            isActive = !isNaN(until) && until <= Date.now();
          } else {
            isActive = false;
          }
        }
        return {
          membership_id: String(m.membership_id),
          user_id: String(m.user_id),
          role_type: String(m.role_type),
          assigned_role: m.assigned_role ? String(m.assigned_role) : "Volunteer",
          joined_at: String(m.joined_at),
          full_name: String(m.full_name || "Member"),
          email: String(m.email || ""),
          photo_url: m.photo_url ? String(m.photo_url) : null,
          skills: Array.isArray(m.skills) ? m.skills : [],
          is_available: m.is_available !== false,
          unavailable_until: m.unavailable_until ? String(m.unavailable_until) : null,
          unavailable_reason: m.unavailable_reason ? String(m.unavailable_reason) : null,
          is_active: isActive,
          is_participant: participantUserIds.has(String(m.user_id)),
        };
      });
    }

    return NextResponse.json({
      success: true,
      is_leader: isLeader,
      participants,
      all_club_members: allClubMembers,
    });
  } catch (error) {
    console.error("Error in GET /api/events/[id]/participants:", error);
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : "Failed to load participants." },
      { status: 500 }
    );
  }
}

// POST /api/events/[id]/participants - Add a club member to this event (LEADER ONLY)
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
    }

    const { id: eventId } = await context.params;

    // Verify event & club leader
    const eventRows = await sql`
      SELECT e.id, e.club_id, e.name as event_name, c.leader_id 
      FROM events e 
      JOIN clubs c ON c.id = e.club_id 
      WHERE e.id = ${eventId} 
      LIMIT 1
    `;

    if (eventRows.length === 0) {
      return NextResponse.json({ success: false, message: "Event not found." }, { status: 404 });
    }

    const event = eventRows[0];
    if (event.leader_id !== user.id) {
      return NextResponse.json(
        { success: false, message: "Access denied. Only the Club Leader can add members to this event." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const targetUserId = String(body.user_id || "").trim();
    const assignedRole = body.assigned_role ? String(body.assigned_role).trim() : null;

    if (!targetUserId) {
      return NextResponse.json(
        { success: false, message: "Target user ID is required." },
        { status: 400 }
      );
    }

    // Verify user is a member of this club
    const clubMember = await sql`
      SELECT id, assigned_role, role_type FROM club_members 
      WHERE club_id = ${event.club_id} AND user_id = ${targetUserId} 
      LIMIT 1
    `;

    if (clubMember.length === 0) {
      return NextResponse.json(
        { success: false, message: "This user is not a member of this club." },
        { status: 400 }
      );
    }

    const roleToAssign = assignedRole || clubMember[0].assigned_role || clubMember[0].role_type || "Volunteer";

    // Insert into event_participants
    await sql`
      INSERT INTO event_participants (
        event_id,
        club_id,
        user_id,
        assigned_role
      ) VALUES (
        ${eventId},
        ${event.club_id},
        ${targetUserId},
        ${roleToAssign}
      )
      ON CONFLICT (event_id, user_id) 
      DO UPDATE SET assigned_role = EXCLUDED.assigned_role
    `;

    emitClubEventUpdate(event.club_id, {
      action: "participant_added",
      club_id: event.club_id,
      event_id: eventId,
      user_id: targetUserId,
    });

    return NextResponse.json({
      success: true,
      message: "Member successfully added to this event.",
    });
  } catch (error) {
    console.error("Error in POST /api/events/[id]/participants:", error);
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : "Failed to add member to event." },
      { status: 500 }
    );
  }
}

// DELETE /api/events/[id]/participants - Remove a member from this event (LEADER ONLY)
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
    }

    const { id: eventId } = await context.params;

    // Verify event & club leader
    const eventRows = await sql`
      SELECT e.id, e.club_id, e.name as event_name, c.leader_id 
      FROM events e 
      JOIN clubs c ON c.id = e.club_id 
      WHERE e.id = ${eventId} 
      LIMIT 1
    `;

    if (eventRows.length === 0) {
      return NextResponse.json({ success: false, message: "Event not found." }, { status: 404 });
    }

    const event = eventRows[0];
    if (event.leader_id !== user.id) {
      return NextResponse.json(
        { success: false, message: "Access denied. Only the Club Leader can remove members from this event." },
        { status: 403 }
      );
    }

    // Read target user_id from query params or body
    let targetUserId = request.nextUrl.searchParams.get("userId") || "";
    if (!targetUserId) {
      try {
        const body = await request.json();
        targetUserId = String(body.user_id || "");
      } catch {
        // no body
      }
    }

    targetUserId = targetUserId.trim();
    if (!targetUserId) {
      return NextResponse.json(
        { success: false, message: "Target user ID is required." },
        { status: 400 }
      );
    }

    // Safety check: Cannot remove the club leader from the event
    if (targetUserId === event.leader_id) {
      return NextResponse.json(
        { success: false, message: "Cannot remove the Club Leader from the event." },
        { status: 400 }
      );
    }

    // Delete from event_participants
    await sql`
      DELETE FROM event_participants 
      WHERE event_id = ${eventId} AND user_id = ${targetUserId}
    `;

    // Unassign unfinished tasks assigned to this user in this event
    await sql`
      UPDATE tasks 
      SET assigned_to = NULL 
      WHERE event_id = ${eventId} AND assigned_to = ${targetUserId} AND status != 'completed'
    `;

    emitClubEventUpdate(event.club_id, {
      action: "participant_removed",
      club_id: event.club_id,
      event_id: eventId,
      user_id: targetUserId,
    });

    return NextResponse.json({
      success: true,
      message: "Member successfully removed from this event.",
    });
  } catch (error) {
    console.error("Error in DELETE /api/events/[id]/participants:", error);
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : "Failed to remove member from event." },
      { status: 500 }
    );
  }
}
