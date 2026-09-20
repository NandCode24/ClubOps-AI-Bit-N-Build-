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

    // Verify event and leader authorization
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

    // SECURITY CHECK: Only Club Leader can batch assign tasks
    if (event.leader_id !== user.id) {
      return NextResponse.json(
        { success: false, message: "Access denied. Only the Club Leader can batch assign event tasks." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const tasks = body.tasks;

    if (!Array.isArray(tasks) || tasks.length === 0) {
      return NextResponse.json(
        { success: false, message: "No tasks provided for assignment." },
        { status: 400 }
      );
    }

    const createdTasks = [];

    for (const item of tasks) {
      const taskName = String(item.name || "").trim();
      if (!taskName) continue;

      const description = item.description ? String(item.description).trim() : null;
      const assignedTo = item.assigned_to ? String(item.assigned_to) : null;
      let deadlineValue = null;
      if (item.deadline) {
        try {
          deadlineValue = new Date(item.deadline).toISOString();
        } catch {
          deadlineValue = null;
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
          ${description},
          ${assignedTo},
          ${deadlineValue},
          'pending'
        )
        RETURNING id, club_id, event_id, name, description, assigned_to, deadline, status, created_at
      `;

      if (inserted.length > 0) {
        const newTask = inserted[0];
        let assigneeName = item.assigned_to_name || null;

        if (!assigneeName && newTask.assigned_to) {
          const u = await sql`SELECT full_name FROM users WHERE id = ${newTask.assigned_to} LIMIT 1`;
          if (u.length > 0) assigneeName = u[0].full_name;
        }

        // Broadcast real-time SSE event
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
    }

    return NextResponse.json({
      success: true,
      message: `Successfully created and assigned ${createdTasks.length} task${createdTasks.length === 1 ? "" : "s"}!`,
      tasks: createdTasks,
    });
  } catch (error) {
    console.error("Error in POST /api/events/[id]/meeting-tasks/batch:", error);
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Failed to batch create tasks.",
      },
      { status: 500 }
    );
  }
}
