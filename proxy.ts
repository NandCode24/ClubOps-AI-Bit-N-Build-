import { NextRequest, NextResponse } from "next/server";
import { auth } from "./app/lib/auth-server";

const neonMiddleware = auth.middleware({ loginUrl: "/signin" });

function hasActiveSession(request: NextRequest): boolean {
  return request.cookies.getAll().some(
    (c) =>
      (c.name.includes("neon-auth") || c.name.includes("better-auth")) &&
      (c.name.includes("session_token") || c.name.includes("session_data")) &&
      Boolean(c.value)
  );
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isAuthPage = pathname.startsWith("/signin") || pathname.startsWith("/signup");
  const isAuthenticated = hasActiveSession(request);

  // If authenticated user visits /signin or /signup, redirect to /dashboard
  if (isAuthPage) {
    if (isAuthenticated) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
    return NextResponse.next();
  }

  // Use official Neon Auth middleware for protected routes
  try {
    return await neonMiddleware(request);
  } catch (err) {
    console.warn("Neon middleware check error, falling back to cookie inspection:", err);
    if (!isAuthenticated) {
      const signInUrl = new URL("/signin", request.url);
      signInUrl.searchParams.set("redirect", pathname);
      return NextResponse.redirect(signInUrl);
    }
    return NextResponse.next();
  }
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/club/:path*",
    "/createClub/:path*",
    "/joinClub/:path*",
    "/profile/:path*",
    "/signin",
    "/signup",
  ],
};

export default proxy;
