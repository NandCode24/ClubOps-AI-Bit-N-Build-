import { NextResponse } from "next/server";
import { getAuthUser, sql } from "../../lib/db";

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
      user,
      clubs: memberships,
    });
  } catch (error) {
    console.error("Error in /api/me:", error);
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Failed to fetch user.",
      },
      { status: 500 }
    );
  }
}
