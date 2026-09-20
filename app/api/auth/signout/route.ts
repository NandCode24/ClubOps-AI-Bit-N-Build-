import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST() {
  const response = NextResponse.json({
    success: true,
    message: "Signed out successfully.",
  });

  const cookiesToClear = [
    "clubops_session",
    "neon_auth.session_token",
    "better-auth.session_token",
    "__Secure-better-auth.session_token",
    "neon_auth_session",
  ];

  for (const name of cookiesToClear) {
    response.cookies.delete(name);
    response.cookies.set({
      name,
      value: "",
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });
  }

  return response;
}
