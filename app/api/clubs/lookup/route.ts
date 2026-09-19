import { NextRequest, NextResponse } from "next/server";
import { getAuthUser, sql } from "../../../lib/db";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser();

    if (!user) {
      return NextResponse.json(
        { success: false, message: "Unauthorized. Please sign in." },
        { status: 401 }
      );
    }

    const body = await request.json();
    const code = String(body.code || "").trim().toUpperCase();

    if (!code) {
      return NextResponse.json(
        { success: false, message: "Please provide a valid club code." },
        { status: 400 }
      );
    }

    // Lookup club by code
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
        c.created_at,
        COUNT(DISTINCT cm.id) as member_count
      FROM clubs c
      LEFT JOIN club_members cm ON cm.club_id = c.id
      WHERE UPPER(c.club_code) = ${code}
      GROUP BY c.id
      LIMIT 1
    `;

    if (clubRows.length === 0) {
      return NextResponse.json(
        { success: false, message: `No club found with code "${code}".` },
        { status: 404 }
      );
    }

    const club = clubRows[0];

    // Check if user is already a member
    const existingMember = await sql`
      SELECT id, role_type, assigned_role FROM club_members 
      WHERE club_id = ${club.id} AND user_id = ${user.id}
      LIMIT 1
    `;

    // Check if user has a pending join request
    const existingRequest = await sql`
      SELECT id, status, created_at FROM join_requests
      WHERE club_id = ${club.id} AND user_id = ${user.id} AND status = 'pending'
      LIMIT 1
    `;

    // Fetch available roles defined by the club leader
    const roles = await sql`
      SELECT id, role_name, description FROM club_roles 
      WHERE club_id = ${club.id}
      ORDER BY role_name ASC
    `;

    return NextResponse.json({
      success: true,
      club: {
        id: club.id,
        club_code: club.club_code,
        name: club.name,
        description: club.description,
        profile_image: club.profile_image,
        leader_name: club.leader_name,
        location: club.location,
        member_count: Number(club.member_count) || 0,
        roles,
        isMember: existingMember.length > 0,
        membership: existingMember[0] || null,
        hasPendingRequest: existingRequest.length > 0,
        pendingRequest: existingRequest[0] || null,
      },
    });
  } catch (error) {
    console.error("Error looking up club:", error);
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Failed to lookup club.",
      },
      { status: 500 }
    );
  }
}
