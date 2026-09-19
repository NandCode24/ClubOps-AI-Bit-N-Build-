import { NextRequest, NextResponse } from "next/server";
import { getAuthUser, sql } from "../../../../lib/db";

export const runtime = "nodejs";

// GET /api/clubs/[id]/requests - Get pending join requests for a club (Leader only)
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json(
        { success: false, message: "Unauthorized." },
        { status: 401 }
      );
    }

    const { id: clubId } = await context.params;

    // Verify current user is the leader of this club
    const clubRows = await sql`
      SELECT id, name, leader_id FROM clubs WHERE id = ${clubId} LIMIT 1
    `;

    if (clubRows.length === 0) {
      return NextResponse.json(
        { success: false, message: "Club not found." },
        { status: 404 }
      );
    }

    const club = clubRows[0];
    if (club.leader_id !== user.id) {
      return NextResponse.json(
        { success: false, message: "Only the club leader can view join requests." },
        { status: 403 }
      );
    }

    // Fetch pending requests with applicant details
    const requests = await sql`
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
        u.college_name,
        u.photo_url
      FROM join_requests jr
      JOIN users u ON u.id = jr.user_id
      WHERE jr.club_id = ${clubId} AND jr.status = 'pending'
      ORDER BY jr.created_at ASC
    `;

    // Fetch available club roles defined for this club
    const roles = await sql`
      SELECT id, role_name, description FROM club_roles 
      WHERE club_id = ${clubId}
      ORDER BY role_name ASC
    `;

    return NextResponse.json({
      success: true,
      club: {
        id: club.id,
        name: club.name,
      },
      requests,
      roles,
    });
  } catch (error) {
    console.error("Error fetching club requests:", error);
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Failed to fetch requests.",
      },
      { status: 500 }
    );
  }
}

// POST /api/clubs/[id]/requests - Accept or Reject a request (Leader only)
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json(
        { success: false, message: "Unauthorized." },
        { status: 401 }
      );
    }

    const { id: clubId } = await context.params;

    // Verify current user is the leader of this club
    const clubRows = await sql`
      SELECT id, name, leader_id FROM clubs WHERE id = ${clubId} LIMIT 1
    `;

    if (clubRows.length === 0) {
      return NextResponse.json(
        { success: false, message: "Club not found." },
        { status: 404 }
      );
    }

    const club = clubRows[0];
    if (club.leader_id !== user.id) {
      return NextResponse.json(
        { success: false, message: "Only the club leader can manage join requests." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const requestId = String(body.request_id || "").trim();
    const action = String(body.action || "").toLowerCase().trim(); // 'accept' | 'reject'
    const assignedRole = String(body.assigned_role || "").trim();

    if (!requestId || !["accept", "reject"].includes(action)) {
      return NextResponse.json(
        { success: false, message: "Valid request_id and action ('accept' or 'reject') are required." },
        { status: 400 }
      );
    }

    // Fetch the pending request
    const requestRows = await sql`
      SELECT id, club_id, user_id, status FROM join_requests 
      WHERE id = ${requestId} AND club_id = ${clubId} AND status = 'pending'
      LIMIT 1
    `;

    if (requestRows.length === 0) {
      return NextResponse.json(
        { success: false, message: "Pending request not found or already reviewed." },
        { status: 404 }
      );
    }

    const joinReq = requestRows[0];

    if (action === "accept") {
      const finalRole = assignedRole || "Volunteer";

      // 1. Insert into club_members
      await sql`
        INSERT INTO club_members (
          club_id,
          user_id,
          role_type,
          assigned_role
        )
        VALUES (
          ${clubId},
          ${joinReq.user_id},
          'volunteer',
          ${finalRole}
        )
        ON CONFLICT (club_id, user_id) 
        DO UPDATE SET assigned_role = EXCLUDED.assigned_role, role_type = 'volunteer'
      `;

      // 2. Mark request as accepted
      await sql`
        UPDATE join_requests
        SET status = 'accepted',
            reviewed_at = NOW(),
            reviewed_by = ${user.id}
        WHERE id = ${requestId}
      `;

      return NextResponse.json({
        success: true,
        message: `Volunteer accepted and assigned role: ${finalRole}`,
      });
    } else {
      // Reject request
      await sql`
        UPDATE join_requests
        SET status = 'rejected',
            reviewed_at = NOW(),
            reviewed_by = ${user.id}
        WHERE id = ${requestId}
      `;

      return NextResponse.json({
        success: true,
        message: "Join request declined.",
      });
    }
  } catch (error) {
    console.error("Error updating club request:", error);
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Failed to update request.",
      },
      { status: 500 }
    );
  }
}
