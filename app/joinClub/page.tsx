"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ThemeToggle } from "../components/ThemeToggle";
import MobileBottomNav from "../components/MobileBottomNav";
import UniversalLoader from "../components/UniversalLoader";

function Logo() {
  return (
    <Link href="/dashboard" className="flex items-center gap-2 sm:gap-3 min-w-0 group">
      <div className="flex h-8 w-8 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-xl sm:rounded-2xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-violet-500 text-white shadow-md shadow-indigo-500/20 group-hover:scale-105 transition-transform">
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="sm:w-5 sm:h-5"
        >
          <path
            d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"
            fill="currentColor"
          />
        </svg>
      </div>
      <div className="min-w-0">
        <span className="text-[15px] sm:text-[19px] font-bold tracking-tight text-slate-900 dark:text-white truncate block">
          ClubOps <span className="bg-gradient-to-r from-indigo-600 to-violet-600 dark:from-indigo-400 dark:to-violet-400 bg-clip-text text-transparent">AI</span>
        </span>
        <span className="hidden sm:block text-[9px] sm:text-[10px] font-medium uppercase tracking-wider text-slate-400 dark:text-slate-500 truncate">
          Event Operations
        </span>
      </div>
    </Link>
  );
}

interface ClubLookupResult {
  id: string;
  club_code: string;
  name: string;
  description: string | null;
  profile_image: string | null;
  leader_name: string;
  location: string | null;
  member_count: number;
  roles: Array<{ id: string; role_name: string }>;
  isMember: boolean;
  hasPendingRequest: boolean;
}

