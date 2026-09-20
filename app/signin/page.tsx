"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signInWithGoogle } from "../lib/auth";
import { ThemeToggle } from "../components/ThemeToggle";
import UniversalLoader from "../components/UniversalLoader";

function EyeIcon({ open }: { open: boolean }) {
  if (open) {
    return (
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M2.5 12C2.5 12 6 5.5 12 5.5C18 5.5 21.5 12 21.5 12C21.5 12 18 18.5 12 18.5C6 18.5 2.5 12 2.5 12Z"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" />
      </svg>
    );
  }

  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M3 3L21 21"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M10.6 10.6C10.2 11 10 11.5 10 12C10 13.1 10.9 14 12 14C12.5 14 13 13.8 13.4 13.4"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M9.9 5.7C10.6 5.55 11.3 5.5 12 5.5C18 5.5 21.5 12 21.5 12C21.5 12 20.2 14.4 18 16.3"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M6.2 7.8C3.8 9.5 2.5 12 2.5 12C2.5 12 6 18.5 12 18.5C13.1 18.5 14.2 18.3 15.2 17.9"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function GoogleIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M21.6 12.23C21.6 11.51 21.54 10.99 21.42 10.45H12V13.67H17.82C17.7 14.47 17.1 15.68 15.9 16.49L15.88 16.6L18.46 18.6L18.64 18.62C20.35 17.05 21.6 14.76 21.6 12.23Z"
        fill="#4285F4"
      />
      <path
        d="M12 22C14.43 22 16.47 21.2 18.04 19.84L15.88 17.17C15.3 17.57 14.51 17.85 12 17.85C9.74 17.85 7.82 16.36 7.08 14.31L6.98 14.32L4.3 16.39L4.26 16.49C5.82 19.75 9.2 22 12 22Z"
        fill="#34A853"
      />
      <path
        d="M7.08 14.31C6.9 13.77 6.8 13.19 6.8 12.6C6.8 12.01 6.9 11.43 7.07 10.89L7.07 10.77L4.35 8.67L4.26 8.71C3.65 9.9 3.3 11.23 3.3 12.6C3.3 13.97 3.65 15.3 4.26 16.49L7.08 14.31Z"
        fill="#FBBC05"
      />
      <path
        d="M12 7.35C13.69 7.35 14.83 8.08 15.48 8.69L18.1 6.13C16.46 4.6 14.43 3.65 12 3.65C8.2 3.65 4.97 5.9 4.26 8.71L7.07 10.89C7.82 8.84 9.74 7.35 12 7.35Z"
        fill="#EA4335"
      />
    </svg>
  );
}

function Logo() {
  return (
    <Link href="/" className="flex items-center justify-center gap-2.5 group">
      <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-violet-600 text-white shadow-md shadow-indigo-500/20 group-hover:scale-105 transition-transform">
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"
            fill="currentColor"
          />
        </svg>
      </div>

      <span className="text-xl font-black tracking-tight text-slate-900 dark:text-white">
        ClubOps<span className="bg-gradient-to-r from-indigo-600 to-violet-600 dark:from-indigo-400 dark:to-violet-400 bg-clip-text text-transparent">.AI</span>
      </span>
    </Link>
  );
}

