import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "../../lib/firebase-admin";

export const runtime = "nodejs";

const SESSION_EXPIRES_IN = 5 * 24 * 60 * 60 * 1000;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const email = String(body?.email || "")
      .trim()
      .toLowerCase();
    const password = String(body?.password || "");

    if (!email || !password) {
      return NextResponse.json(
        {
          success: false,
          message: "Email and password are required.",
        },
        { status: 400 },
      );
    }

    const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        {
          success: false,
          message: "Missing NEXT_PUBLIC_FIREBASE_API_KEY.",
        },
        { status: 500 },
      );
    }

    // Firebase login
    const firebaseResponse = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          password,
          returnSecureToken: true,
        }),
      },
    );

    const firebaseData = await firebaseResponse.json();

    if (!firebaseResponse.ok) {
      const firebaseMessage =
        firebaseData?.error?.message || "Firebase signin failed.";

      const errors: Record<string, string> = {
        INVALID_LOGIN_CREDENTIALS: "Invalid email or password.",
        EMAIL_NOT_FOUND: "No account exists with this email.",
        INVALID_PASSWORD: "Invalid email or password.",
        USER_DISABLED: "This account has been disabled.",
        TOO_MANY_ATTEMPTS_TRY_LATER:
          "Too many failed attempts. Please try again later.",
      };

      return NextResponse.json(
        {
          success: false,
          message: errors[firebaseMessage] || "Invalid email or password.",
        },
        { status: 401 },
      );
    }

    const uid = firebaseData.localId;
    const idToken = firebaseData.idToken;

    if (!uid || !idToken) {
      return NextResponse.json(
        {
          success: false,
          message: "Firebase did not return valid authentication data.",
        },
        { status: 500 },
      );
    }

    // Initialize Admin SDK
    const adminAuth = getAdminAuth();
    const adminDb = getAdminDb();

    // Get Firebase user
    const user = await adminAuth.getUser(uid);

    // Update Firestore
    await adminDb
      .collection("users")
      .doc(uid)
      .set(
        {
          uid,
          fullName: user.displayName || "",
          email: user.email || email,
          photoURL: user.photoURL || null,
          lastLoginAt: new Date(),
          updatedAt: new Date(),
        },
        {
          merge: true,
        },
      );

    // Create session cookie
    const sessionCookie = await adminAuth.createSessionCookie(idToken, {
      expiresIn: SESSION_EXPIRES_IN,
    });

    const response = NextResponse.json(
      {
        success: true,
        message: "Signed in successfully.",
        user: {
          uid,
          fullName: user.displayName || "",
          email: user.email || email,
          photoURL: user.photoURL || null,
        },
      },
      { status: 200 },
    );

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
    console.error("=================================");
    console.error("CLUBOPS SIGNIN ERROR");
    console.error(error);
    console.error("=================================");

    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error ? error.message : "Unexpected signin error.",
      },
      { status: 500 },
    );
  }
}