export default function JoinClubPage() {
  const router = useRouter();

  const [clubCode, setClubCode] = useState("");
  const [lookingUp, setLookingUp] = useState(false);
  const [club, setClub] = useState<ClubLookupResult | null>(null);
  const [lookupError, setLookupError] = useState("");

  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [joinSuccess, setJoinSuccess] = useState(false);
  const [submitError, setSubmitError] = useState("");

  async function handleLookup(e?: FormEvent) {
    if (e) e.preventDefault();
    setLookupError("");
    setSubmitError("");
    setClub(null);

    const cleanCode = clubCode.trim().toUpperCase();
    if (!cleanCode) {
      setLookupError("Please enter a club code.");
      return;
    }

    try {
      setLookingUp(true);
      const res = await fetch("/api/clubs/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: cleanCode }),
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
            : `Lookup failed (${res.status}): ${text.slice(0, 120)}`
        );
      }

      if (!res.ok || !data?.success) {
        throw new Error(data?.message || "Club not found. Check the code and try again.");
      }

      setClub(data.club);
    } catch (err) {
      setLookupError(err instanceof Error ? err.message : "Error looking up club.");
    } finally {
      setLookingUp(false);
    }
  }

  async function handleJoinRequest(e: FormEvent) {
    e.preventDefault();
    if (!club) return;

    setSubmitError("");

    try {
      setSubmitting(true);

      const res = await fetch(`/api/clubs/${club.id}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          club_id: club.id,
          message: message.trim(),
        }),
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
            : `Request failed (${res.status}): ${text.slice(0, 120)}`
        );
      }

      if (!res.ok || !data?.success) {
        throw new Error(data?.message || "Failed to send join request.");
      }

      setJoinSuccess(true);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Failed to send join request.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      {submitting && (
        <UniversalLoader
          fullscreen
          blur
          badge="ClubOps AI Volunteer"
          text="Submitting Join Request..."
          subtext={`Notifying ${club?.name ? club.name : "club"} leadership and registering your volunteer application...`}
        />
      )}

      <main
        className={`min-h-screen bg-[#F2ECE1] dark:bg-[#121810] px-4 pt-4 pb-24 sm:px-6 sm:py-12 transition-all duration-300 ${
          submitting ? "filter blur-sm pointer-events-none select-none" : ""
        }`}
      >
      {/* Top Header */}
      <div className="mx-auto max-w-4xl mb-6 sm:mb-8 flex items-center justify-between gap-3">
        <Logo />
        <div className="flex items-center gap-2 sm:gap-3">
          <ThemeToggle />
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:border-slate-300 dark:hover:border-slate-700 transition min-h-[38px]"
          >
            ← Dashboard
          </Link>
        </div>
      </div>

      <div className="mx-auto w-full max-w-xl rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-8 md:p-10 shadow-xl shadow-slate-200/30 dark:shadow-none transition-colors duration-200">
        {joinSuccess ? (
          <div className="text-center py-4 sm:py-6">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-100 dark:border-emerald-800 text-4xl shadow-inner mb-6">
              ✉️
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              Join Request Sent!
            </h2>
            <p className="mt-3 text-sm sm:text-base text-slate-600 dark:text-slate-400">
              Your request has been forwarded to <strong className="text-slate-900 dark:text-white">{club?.name}&apos;s</strong> leader (<span className="text-slate-800 dark:text-slate-200 font-medium">{club?.leader_name}</span>).
            </p>
            <div className="mt-6 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700 p-4 text-xs text-slate-500 dark:text-slate-400 text-left sm:text-center">
              Once the leader approves your request, they will assign you an official role (e.g. Technical, Logistics, PR, etc.) and you will gain full access to the club&apos;s events and tasks.
            </div>
            <div className="mt-8 flex justify-center">
              <button
                type="button"
                onClick={() => router.push("/dashboard")}
                className="w-full sm:w-auto rounded-xl bg-slate-900 dark:bg-white px-6 py-3.5 text-sm font-bold text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-100 transition active:scale-95 min-h-[48px]"
              >
                Return to Dashboard
              </button>
            </div>
          </div>
        ) : (
          <div>
            <div className="border-b border-slate-100 dark:border-slate-800 pb-5 sm:pb-6 mb-6">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200/60 dark:border-indigo-800/60 px-3 py-1 text-xs font-semibold text-indigo-700 dark:text-indigo-300">
                <span className="h-1.5 w-1.5 rounded-full bg-indigo-600" />
                Volunteer / Member Onboarding
              </span>
              <h1 className="mt-3 text-2xl sm:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                Join a Club
              </h1>
              <p className="mt-2 text-sm sm:text-base text-slate-500 dark:text-slate-400">
                Enter the unique Club Code provided by your Club Leader to request volunteer membership.
              </p>
            </div>

            {lookupError && (
              <div className="mb-6 rounded-2xl border border-red-200 dark:border-red-900/50 bg-red-50/80 dark:bg-red-950/40 p-4 text-sm text-red-700 dark:text-red-400 flex items-start gap-3">
                <span className="text-lg">⚠️</span>
                <span>{lookupError}</span>
              </div>
            )}

            {/* Club Code Input & Lookup Form */}
            <form onSubmit={handleLookup} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-900 dark:text-slate-200 mb-1.5">
                  Enter Club Code
                </label>
                <div className="flex flex-col sm:flex-row gap-2.5">
                  <input
                    type="text"
                    required
                    placeholder="e.g. CLB-9K2P4X"
                    value={clubCode}
                    onChange={(e) => setClubCode(e.target.value.toUpperCase())}
                    className="flex-1 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-3.5 font-mono font-bold tracking-wider uppercase text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none transition min-h-[48px] text-base"
                  />
                  <button
                    type="submit"
                    disabled={lookingUp || !clubCode.trim()}
                    className="w-full sm:w-auto rounded-xl bg-indigo-600 px-6 py-3.5 text-sm font-bold text-white shadow-md shadow-indigo-500/20 hover:bg-indigo-500 transition active:scale-95 disabled:opacity-50 min-h-[48px] flex items-center justify-center"
                  >
                    {lookingUp ? "Searching..." : "Lookup Club"}
                  </button>
                </div>
                <span className="mt-1.5 block text-xs text-slate-400 dark:text-slate-500">
                  Ask your club lead or student president for their 6-digit Club ID.
                </span>
              </div>
            </form>

            {/* Found Club Preview & Join Submission Form */}
            {club && (
              <div className="mt-6 sm:mt-8 rounded-2xl border border-indigo-100 dark:border-indigo-900/60 bg-indigo-50/40 dark:bg-indigo-950/30 p-4 sm:p-6">
                <div className="flex items-start gap-3.5 sm:gap-4">
                  <div className="flex h-12 w-12 sm:h-14 sm:w-14 shrink-0 items-center justify-center rounded-2xl bg-white dark:bg-slate-800 border border-indigo-100 dark:border-indigo-800 text-2xl sm:text-3xl shadow-sm">
                    {club.profile_image || "🏛️"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white truncate">
                        {club.name}
                      </h3>
                      <span className="rounded-md bg-indigo-100 dark:bg-indigo-900/60 px-2 py-0.5 font-mono text-[11px] font-semibold text-indigo-800 dark:text-indigo-300">
                        {club.club_code}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      Lead: <strong className="text-slate-700 dark:text-slate-300">{club.leader_name}</strong> • {club.location || "Campus"} • {club.member_count} member{club.member_count === 1 ? "" : "s"}
                    </p>
                    {club.description && (
                      <p className="mt-2 text-xs sm:text-sm text-slate-600 dark:text-slate-300 line-clamp-2">
                        {club.description}
                      </p>
                    )}
                  </div>
                </div>

                {/* Available Roles Defined by Leader */}
                {club.roles && club.roles.length > 0 && (
                  <div className="mt-4 border-t border-indigo-100/60 dark:border-indigo-900/60 pt-3">
                    <span className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                      Available Club Roles:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {club.roles.map((r) => (
                        <span
                          key={r.id}
                          className="rounded-md border border-indigo-200 dark:border-indigo-800 bg-white dark:bg-slate-800 px-2 py-0.5 text-[11px] font-medium text-indigo-700 dark:text-indigo-300 shadow-2xs"
                        >
                          {r.role_name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Status Check: If already a member or pending request */}
                {club.isMember ? (
                  <div className="mt-6 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 p-4 text-sm text-emerald-800 dark:text-emerald-300 text-center">
                    ✓ You are already an active member of this club!
                    <div className="mt-2">
                      <Link
                        href={`/dashboard?club_id=${club.id}`}
                        className="inline-block font-bold text-emerald-900 dark:text-emerald-200 underline underline-offset-2"
                      >
                        Open Club Dashboard →
                      </Link>
                    </div>
                  </div>
                ) : club.hasPendingRequest ? (
                  <div className="mt-6 rounded-xl bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 p-4 text-sm text-amber-800 dark:text-amber-300 text-center">
                    ⏳ You already have a pending join request for this club. The club leader has been notified.
                    <div className="mt-2">
                      <Link
                        href="/dashboard"
                        className="inline-block font-bold text-amber-900 dark:text-amber-200 underline underline-offset-2"
                      >
                        Return to Dashboard →
                      </Link>
                    </div>
                  </div>
                ) : (
                  <form onSubmit={handleJoinRequest} className="mt-6 border-t border-indigo-100/60 dark:border-indigo-900/60 pt-5">
                    {submitError && (
                      <div className="mb-4 rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/40 p-3 text-xs text-red-700 dark:text-red-400">
                        {submitError}
                      </div>
                    )}

                    <div className="mb-4">
                      <label className="block text-xs font-semibold text-slate-900 dark:text-slate-200 mb-1">
                        Intro Note for Club Leader (Optional)
                      </label>
                      <textarea
                        rows={3}
                        placeholder="Tell the leader about your skills or which role you are interested in..."
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-3 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none text-base"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={submitting}
                      className="w-full rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 py-3.5 text-base font-bold text-white shadow-md shadow-indigo-500/20 hover:opacity-95 transition active:scale-[0.99] disabled:opacity-50 min-h-[48px]"
                    >
                      {submitting ? "Sending Request..." : "Request to Join Club →"}
                    </button>
                  </form>
                )}
              </div>
            )}
          </div>
        )}
      </div>
      <MobileBottomNav />
    </main>
    </>
  );
}
