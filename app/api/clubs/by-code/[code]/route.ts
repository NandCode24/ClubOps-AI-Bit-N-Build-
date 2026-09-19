import { NextRequest, NextResponse } from "next/server";
import { getAuthUser, sql } from "../../../../lib/db";

export const runtime = "nodejs";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ code: string }> }
) {
  try {
    const user = await getAuthUser();
    const { code: rawCode } = await context.params;
    const code = rawCode.trim().toUpperCase();

    // Fetch club by code
    const clubRows = await sql`
      SELECT 
        c.id,
        c.club_code,
        c.name,
        c.description,
        c.profile_image,
        c.leader_id,
        c.leader_name,
        c.location,
        c.created_at
      FROM clubs c
      WHERE UPPER(c.club_code) = ${code}
      LIMIT 1
    `;

    if (clubRows.length === 0) {
      return NextResponse.json(
        { success: false, message: `Club with code "${code}" not found.` },
        { status: 404 }
      );
    }

    const club = clubRows[0];
    const isLeader = user ? club.leader_id === user.id : false;

    // Check membership
    let membership = null;
    if (user) {
      const memberRows = await sql`
        SELECT id, role_type, assigned_role, joined_at
        FROM club_members
        WHERE club_id = ${club.id} AND user_id = ${user.id}
        LIMIT 1
      `;
      if (memberRows.length > 0) {
        membership = memberRows[0];
      }
    }

    // Fetch club roles
    const roles = await sql`
      SELECT id, role_name, description
      FROM club_roles
      WHERE club_id = ${club.id}
      ORDER BY role_name ASC
    `;

    // Fetch members
    const memberRows = await sql`
      SELECT 
        cm.id as membership_id,
        cm.user_id,
        cm.role_type,
        cm.assigned_role,
        cm.joined_at,
        u.full_name,
        u.email,
        u.photo_url,
        u.skills,
        u.is_available,
        u.unavailable_until,
        u.unavailable_reason
      FROM club_members cm
      JOIN users u ON u.id = cm.user_id
      WHERE cm.club_id = ${club.id}
      ORDER BY 
        CASE WHEN cm.role_type = 'leader' THEN 0 ELSE 1 END,
        cm.joined_at ASC
    `;

    const members = memberRows.map((m: Record<string, any>) => {
      let isActive = true;
      if (m.is_available === false) {
        if (m.unavailable_until) {
          const until = new Date(m.unavailable_until).getTime();
          isActive = !isNaN(until) && until <= Date.now();
        } else {
          isActive = false;
        }
      }
      return {
        membership_id: String(m.membership_id),
        user_id: String(m.user_id),
        role_type: String(m.role_type),
        assigned_role: m.assigned_role ? String(m.assigned_role) : null,
        joined_at: String(m.joined_at),
        full_name: String(m.full_name || "Member"),
        email: String(m.email || ""),
        photo_url: m.photo_url ? String(m.photo_url) : null,
        skills: Array.isArray(m.skills) ? m.skills : [],
        is_available: m.is_available !== false,
        unavailable_until: m.unavailable_until ? String(m.unavailable_until) : null,
        unavailable_reason: m.unavailable_reason ? String(m.unavailable_reason) : null,
        is_active: isActive,
      };
    });

    // If leader, fetch pending join requests
    let pendingRequests: Array<{
      request_id: string;
      club_id: string;
      user_id: string;
      status: string;
      message: string | null;
      created_at: string;
      full_name: string;
      email: string;
      skills: string[];
      photo_url: string | null;
    }> = [];

    if (isLeader) {
      const reqRows = await sql`
        SELECT 
          jr.id as request_id,
          jr.club_id,
          jr.user_id,
          jr.status,
          jr.message,
          jr.created_at,
          u.full_name,
          u.email,
          u.skills,
          u.photo_url
        FROM join_requests jr
        JOIN users u ON u.id = jr.user_id
        WHERE jr.club_id = ${club.id} AND jr.status = 'pending'
        ORDER BY jr.created_at ASC
      `;
      pendingRequests = reqRows.map((r: Record<string, any>) => ({
        request_id: String(r.request_id),
        club_id: String(r.club_id),
        user_id: String(r.user_id),
        status: String(r.status),
        message: r.message ? String(r.message) : null,
        created_at: String(r.created_at),
        full_name: String(r.full_name || "Volunteer"),
        email: String(r.email || ""),
        skills: Array.isArray(r.skills) ? r.skills : [],
        photo_url: r.photo_url ? String(r.photo_url) : null,
      }));
    }

    return NextResponse.json({
      success: true,
      user,
      club: {
        ...club,
        is_leader: isLeader,
        is_member: Boolean(membership),
        user_role: membership?.assigned_role || (isLeader ? "Leader" : null),
        member_count: members.length,
        members,
        roles,
        pendingRequests,
      },
    });
  } catch (error) {
    console.error("Error in /api/clubs/by-code:", error);
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Failed to load club details.",
      },
      { status: 500 }
    );
  }
}
