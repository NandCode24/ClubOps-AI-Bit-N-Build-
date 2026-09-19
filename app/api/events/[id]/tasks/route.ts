import { NextRequest, NextResponse } from "next/server";
import { getAuthUser, sql } from "../../../../lib/db";
import { emitTaskEvent } from "../../../../lib/events";
import { evaluateTaskAssignmentWithGroq } from "../../../../lib/groq";

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

    if (!assigned_to || !String(assigned_to).trim()) {
      return NextResponse.json(
        { success: false, message: "Whom to inform / Assignee is compulsory. You must designate an active volunteer to assign and notify." },
        { status: 400 }
      );
    }

    // Availability & Workload check:
    let aiAdvisory: string | null = null;

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

      // 2. Groq AI Workload check: Prevent assigning 2 tasks at a single time to a single volunteer!
      const activeTasks = await sql`
        SELECT 
          t.id, 
          t.name, 
          t.status, 
          t.deadline, 
          e.name as event_name
        FROM tasks t
        LEFT JOIN events e ON e.id = t.event_id
        WHERE t.assigned_to = ${assigned_to} 
          AND t.club_id = ${event.club_id} 
          AND t.status != 'completed' 
        ORDER BY t.created_at DESC
      `;

      if (activeTasks.length > 0) {
        const volunteerRows = await sql`SELECT id, full_name, skills FROM users WHERE id = ${assigned_to} LIMIT 1`;
        const v = volunteerRows[0] || { id: assigned_to, full_name: "Volunteer", skills: [] };

        // Fetch free volunteers for AI to suggest as alternatives
        const freeMemberRows = await sql`
          SELECT u.id, u.full_name, u.skills
          FROM club_members cm
          JOIN users u ON u.id = cm.user_id
          WHERE cm.club_id = ${event.club_id}
            AND u.id != ${assigned_to}
            AND (u.is_available IS NULL OR u.is_available = true)
            AND NOT EXISTS (
              SELECT 1 FROM tasks t 
              WHERE t.assigned_to = u.id 
                AND t.club_id = ${event.club_id} 
                AND t.status != 'completed'
            )
          LIMIT 3
        `;

        const availableVolunteers = freeMemberRows.map((m: Record<string, any>) => ({
          id: String(m.id),
          name: String(m.full_name),
          skills: Array.isArray(m.skills) ? m.skills : [],
        }));

        const aiCheck = await evaluateTaskAssignmentWithGroq({
          volunteerId: String(v.id),
          volunteerName: String(v.full_name),
          volunteerSkills: Array.isArray(v.skills) ? v.skills : [],
          newTask: {
            name: name.trim(),
            description: description?.trim() || null,
            deadline: deadline || null,
          },
          existingActiveTasks: activeTasks.map((t: Record<string, any>) => ({
            id: String(t.id),
            name: String(t.name),
            status: String(t.status),
            deadline: t.deadline ? String(t.deadline) : null,
            event_name: t.event_name ? String(t.event_name) : null,
          })),
          availableVolunteers,
        });

        aiAdvisory = aiCheck.recommendation;
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
      ai_advisory: aiAdvisory,
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
