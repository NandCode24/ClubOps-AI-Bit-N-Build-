import { NextRequest, NextResponse } from "next/server";
import { getAuthUser, sql } from "../../../lib/db";
import { evaluateTaskAssignmentWithGroq } from "../../../lib/groq";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
    }

    const body = await request.json();
    const {
      club_id,
      event_id,
      volunteer_id,
      task_name,
      task_description,
      task_deadline,
    } = body;

    if (!volunteer_id) {
      return NextResponse.json(
        { success: false, message: "Volunteer ID is required." },
        { status: 400 }
      );
    }

    // 1. Fetch Target Volunteer Info
    const volunteerRows = await sql`
      SELECT id, full_name, email, skills, is_available, unavailable_until, unavailable_reason
      FROM users
      WHERE id = ${volunteer_id}
      LIMIT 1
    `;

    if (volunteerRows.length === 0) {
      return NextResponse.json(
        { success: false, message: "Volunteer not found." },
        { status: 404 }
      );
    }

    const volunteer = volunteerRows[0];

    // Check availability / leave status
    if (volunteer.is_available === false) {
      let isStillAway = true;
      if (volunteer.unavailable_until) {
        const until = new Date(volunteer.unavailable_until).getTime();
        if (!isNaN(until) && until <= Date.now()) {
          isStillAway = false;
        }
      }

      if (isStillAway) {
        const untilStr = volunteer.unavailable_until
          ? new Date(volunteer.unavailable_until).toLocaleString()
          : "further notice";
        return NextResponse.json({
          success: true,
          allowed: false,
          hasConflict: true,
          conflictType: "unavailable",
          reason: `Volunteer On Leave: ${volunteer.full_name} is marked unavailable until ${untilStr}${volunteer.unavailable_reason ? ` (${volunteer.unavailable_reason})` : ""}.`,
          recommendation: "Please select an active volunteer who is not currently on leave.",
          suggestedAlternative: null,
          modelUsed: "ClubOps Availability Engine",
        });
      }
    }

    // 2. Fetch all current active tasks for this volunteer in this club (or across events)
    const activeTasksRows = await sql`
      SELECT 
        t.id, 
        t.name, 
        t.status, 
        t.deadline, 
        e.name as event_name
      FROM tasks t
      LEFT JOIN events e ON e.id = t.event_id
      WHERE t.assigned_to = ${volunteer_id}
        ${club_id ? sql`AND t.club_id = ${club_id}` : sql``}
        AND t.status != 'completed'
      ORDER BY t.created_at DESC
    `;

    const existingActiveTasks = activeTasksRows.map((t: Record<string, any>) => ({
      id: String(t.id),
      name: String(t.name),
      status: String(t.status),
      deadline: t.deadline ? String(t.deadline) : null,
      event_name: t.event_name ? String(t.event_name) : null,
    }));

    // 3. Find other club volunteers who have 0 active tasks (available peers for AI suggestions)
    let availableVolunteers: Array<{ id: string; name: string; skills: string[] }> = [];
    if (club_id) {
      const freeMemberRows = await sql`
        SELECT 
          u.id, 
          u.full_name, 
          u.skills
        FROM club_members cm
        JOIN users u ON u.id = cm.user_id
        WHERE cm.club_id = ${club_id}
          AND u.id != ${volunteer_id}
          AND (u.is_available IS NULL OR u.is_available = true)
          AND NOT EXISTS (
            SELECT 1 FROM tasks t 
            WHERE t.assigned_to = u.id 
              AND t.club_id = ${club_id} 
              AND t.status != 'completed'
          )
        LIMIT 5
      `;

      availableVolunteers = freeMemberRows.map((m: Record<string, any>) => ({
        id: String(m.id),
        name: String(m.full_name),
        skills: Array.isArray(m.skills) ? m.skills : [],
      }));
    }

    // 4. Run Groq AI Evaluation
    const aiResult = await evaluateTaskAssignmentWithGroq({
      volunteerId: String(volunteer.id),
      volunteerName: String(volunteer.full_name),
      volunteerSkills: Array.isArray(volunteer.skills) ? volunteer.skills : [],
      newTask: {
        name: task_name || "New Task",
        description: task_description || null,
        deadline: task_deadline || null,
      },
      existingActiveTasks,
      availableVolunteers,
    });

    return NextResponse.json({
      success: true,
      ...aiResult,
      volunteer: {
        id: String(volunteer.id),
        name: String(volunteer.full_name),
        email: String(volunteer.email),
        skills: Array.isArray(volunteer.skills) ? volunteer.skills : [],
      },
      activeTasksCount: existingActiveTasks.length,
      existingActiveTasks,
    });
  } catch (error) {
    console.error("Error in /api/ai/task-check:", error);
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "AI task check failed.",
      },
      { status: 500 }
    );
  }
}
