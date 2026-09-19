import { NextRequest, NextResponse } from "next/server";
import { getAuthUser, sql } from "../../lib/db";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser();

    if (!user) {
      return NextResponse.json(
        { success: false, message: "Unauthorized. Please sign in." },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const requestedClubId = searchParams.get("club_id");

    // Fetch all clubs user belongs to
    const userClubs = await sql`
      SELECT 
        c.id,
        c.club_code,
        c.name,
        c.description,
        c.profile_image,
        c.leader_id,
        c.leader_name,
        c.location,
        c.created_at,
        cm.role_type,
        cm.assigned_role,
        (c.leader_id = ${user.id}) as is_leader
      FROM club_members cm
      JOIN clubs c ON c.id = cm.club_id
      WHERE cm.user_id = ${user.id}
      ORDER BY is_leader DESC, cm.joined_at DESC
    `;

    // If user belongs to no clubs, return onboarding status
    if (userClubs.length === 0) {
      return NextResponse.json({
        success: true,
        user,
        hasClubs: false,
        clubs: [],
        activeClub: null,
      });
    }

    // Determine active club (either requested or first in list)
    const activeClubMeta = requestedClubId
      ? userClubs.find((c) => c.id === requestedClubId) || userClubs[0]
      : userClubs[0];

    const activeClubId = activeClubMeta.id;
    const isLeader = Boolean(activeClubMeta.is_leader);

    // Fetch members of active club
    const members = await sql`
      SELECT 
        cm.id as membership_id,
        cm.user_id,
        cm.role_type,
        cm.assigned_role,
        cm.joined_at,
        u.full_name,
        u.email,
        u.photo_url,
        u.skills
      FROM club_members cm
      JOIN users u ON u.id = cm.user_id
      WHERE cm.club_id = ${activeClubId}
      ORDER BY 
        CASE WHEN cm.role_type = 'leader' THEN 0 ELSE 1 END,
        cm.joined_at ASC
    `;

    // Fetch club custom roles
    const roles = await sql`
      SELECT id, role_name, description FROM club_roles
      WHERE club_id = ${activeClubId}
      ORDER BY role_name ASC
    `;

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
        WHERE jr.club_id = ${activeClubId} AND jr.status = 'pending'
        ORDER BY jr.created_at ASC
      `;
      pendingRequests = reqRows.map((r) => ({
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
      hasClubs: true,
      clubs: userClubs,
      activeClub: {
        ...activeClubMeta,
        member_count: members.length,
        members,
        roles,
        pendingRequests,
      },
    });
  } catch (error) {
    console.error("Error in /api/dashboard:", error);
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Failed to load dashboard data.",
      },
      { status: 500 }
    );
  }
}
