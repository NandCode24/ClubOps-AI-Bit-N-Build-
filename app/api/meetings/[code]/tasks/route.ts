import { NextRequest, NextResponse } from "next/server";
import { getAuthUser, sql } from "../../../../lib/db";
import { emitTaskEvent } from "../../../../lib/events";

export const runtime = "nodejs";

// POST /api/meetings/[code]/tasks - Convert action item(s) to official event task(s)
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ code: string }> }
) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const { code: meetingCode } = await context.params;

    const meetingRows = await sql`
      SELECT m.id, m.event_id, m.club_id, c.leader_id
      FROM event_meetings m
      JOIN clubs c ON c.id = m.club_id
      WHERE m.meeting_code = ${meetingCode}
      LIMIT 1
    `;

    if (meetingRows.length === 0) {
      return NextResponse.json({ success: false, message: "Meeting not found" }, { status: 404 });
    }

    const meeting = meetingRows[0];
    const isLeader = meeting.leader_id === user.id;

    if (!isLeader) {
      return NextResponse.json({ success: false, message: "Only the Club Leader can create event tasks." }, { status: 403 });
    }

    const body = await request.json();
    const taskItems = Array.isArray(body.tasks) ? body.tasks : [body];

    if (taskItems.length === 0) {
      return NextResponse.json({ success: false, message: "No task items provided" }, { status: 400 });
    }

    const createdTasks = [];

    for (const item of taskItems) {
      const taskName = String(item.task || item.name || "").trim();
      if (!taskName) continue;

      const description = item.description || (item.explanation ? String(item.explanation) : null);
      let assignedTo = item.owner_id || item.assigned_to || null;
      let assigneeName = item.owner || item.assigned_to_name || null;

      // If owner name was spoken but owner_id wasn't populated, attempt lookup
      if (!assignedTo && assigneeName) {
        const matched = await sql`
          SELECT id, full_name FROM users
          WHERE LOWER(full_name) = LOWER(${assigneeName})
             OR full_name ILIKE ${`%${assigneeName}%`}
          LIMIT 1
        `;
        if (matched.length > 0) {
          assignedTo = matched[0].id;
          assigneeName = matched[0].full_name;
        }
      }

      let deadlineValue = null;
      if (item.deadline) {
        try {
          const d = new Date(item.deadline);
          if (!isNaN(d.getTime())) {
            deadlineValue = d.toISOString();
          }
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
          ${meeting.club_id},
          ${meeting.event_id},
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

        // Emit real-time SSE event
        emitTaskEvent(meeting.club_id, {
          action: "created",
          task_id: newTask.id,
          club_id: meeting.club_id,
          event_id: meeting.event_id,
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
      message: `Created ${createdTasks.length} task${createdTasks.length === 1 ? "" : "s"} successfully!`,
      tasks: createdTasks,
    });
  } catch (error) {
    console.error("Error creating tasks from meeting:", error);
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : "Failed to create task" },
      { status: 500 }
    );
  }
}
