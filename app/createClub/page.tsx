"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import ThemeToggle from "../components/ThemeToggle";
import MobileBottomNav from "../components/MobileBottomNav";
import UniversalLoader from "../components/UniversalLoader";

const PRESET_ROLES = [
  "Technical Lead",
  "Event Coordinator",
  "Marketing & PR",
  "Design & Media",
  "Logistics & Operations",
  "Volunteer",
];

const PRESET_AVATARS = [
  "🚀", "⚡", "🤖", "🎨", "🔬", "💻", "🎵", "🏆", "🌟", "🌍"
];

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

export default function CreateClubPage() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [leaderName, setLeaderName] = useState("");
  const [selectedAvatar, setSelectedAvatar] = useState("🚀");
  const [roles, setRoles] = useState<string[]>([
    "Technical Lead",
    "Event Coordinator",
    "Marketing & PR",
    "Logistics & Operations",
    "Volunteer",
  ]);
  const [newRoleInput, setNewRoleInput] = useState("");

  const [loading, setLoading] = useState(false);
  const [fetchingUser, setFetchingUser] = useState(true);
  const [error, setError] = useState("");
  const [createdClub, setCreatedClub] = useState<{
    id: string;
    club_code: string;
    name: string;
  } | null>(null);

  const [copied, setCopied] = useState(false);

  // Fetch current user details to prefill leader name
  useEffect(() => {
    async function loadUser() {
      try {
        const res = await fetch("/api/me");
        if (res.status === 401) {
          router.push("/signin");
          return;
        }
        const data = await res.json();
        if (data.success && data.user) {
          setLeaderName(data.user.full_name || "");
        }
      } catch (err) {
        console.error("Failed to load user:", err);
      } finally {
        setFetchingUser(false);
      }
    }
    loadUser();
  }, [router]);

  function handleAddRole(roleToAdd?: string) {
    const role = (roleToAdd || newRoleInput).trim();
    if (!role) return;
    if (!roles.includes(role)) {
      setRoles([...roles, role]);
    }
    if (!roleToAdd) {
      setNewRoleInput("");
    }
  }

  function handleRemoveRole(roleToRemove: string) {
    if (roles.length <= 1) {
      setError("Club must have at least one role defined.");
      return;
    }
    setRoles(roles.filter((r) => r !== roleToRemove));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");

    if (!name.trim()) {
      setError("Please provide a club name.");
      return;
    }

    try {
      setLoading(true);

      const res = await fetch("/api/clubs/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim(),
          location: location.trim(),
          leader_name: leaderName.trim(),
          profile_image: selectedAvatar,
          roles,
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
            : `Create club failed (${res.status}): ${text.slice(0, 100)}`
        );
      }

      if (!res.ok) {
        throw new Error(data.message || "Failed to create club.");
      }

      setCreatedClub(data.club);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  function copyCode() {
    if (!createdClub) return;
    navigator.clipboard.writeText(createdClub.club_code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <>
      {loading && (
        <UniversalLoader
          fullscreen
          blur
          badge="Club Generation"
          text="Generating Club Workspace..."
          subtext="Setting up your official club code, role templates, and member spaces..."
        />
      )}

      <main
        className={`min-h-screen bg-[#F8FAFC] dark:bg-[#090D16] px-3 py-4 sm:px-6 sm:py-12 pb-24 md:pb-8 transition-all duration-300 ${
          loading ? "filter blur-sm pointer-events-none select-none" : ""
        }`}
      >
      {/* Top Header */}
      <div className="mx-auto max-w-4xl mb-6 sm:mb-8 flex items-center justify-between gap-3">
        <Logo />
        <div className="flex items-center gap-2 sm:gap-3">
          <ThemeToggle />
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:border-slate-300 dark:hover:border-slate-700 transition"
          >
            ← Dashboard
          </Link>
        </div>
      </div>

      <div className="mx-auto w-full max-w-2xl rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-8 md:p-10 shadow-xl shadow-slate-200/30 dark:shadow-none transition-colors duration-200">
        {/* Success Modal / Banner when Club is Created */}
        {createdClub ? (
          <div className="text-center py-6">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-100 dark:border-indigo-800 text-4xl shadow-inner mb-6">
              🎉
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              Club Created Successfully!
            </h2>
            <p className="mt-2 text-sm sm:text-base text-slate-600 dark:text-slate-400">
              <span className="font-semibold text-slate-900 dark:text-white">{createdClub.name}</span> is live. Share this unique Club ID with students and volunteers to invite them to join.
            </p>

            {/* Club Code Card */}
            <div className="mt-6 sm:mt-8 rounded-2xl border-2 border-dashed border-indigo-300 dark:border-indigo-800 bg-indigo-50/50 dark:bg-indigo-950/40 p-5 sm:p-6">
              <p className="text-xs font-semibold uppercase tracking-wider text-indigo-700 dark:text-indigo-400">
                Official Club Code
              </p>
              <div className="mt-2 flex items-center justify-center gap-3">
                <span className="font-mono text-3xl sm:text-4xl font-black tracking-widest text-indigo-950 dark:text-indigo-200">
                  {createdClub.club_code}
                </span>
                <button
                  type="button"
                  onClick={copyCode}
                  className="rounded-xl bg-white dark:bg-slate-800 px-3.5 py-2 text-xs sm:text-sm font-semibold text-indigo-600 dark:text-indigo-400 shadow-xs border border-indigo-200 dark:border-indigo-700 hover:bg-indigo-50 dark:hover:bg-slate-700 transition active:scale-95"
                >
                  {copied ? "Copied! ✓" : "Copy Code"}
                </button>
              </div>
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                Volunteers enter this code at <strong>/joinClub</strong> to send you a join request.
              </p>
            </div>

            <div className="mt-6 sm:mt-8 flex flex-col sm:flex-row gap-3 justify-center">
              <button
                type="button"
                onClick={() => router.push(`/club/${createdClub.club_code}`)}
                className="w-full sm:w-auto rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-6 py-3.5 text-sm sm:text-base font-semibold text-white shadow-lg shadow-indigo-500/25 hover:from-indigo-500 hover:to-violet-500 transition active:scale-98"
              >
                Open Club Workspace (/club/{createdClub.club_code}) →
              </button>
            </div>
          </div>
        ) : (
          <div>
            <div className="border-b border-slate-100 dark:border-slate-800 pb-5 sm:pb-6 mb-6 sm:mb-8">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200/60 dark:border-indigo-800/60 px-3 py-1 text-xs font-semibold text-indigo-700 dark:text-indigo-300">
                <span className="h-1.5 w-1.5 rounded-full bg-indigo-600" />
                Step 1: Club Setup
              </span>
              <h1 className="mt-3 text-2xl sm:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                Create a College Club
              </h1>
              <p className="mt-2 text-sm sm:text-base text-slate-500 dark:text-slate-400">
                Launch your club&apos;s workspace on ClubOps AI. You will become the Club Leader and can manage events, volunteers, and custom roles.
              </p>
            </div>

            {error && (
              <div className="mb-6 rounded-2xl border border-red-200 dark:border-red-900/50 bg-red-50/80 dark:bg-red-950/40 p-4 text-sm text-red-700 dark:text-red-400 flex items-start gap-3">
                <span className="text-lg">⚠️</span>
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5 sm:space-y-6">
              {/* Club Avatar / Icon */}
              <div>
                <label className="block text-sm font-semibold text-slate-900 dark:text-slate-200 mb-2">
                  Club Icon / Emoji
                </label>
                <div className="grid grid-cols-5 sm:grid-cols-10 gap-2">
                  {PRESET_AVATARS.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => setSelectedAvatar(emoji)}
                      className={`h-10 sm:h-11 rounded-xl text-xl flex items-center justify-center transition active:scale-95 ${
                        selectedAvatar === emoji
                          ? "bg-indigo-600 text-white shadow-md ring-2 ring-indigo-600 ring-offset-2 dark:ring-offset-slate-900"
                          : "bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300"
                      }`}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>

              {/* Club Name */}
              <div>
                <label className="block text-sm font-semibold text-slate-900 dark:text-slate-200 mb-1.5">
                  Club Name <span className="text-indigo-600 dark:text-indigo-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. ACM Student Chapter, Google Developer Group, Drama Club"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-3 text-sm sm:text-base text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none transition"
                />
              </div>

              {/* Leader Name (Auto-filled) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-900 dark:text-slate-200 mb-1.5">
                    Leader Name
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Alex Rivera"
                    value={leaderName}
                    onChange={(e) => setLeaderName(e.target.value)}
                    disabled={fetchingUser}
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-3 text-sm sm:text-base text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none transition"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-900 dark:text-slate-200 mb-1.5">
                    Campus / Location (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Main Campus, Building B"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-3 text-sm sm:text-base text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none transition"
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-semibold text-slate-900 dark:text-slate-200 mb-1.5">
                  Club Description (Optional)
                </label>
                <textarea
                  rows={3}
                  placeholder="What is your club's mission, goals, or activities?"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-3 text-sm sm:text-base text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none transition"
                />
              </div>

              {/* Defined Roles for Volunteers */}
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 p-4 sm:p-5">
                <div className="mb-3">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Club Volunteer Roles
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Define the roles you will assign when volunteers submit requests to join.
                  </p>
                </div>

                {/* Role tags list */}
                <div className="flex flex-wrap gap-2 mb-4">
                  {roles.map((role) => (
                    <span
                      key={role}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950/60 px-3 py-1 text-xs font-semibold text-indigo-700 dark:text-indigo-300"
                    >
                      {role}
                      <button
                        type="button"
                        onClick={() => handleRemoveRole(role)}
                        className="text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-200 font-bold"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>

                {/* Add Custom Role Input */}
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Add custom role (e.g. Media Head)"
                    value={newRoleInput}
                    onChange={(e) => setNewRoleInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddRole();
                      }
                    }}
                    className="flex-1 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 text-xs sm:text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none transition"
                  />
                  <button
                    type="button"
                    onClick={() => handleAddRole()}
                    className="rounded-xl bg-slate-800 dark:bg-slate-700 hover:bg-slate-700 dark:hover:bg-slate-600 px-4 py-2 text-xs font-bold text-white transition active:scale-95"
                  >
                    Add
                  </button>
                </div>

                {/* Quick Add Presets */}
                <div className="mt-3 flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] text-slate-400 dark:text-slate-500">Quick add:</span>
                  {PRESET_ROLES.filter((r) => !roles.includes(r)).map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => handleAddRole(preset)}
                      className="rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-0.5 text-[11px] font-medium text-slate-600 dark:text-slate-300 hover:border-indigo-300 hover:text-indigo-600 transition"
                    >
                      + {preset}
                    </button>
                  ))}
                </div>
              </div>

              {/* Submit Button */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 py-4 text-base font-bold text-white shadow-lg shadow-indigo-500/25 hover:from-indigo-500 hover:to-violet-500 transition active:scale-98 disabled:opacity-60"
                >
                  {loading ? "Generating Club Workspace..." : "Create Club & Generate Code →"}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
      <MobileBottomNav />
    </main>
    </>
  );
}
