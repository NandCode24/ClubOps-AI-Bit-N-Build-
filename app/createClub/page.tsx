"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

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

      const data = await res.json();

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

      <div className="mx-auto w-full max-w-2xl rounded-3xl border border-slate-200/80 bg-white p-6 sm:p-10 shadow-[0_12px_40px_rgba(15,23,42,0.06)]">
        {/* Success Modal / Banner when Club is Created */}
        {createdClub ? (
          <div className="text-center py-6">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-indigo-50 border border-indigo-100 text-4xl shadow-inner mb-6">
              🎉
            </div>
            <h2 className="text-3xl font-bold tracking-tight text-slate-900">
              Club Created Successfully!
            </h2>
            <p className="mt-2 text-base text-slate-600">
              <span className="font-semibold text-slate-900">{createdClub.name}</span> is live. Share this unique Club ID with students and volunteers to invite them to join.
            </p>

            {/* Club Code Card */}
            <div className="mt-8 rounded-2xl border-2 border-dashed border-indigo-300 bg-indigo-50/50 p-6">
              <p className="text-xs font-semibold uppercase tracking-wider text-indigo-700">
                Official Club Code
              </p>
              <div className="mt-2 flex items-center justify-center gap-3">
                <span className="font-mono text-3xl sm:text-4xl font-black tracking-widest text-indigo-950">
                  {createdClub.club_code}
                </span>
                <button
                  type="button"
                  onClick={copyCode}
                  className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-indigo-600 shadow-sm border border-indigo-200 hover:bg-indigo-50 transition active:scale-95"
                >
                  {copied ? "Copied! ✓" : "Copy Code"}
                </button>
              </div>
              <p className="mt-2 text-xs text-slate-500">
                Volunteers enter this code at <strong>/joinClub</strong> to send you a join request.
              </p>
            </div>

            <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
              <button
                type="button"
                onClick={() => router.push(`/club/${createdClub.club_code}`)}
                className="rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-6 py-3.5 text-base font-semibold text-white shadow-lg shadow-indigo-500/25 hover:from-indigo-500 hover:to-violet-500 transition"
              >
                Open Club Workspace (/club/{createdClub.club_code}) →
              </button>
            </div>
          </div>
        ) : (
          <div>
            <div className="border-b border-slate-100 pb-6 mb-8">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">
                <span className="h-1.5 w-1.5 rounded-full bg-indigo-600" />
                Step 1: Club Setup
              </span>
              <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
                Create a College Club
              </h1>
              <p className="mt-2 text-base text-slate-500">
                Launch your club&apos;s workspace on ClubOps AI. You will become the Club Leader and can manage events, volunteers, and custom roles.
              </p>
            </div>

            {error && (
              <div className="mb-6 rounded-2xl border border-red-200 bg-red-50/80 p-4 text-sm text-red-700 flex items-start gap-3">
                <span className="text-lg">⚠️</span>
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Club Avatar / Icon */}
              <div>
                <label className="block text-sm font-semibold text-slate-900 mb-2">
                  Club Icon / Emoji
                </label>
                <div className="flex flex-wrap gap-2">
                  {PRESET_AVATARS.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => setSelectedAvatar(emoji)}
                      className={`h-11 w-11 rounded-xl text-xl flex items-center justify-center transition ${
                        selectedAvatar === emoji
                          ? "bg-indigo-600 text-white shadow-md ring-2 ring-indigo-600 ring-offset-2"
                          : "bg-slate-100 hover:bg-slate-200 text-slate-700"
                      }`}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>

              {/* Club Name */}
              <div>
                <label className="block text-sm font-semibold text-slate-900 mb-1.5">
                  Club Name <span className="text-indigo-600">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. ACM Student Chapter, Google Developer Group, Drama Club"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 transition"
                />
              </div>

              {/* Leader Name (Auto-filled) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-900 mb-1.5">
                    Leader Name
                  </label>
                  <input
                    type="text"
                    required
                    value={leaderName}
                    onChange={(e) => setLeaderName(e.target.value)}
                    disabled={fetchingUser}
                    className="w-full rounded-xl border border-slate-300 bg-slate-50/70 px-4 py-3 text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 transition"
                  />
                  <span className="mt-1 block text-xs text-slate-400">
                    Auto-filled from your profile
                  </span>
                </div>

                {/* Campus / Location */}
                <div>
                  <label className="block text-sm font-semibold text-slate-900 mb-1.5">
                    Location / Campus
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Main Auditorium / North Campus"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 transition"
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-semibold text-slate-900 mb-1.5">
                  Description / Mission
                </label>
                <textarea
                  rows={3}
                  placeholder="What is this club about? What events do you organize?"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 transition"
                />
              </div>

              {/* Roles Available Within Club */}
              <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-5">
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-semibold text-slate-900">
                    Club Roles (Assign to Volunteers)
                  </label>
                  <span className="text-xs text-slate-500">
                    {roles.length} role{roles.length === 1 ? "" : "s"} defined
                  </span>
                </div>
                <p className="text-xs text-slate-500 mb-4">
                  Define roles volunteers can take up. When a member requests to join with your Club Code, you can assign them one of these roles upon acceptance.
                </p>

                {/* Current Roles Chips */}
                <div className="flex flex-wrap gap-2 mb-4">
                  {roles.map((role) => (
                    <span
                      key={role}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50/80 px-3 py-1.5 text-xs font-semibold text-indigo-800"
                    >
                      {role}
                      <button
                        type="button"
                        onClick={() => handleRemoveRole(role)}
                        className="text-indigo-400 hover:text-indigo-700 ml-1 transition"
                        title="Remove role"
                      >
                        ✕
                      </button>
                    </span>
                  ))}
                </div>

                {/* Add Custom Role Input */}
                <div className="flex gap-2 mb-3">
                  <input
                    type="text"
                    placeholder="Add a new custom role..."
                    value={newRoleInput}
                    onChange={(e) => setNewRoleInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddRole();
                      }
                    }}
                    className="flex-1 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => handleAddRole()}
                    className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 transition"
                  >
                    + Add Role
                  </button>
                </div>

                {/* Quick Presets */}
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] text-slate-400 font-medium mr-1">Suggestions:</span>
                  {PRESET_ROLES.filter((p) => !roles.includes(p)).map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => handleAddRole(preset)}
                      className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-600 hover:border-indigo-300 hover:text-indigo-600 transition"
                    >
                      + {preset}
                    </button>
                  ))}
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-2xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-violet-600 py-4 text-base font-bold text-white shadow-lg shadow-indigo-500/25 hover:opacity-95 transition active:scale-[0.99] disabled:opacity-50"
              >
                {loading ? "Creating Club & Generating Code..." : "Create Club & Generate Code →"}
              </button>
            </form>
          </div>
        )}
      </div>
    </main>
  );
}
