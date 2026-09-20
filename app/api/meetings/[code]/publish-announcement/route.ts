import { NextRequest, NextResponse } from "next/server";
import { getAuthUser, sql } from "../../../../lib/db";
import { emitClubEventUpdate } from "../../../../lib/events";

export const runtime = "nodejs";

// POST /api/meetings/[code]/publish-announcement - Publish Meeting Summary as Event Announcement (LEADER ONLY)
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ code: string }> }
) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ success: false, message: "Unauthorized. Please sign in." }, { status: 401 });
    }

    const { code: meetingCode } = await context.params;

    const meetingRows = await sql`
      SELECT 
        m.id,
        m.event_id,
        m.club_id,
        m.title,
        m.summary_title,
        m.summary_content,
        m.summary_decisions,
        m.extracted_tasks,
        m.summary_next_steps,
        m.recording_url,
        m.is_summary_published,
        c.leader_id,
        c.name as club_name,
        e.name as event_name
      FROM event_meetings m
      JOIN clubs c ON c.id = m.club_id
      JOIN events e ON e.id = m.event_id
      WHERE m.meeting_code = ${meetingCode}
      LIMIT 1
    `;

    if (meetingRows.length === 0) {
      return NextResponse.json({ success: false, message: "Meeting not found." }, { status: 404 });
    }

    const meeting = meetingRows[0];

    // SECURITY CHECK: Strictly enforce that ONLY the Club Leader can publish the summary as an announcement
    if (meeting.leader_id !== user.id) {
      return NextResponse.json(
        { success: false, message: "Forbidden. Only the Club Leader can publish meeting summaries to event announcements." },
        { status: 403 }
      );
    }

    let customContent: string | null = null;
    let customTitle: string | null = null;
    try {
      const body = await request.json();
      if (body.content) customContent = String(body.content).trim();
      if (body.title) customTitle = String(body.title).trim();
    } catch {
      // Body is optional
    }

    // Compose professional announcement markdown if custom content is not provided
    const announcementTitle = customTitle || `Meeting Summary — ${meeting.summary_title || meeting.title}`;

    let announcementContent = customContent;
    if (!announcementContent) {
      const parts: string[] = [];

      if (meeting.summary_content) {
        parts.push(`**Overview**\n${meeting.summary_content}`);
      }

      const decisions = Array.isArray(meeting.summary_decisions) ? meeting.summary_decisions : [];
      if (decisions.length > 0) {
        parts.push(`**Decisions Made**\n${decisions.map((d: any) => `• ${d}`).join("\n")}`);
      }

      const tasks = Array.isArray(meeting.extracted_tasks) ? meeting.extracted_tasks : [];
      if (tasks.length > 0) {
        parts.push(
          `**Key Action Items**\n${tasks
            .map((t: any) => {
              const assignee = t.owner || t.suggested_assignee_name || "Unassigned";
              const deadline = t.deadline ? ` (Due: ${t.deadline.slice(0, 10)})` : "";
              return `• ${t.task || t.name} — *${assignee}*${deadline}`;
            })
            .join("\n")}`
        );
      }

      const nextSteps = Array.isArray(meeting.summary_next_steps) ? meeting.summary_next_steps : [];
      if (nextSteps.length > 0) {
        parts.push(`**Next Steps**\n${nextSteps.map((ns: any) => `• ${ns}`).join("\n")}`);
      }

      announcementContent = parts.join("\n\n");
    }

    // Insert into existing announcements table
    const insertedAnnouncement = await sql`
      INSERT INTO announcements (
        club_id,
        event_id,
        title,
        content,
        audio_url,
        created_by
      ) VALUES (
        ${meeting.club_id},
        ${meeting.event_id},
        ${announcementTitle},
        ${announcementContent},
        ${meeting.recording_url || null},
        ${user.id}
      )
      RETURNING id, title, created_at
    `;

    const newAnnouncement = insertedAnnouncement[0];

    // Mark meeting summary as published
    await sql`
      UPDATE event_meetings
      SET is_summary_published = true,
          published_announcement_id = ${newAnnouncement.id},
          updated_at = NOW()
      WHERE id = ${meeting.id}
    `;

    // Emit real-time notification
    emitClubEventUpdate(meeting.club_id, {
      action: "announcement_posted",
      event_id: meeting.event_id,
      club_id: meeting.club_id,
      name: meeting.event_name,
      announcement: newAnnouncement,
    });

    return NextResponse.json({
      success: true,
      message: "Meeting summary published as an official event announcement!",
      announcementId: newAnnouncement.id,
    });
  } catch (error) {
    console.error("Error publishing meeting announcement:", error);
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : "Failed to publish announcement" },
      { status: 500 }
    );
  }
}
