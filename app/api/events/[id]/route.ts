import { NextRequest, NextResponse } from "next/server";
import { getAuthUser, sql } from "../../../lib/db";

export const runtime = "nodejs";

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

    // Fetch event + club details
    const eventRows = await sql`
      SELECT 
        e.id,
        e.club_id,
        e.name,
        e.description,
        e.venue,
        e.mode,
        e.start_time,
        e.end_time,
        e.meeting_link,
        e.meeting_code,
        e.meeting_time,
        e.created_by,
        e.created_at,
        c.name as club_name,
        c.club_code,
        c.leader_id,
        c.leader_name
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

    // Fetch participants with availability status
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

    const isParticipant = participants.some((p) => p.user_id === user.id);

    // Fetch tasks
    const tasks = await sql`
      SELECT 
        t.id,
        t.club_id,
        t.event_id,
        t.name,
        t.description,
        t.assigned_to,
        t.deadline,
        t.status,
        t.completed_at,
        t.created_at,
        u.full_name as assigned_to_name,
        u.email as assigned_to_email,
        u.photo_url as assigned_to_photo,
        u.skills as assigned_to_skills
      FROM tasks t
      LEFT JOIN users u ON u.id = t.assigned_to
      WHERE t.event_id = ${eventId}
      ORDER BY 
        CASE WHEN t.status = 'completed' THEN 1 ELSE 0 END,
        t.deadline ASC NULLS LAST,
        t.created_at ASC
    `;

    const userTasks = tasks.filter((t: Record<string, any>) => t.assigned_to === user.id);

    // VOLUNTEER PRIVACY:
    // Only the Club Leader can view all tasks across the entire event.
    // Volunteers strictly receive only their own assigned tasks!
    const visibleTasks = isLeader ? tasks : userTasks;

    return NextResponse.json({
      success: true,
      event: {
        ...event,
        is_leader: isLeader,
        is_participant: isParticipant,
        participants,
        tasks: visibleTasks,
        user_tasks: userTasks,
      },
    });
  } catch (error) {
    console.error("Error in GET /api/events/[id]:", error);
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : "Failed to load event." },
      { status: 500 }
    );
  }
}
