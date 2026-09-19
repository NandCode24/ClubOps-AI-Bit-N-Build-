import { NextRequest, NextResponse } from "next/server";
import { getAuthUser, sql } from "../../../../lib/db";
import { emitTaskEvent } from "../../../../lib/events";

export const runtime = "nodejs";

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

    // Fetch event and verify leader
    const eventRows = await sql`
      SELECT e.id, e.club_id, c.leader_id 
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
        { success: false, message: "Only the club leader can create and assign tasks." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { name, description, assigned_to, deadline } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ success: false, message: "Task name is required." }, { status: 400 });
    }

    // Availability & Workload check:
    if (assigned_to) {
      // 1. Availability check
      const userRows = await sql`
        SELECT full_name, is_available, unavailable_until, unavailable_reason 
        FROM users WHERE id = ${assigned_to} LIMIT 1
      `;
      if (userRows.length > 0) {
        const u = userRows[0];
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

      // 2. Workload check: 1 volunteer can hold only 1 active task at a time!
      const activeTasks = await sql`
        SELECT id, name FROM tasks 
        WHERE assigned_to = ${assigned_to} 
          AND club_id = ${event.club_id} 
          AND status != 'completed' 
        LIMIT 1
      `;
      if (activeTasks.length > 0) {
        const volunteerRows = await sql`SELECT full_name FROM users WHERE id = ${assigned_to} LIMIT 1`;
        const volunteerName = volunteerRows[0]?.full_name || "Selected volunteer";
        return NextResponse.json(
          {
            success: false,
            message: `Workload Risk Alert: ${volunteerName} is already assigned to an active task ("${activeTasks[0].name}"). Each volunteer can hold only 1 active task at a time to prevent burnout.`,
          },
          { status: 400 }
        );
      }
    }

    // Insert task
    const taskRows = await sql`
      INSERT INTO tasks (
        club_id,
        event_id,
        name,
        description,
        assigned_to,
        deadline,
        status
      ) VALUES (
        ${event.club_id},
        ${eventId},
        ${name.trim()},
        ${description?.trim() || null},
        ${assigned_to || null},
        ${deadline ? deadline : null},
        'pending'
      )
      RETURNING id, club_id, event_id, name, description, assigned_to, deadline, status, created_at
    `;

    const newTask = taskRows[0];

    // Get assigned user full name for real-time notification
    let assigneeName: string | null = null;
    if (assigned_to) {
      const u = await sql`SELECT full_name FROM users WHERE id = ${assigned_to} LIMIT 1`;
      if (u.length > 0) assigneeName = u[0].full_name;
    }

    // Emit real-time event
    emitTaskEvent(event.club_id, {
      action: "created",
      task_id: newTask.id,
      club_id: event.club_id,
      event_id: eventId,
      name: newTask.name,
      status: newTask.status,
      assigned_to: newTask.assigned_to,
      assigned_to_name: assigneeName,
      deadline: newTask.deadline ? String(newTask.deadline) : null,
      updated_at: String(newTask.created_at),
    });

    return NextResponse.json({
      success: true,
      message: "Task created and assigned successfully.",
      task: {
        ...newTask,
        assigned_to_name: assigneeName,
      },
    });
  } catch (error) {
    console.error("Error in POST /api/events/[id]/tasks:", error);
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : "Failed to create task." },
      { status: 500 }
    );
  }
}
