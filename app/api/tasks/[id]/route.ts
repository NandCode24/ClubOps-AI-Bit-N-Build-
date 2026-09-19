import { NextRequest, NextResponse } from "next/server";
import { getAuthUser, sql } from "../../../lib/db";
import { emitTaskEvent } from "../../../lib/events";

export const runtime = "nodejs";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
    }

    const { id: taskId } = await context.params;

    // Fetch existing task with club & leader info
    const taskRows = await sql`
      SELECT 
        t.id,
        t.club_id,
        t.event_id,
        t.name,
        t.description,
        t.assigned_to,
        t.deadline,
        t.status,
        c.leader_id
      FROM tasks t
      JOIN clubs c ON c.id = t.club_id
      WHERE t.id = ${taskId}
      LIMIT 1
    `;

    if (taskRows.length === 0) {
      return NextResponse.json({ success: false, message: "Task not found." }, { status: 404 });
    }

    const task = taskRows[0];
    const isLeader = task.leader_id === user.id;
    const isAssignee = task.assigned_to === user.id;

    // Only the assigned volunteer or the club leader can update task status
    if (!isLeader && !isAssignee) {
      return NextResponse.json(
        { success: false, message: "You are not authorized to update this task." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { status } = body;

    const allowedStatuses = ["pending", "in_progress", "completed"];
    if (!status || !allowedStatuses.includes(status)) {
      return NextResponse.json(
        { success: false, message: "Invalid status. Must be pending, in_progress, or completed." },
        { status: 400 }
      );
    }

    const isCompleted = status === "completed";

    const updatedRows = await sql`
      UPDATE tasks
      SET 
        status = ${status},
        completed_at = ${isCompleted ? sql`NOW()` : null}
      WHERE id = ${taskId}
      RETURNING id, club_id, event_id, name, description, assigned_to, deadline, status, completed_at, created_at
    `;

    const updatedTask = updatedRows[0];

    // Fetch user name of assignee
    let assigneeName: string | null = null;
    if (updatedTask.assigned_to) {
      const u = await sql`SELECT full_name FROM users WHERE id = ${updatedTask.assigned_to} LIMIT 1`;
      if (u.length > 0) assigneeName = u[0].full_name;
    }

    // Broadcast real-time task status change event over SSE bus!
    emitTaskEvent(task.club_id, {
      action: "status_change",
      task_id: updatedTask.id,
      club_id: task.club_id,
      event_id: task.event_id,
      name: updatedTask.name,
      status: updatedTask.status,
      assigned_to: updatedTask.assigned_to,
      assigned_to_name: assigneeName || user.full_name,
      deadline: updatedTask.deadline ? String(updatedTask.deadline) : null,
      updated_at: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      message: `Task marked as ${status}.`,
      task: {
        ...updatedTask,
        assigned_to_name: assigneeName,
      },
    });
  } catch (error) {
    console.error("Error in PATCH /api/tasks/[id]:", error);
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : "Failed to update task." },
      { status: 500 }
    );
  }
}
