"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signInWithGoogle } from "../lib/auth";

function EyeIcon({ open }: { open: boolean }) {
  if (open) {
    return (
      <svg
        width="24"
        height="24"
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
      width="24"
      height="24"
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
      width="24"
      height="24"
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
    <div className="flex items-center justify-center gap-2">
      <div className="flex h-7 w-7 items-center justify-center rounded-[7px] bg-[#0F172A]">
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <rect
            x="5"
            y="3"
            width="14"
            height="18"
            rx="3"
            stroke="#2563EB"
            strokeWidth="2"
          />
          <path
            d="M9 3.5V6"
            stroke="#2563EB"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path
            d="M15 3.5V6"
            stroke="#2563EB"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path
            d="M9 13L11 15L15.5 10.5"
            stroke="#06B6D4"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>

      <span className="text-[20px] font-bold tracking-[-0.5px] text-[#0F172A]">
        ClubOps<span className="text-[#2563EB]">.AI</span>
      </span>
    </div>
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

      const data = await response.json();

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

      await signInWithGoogle();

      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Google sign-in failed.");
    } finally {
      setGoogleLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#F8FAFC] px-4 py-8 sm:px-6 sm:py-12">
      <div className="mx-auto w-full max-w-[650px] rounded-[28px] border border-[#E2E8F0] bg-white px-6 py-10 shadow-[0_8px_30px_rgba(15,23,42,0.04)] sm:px-12 sm:py-14 md:px-12">
        <div className="flex flex-col items-center">
          <Logo />

          <div className="mt-12 text-center">
            <h1 className="text-[42px] font-bold leading-[1.15] tracking-[-1.5px] text-[#0F172A] sm:text-[48px]">
              Welcome back
            </h1>

            <p className="mt-4 text-[19px] leading-7 text-[#64748B] sm:text-[21px]">
              Sign in to manage your events.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="mt-12 w-full space-y-7">
            <div>
              <label
                htmlFor="email"
                className="mb-2.5 block text-[17px] font-semibold text-[#0F172A]"
              >
                Email
              </label>

              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@campus.edu"
                autoComplete="email"
                required
                className="h-[70px] w-full rounded-[15px] border border-[#D9E1EC] bg-white px-6 text-[20px] text-[#0F172A] outline-none transition placeholder:text-[#64748B] focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/10"
              />
            </div>

            <div>
              <div className="mb-2.5 flex items-center justify-between">
                <label
                  htmlFor="password"
                  className="text-[17px] font-semibold text-[#0F172A]"
                >
                  Password
                </label>

                <Link
                  href="/forgot-password"
                  className="text-[17px] font-medium text-[#2563EB] hover:underline"
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
                  className="h-[70px] w-full rounded-[15px] border border-[#D9E1EC] bg-white px-6 pr-16 text-[20px] text-[#0F172A] outline-none transition placeholder:text-[#64748B] focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/10"
                />

                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute right-5 top-1/2 -translate-y-1/2 text-[#94A3B8] transition hover:text-[#64748B]"
                >
                  <EyeIcon open={showPassword} />
                </button>
              </div>
            </div>

            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || googleLoading}
              className="h-[64px] w-full rounded-[14px] bg-[#2563EB] text-[20px] font-semibold text-white transition hover:bg-[#1D4ED8] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Signing in..." : "Sign In"}
            </button>
          </form>

          <div className="my-8 flex w-full items-center gap-5">
            <div className="h-px flex-1 bg-[#D9E1EC]" />
            <span className="text-[18px] font-medium text-[#64748B]">OR</span>
            <div className="h-px flex-1 bg-[#D9E1EC]" />
          </div>

          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={loading || googleLoading}
            className="flex h-[64px] w-full items-center justify-center gap-4 rounded-[14px] border border-[#D9E1EC] bg-white text-[19px] font-medium text-[#0F172A] shadow-[0_2px_5px_rgba(15,23,42,0.04)] transition hover:bg-[#F8FAFC] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <GoogleIcon />
            {googleLoading ? "Connecting..." : "Continue with Google"}
          </button>

          <p className="mt-9 text-center text-[18px] text-[#64748B]">
            Don&apos;t have an account?{" "}
            <Link
              href="/signup"
              className="font-medium text-[#2563EB] hover:underline"
            >
              Sign up
            </Link>
          </p>
        </div>
      </div>

      <p className="mx-auto mt-7 max-w-[650px] px-4 text-center text-[16px] leading-6 text-[#94A3B8]">
        By continuing, you agree to our{" "}
        <Link
          href="/terms"
          className="underline underline-offset-2 hover:text-[#64748B]"
        >
          Terms of Service
        </Link>{" "}
        and{" "}
        <Link
          href="/privacy"
          className="underline underline-offset-2 hover:text-[#64748B]"
        >
          Privacy Policy
        </Link>
        .
      </p>
    </main>
  );
}
