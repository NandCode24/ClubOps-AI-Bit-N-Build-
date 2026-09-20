import { neon } from "@neondatabase/serverless";
import { auth } from "./auth-server";

const databaseUrl = process.env.DATABASE_URL || "postgresql://unconfigured_neon_db:missing@localhost:5432/placeholder";

export const sql = neon(databaseUrl);

export interface DbUser {
  id: string;
  email: string;
  full_name: string;
  username?: string | null;
  mobile_number?: string | null;
  college_name?: string | null;
  skills: string[];
  photo_url?: string | null;
  is_available?: boolean;
  unavailable_until?: string | null;
  unavailable_reason?: string | null;
  created_at?: string;
  updated_at?: string;
}

export function isMemberAvailable(user: {
  is_available?: boolean | null;
  unavailable_until?: string | Date | null;
}): boolean {
  if (user.is_available === false) {
    if (user.unavailable_until) {
      const until = new Date(user.unavailable_until).getTime();
      if (!isNaN(until) && until <= Date.now()) {
        return true; // Duration expired, auto-reactivated!
      }
    }
    return false; // Still unavailable
  }
  return true;
}

export interface DbClub {
  id: string;
  club_code: string;
  name: string;
  description?: string | null;
  profile_image?: string | null;
  leader_id: string;
  leader_name: string;
  location?: string | null;
  created_at?: string;
}

export interface DbClubRole {
  id: string;
  club_id: string;
  role_name: string;
  description?: string | null;
  created_at?: string;
}

export interface DbClubMember {
  id: string;
  club_id: string;
  user_id: string;
  role_type: "leader" | "volunteer" | "member";
  assigned_role?: string | null;
  joined_at?: string;
}

export interface DbJoinRequest {
  id: string;
  club_id: string;
  user_id: string;
  status: "pending" | "accepted" | "rejected";
  message?: string | null;
  created_at?: string;
  reviewed_at?: string | null;
  reviewed_by?: string | null;
}

/**
 * Verifies session via Neon Auth and ensures user is synced in Neon DB
 */
export async function getAuthUser(): Promise<DbUser | null> {
  try {
    const { data: session, error } = await auth.getSession();
    if (error || !session?.user) {
      return null;
    }

    const sessionUser = session.user;
    const uid = String(sessionUser.id);
    const email = String(sessionUser.email || "").toLowerCase();
    const fullName = sessionUser.name || email.split("@")[0] || "User";
    const photoURL = sessionUser.image || null;

    // Check if user exists in Neon DB
    const existingUsers = await sql`
      SELECT id, email, full_name, username, mobile_number, college_name, skills, photo_url, is_available, unavailable_until, unavailable_reason, created_at, updated_at
      FROM users
      WHERE id = ${uid} OR email = ${email}
      LIMIT 1
    `;

    if (existingUsers.length > 0) {
      const u = existingUsers[0];
      if (u.id !== uid) {
        await sql`UPDATE users SET photo_url = COALESCE(photo_url, ${photoURL}) WHERE id = ${u.id}`;
      }
      return {
        id: u.id,
        email: u.email,
        full_name: u.full_name,
        username: u.username,
        mobile_number: u.mobile_number,
        college_name: u.college_name,
        skills: u.skills || [],
        photo_url: u.photo_url || photoURL,
        is_available: u.is_available !== false,
        unavailable_until: u.unavailable_until ? String(u.unavailable_until) : null,
        unavailable_reason: u.unavailable_reason || null,
        created_at: u.created_at,
        updated_at: u.updated_at,
      };
    }

    const inserted = await sql`
      INSERT INTO users (id, email, full_name, photo_url, is_available)
      VALUES (${uid}, ${email}, ${fullName}, ${photoURL}, true)
      ON CONFLICT (id) DO UPDATE
      SET email = EXCLUDED.email,
          full_name = EXCLUDED.full_name,
          photo_url = COALESCE(users.photo_url, EXCLUDED.photo_url),
          updated_at = NOW()
      RETURNING id, email, full_name, username, mobile_number, college_name, skills, photo_url, is_available, unavailable_until, unavailable_reason, created_at, updated_at
    `;

    const u = inserted[0];
    return {
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
      created_at: u.created_at,
      updated_at: u.updated_at,
    };
  } catch (error) {
    console.error("Auth verification failed in Neon DB helper:", error);
    return null;
  }
}

/**
 * Generate a unique readable Club Code (e.g. CLB-9K2P4X)
 */
export async function generateUniqueClubCode(): Promise<string> {
  const chars = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"; // avoid ambiguous 0, O, 1, I
  for (let attempt = 0; attempt < 10; attempt++) {
    let randomPart = "";
    for (let i = 0; i < 6; i++) {
      randomPart += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    const candidate = `CLB-${randomPart}`;

    const existing = await sql`
      SELECT id FROM clubs WHERE club_code = ${candidate} LIMIT 1
    `;

    if (existing.length === 0) {
      return candidate;
    }
  }

  // Fallback with timestamp
  return `CLB-${Date.now().toString(36).toUpperCase().slice(-6)}`;
}
