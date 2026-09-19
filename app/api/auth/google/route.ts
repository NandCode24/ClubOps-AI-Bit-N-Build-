import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth } from "../../../lib/firebase-admin";
import { sql } from "../../../lib/db";

export const runtime = "nodejs";

const SESSION_EXPIRES_IN = 5 * 24 * 60 * 60 * 1000; // 5 days

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const idToken = String(body.idToken || "").trim();

    if (!idToken) {
      return NextResponse.json(
        { success: false, message: "Missing idToken." },
        { status: 400 }
      );
    }

    const adminAuth = getAdminAuth();
    const decodedToken = await adminAuth.verifyIdToken(idToken);

    const uid = decodedToken.uid;
    const email = decodedToken.email || "";
    const name = decodedToken.name || email.split("@")[0] || "User";
    const picture = decodedToken.picture || null;

    // Upsert into Neon DB users table
    await sql`
      INSERT INTO users (id, email, full_name, photo_url)
      VALUES (${uid}, ${email}, ${name}, ${picture})
      ON CONFLICT (id) DO UPDATE
      SET email = EXCLUDED.email,
          full_name = EXCLUDED.full_name,
          photo_url = COALESCE(users.photo_url, EXCLUDED.photo_url),
          updated_at = NOW()
    `;

    // Create session cookie
    const sessionCookie = await adminAuth.createSessionCookie(idToken, {
      expiresIn: SESSION_EXPIRES_IN,
    });

    const response = NextResponse.json({
      success: true,
      message: "Google sign-in successful.",
      user: {
        uid,
        email,
        fullName: name,
        photoURL: picture,
      },
    });

    response.cookies.set({
      name: "clubops_session",
      value: sessionCookie,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_EXPIRES_IN / 1000,
    });

    return response;
  } catch (error) {
    console.error("Error in Google Auth exchange:", error);
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Google authentication failed.",
      },
      { status: 500 }
    );
  }
}
