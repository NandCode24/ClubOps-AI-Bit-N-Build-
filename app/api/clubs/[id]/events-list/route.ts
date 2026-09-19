import { NextRequest, NextResponse } from "next/server";
import { getAuthUser, sql } from "../../../../lib/db";
import { emitClubEventUpdate, emitTaskEvent } from "../../../../lib/events";

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

    const { id: clubId } = await context.params;

    // Verify club exists and user is a member or leader
    const clubRows = await sql`
      SELECT id, leader_id FROM clubs WHERE id = ${clubId} LIMIT 1
    `;
    if (clubRows.length === 0) {
      return NextResponse.json({ success: false, message: "Club not found." }, { status: 404 });
    }
    const club = clubRows[0];
    const isLeader = club.leader_id === user.id;

    if (!isLeader) {
      const membership = await sql`
        SELECT id FROM club_members WHERE club_id = ${clubId} AND user_id = ${user.id} LIMIT 1
      `;
      if (membership.length === 0) {
        return NextResponse.json(
          { success: false, message: "Access denied. You are not a member of this club." },
          { status: 403 }
        );
      }
    }

    // Fetch all events for this club with participant & task aggregates
    const events = await sql`
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
        u.full_name as creator_name,
        (SELECT COUNT(*)::int FROM event_participants ep WHERE ep.event_id = e.id) as participant_count,
        (SELECT COUNT(*)::int FROM tasks t WHERE t.event_id = e.id) as total_tasks,
        (SELECT COUNT(*)::int FROM tasks t WHERE t.event_id = e.id AND t.status = 'completed') as completed_tasks,
        (SELECT COUNT(*)::int FROM tasks t WHERE t.event_id = e.id AND t.assigned_to = ${user.id} AND t.status != 'completed') as my_active_tasks
      FROM events e
      LEFT JOIN users u ON u.id = e.created_by
      WHERE e.club_id = ${clubId}
      ORDER BY e.start_time ASC
    `;

    // Fetch all tasks for events in this club so volunteers can see all tasks across events
    const allClubTasks = await sql`
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
        e.name as event_name,
        u.full_name as assigned_to_name,
        u.email as assigned_to_email,
        u.photo_url as assigned_to_photo
      FROM tasks t
      JOIN events e ON e.id = t.event_id
      LEFT JOIN users u ON u.id = t.assigned_to
      WHERE e.club_id = ${clubId}
      ORDER BY 
        CASE WHEN t.status = 'completed' THEN 1 ELSE 0 END,
        t.deadline ASC NULLS LAST,
        t.created_at ASC
    `;

    return NextResponse.json({
      success: true,
      events,
      tasks: allClubTasks,
    });
  } catch (error) {
    console.error("Error in GET /api/clubs/[id]/events-list:", error);
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : "Failed to load events." },
      { status: 500 }
    );
  }
}

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

    // STRICT CHECK: Only the Club Leader can create an event
    const clubRows = await sql`
      SELECT id, leader_id, name, club_code FROM clubs WHERE id = ${clubId} LIMIT 1
    `;
    if (clubRows.length === 0) {
      return NextResponse.json({ success: false, message: "Club not found." }, { status: 404 });
    }
    const club = clubRows[0];
    if (club.leader_id !== user.id) {
      return NextResponse.json(
        { success: false, message: "Only the club leader can create an event for this club." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const {
      name,
      description,
      venue,
      mode = "offline",
      start_time,
      end_time,
      meeting_link,
      meeting_code,
      meeting_time,
      selected_members = [],
      initial_tasks = [],
    } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ success: false, message: "Event name is required." }, { status: 400 });
    }

    if (!start_time || !end_time) {
      return NextResponse.json(
        { success: false, message: "Start date/time and end date/time are required." },
        { status: 400 }
      );
    }

    const startDate = new Date(start_time);
    const endDate = new Date(end_time);
    if (endDate <= startDate) {
      return NextResponse.json(
        { success: false, message: "Ending date & time must be after starting date & time." },
        { status: 400 }
      );
    }

    // Workload check on initial tasks: 1 volunteer = 1 active task max!
    const assignedUserIds = new Set<string>();
    for (const t of initial_tasks) {
      if (t.assigned_to) {
        if (assignedUserIds.has(t.assigned_to)) {
          return NextResponse.json(
            {
              success: false,
              message: "Volunteer workload violation: Cannot assign multiple tasks to the same volunteer during event setup. (1 volunteer can only hold 1 active task)",
            },
            { status: 400 }
          );
        }
        assignedUserIds.add(t.assigned_to);

        // Check availability
        const volunteerUser = await sql`
          SELECT full_name, is_available, unavailable_until, unavailable_reason 
          FROM users WHERE id = ${t.assigned_to} LIMIT 1
        `;
        if (volunteerUser.length > 0) {
          const u = volunteerUser[0];
          if (u.is_available === false) {
            let isStillAway = true;
            if (u.unavailable_until) {
              const until = new Date(u.unavailable_until).getTime();
              if (!isNaN(until) && until <= Date.now()) {
                isStillAway = false;
              }
            }
            if (isStillAway) {
              const untilStr = u.unavailable_until ? new Date(u.unavailable_until).toLocaleString() : "further notice";
              return NextResponse.json(
                {
                  success: false,
                  message: `Volunteer Unavailable: ${u.full_name} is currently deactivated / on leave until ${untilStr}${u.unavailable_reason ? ` (${u.unavailable_reason})` : ""}. Please select an active volunteer.`,
                },
                { status: 400 }
              );
            }
          }
        }

        // Check DB for existing uncompleted task across this club
        const activeTasks = await sql`
          SELECT id, name FROM tasks 
          WHERE assigned_to = ${t.assigned_to} 
            AND club_id = ${clubId} 
            AND status != 'completed' 
          LIMIT 1
        `;
        if (activeTasks.length > 0) {
          const volunteerName = volunteerUser[0]?.full_name || "Selected volunteer";
          return NextResponse.json(
            {
              success: false,
              message: `Volunteer Overload Alert: ${volunteerName} is already working on an active task ("${activeTasks[0].name}"). Each volunteer can hold only 1 active task at a time.`,
            },
            { status: 400 }
          );
        }
      }
    }

    // 1. Insert Event
    const eventRows = await sql`
      INSERT INTO events (
        club_id,
        name,
        description,
        venue,
        mode,
        start_time,
        end_time,
        meeting_link,
        meeting_code,
        meeting_time,
        created_by
      ) VALUES (
        ${clubId},
        ${name.trim()},
        ${description?.trim() || null},
        ${venue?.trim() || null},
        ${mode},
        ${start_time},
        ${end_time},
        ${meeting_link?.trim() || null},
        ${meeting_code?.trim() || null},
        ${meeting_time ? meeting_time : null},
        ${user.id}
      )
      RETURNING id, name, mode, start_time, end_time, created_at
    `;
    const newEvent = eventRows[0];

    // 2. Insert Selected Members into event_participants
    // Also automatically add leader as a participant if not explicitly in the list
    const participantSet = new Set<string>(selected_members);
    participantSet.add(user.id);

    for (const memberId of participantSet) {
      // Find member's club role
      const memberRoleRows = await sql`
        SELECT assigned_role, role_type FROM club_members 
        WHERE club_id = ${clubId} AND user_id = ${memberId} 
        LIMIT 1
      `;
      const assignedRole = memberRoleRows.length > 0 
        ? memberRoleRows[0].assigned_role || memberRoleRows[0].role_type 
        : (memberId === user.id ? "Leader" : "Member");

      await sql`
        INSERT INTO event_participants (
          event_id,
          club_id,
          user_id,
          assigned_role
        ) VALUES (
          ${newEvent.id},
          ${clubId},
          ${memberId},
          ${assignedRole}
        )
        ON CONFLICT (event_id, user_id) DO NOTHING
      `;
    }

    // 3. Insert Initial Tasks
    for (const t of initial_tasks) {
      if (t.name && t.name.trim()) {
        const taskRow = await sql`
          INSERT INTO tasks (
            club_id,
            event_id,
            name,
            description,
            assigned_to,
            deadline,
            status
          ) VALUES (
            ${clubId},
            ${newEvent.id},
            ${t.name.trim()},
            ${t.description?.trim() || null},
            ${t.assigned_to || null},
            ${t.deadline ? t.deadline : null},
            'pending'
          )
          RETURNING id, name, status, assigned_to, deadline, created_at
        `;

        // Broadcast task creation
        emitTaskEvent(clubId, {
          action: "created",
          task_id: taskRow[0].id,
          club_id: clubId,
          event_id: newEvent.id,
          name: taskRow[0].name,
          status: taskRow[0].status,
          assigned_to: taskRow[0].assigned_to,
          deadline: taskRow[0].deadline ? String(taskRow[0].deadline) : null,
          updated_at: String(taskRow[0].created_at),
        });
      }
    }

    // 4. Emit event creation update
    emitClubEventUpdate(clubId, {
      action: "created",
      event_id: newEvent.id,
      club_id: clubId,
      name: newEvent.name,
    });

    return NextResponse.json({
      success: true,
      message: "Event created successfully.",
      event_id: newEvent.id,
      club_code: club.club_code,
    });
  } catch (error) {
    console.error("Error in POST /api/clubs/[id]/events-list:", error);
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : "Failed to create event." },
      { status: 500 }
    );
  }
}
