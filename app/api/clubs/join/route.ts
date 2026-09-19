import { NextRequest, NextResponse } from "next/server";
import { getAuthUser, sql } from "../../../lib/db";
import { emitNewJoinRequest } from "../../../lib/events";

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
    const clubId = String(body.club_id || "").trim();
    const message = String(body.message || "").trim();

    if (!clubId) {
      return NextResponse.json(
        { success: false, message: "Club ID is required." },
        { status: 400 }
      );
    }

    // Verify club exists
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

    // Check if already a member
    const existingMember = await sql`
      SELECT id FROM club_members WHERE club_id = ${club.id} AND user_id = ${user.id} LIMIT 1
    `;

    if (existingMember.length > 0) {
      return NextResponse.json(
        { success: false, message: "You are already a member of this club." },
        { status: 400 }
      );
    }

    // Check if user already has a pending request
    const existingRequest = await sql`
      SELECT id, status FROM join_requests 
      WHERE club_id = ${club.id} AND user_id = ${user.id} AND status = 'pending'
      LIMIT 1
    `;

    if (existingRequest.length > 0) {
      return NextResponse.json(
        { success: false, message: "You already have a pending join request for this club." },
        { status: 400 }
      );
    }

    // Insert new pending request
    const inserted = await sql`
      INSERT INTO join_requests (
        club_id,
        user_id,
        status,
        message
      )
      VALUES (
        ${club.id},
        ${user.id},
        'pending',
        ${message || null}
      )
      RETURNING id, club_id, user_id, status, message, created_at
    `;

    const reqRow = inserted[0];

    // Emit real-time event to connected leaders
    emitNewJoinRequest(club.id, {
      request_id: String(reqRow.id),
      club_id: String(club.id),
      user_id: String(user.id),
      status: String(reqRow.status),
      message: reqRow.message ? String(reqRow.message) : null,
      created_at: String(reqRow.created_at),
      full_name: String(user.full_name || "Volunteer"),
      email: String(user.email || ""),
      skills: Array.isArray(user.skills) ? user.skills : [],
      photo_url: user.photo_url ? String(user.photo_url) : null,
    });

    return NextResponse.json({
      success: true,
      message: `Your request to join ${club.name} has been submitted! The club leader will review your request and assign your role.`,
      request: reqRow,
    });
  } catch (error) {
    console.error("Error joining club:", error);
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Failed to submit join request.",
      },
      { status: 500 }
    );
  }
}
