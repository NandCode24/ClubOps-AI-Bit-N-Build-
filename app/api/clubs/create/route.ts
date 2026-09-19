import { NextRequest, NextResponse } from "next/server";
import { getAuthUser, generateUniqueClubCode, sql } from "../../../lib/db";

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
    const name = String(body.name || "").trim();
    const description = String(body.description || "").trim();
    const location = String(body.location || "").trim();
    const profileImage = String(body.profile_image || "").trim();
    const leaderName = String(body.leader_name || user.full_name || "").trim();

    const rolesInput: string[] = Array.isArray(body.roles)
      ? body.roles.map((r: unknown) => String(r).trim()).filter(Boolean)
      : [];

    if (!name) {
      return NextResponse.json(
        { success: false, message: "Club name is required." },
        { status: 400 }
      );
    }

    // Generate unique club code
    const clubCode = await generateUniqueClubCode();

    // Insert club into Neon
    const clubRows = await sql`
      INSERT INTO clubs (
        club_code,
        name,
        description,
        profile_image,
        leader_id,
        leader_name,
        location
      )
      VALUES (
        ${clubCode},
        ${name},
        ${description || null},
        ${profileImage || null},
        ${user.id},
        ${leaderName},
        ${location || null}
      )
      RETURNING id, club_code, name, description, profile_image, leader_id, leader_name, location, created_at
    `;

    const club = clubRows[0];

    // Add creator as club leader in club_members
    await sql`
      INSERT INTO club_members (
        club_id,
        user_id,
        role_type,
        assigned_role
      )
      VALUES (
        ${club.id},
        ${user.id},
        'leader',
        'Club Leader'
      )
    `;

    // Add custom roles created by the leader (fallback to default standard roles if none provided)
    const rolesToCreate = rolesInput.length > 0
      ? rolesInput
      : ["Volunteer", "Technical Lead", "Event Coordinator", "Marketing Lead", "Logistics"];

    for (const roleName of rolesToCreate) {
      await sql`
        INSERT INTO club_roles (club_id, role_name)
        VALUES (${club.id}, ${roleName})
        ON CONFLICT (club_id, role_name) DO NOTHING
      `;
    }

    const savedRoles = await sql`
      SELECT id, role_name, description FROM club_roles WHERE club_id = ${club.id} ORDER BY created_at ASC
    `;

    return NextResponse.json({
      success: true,
      message: "Club created successfully!",
      club: {
        ...club,
        roles: savedRoles,
      },
    });
  } catch (error) {
    console.error("Error creating club:", error);
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Failed to create club.",
      },
      { status: 500 }
    );
  }
}
