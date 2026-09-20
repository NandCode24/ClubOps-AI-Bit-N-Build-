import { NextRequest, NextResponse } from "next/server";
import { getAuthUser, sql } from "../../../../../lib/db";
import { emitTaskEvent } from "../../../../../lib/events";

export const runtime = "nodejs";

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

    // Verify event exists and verify Club Leader identity
    const eventRows = await sql`
      SELECT e.id, e.club_id, e.name as event_name, c.leader_id
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

    if (event.leader_id !== user.id) {
      return NextResponse.json(
        { success: false, message: "Access denied. Only the Club Leader can batch assign tasks." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const tasksToCreate = Array.isArray(body.tasks) ? body.tasks : [];

    if (tasksToCreate.length === 0) {
      return NextResponse.json(
        { success: false, message: "No tasks provided to assign." },
        { status: 400 }
      );
    }

    // Validate that each task has a name and an assigned volunteer (compulsory)
    for (let i = 0; i < tasksToCreate.length; i++) {
      const t = tasksToCreate[i];
      if (!t.name || !String(t.name).trim()) {
        return NextResponse.json(
          { success: false, message: `Task #${i + 1} is missing a name.` },
          { status: 400 }
        );
      }
      if (!t.assigned_to || !String(t.assigned_to).trim()) {
        return NextResponse.json(
          {
            success: false,
            message: `Task "${t.name}" requires an assigned volunteer. "Whom to inform" is compulsory.`,
          },
          { status: 400 }
        );
      }
    }

    const createdTasks: any[] = [];

    for (const t of tasksToCreate) {
      const taskName = String(t.name).trim();
      const taskDesc = t.description ? String(t.description).trim() : null;
      const assignedTo = String(t.assigned_to);
      let deadline: string | null = null;
      if (t.deadline) {
        const d = new Date(t.deadline);
        if (!isNaN(d.getTime())) {
          deadline = d.toISOString();
        }
      }

      const inserted = await sql`
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
          ${taskName},
          ${taskDesc},
          ${assignedTo},
          ${deadline},
          'pending'
        )
        RETURNING id, club_id, event_id, name, description, assigned_to, deadline, status, created_at
      `;

      const newTask = inserted[0];

      // Fetch assignee name for SSE broadcast
      let assigneeName: string | null = null;
      const uRows = await sql`SELECT full_name FROM users WHERE id = ${assignedTo} LIMIT 1`;
      if (uRows.length > 0) assigneeName = uRows[0].full_name;

      // Broadcast SSE update so volunteers see live real-time notification
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

      createdTasks.push({
        ...newTask,
        assigned_to_name: assigneeName,
      });
    }

    return NextResponse.json({
      success: true,
      message: `Successfully created and assigned ${createdTasks.length} task${createdTasks.length > 1 ? "s" : ""}.`,
      count: createdTasks.length,
      tasks: createdTasks,
    });
  } catch (error) {
    console.error("Error in POST /api/events/[id]/tasks/batch:", error);
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Failed to batch assign tasks.",
      },
      { status: 500 }
    );
  }
}