export default function SignInPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");

    try {
      setLoading(true);

      const response = await fetch("/api/signin", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          password,
        }),
      });

      const contentType = response.headers.get("content-type") || "";
      let data: any = null;
      if (contentType.includes("application/json")) {
        data = await response.json();
      } else {
        const text = await response.text();
        throw new Error(
          response.ok
            ? "Server returned an unexpected response format."
            : `Sign in failed (${response.status}): ${text.slice(0, 100)}`
        );
      }

      if (!response.ok) {
        throw new Error(data.message || "Unable to sign in.");
      }

      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to sign in.");
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleSignIn() {
    try {
      setError("");
      setGoogleLoading(true);

      const user = await signInWithGoogle();
      const idToken = await user.getIdToken();

      const res = await fetch("/api/auth/google", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
      });

      const contentType = res.headers.get("content-type") || "";
      let data: any = null;
      if (contentType.includes("application/json")) {
        data = await res.json();
      } else {
        const text = await res.text();
        throw new Error(
          res.ok
            ? "Server returned an unexpected response format."
            : `Google sign-in failed (${res.status}): ${text.slice(0, 100).trim() || "Server configuration error. Check Vercel environment variables and server logs."}`
        );
      }

      if (!res.ok) {
        throw new Error(data.message || "Google sign-in exchange failed.");
      }

      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Google sign-in failed.");
    } finally {
      setGoogleLoading(false);
    }
  }

  const isAuthenticating = loading || googleLoading;

  return (
    <>
      {isAuthenticating && (
        <UniversalLoader
          fullscreen
          blur
          badge={googleLoading ? "Google Authentication" : "Secure Authentication"}
          text={googleLoading ? "Connecting with Google..." : "Signing in..."}
          subtext={
            googleLoading
              ? "Authenticating your Google account and verifying secure access..."
              : "Verifying your credentials and preparing your dashboard..."
          }
        />
      )}

      <main
        className={`min-h-screen bg-[#F2ECE1] dark:bg-[#121810] px-4 py-6 sm:px-6 sm:py-12 transition-all duration-300 ${
          isAuthenticating ? "filter blur-md pointer-events-none select-none" : ""
        }`}
      >
      {/* Top Floating Controls */}
      <div className="mx-auto flex max-w-[620px] items-center justify-between mb-4">
        <Link
          href="/"
          className="text-xs font-semibold text-[#737E67] hover:text-[#1B2213] dark:text-[#8E9A82] dark:hover:text-[#F4F6F0] transition"
        >
          ← Back to Home
        </Link>
        <ThemeToggle />
      </div>

      <div className="mx-auto w-full max-w-[540px] rounded-3xl border border-[#E2DDD0] dark:border-[#283422] bg-white dark:bg-[#192015] p-5 sm:p-10 md:p-12 shadow-xl shadow-slate-200/40 dark:shadow-none backdrop-blur-md transition-colors duration-200">
        <div className="flex flex-col items-center">
          <Logo />

          <div className="mt-6 sm:mt-10 text-center">
            <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              Welcome back
            </h1>

            <p className="mt-1.5 text-xs sm:text-base text-slate-500 dark:text-slate-400">
              Sign in to manage your clubs and event tasks.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="mt-8 sm:mt-10 w-full space-y-5">
            <div>
              <label
                htmlFor="email"
                className="mb-1.5 block text-sm font-semibold text-slate-800 dark:text-slate-200"
              >
                Email Address
              </label>

              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@campus.edu"
                autoComplete="email"
                required
                className="h-13 w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/80 px-4 text-base text-slate-900 dark:text-white outline-none transition placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-indigo-600 dark:focus:border-indigo-400 focus:bg-white dark:focus:bg-slate-800"
              />
            </div>

            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label
                  htmlFor="password"
                  className="text-sm font-semibold text-slate-800 dark:text-slate-200"
                >
                  Password
                </label>

                <Link
                  href="/forgot-password"
                  className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
                >
                  Forgot password?
                </Link>
              </div>

              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  required
                  className="h-13 w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/80 px-4 pr-12 text-base text-slate-900 dark:text-white outline-none transition placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-indigo-600 dark:focus:border-indigo-400 focus:bg-white dark:focus:bg-slate-800"
                />

                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-slate-600 dark:hover:text-slate-300"
                >
                  <EyeIcon open={showPassword} />
                </button>
              </div>
            </div>

            {error && (
              <div className="rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/40 px-4 py-3 text-xs sm:text-sm font-medium text-red-600 dark:text-red-400">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || googleLoading}
              className="h-13 w-full rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 text-base font-bold text-white shadow-md shadow-indigo-500/25 transition hover:opacity-95 active:scale-98 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Signing in..." : "Sign In"}
            </button>
          </form>

          <div className="my-6 sm:my-8 flex w-full items-center gap-4">
            <div className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">OR</span>
            <div className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
          </div>

          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={loading || googleLoading}
            className="flex h-13 w-full items-center justify-center gap-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm sm:text-base font-semibold text-slate-800 dark:text-slate-100 shadow-2xs transition hover:bg-slate-50 dark:hover:bg-slate-750 active:scale-98 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <GoogleIcon />
            {googleLoading ? "Connecting..." : "Continue with Google"}
          </button>

          <p className="mt-8 text-center text-sm text-slate-500 dark:text-slate-400">
            Don&apos;t have an account?{" "}
            <Link
              href="/signup"
              className="font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
            >
              Sign up
            </Link>
          </p>
        </div>
      </div>

      <p className="mx-auto mt-6 max-w-[620px] px-4 text-center text-xs text-slate-400 dark:text-slate-500">
        By continuing, you agree to our{" "}
        <Link
          href="/terms"
          className="underline underline-offset-2 hover:text-slate-600 dark:hover:text-slate-400"
        >
          Terms of Service
        </Link>{" "}
        and{" "}
        <Link
          href="/privacy"
          className="underline underline-offset-2 hover:text-slate-600 dark:hover:text-slate-400"
        >
          Privacy Policy
        </Link>
        .
      </p>
    </main>
    </>
  );
}
