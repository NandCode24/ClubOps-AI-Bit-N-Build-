"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

function Logo() {
  return (
    <Link href="/dashboard" className="flex items-center gap-3">
      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-violet-500 text-white shadow-md shadow-indigo-500/20">
        <svg
          width="22"
          height="22"
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
      <div>
        <span className="text-[20px] font-bold tracking-tight text-slate-900">
          ClubOps <span className="bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent">AI</span>
        </span>
        <span className="block text-[11px] font-medium uppercase tracking-wider text-slate-400">
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

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "No club found with this code.");
      }

      setClub(data.club);
    } catch (err) {
      setLookupError(err instanceof Error ? err.message : "Lookup failed.");
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
      const res = await fetch("/api/clubs/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          club_id: club.id,
          message: message.trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Failed to submit request.");
      }

      setJoinSuccess(true);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-50 px-4 py-8 sm:px-6 sm:py-12">
      {/* Top Header */}
      <div className="mx-auto max-w-4xl mb-8 flex items-center justify-between">
        <Logo />
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900 transition"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          Back to Dashboard
        </Link>
      </div>

      <div className="mx-auto w-full max-w-xl rounded-3xl border border-slate-200/80 bg-white p-6 sm:p-10 shadow-[0_12px_40px_rgba(15,23,42,0.06)]">
        {joinSuccess ? (
          <div className="text-center py-6">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-emerald-50 border border-emerald-100 text-4xl shadow-inner mb-6">
              ✉️
            </div>
            <h2 className="text-3xl font-bold tracking-tight text-slate-900">
              Join Request Sent!
            </h2>
            <p className="mt-3 text-base text-slate-600">
              Your request has been forwarded to <strong className="text-slate-900">{club?.name}&apos;s</strong> leader (<span className="text-slate-800 font-medium">{club?.leader_name}</span>).
            </p>
            <div className="mt-6 rounded-2xl bg-slate-50 border border-slate-200/70 p-4 text-xs text-slate-500">
              Once the leader approves your request, they will assign you an official role (e.g. Technical, Logistics, PR, etc.) and you will gain full access to the club&apos;s events and tasks.
            </div>
            <div className="mt-8 flex justify-center">
              <button
                type="button"
                onClick={() => router.push("/dashboard")}
                className="rounded-xl bg-slate-900 px-6 py-3 text-sm font-semibold text-white hover:bg-slate-800 transition"
              >
                Return to Dashboard
              </button>
            </div>
          </div>
        ) : (
          <div>
            <div className="border-b border-slate-100 pb-6 mb-6">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">
                <span className="h-1.5 w-1.5 rounded-full bg-indigo-600" />
                Volunteer / Member Onboarding
              </span>
              <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
                Join a Club
              </h1>
              <p className="mt-2 text-base text-slate-500">
                Enter the unique Club Code provided by your Club Leader to request volunteer membership.
              </p>
            </div>

            {lookupError && (
              <div className="mb-6 rounded-2xl border border-red-200 bg-red-50/80 p-4 text-sm text-red-700 flex items-start gap-3">
                <span className="text-lg">⚠️</span>
                <span>{lookupError}</span>
              </div>
            )}

            {/* Club Code Input & Lookup Form */}
            <form onSubmit={handleLookup} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-900 mb-1.5">
                  Enter Club Code
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    required
                    placeholder="e.g. CLB-9K2P4X"
                    value={clubCode}
                    onChange={(e) => setClubCode(e.target.value.toUpperCase())}
                    className="flex-1 rounded-xl border border-slate-300 px-4 py-3 font-mono font-bold tracking-wider uppercase text-slate-900 placeholder:text-slate-400 placeholder:font-normal placeholder:tracking-normal focus:border-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 transition"
                  />
                  <button
                    type="submit"
                    disabled={lookingUp || !clubCode.trim()}
                    className="rounded-xl bg-indigo-600 px-6 py-3 text-sm font-bold text-white shadow-md shadow-indigo-500/20 hover:bg-indigo-500 transition active:scale-95 disabled:opacity-50"
                  >
                    {lookingUp ? "Searching..." : "Lookup Club"}
                  </button>
                </div>
                <span className="mt-1.5 block text-xs text-slate-400">
                  Ask your club lead or student president for their 6-digit Club ID.
                </span>
              </div>
            </form>

            {/* Found Club Preview & Join Submission Form */}
            {club && (
              <div className="mt-8 rounded-2xl border border-indigo-100 bg-indigo-50/30 p-6">
                <div className="flex items-start gap-4">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white border border-indigo-100 text-3xl shadow-sm">
                    {club.profile_image || "🏛️"}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-xl font-bold text-slate-900">
                        {club.name}
                      </h3>
                      <span className="rounded-md bg-indigo-100 px-2 py-0.5 font-mono text-[11px] font-semibold text-indigo-800">
                        {club.club_code}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      Lead: <strong className="text-slate-700">{club.leader_name}</strong> • {club.location || "Campus"} • {club.member_count} member{club.member_count === 1 ? "" : "s"}
                    </p>
                    {club.description && (
                      <p className="mt-2 text-sm text-slate-600 line-clamp-2">
                        {club.description}
                      </p>
                    )}
                  </div>
                </div>

                {/* Available Roles Defined by Leader */}
                {club.roles && club.roles.length > 0 && (
                  <div className="mt-4 border-t border-indigo-100/60 pt-3">
                    <span className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Available Club Roles:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {club.roles.map((r) => (
                        <span
                          key={r.id}
                          className="rounded-md border border-indigo-200 bg-white px-2 py-0.5 text-[11px] font-medium text-indigo-700 shadow-2xs"
                        >
                          {r.role_name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Status Check: If already a member or pending request */}
                {club.isMember ? (
                  <div className="mt-6 rounded-xl bg-emerald-50 border border-emerald-200 p-4 text-sm text-emerald-800 text-center">
                    ✓ You are already an active member of this club!
                    <div className="mt-2">
                      <Link
                        href={`/dashboard?club_id=${club.id}`}
                        className="inline-block font-bold text-emerald-900 underline underline-offset-2"
                      >
                        Open Club Dashboard →
                      </Link>
                    </div>
                  </div>
                ) : club.hasPendingRequest ? (
                  <div className="mt-6 rounded-xl bg-amber-50 border border-amber-200 p-4 text-sm text-amber-800 text-center">
                    ⏳ You already have a pending join request for this club. The club leader has been notified.
                    <div className="mt-2">
                      <Link
                        href="/dashboard"
                        className="inline-block font-bold text-amber-900 underline underline-offset-2"
                      >
                        Return to Dashboard →
                      </Link>
                    </div>
                  </div>
                ) : (
                  <form onSubmit={handleJoinRequest} className="mt-6 border-t border-indigo-100/60 pt-5">
                    {submitError && (
                      <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                        {submitError}
                      </div>
                    )}

                    <div className="mb-4">
                      <label className="block text-xs font-semibold text-slate-900 mb-1">
                        Intro Note for Club Leader (Optional)
                      </label>
                      <textarea
                        rows={2}
                        placeholder="Tell the leader about your skills or which role you are interested in..."
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={submitting}
                      className="w-full rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 py-3 text-sm font-bold text-white shadow-md shadow-indigo-500/20 hover:opacity-95 transition active:scale-[0.99] disabled:opacity-50"
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
    </main>
  );
}
