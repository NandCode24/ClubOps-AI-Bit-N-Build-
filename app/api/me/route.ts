import { NextRequest, NextResponse } from "next/server";
import { getAuthUser, isMemberAvailable, sql } from "../../lib/db";
import { emitTaskEvent } from "../../lib/events";
import { findBestSkillMatchWithGroq } from "../../lib/groq";

export const runtime = "nodejs";

export async function GET() {
  try {
    const user = await getAuthUser();

    if (!user) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    // Fetch user's club memberships
    const memberships = await sql`
      SELECT 
        cm.id as membership_id,
        cm.club_id,
        cm.role_type,
        cm.assigned_role,
        cm.joined_at,
        c.name as club_name,
        c.club_code,
        c.description as club_description,
        c.profile_image as club_image,
        c.leader_id,
        c.leader_name,
        c.location as club_location
      FROM club_members cm
      JOIN clubs c ON c.id = cm.club_id
      WHERE cm.user_id = ${user.id}
      ORDER BY cm.joined_at DESC
    `;

    return NextResponse.json({
      success: true,
      user: {
        ...user,
        is_active: isMemberAvailable(user),
      },
      clubs: memberships,
    });
  } catch (error) {
    console.error("Error in GET /api/me:", error);
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Failed to fetch user.",
      },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const {
      full_name,
      college_name,
      mobile_number,
      skills,
      is_available,
      unavailable_duration,
      unavailable_until: rawUnavailableUntil,
      unavailable_reason,
    } = body;

    let newUntil: string | null = null;
    let newReason: string | null = null;
    let newIsAvailable = user.is_available !== false;

    if (is_available !== undefined) {
      newIsAvailable = Boolean(is_available);

      if (newIsAvailable) {
        // Reactivating immediately
        newUntil = null;
        newReason = null;
      } else {
        // Deactivating / setting away for duration
        newReason = unavailable_reason ? String(unavailable_reason).trim() : "Temporarily on leave";

        if (unavailable_duration) {
          const now = Date.now();
          switch (unavailable_duration) {
            case "4h":
              newUntil = new Date(now + 4 * 60 * 60 * 1000).toISOString();
              break;
            case "8h":
              newUntil = new Date(now + 8 * 60 * 60 * 1000).toISOString();
              break;
            case "24h":
            case "1d":
              newUntil = new Date(now + 24 * 60 * 60 * 1000).toISOString();
              break;
            case "3d":
              newUntil = new Date(now + 3 * 24 * 60 * 60 * 1000).toISOString();
              break;
            case "7d":
            case "1w":
              newUntil = new Date(now + 7 * 24 * 60 * 60 * 1000).toISOString();
              break;
            default:
              newUntil = new Date(now + 24 * 60 * 60 * 1000).toISOString();
          }
        } else if (rawUnavailableUntil) {
          newUntil = new Date(rawUnavailableUntil).toISOString();
        } else {
          // Default to 24 hours if no duration provided
          newUntil = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
        }
      }
    }

    // Prepare skills array
    let newSkills = user.skills;
    if (Array.isArray(skills)) {
      newSkills = skills.map((s: string) => String(s).trim()).filter(Boolean);
    }

    const updatedFullName = full_name !== undefined ? String(full_name).trim() : user.full_name;
    const updatedCollege = college_name !== undefined ? String(college_name).trim() : user.college_name;
    const updatedMobile = mobile_number !== undefined ? String(mobile_number).trim() : user.mobile_number;

    const updatedRows = await sql`
      UPDATE users
      SET 
        full_name = ${updatedFullName},
        college_name = ${updatedCollege},
        mobile_number = ${updatedMobile},
        skills = ${newSkills},
        is_available = ${newIsAvailable},
        unavailable_until = ${newUntil},
        unavailable_reason = ${newReason},
        updated_at = NOW()
      WHERE id = ${user.id}
      RETURNING id, email, full_name, username, mobile_number, college_name, skills, photo_url, is_available, unavailable_until, unavailable_reason, updated_at
    `;

    const u = updatedRows[0];
    const updatedUser = {
      id: u.id,
      email: u.email,
      full_name: u.full_name,
      username: u.username,
      mobile_number: u.mobile_number,
      college_name: u.college_name,
      skills: u.skills || [],
      photo_url: u.photo_url,
      is_available: u.is_available !== false,
      unavailable_until: u.unavailable_until ? String(u.unavailable_until) : null,
      unavailable_reason: u.unavailable_reason || null,
      is_active: isMemberAvailable(u),
    };

    // If user marked as unavailable / deactivating, auto-reassign active tasks to peers with similar skillset
    const reassignedTasksList: Array<{
      taskId: string;
      taskName: string;
      reassignedToId: string;
      reassignedToName: string;
      reason: string;
    }> = [];

    if (is_available !== undefined && !newIsAvailable) {
      try {
        const activeTasks = await sql`
          SELECT t.id, t.name, t.description, t.club_id, t.event_id, e.name as event_name
          FROM tasks t
          LEFT JOIN events e ON e.id = t.event_id
          WHERE t.assigned_to = ${user.id} AND t.status != 'completed'
        `;

        for (const t of activeTasks) {
          // Find candidate volunteers in the same club who are available and have 0 active tasks
          const candidateRows = await sql`
            SELECT u.id, u.full_name, u.skills
            FROM club_members cm
            JOIN users u ON u.id = cm.user_id
            WHERE cm.club_id = ${t.club_id}
              AND u.id != ${user.id}
              AND (u.is_available IS NULL OR u.is_available = true)
              AND NOT EXISTS (
                SELECT 1 FROM tasks ot
                WHERE ot.assigned_to = u.id
                  AND ot.club_id = ${t.club_id}
                  AND ot.status != 'completed'
              )
          `;

          const candidates = candidateRows.map((c: Record<string, any>) => ({
            id: String(c.id),
            name: String(c.full_name),
            skills: Array.isArray(c.skills) ? c.skills : [],
          }));

          if (candidates.length > 0) {
            const matchResult = await findBestSkillMatchWithGroq({
              task: {
                id: String(t.id),
                name: String(t.name),
                description: t.description ? String(t.description) : null,
              },
              deactivatingUser: {
                id: String(user.id),
                name: String(user.full_name),
                skills: Array.isArray(user.skills) ? user.skills : [],
              },
              candidates,
            });

            if (matchResult) {
              await sql`
                UPDATE tasks
                SET assigned_to = ${matchResult.selectedVolunteerId}
                WHERE id = ${t.id}
              `;

              emitTaskEvent(t.club_id, {
                action: "reallocated",
                task_id: t.id,
                club_id: t.club_id,
                event_id: t.event_id,
                name: t.name,
                status: "pending",
                assigned_to: matchResult.selectedVolunteerId,
                assigned_to_name: matchResult.selectedVolunteerName,
                previous_assignee_name: user.full_name,
                updated_at: new Date().toISOString(),
              });

              reassignedTasksList.push({
                taskId: String(t.id),
                taskName: String(t.name),
                reassignedToId: matchResult.selectedVolunteerId,
                reassignedToName: matchResult.selectedVolunteerName,
                reason: matchResult.reasoning,
              });
            }
          }
        }
      } catch (reassignErr) {
        console.error("Auto-reassign error on deactivation:", reassignErr);
      }
    }

    return NextResponse.json({
      success: true,
      message:
        reassignedTasksList.length > 0
          ? `Profile updated. ${reassignedTasksList.length} active task${
              reassignedTasksList.length > 1 ? "s were" : " was"
            } automatically reassigned to available volunteers with matching skills.`
          : "Profile and availability updated successfully.",
      user: updatedUser,
      reassigned_tasks: reassignedTasksList,
    });
  } catch (error) {
    console.error("Error in PATCH /api/me:", error);
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Failed to update profile.",
      },
      { status: 500 }
    );
  }
}
