import { NextRequest, NextResponse } from "next/server";
import { getAuthUser, sql } from "../../../lib/db";

export const runtime = "nodejs";

// DELETE /api/clubs/[id] - Delete club by ID (LEADER ONLY)
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
    }

    const { id: clubId } = await context.params;

    const clubRows = await sql`
      SELECT id, club_code, name, leader_id 
      FROM clubs 
      WHERE id = ${clubId} 
      LIMIT 1
    `;

    if (clubRows.length === 0) {
      return NextResponse.json({ success: false, message: "Club not found." }, { status: 404 });
    }

    const club = clubRows[0];
    if (club.leader_id !== user.id) {
      return NextResponse.json(
        { success: false, message: "Access denied. Only the Club Leader can delete this club." },
        { status: 403 }
      );
    }

    // Cascade delete club
    await sql`DELETE FROM clubs WHERE id = ${club.id}`;

    return NextResponse.json({
      success: true,
      message: `Club "${club.name}" and all associated events/tasks have been deleted.`,
    });
  } catch (error) {
    console.error("Error in DELETE /api/clubs/[id]:", error);
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : "Failed to delete club." },
      { status: 500 }
    );
  }
}
