import { NextRequest, NextResponse } from "next/server";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const sessionCookie = request.cookies.get("clubops_session")?.value;
  const neonSession = request.cookies.get("neon_auth.session_token")?.value;
  const isAuthenticated = Boolean(sessionCookie || neonSession);

  const protectedPaths = ["/dashboard", "/club", "/createClub", "/joinClub"];
  const isProtected = protectedPaths.some((p) => pathname.startsWith(p));

  const authPaths = ["/signin", "/signup"];
  const isAuthPage = authPaths.some((p) => pathname.startsWith(p));

  // If user tries to access a protected page without authentication, redirect to /signin
  if (isProtected && !isAuthenticated) {
    const signInUrl = new URL("/signin", request.url);
    signInUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(signInUrl);
  }

  // If authenticated user visits signin/signup, redirect to dashboard
  if (isAuthPage && isAuthenticated) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/club/:path*",
    "/createClub/:path*",
    "/joinClub/:path*",
    "/signin",
    "/signup",
  ],
};

export default proxy;
