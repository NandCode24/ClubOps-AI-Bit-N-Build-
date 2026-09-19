import { NextRequest, NextResponse } from "next/server";
import { getAuthUser, sql } from "../../../lib/db";
import { emitTaskEvent } from "../../../lib/events";
import { evaluateTaskAssignmentWithGroq } from "../../../lib/groq";

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

    if (!isLeader && !isAssignee) {
      return NextResponse.json(
        { success: false, message: "You are not authorized to update this task." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { status, assigned_to } = body;

    let targetStatus = task.status;
    let targetAssignedTo = task.assigned_to;
    let oldAssigneeName: string | null = null;
    let newAssigneeName: string | null = null;
    let isReallocation = false;

    // 1. Handle Reallocation (Leader Only)
    if (assigned_to !== undefined) {
      if (!isLeader) {
        return NextResponse.json(
          { success: false, message: "Only the club leader can reallocate tasks to other members." },
          { status: 403 }
        );
      }

      if (!assigned_to || !String(assigned_to).trim()) {
        return NextResponse.json(
          { success: false, message: "Whom to inform / Assignee is compulsory. You must designate an active volunteer." },
          { status: 400 }
        );
      }

      const newVolunteerId = String(assigned_to).trim();

      if (newVolunteerId !== task.assigned_to) {
        isReallocation = true;

        // Fetch candidate volunteer info
        const volunteerRows = await sql`
          SELECT id, full_name, skills, is_available, unavailable_until, unavailable_reason
          FROM users
          WHERE id = ${newVolunteerId}
          LIMIT 1
        `;

        if (volunteerRows.length === 0) {
          return NextResponse.json(
            { success: false, message: "Target volunteer not found." },
            { status: 404 }
          );
        }

        const candidate = volunteerRows[0];

        // Availability check
        if (candidate.is_available === false) {
          let isStillAway = true;
          if (candidate.unavailable_until) {
            const until = new Date(candidate.unavailable_until).getTime();
            if (!isNaN(until) && until <= Date.now()) {
              isStillAway = false;
            }
          }
          if (isStillAway) {
            const untilStr = candidate.unavailable_until
              ? new Date(candidate.unavailable_until).toLocaleString()
              : "further notice";
            return NextResponse.json(
              {
                success: false,
                message: `Volunteer Unavailable: ${candidate.full_name} is currently on leave until ${untilStr}. Please select an active volunteer.`,
              },
              { status: 400 }
            );
          }
        }

        // Workload Check: Ensure candidate does not already have an active task in this club
        const activeTasks = await sql`
          SELECT 
            t.id, 
            t.name, 
            t.status, 
            t.deadline, 
            e.name as event_name
          FROM tasks t
          LEFT JOIN events e ON e.id = t.event_id
          WHERE t.assigned_to = ${newVolunteerId}
            AND t.club_id = ${task.club_id}
            AND t.id != ${taskId}
            AND t.status != 'completed'
          ORDER BY t.created_at DESC
        `;

        let aiAdvisory: string | null = null;

        if (activeTasks.length > 0) {
          // Free peers in club for AI recommendations
          const freeMemberRows = await sql`
            SELECT u.id, u.full_name, u.skills
            FROM club_members cm
            JOIN users u ON u.id = cm.user_id
            WHERE cm.club_id = ${task.club_id}
              AND u.id != ${newVolunteerId}
              AND (u.is_available IS NULL OR u.is_available = true)
              AND NOT EXISTS (
                SELECT 1 FROM tasks ot
                WHERE ot.assigned_to = u.id
                  AND ot.club_id = ${task.club_id}
                  AND ot.id != ${taskId}
                  AND ot.status != 'completed'
              )
            LIMIT 3
          `;

          const availableVolunteers = freeMemberRows.map((m: Record<string, any>) => ({
            id: String(m.id),
            name: String(m.full_name),
            skills: Array.isArray(m.skills) ? m.skills : [],
          }));

          const aiCheck = await evaluateTaskAssignmentWithGroq({
            volunteerId: String(candidate.id),
            volunteerName: String(candidate.full_name),
            volunteerSkills: Array.isArray(candidate.skills) ? candidate.skills : [],
            newTask: {
              name: task.name,
              description: task.description,
              deadline: task.deadline ? String(task.deadline) : null,
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

        // Leader has authority to reallocate; AI provides advisory guidance
        targetAssignedTo = newVolunteerId;
        newAssigneeName = candidate.full_name;

        // Fetch old assignee name
        if (task.assigned_to) {
          const oldUser = await sql`SELECT full_name FROM users WHERE id = ${task.assigned_to} LIMIT 1`;
          if (oldUser.length > 0) oldAssigneeName = oldUser[0].full_name;
        }
      }
    }

    // 2. Handle Status Update
    if (status !== undefined) {
      const allowedStatuses = ["pending", "in_progress", "completed"];
      if (!allowedStatuses.includes(status)) {
        return NextResponse.json(
          { success: false, message: "Invalid status. Must be pending, in_progress, or completed." },
          { status: 400 }
        );
      }
      targetStatus = status;
    }

    const isCompleted = targetStatus === "completed";

    const updatedRows = await sql`
      UPDATE tasks
      SET 
        status = ${targetStatus},
        assigned_to = ${targetAssignedTo},
        completed_at = ${isCompleted ? sql`NOW()` : null}
      WHERE id = ${taskId}
      RETURNING id, club_id, event_id, name, description, assigned_to, deadline, status, completed_at, created_at
    `;

    const updatedTask = updatedRows[0];

    // Fetch current assignee name if not set
    if (!newAssigneeName && updatedTask.assigned_to) {
      const u = await sql`SELECT full_name FROM users WHERE id = ${updatedTask.assigned_to} LIMIT 1`;
      if (u.length > 0) newAssigneeName = u[0].full_name;
    }

    // Broadcast SSE Event
    if (isReallocation) {
      emitTaskEvent(task.club_id, {
        action: "reallocated",
        task_id: updatedTask.id,
        club_id: task.club_id,
        event_id: task.event_id,
        name: updatedTask.name,
        status: updatedTask.status,
        assigned_to: updatedTask.assigned_to,
        assigned_to_name: newAssigneeName,
        previous_assignee_name: oldAssigneeName,
        updated_at: new Date().toISOString(),
      });
    } else {
      emitTaskEvent(task.club_id, {
        action: "status_change",
        task_id: updatedTask.id,
        club_id: task.club_id,
        event_id: task.event_id,
        name: updatedTask.name,
        status: updatedTask.status,
        assigned_to: updatedTask.assigned_to,
        assigned_to_name: newAssigneeName || user.full_name,
        deadline: updatedTask.deadline ? String(updatedTask.deadline) : null,
        updated_at: new Date().toISOString(),
      });
    }

    return NextResponse.json({
      success: true,
      message: isReallocation
        ? `Task reallocated from ${oldAssigneeName || "previous volunteer"} to ${newAssigneeName}.`
        : `Task marked as ${targetStatus}.`,
      task: {
        ...updatedTask,
        assigned_to_name: newAssigneeName,
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
