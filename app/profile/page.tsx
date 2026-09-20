"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import ThemeToggle from "../components/ThemeToggle";
import MobileBottomNav from "../components/MobileBottomNav";
import UniversalLoader from "../components/UniversalLoader";

interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  username?: string | null;
  mobile_number?: string | null;
  college_name?: string | null;
  skills: string[];
  photo_url?: string | null;
  is_available?: boolean;
  unavailable_until?: string | null;
  unavailable_reason?: string | null;
  is_active?: boolean;
}

const POPULAR_SKILLS = [
  "Event Management",
  "Graphic Design",
  "Social Media",
  "Video Editing",
  "Photography",
  "Web Development",
  "Public Speaking",
  "Anchor / Host",
  "Logistics & Venue",
  "Sponsorship & PR",
  "Sound & AV Setup",
  "Content Writing",
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
          Profile &amp; Availability
        </span>
      </div>
    </Link>
  );
}

export default function ProfilePage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Editable Profile fields
  const [fullName, setFullName] = useState("");
  const [collegeName, setCollegeName] = useState("");
  const [mobileNumber, setMobileNumber] = useState("");

  // Skills ("Skillet")
  const [skills, setSkills] = useState<string[]>([]);
  const [customSkill, setCustomSkill] = useState("");

  // Availability State
  const [selectedDuration, setSelectedDuration] = useState<string>("24h");
  const [customUntilDate, setCustomUntilDate] = useState<string>("");
  const [awayReason, setAwayReason] = useState<string>("");

  async function loadProfile() {
    try {
      setLoading(true);
      const res = await fetch("/api/me");
      if (res.status === 401) {
        router.push("/signin?redirect=/profile");
        return;
      }
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || "Failed to load profile.");
      }

      setUser(data.user);
      setFullName(data.user.full_name || "");
      setCollegeName(data.user.college_name || "");
      setMobileNumber(data.user.mobile_number || "");
      setSkills(Array.isArray(data.user.skills) ? data.user.skills : []);
      setAwayReason(data.user.unavailable_reason || "");
    } catch (err) {
      setMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Error loading profile.",
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleAddSkill(skillToAdd: string) {
    const trimmed = skillToAdd.trim();
    if (!trimmed) return;
    if (skills.some((s) => s.toLowerCase() === trimmed.toLowerCase())) {
      return;
    }
    setSkills((prev) => [...prev, trimmed]);
    setCustomSkill("");
  }

  function handleRemoveSkill(skillToRemove: string) {
    setSkills((prev) => prev.filter((s) => s !== skillToRemove));
  }

  // Save General Profile & Skills
  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    try {
      setSaving(true);
      setMessage(null);

      const res = await fetch("/api/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: fullName.trim(),
          college_name: collegeName.trim(),
          mobile_number: mobileNumber.trim(),
          skills,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || "Failed to save profile.");
      }

      setUser(data.user);
      setMessage({ type: "success", text: "Profile details and skills updated successfully! ✓" });
    } catch (err) {
      setMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Failed to update profile.",
      });
    } finally {
      setSaving(false);
    }
  }

  // Set User As Away / Deactivate Temporarily
  async function handleSetAway() {
    try {
      setSaving(true);
      setMessage(null);

      const payload: Record<string, any> = {
        is_available: false,
        unavailable_reason: awayReason.trim() || "Temporarily on leave",
      };

      if (selectedDuration === "custom") {
        if (!customUntilDate) {
          setMessage({ type: "error", text: "Please choose a custom return date and time." });
          setSaving(false);
          return;
        }
        payload.unavailable_until = new Date(customUntilDate).toISOString();
      } else {
        payload.unavailable_duration = selectedDuration;
      }

      const res = await fetch("/api/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || "Failed to update availability.");
      }

      setUser(data.user);
      let successMsg = `You are now marked as Away until ${new Date(data.user.unavailable_until).toLocaleString()}. You will not receive new tasks.`;
      if (Array.isArray(data.reassigned_tasks) && data.reassigned_tasks.length > 0) {
        successMsg += ` ${data.reassigned_tasks.length} active task(s) were automatically reassigned to peers with matching skillsets.`;
      }
      setMessage({
        type: "success",
        text: successMsg,
      });
    } catch (err) {
      setMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Failed to update availability.",
      });
    } finally {
      setSaving(false);
    }
  }

  // Instant Reactivate / Set Available
  async function handleReactivateNow() {
    try {
      setSaving(true);
      setMessage(null);

      const res = await fetch("/api/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          is_available: true,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || "Failed to reactivate role.");
      }

      setUser(data.user);
      setMessage({
        type: "success",
        text: "You are now Active & Available for event tasks! ✓",
      });
    } catch (err) {
      setMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Failed to reactivate.",
      });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <UniversalLoader
        badge="ClubOps AI Profile"
        text="Loading your profile..."
        subtext="Fetching your personal details, verified skills, and club affiliations..."
      />
    );
  }

  const isUserAway = user?.is_active === false;

  return (
    <main className="min-h-screen bg-[#F6F4EE] dark:bg-[#121810] text-[#1B2213] dark:text-[#F4F6F0] transition-colors duration-200">
      {/* Top Navbar */}
      <header className="sticky top-0 z-30 border-b border-[#E2DDD0] dark:border-[#283422] bg-[#F6F4EE]/90 dark:bg-[#121810]/90 backdrop-blur-md px-3 sm:px-8 py-2.5 sm:py-3.5">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-2">
          <Logo />
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <ThemeToggle />
            <Link
              href="/dashboard"
              className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-1.5 sm:px-3.5 sm:py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
            >
              ← <span className="hidden sm:inline">Back to </span>Dashboard
            </Link>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-4xl px-3 sm:px-6 py-4 sm:py-8 pb-24 md:pb-8">
        {/* Breadcrumb */}
        <div className="mb-4 flex items-center gap-2 text-xs font-medium text-slate-400 dark:text-slate-500">
          <Link href="/dashboard" className="hover:text-slate-600 dark:hover:text-slate-300 transition">
            Dashboard
          </Link>
          <span>/</span>
          <span className="font-bold text-indigo-600 dark:text-indigo-400">Profile &amp; Availability</span>
        </div>

        {/* Page Header */}
        <div className="mb-6 sm:mb-8">
          <h1 className="text-xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            My Profile, Skills &amp; Availability
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            Manage your volunteer skills, contact details, and role availability duration.
          </p>
        </div>

        {/* Status Message */}
        {message && (
          <div
            className={`mb-6 rounded-2xl p-4 text-xs sm:text-sm font-semibold flex items-center justify-between ${
              message.type === "success"
                ? "border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300"
                : "border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/60 text-red-800 dark:text-red-300"
            }`}
          >
            <span>{message.text}</span>
            <button
              type="button"
              onClick={() => setMessage(null)}
              className="text-xs opacity-70 hover:opacity-100"
            >
              ✕
            </button>
          </div>
        )}

        <div className="space-y-6 sm:space-y-8">
          {/* 1. AVAILABILITY & ROLE DEACTIVATION SECTION */}
          <div className="rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-6 md:p-8 shadow-xs">
            <div className="flex items-center gap-3 border-b border-slate-100 dark:border-slate-800/80 pb-4 mb-6">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 font-bold text-lg">
                ⏱️
              </span>
              <div>
                <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                  Role Availability &amp; Leave Status
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Deactivate your volunteer status for a set duration (hours or days). Automatically reactivates when time expires.
                </p>
              </div>
            </div>

            {/* Current Status Box */}
            <div
              className={`rounded-2xl border p-4 sm:p-5 mb-6 ${
                isUserAway
                  ? "border-rose-200 dark:border-rose-900/70 bg-rose-50/50 dark:bg-rose-950/30"
                  : "border-emerald-200 dark:border-emerald-900/70 bg-emerald-50/40 dark:bg-emerald-950/30"
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-start gap-3.5">
                  <div className="text-2xl mt-0.5">{isUserAway ? "🔴" : "🟢"}</div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-extrabold text-base text-slate-900 dark:text-white">
                        {isUserAway ? "Currently Away / Deactivated" : "Active & Ready for Tasks"}
                      </h3>
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider ${
                          isUserAway
                            ? "bg-rose-100 dark:bg-rose-950/70 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-900"
                            : "bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900"
                        }`}
                      >
                        {isUserAway ? "Unavailable" : "Available"}
                      </span>
                    </div>

                    {isUserAway ? (
                      <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
                        Unavailable until:{" "}
                        <strong className="text-rose-700 dark:text-rose-300">
                          {user?.unavailable_until
                            ? new Date(user.unavailable_until).toLocaleString()
                            : "further notice"}
                        </strong>
                        {user?.unavailable_reason && (
                          <span className="block mt-0.5 text-slate-500 dark:text-slate-400 italic">
                            Reason: &ldquo;{user.unavailable_reason}&rdquo;
                          </span>
                        )}
                      </p>
                    ) : (
                      <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
                        You are listed as active. Club leaders can assign tasks to you based on your skills.
                      </p>
                    )}
                  </div>
                </div>

                {isUserAway && (
                  <button
                    type="button"
                    disabled={saving}
                    onClick={handleReactivateNow}
                    className="self-start sm:self-center min-h-[44px] flex items-center justify-center rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-emerald-500 active:scale-95 transition disabled:opacity-50 shrink-0"
                  >
                    ✓ Reactivate Immediately
                  </button>
                )}
              </div>
            </div>

            {/* Set Away Options (if currently active) */}
            {!isUserAway ? (
              <div className="space-y-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  Set Yourself as Away / Deactivate for a Duration
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Preparing for exams or taking time off? Select how long you will be unavailable. Club leaders will see your away status and cannot assign you new tasks.
                </p>

                {/* Duration Presets */}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 pt-1">
                  {[
                    { id: "4h", label: "4 Hours", desc: "Short break" },
                    { id: "8h", label: "8 Hours", desc: "Study block" },
                    { id: "24h", label: "1 Day", desc: "24 hours" },
                    { id: "3d", label: "3 Days", desc: "Mid-term" },
                    { id: "7d", label: "7 Days", desc: "1 week" },
                    { id: "custom", label: "Custom", desc: "Pick date" },
                  ].map((dur) => (
                    <button
                      key={dur.id}
                      type="button"
                      onClick={() => setSelectedDuration(dur.id)}
                      className={`rounded-xl border p-2.5 text-center transition ${
                        selectedDuration === dur.id
                          ? "border-indigo-600 dark:border-indigo-500 bg-indigo-50/60 dark:bg-indigo-950/60 font-bold text-indigo-900 dark:text-indigo-200 ring-2 ring-indigo-500/20"
                          : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/60 hover:border-slate-300 dark:hover:border-slate-700 text-slate-700 dark:text-slate-300"
                      }`}
                    >
                      <div className="text-xs font-bold">{dur.label}</div>
                      <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">{dur.desc}</div>
                    </button>
                  ))}
                </div>

                {/* Custom Date Picker (if custom selected) */}
                {selectedDuration === "custom" && (
                  <div className="rounded-xl border border-indigo-200 dark:border-indigo-900 bg-indigo-50/30 dark:bg-indigo-950/30 p-3.5">
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Return Date &amp; Time *
                    </label>
                    <input
                      type="datetime-local"
                      value={customUntilDate}
                      onChange={(e) => setCustomUntilDate(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-medium text-slate-800 dark:text-slate-200 focus:border-indigo-500 focus:outline-none"
                    />
                  </div>
                )}

                {/* Optional Reason */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Reason for leave / break (Optional)
                  </label>
                  <input
                    type="text"
                    value={awayReason}
                    onChange={(e) => setAwayReason(e.target.value)}
                    placeholder="e.g., End semester exams, Lab submissions, Sick leave"
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 py-2 text-xs text-slate-800 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-800 focus:outline-none transition"
                  />
                </div>

                <div className="pt-2">
                  <button
                    type="button"
                    disabled={saving}
                    onClick={handleSetAway}
                    className="w-full sm:w-auto min-h-[44px] flex items-center justify-center rounded-xl bg-slate-900 dark:bg-slate-100 px-5 py-2.5 text-xs font-bold text-white dark:text-slate-900 shadow-xs hover:bg-slate-800 dark:hover:bg-white active:scale-95 transition disabled:opacity-50"
                  >
                    {saving ? "Saving..." : "Set as Away / Deactivate Temporarily"}
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-xs text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-100 dark:border-slate-800/80">
                💡 Need to modify your return date? You can reactivate anytime above and set a new duration.
              </div>
            )}
          </div>

          {/* 2. SKILLS MANAGEMENT ("SKILLET") */}
          <div className="rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-6 md:p-8 shadow-xs space-y-5 sm:space-y-6">
            <div className="flex items-center gap-3 border-b border-slate-100 dark:border-slate-800/80 pb-4">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 font-bold text-lg">
                🎯
              </span>
              <div>
                <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                  Skills Management (&ldquo;Skillet&rdquo;)
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Highlight your superpowers. The AI uses your skillet to recommend task matches in club events.
                </p>
              </div>
            </div>

            {/* Current Active Skills */}
            <div>
              <span className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-2">
                My Skills ({skills.length})
              </span>

              {skills.length === 0 ? (
                <p className="text-xs italic text-slate-400 dark:text-slate-500 py-2">
                  No skills added yet. Pick from the suggestions below or type your own!
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {skills.map((skill) => (
                    <span
                      key={skill}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/70 border border-indigo-200/70 dark:border-indigo-800 px-3 py-1.5 text-xs font-bold text-indigo-800 dark:text-indigo-300 shadow-2xs"
                    >
                      {skill}
                      <button
                        type="button"
                        onClick={() => handleRemoveSkill(skill)}
                        className="hover:text-red-600 dark:hover:text-red-400 font-bold ml-0.5 text-indigo-400"
                        title="Remove skill"
                      >
                        ✕
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Custom Skill Input */}
            <div className="flex flex-col sm:flex-row gap-2 max-w-md">
              <input
                type="text"
                value={customSkill}
                onChange={(e) => setCustomSkill(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddSkill(customSkill);
                  }
                }}
                placeholder="Type a skill (e.g. Figma, Canva, DJing)..."
                className="flex-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 py-2.5 text-xs text-slate-800 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-800 focus:outline-none transition min-h-[44px]"
              />
              <button
                type="button"
                onClick={() => handleAddSkill(customSkill)}
                className="w-full sm:w-auto rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-indigo-500 transition min-h-[44px] flex items-center justify-center shrink-0"
              >
                + Add Skill
              </button>
            </div>

            {/* Quick Suggestions */}
            <div>
              <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2">
                Quick Recommendations for College Clubs:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {POPULAR_SKILLS.filter((s) => !skills.includes(s)).map((rec) => (
                  <button
                    key={rec}
                    type="button"
                    onClick={() => handleAddSkill(rec)}
                    className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 px-2.5 py-1 text-xs font-medium text-slate-700 dark:text-slate-300 hover:border-indigo-300 dark:hover:border-indigo-700 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/40 hover:text-indigo-700 dark:hover:text-indigo-300 transition"
                  >
                    + {rec}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 3. PROFILE DETAILS */}
          <form onSubmit={handleSaveProfile} className="rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-6 md:p-8 shadow-xs space-y-5 sm:space-y-6">
            <div className="flex items-center gap-3 border-b border-slate-100 dark:border-slate-800/80 pb-4">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 font-bold text-lg">
                👤
              </span>
              <div>
                <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">Personal Details</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">Your campus identification and contact info</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 py-2 text-xs font-medium text-slate-800 dark:text-slate-200 focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-800 focus:outline-none transition"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Email Address (Verified)
                </label>
                <input
                  type="email"
                  disabled
                  value={user?.email || ""}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100/70 dark:bg-slate-800/40 px-3.5 py-2 text-xs font-medium text-slate-500 dark:text-slate-400 cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  College / University
                </label>
                <input
                  type="text"
                  value={collegeName}
                  onChange={(e) => setCollegeName(e.target.value)}
                  placeholder="e.g. Stanford University / Tech Institute"
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 py-2 text-xs font-medium text-slate-800 dark:text-slate-200 focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-800 focus:outline-none transition"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Mobile Number
                </label>
                <input
                  type="tel"
                  value={mobileNumber}
                  onChange={(e) => setMobileNumber(e.target.value)}
                  placeholder="+91 98765 43210"
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 py-2 text-xs font-medium text-slate-800 dark:text-slate-200 focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-800 focus:outline-none transition"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800/80">
              <button
                type="submit"
                disabled={saving}
                className="w-full sm:w-auto rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-6 py-3 text-sm font-bold text-white shadow-xs hover:from-indigo-500 hover:to-violet-500 active:scale-95 transition disabled:opacity-50 min-h-[48px]"
              >
                {saving ? "Saving Changes..." : "Save Profile Details"}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Persistent Mobile Bottom Navigation Bar */}
      <MobileBottomNav />
    </main>
  );
}