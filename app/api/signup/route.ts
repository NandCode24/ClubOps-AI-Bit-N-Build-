import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "../../lib/firebase-admin";

export const runtime = "nodejs";

const SESSION_EXPIRES_IN = 5 * 24 * 60 * 60 * 1000;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const fullName = String(body?.fullName || "").trim();
    const email = String(body?.email || "")
      .trim()
      .toLowerCase();
    const password = String(body?.password || "");

    if (!fullName || !email || !password) {
      return NextResponse.json(
        {
          success: false,
          message: "Full name, email and password are required.",
        },
        { status: 400 },
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        {
          success: false,
          message: "Password must be at least 6 characters.",
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

    // Create Firebase Auth account
    const firebaseResponse = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${apiKey}`,
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
        firebaseData?.error?.message || "Firebase signup failed.";

      const errors: Record<string, string> = {
        EMAIL_EXISTS: "An account with this email already exists.",
        INVALID_EMAIL: "Please enter a valid email address.",
        WEAK_PASSWORD: "Password must be at least 6 characters.",
        OPERATION_NOT_ALLOWED:
          "Email/password authentication is not enabled in Firebase.",
      };

      return NextResponse.json(
        {
          success: false,
          message: errors[firebaseMessage] || firebaseMessage,
        },
        { status: 400 },
      );
    }

    const uid = firebaseData.localId;
    const idToken = firebaseData.idToken;

    if (!uid || !idToken) {
      return NextResponse.json(
        {
          success: false,
          message: "Firebase did not return a valid user.",
        },
        { status: 500 },
      );
    }

    // Initialize Admin SDK only now
    const adminAuth = getAdminAuth();
    const adminDb = getAdminDb();

    // Update Firebase Auth profile
    await adminAuth.updateUser(uid, {
      displayName: fullName,
    });

    // Create Firestore user
    await adminDb.collection("users").doc(uid).set(
      {
        uid,
        fullName,
        email,
        role: "member",
        photoURL: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastLoginAt: new Date(),
      },
      {
        merge: true,
      },
    );

    // Create server session cookie
    const sessionCookie = await adminAuth.createSessionCookie(idToken, {
      expiresIn: SESSION_EXPIRES_IN,
    });

    const response = NextResponse.json(
      {
        success: true,
        message: "Account created successfully.",
        user: {
          uid,
          fullName,
          email,
          role: "member",
        },
      },
      { status: 201 },
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
    console.error("CLUBOPS SIGNUP ERROR");
    console.error(error);
    console.error("=================================");

    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error ? error.message : "Unexpected signup error.",
      },
      { status: 500 },
    );
  }
}
