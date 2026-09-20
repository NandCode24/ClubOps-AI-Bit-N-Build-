"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import ThemeToggle from "@/app/components/ThemeToggle";
import MobileBottomNav from "@/app/components/MobileBottomNav";
import UniversalLoader from "@/app/components/UniversalLoader";

interface Member {
  membership_id: string;
  user_id: string;
  role_type: string;
  assigned_role: string | null;
  full_name: string;
  email: string;
  photo_url: string | null;
  skills: string[];
  is_available?: boolean;
  unavailable_until?: string | null;
  unavailable_reason?: string | null;
  is_active?: boolean;
}

interface ClubDetails {
  id: string;
  club_code: string;
  name: string;
  leader_id: string;
  leader_name: string;
  is_leader: boolean;
  members: Member[];
}

interface InitialTaskItem {
  id: string;
  name: string;
  description: string;
  assigned_to: string;
  deadline: string;
}

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

export default function CreateEventPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const router = useRouter();
  const { code: rawCode } = use(params);
  const clubCode = rawCode?.toUpperCase();

  const [loadingClub, setLoadingClub] = useState(true);
  const [club, setClub] = useState<ClubDetails | null>(null);
  const [error, setError] = useState("");

  // Form State
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [mode, setMode] = useState<"offline" | "online" | "hybrid">("offline");
  const [venue, setVenue] = useState("");
  const [meetingLink, setMeetingLink] = useState("");
  const [meetingCode, setMeetingCode] = useState("");

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Selected participating members (user IDs)
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);

  // Initial Tasks
  const [tasks, setTasks] = useState<InitialTaskItem[]>([]);

  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  // Load club metadata & check leadership
  useEffect(() => {
    async function fetchClub() {
      try {
        setLoadingClub(true);
        setError("");
        const res = await fetch(`/api/clubs/by-code/${clubCode}`);
        if (res.status === 401) {
          router.push(`/signin?redirect=/club/${clubCode}/create-event`);
          return;
        }
        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.message || "Failed to load club.");
        }
        setClub(data.club);

        // By default, select all club members to participate
        if (Array.isArray(data.club.members)) {
          setSelectedMembers(data.club.members.map((m: Member) => m.user_id));
        }

        // Set sensible default dates: tomorrow 10:00 AM to 12:00 PM
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(10, 0, 0, 0);
        const tomorrowEnd = new Date(tomorrow);
        tomorrowEnd.setHours(13, 0, 0, 0);

        const formatForInput = (d: Date) => {
          const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
          return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
        };

        setStartDate(formatForInput(tomorrow));
        setEndDate(formatForInput(tomorrowEnd));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error loading club.");
      } finally {
        setLoadingClub(false);
      }
    }

    if (clubCode) {
      fetchClub();
    }
  }, [clubCode, router]);

  function toggleMember(userId: string) {
    setSelectedMembers((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  }

  function selectAllMembers() {
    if (!club?.members) return;
    setSelectedMembers(club.members.map((m) => m.user_id));
  }

  function deselectAllMembers() {
    setSelectedMembers([]);
  }

  function addTask() {
    setTasks((prev) => [
      ...prev,
      {
        id: Math.random().toString(36).substring(2, 9),
        name: "",
        description: "",
        assigned_to: "",
        deadline: endDate || startDate || "",
      },
    ]);
  }

  function updateTask(id: string, field: keyof InitialTaskItem, val: string) {
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, [field]: val } : t))
    );
  }

  function removeTask(id: string) {
    setTasks((prev) => prev.filter((t) => t.id !== id));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");

    if (!club) return;

    if (!club.is_leader) {
      setFormError("Authorization violation: Only the club leader can create events.");
      return;
    }

    if (!name.trim()) {
      setFormError("Please enter an event name.");
      return;
    }

    if (!startDate || !endDate) {
      setFormError("Please provide both starting and ending date & time.");
      return;
    }

    if (new Date(endDate) <= new Date(startDate)) {
      setFormError("Ending date & time must be after starting date & time.");
      return;
    }

    if (mode === "offline" && !venue.trim()) {
      setFormError("Please enter a venue or room location for offline events.");
      return;
    }

    if (mode === "online" && !meetingLink.trim()) {
      setFormError("Please enter a virtual meeting link (Google Meet / Zoom) for online events.");
      return;
    }

    // Workload check: ensure 1 volunteer is not assigned to multiple tasks in the form
    const assignedIds = new Set<string>();
    for (const t of tasks) {
      if (t.assigned_to) {
        if (assignedIds.has(t.assigned_to)) {
          const assignedUser = club.members.find((m) => m.user_id === t.assigned_to);
          setFormError(
            `Workload rule violation: ${assignedUser?.full_name || "Volunteer"} cannot be assigned to multiple tasks. A volunteer can hold only 1 active task at a time.`
          );
          return;
        }
        assignedIds.add(t.assigned_to);
      }
    }

    try {
      setSubmitting(true);

      const res = await fetch(`/api/clubs/${club.id}/events-list`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim(),
          mode,
          venue: mode !== "online" ? venue.trim() : null,
          meeting_link: mode !== "offline" ? meetingLink.trim() : null,
          meeting_code: mode !== "offline" ? meetingCode.trim() : null,
          start_time: new Date(startDate).toISOString(),
          end_time: new Date(endDate).toISOString(),
          selected_members: selectedMembers,
          initial_tasks: tasks.filter((t) => t.name.trim().length > 0).map((t) => ({
            name: t.name.trim(),
            description: t.description.trim(),
            assigned_to: t.assigned_to || null,
            deadline: t.deadline ? new Date(t.deadline).toISOString() : null,
          })),
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.message || "Failed to create event.");
      }

      // Success! Redirect to the newly created event space
      router.push(`/club/${clubCode}/event/${data.event_id}`);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to create event.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loadingClub) {
    return (
      <UniversalLoader
        badge="Event Creator"
        text="Loading club details..."
        subtext="Preparing volunteer roles, templates, and setup checklist..."
      />
    );
  }

  if (error || !club) {
    return (
      <main className="min-h-screen bg-slate-50 dark:bg-slate-950 px-4 sm:px-6 py-12">
        <div className="mx-auto max-w-lg rounded-3xl border border-red-200 dark:border-red-900/60 bg-white dark:bg-slate-900 p-6 sm:p-8 text-center shadow-lg">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 dark:bg-red-950/50 text-2xl mb-4">
            ⚠️
          </div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Club Error</h2>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{error || "Unable to load club details."}</p>
          <div className="mt-6 flex justify-center gap-3">
            <Link
              href="/dashboard"
              className="inline-block rounded-xl bg-slate-900 dark:bg-slate-100 px-5 py-2.5 text-sm font-semibold text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-white transition"
            >
              Back to Dashboard
            </Link>
          </div>
        </div>
      </main>
    );
  }

  // Strictly enforce leader permission on UI side as well
  if (!club.is_leader) {
    return (
      <main className="min-h-screen bg-slate-50 dark:bg-slate-950 px-4 sm:px-6 py-12">
        <div className="mx-auto max-w-lg rounded-3xl border border-amber-200 dark:border-amber-900/60 bg-white dark:bg-slate-900 p-6 sm:p-8 text-center shadow-lg">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-50 dark:bg-amber-950/50 text-3xl mb-4">
            🔒
          </div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white">Leader Access Required</h2>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            Only the official Club Leader (<strong className="text-slate-800 dark:text-slate-100">{club.leader_name}</strong>) is authorized to create events and assign tasks.
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <Link
              href={`/club/${clubCode}`}
              className="inline-block rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 transition shadow-sm"
            >
              ← Back to {club.name}
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#F6F4EE] dark:bg-[#121810] text-[#1B2213] dark:text-[#F4F6F0] transition-colors duration-200">
      {/* Top Navbar */}
      <header className="sticky top-0 z-30 border-b border-[#E2DDD0] dark:border-[#283422] bg-[#F6F4EE]/90 dark:bg-[#121810]/90 backdrop-blur-md px-3 sm:px-8 py-2.5 sm:py-3.5">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-2">
          <Logo />
          <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
            <ThemeToggle />
            <Link
              href="/profile"
              className="hidden sm:inline-flex items-center rounded-xl border border-indigo-200/70 dark:border-indigo-800/80 bg-indigo-50/70 dark:bg-indigo-950/50 px-3 sm:px-3.5 py-2 text-xs font-bold text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition"
            >
              👤 <span className="hidden sm:inline">Profile &amp; Availability</span>
            </Link>
            <Link
              href={`/club/${clubCode}`}
              className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 sm:px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
            >
              ← <span className="hidden sm:inline">Back to </span>Club
            </Link>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-4xl px-3 sm:px-6 py-4 sm:py-8 pb-28 md:pb-8">
        {/* Breadcrumb */}
        <div className="mb-4 flex flex-wrap items-center gap-2 text-xs font-medium text-slate-400 dark:text-slate-500">
          <Link href="/dashboard" className="hover:text-slate-600 dark:hover:text-slate-300 transition">
            Dashboard
          </Link>
          <span>/</span>
          <Link href={`/club/${clubCode}`} className="hover:text-slate-600 dark:hover:text-slate-300 transition truncate max-w-[150px] sm:max-w-none">
            {club.name} ({clubCode})
          </Link>
          <span>/</span>
          <span className="font-bold text-indigo-600 dark:text-indigo-400">Create Event</span>
        </div>

        {/* Page Header */}
        <div className="mb-6 sm:mb-8">
          <div className="inline-flex items-center gap-2 rounded-full bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200/60 dark:border-indigo-800/60 px-3 py-1 text-xs font-bold text-indigo-700 dark:text-indigo-300 mb-2">
            👑 Club Leader Operations
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            Create New Event & Assign Tasks
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            Set up the event schedule, select participating members from <strong className="text-slate-700 dark:text-slate-200">{club.name}</strong>, and assign initial tasks with deadlines.
          </p>
        </div>

        {formError && (
          <div className="mb-6 rounded-2xl border border-red-200 dark:border-red-900/70 bg-red-50 dark:bg-red-950/50 p-4 text-xs sm:text-sm font-semibold text-red-800 dark:text-red-300 flex items-center justify-between">
            <span>⚠️ {formError}</span>
            <button
              type="button"
              onClick={() => setFormError("")}
              className="text-xs text-red-600 dark:text-red-400 hover:underline"
            >
              Dismiss
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5 sm:space-y-8">
          {/* 1. Basic Event Details */}
          <div className="rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-6 md:p-8 shadow-xs space-y-5 sm:space-y-6">
            <div className="flex items-center gap-3 border-b border-slate-100 dark:border-slate-800/80 pb-4">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 font-bold text-sm">
                1
              </span>
              <div>
                <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">Event Overview</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">Basic identification and objectives of the event</p>
              </div>
            </div>

            <div>
              <label htmlFor="event-name" className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">
                Event Name *
              </label>
              <input
                id="event-name"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Annual Hackathon 2026 / Campus Orientation & Tech Expo"
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/60 px-4 py-3 text-sm font-semibold text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-800 focus:outline-none transition"
              />
            </div>

            <div>
              <label htmlFor="event-desc" className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">
                Description & Agenda
              </label>
              <textarea
                id="event-desc"
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe the goals, key milestones, audience, or briefing instructions..."
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/60 px-4 py-2.5 text-sm text-slate-800 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-800 focus:outline-none transition"
              />
            </div>
          </div>

          {/* 2. Mode and Location / Meeting Section */}
          <div className="rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-6 md:p-8 shadow-xs space-y-5 sm:space-y-6">
            <div className="flex items-center gap-3 border-b border-slate-100 dark:border-slate-800/80 pb-4">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 font-bold text-sm">
                2
              </span>
              <div>
                <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">Event Mode & Location</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">Choose between offline campus venue, online virtual room, or hybrid</p>
              </div>
            </div>

            {/* Mode selection buttons */}
            <div>
              <span className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-2">
                Event Mode *
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3">
                {[
                  { key: "offline", label: "Offline", icon: "🏛️", desc: "Physical on-campus venue" },
                  { key: "online", label: "Online", icon: "🌐", desc: "Virtual Google Meet or Zoom" },
                  { key: "hybrid", label: "Hybrid", icon: "⚡", desc: "Dual physical & virtual access" },
                ].map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setMode(item.key as "offline" | "online" | "hybrid")}
                    className={`rounded-2xl border p-3.5 sm:p-4 text-left transition ${
                      mode === item.key
                        ? "border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/40 shadow-xs ring-2 ring-indigo-500/20"
                        : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/60 hover:border-slate-300 dark:hover:border-slate-700"
                    }`}
                  >
                    <div className="text-2xl mb-1">{item.icon}</div>
                    <div className="font-bold text-slate-900 dark:text-white text-sm">{item.label}</div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{item.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Venue (for offline / hybrid) */}
            {mode !== "online" && (
              <div>
                <label htmlFor="event-venue" className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">
                  Venue / Location *
                </label>
                <input
                  id="event-venue"
                  type="text"
                  required
                  value={venue}
                  onChange={(e) => setVenue(e.target.value)}
                  placeholder="e.g., Auditorium B, Tech Block 3rd Floor"
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/60 px-4 py-2.5 text-sm text-slate-800 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-800 focus:outline-none transition"
                />
              </div>
            )}

            {/* Meeting Link & Code (for online / hybrid) */}
            {mode !== "offline" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 rounded-2xl bg-indigo-50/40 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/60 p-4">
                <div>
                  <label htmlFor="event-meeting-link" className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                    Virtual Meeting Link *
                  </label>
                  <input
                    id="event-meeting-link"
                    type="url"
                    required
                    value={meetingLink}
                    onChange={(e) => setMeetingLink(e.target.value)}
                    placeholder="https://meet.google.com/xyz-abc-def"
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 text-sm text-slate-800 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none transition"
                  />
                  <span className="text-[11px] text-slate-400 dark:text-slate-500 mt-1 block">Volunteers will see a direct Join button</span>
                </div>

                <div>
                  <label htmlFor="event-meeting-code" className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                    Meeting Passcode / Room Code (Optional)
                  </label>
                  <input
                    id="event-meeting-code"
                    type="text"
                    value={meetingCode}
                    onChange={(e) => setMeetingCode(e.target.value)}
                    placeholder="e.g., 849-204 or Passcode"
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 text-sm text-slate-800 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none transition"
                  />
                </div>
              </div>
            )}
          </div>

          {/* 3. Date and Time Schedule */}
          <div className="rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-6 md:p-8 shadow-xs space-y-5 sm:space-y-6">
            <div className="flex items-center gap-3 border-b border-slate-100 dark:border-slate-800/80 pb-4">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 font-bold text-sm">
                3
              </span>
              <div>
                <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">Event Timings & Schedule</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">Specify exact starting and ending date & time</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="start-date" className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">
                  Starting Date & Time *
                </label>
                <input
                  id="start-date"
                  type="datetime-local"
                  required
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/60 px-4 py-2.5 text-sm font-semibold text-slate-800 dark:text-slate-200 focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-800 focus:outline-none transition"
                />
              </div>

              <div>
                <label htmlFor="end-date" className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">
                  Ending Date & Time *
                </label>
                <input
                  id="end-date"
                  type="datetime-local"
                  required
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/60 px-4 py-2.5 text-sm font-semibold text-slate-800 dark:text-slate-200 focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-800 focus:outline-none transition"
                />
              </div>
            </div>
          </div>

          {/* 4. Select Club Members */}
          <div className="rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-6 md:p-8 shadow-xs space-y-5 sm:space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800/80 pb-4">
              <div className="flex items-center gap-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 font-bold text-sm">
                  4
                </span>
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                    Select Participating Members ({selectedMembers.length}/{club.members?.length || 0})
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Choose which club members will participate in this event and be available for task assignments.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={selectAllMembers}
                  className="rounded-lg bg-indigo-50 dark:bg-indigo-950/60 px-2.5 py-1 text-xs font-bold text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 transition"
                >
                  Select All
                </button>
                <button
                  type="button"
                  onClick={deselectAllMembers}
                  className="rounded-lg bg-slate-100 dark:bg-slate-800 px-2.5 py-1 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition"
                >
                  Clear All
                </button>
              </div>
            </div>

            {!club.members || club.members.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400 italic py-4 text-center">
                No members found in this club yet. You will be added as the leader.
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-80 overflow-y-auto pr-1">
                {club.members.map((member) => {
                  const isSelected = selectedMembers.includes(member.user_id);
                  return (
                    <div
                      key={member.user_id}
                      onClick={() => toggleMember(member.user_id)}
                      className={`cursor-pointer rounded-2xl border p-3.5 transition flex items-center justify-between gap-3 ${
                        isSelected
                          ? "border-indigo-600 dark:border-indigo-500 bg-indigo-50/40 dark:bg-indigo-950/40 shadow-2xs"
                          : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700 opacity-75"
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-500 to-violet-500 text-white font-bold text-sm">
                          {member.full_name?.charAt(0) || "M"}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-900 dark:text-white text-sm truncate">
                              {member.full_name}
                            </span>
                            {member.user_id === club.leader_id && (
                              <span className="shrink-0 rounded bg-indigo-100 dark:bg-indigo-950 text-indigo-800 dark:text-indigo-300 px-1.5 py-0.2 text-[10px] font-bold">
                                Leader
                              </span>
                            )}
                            {member.is_active === false && (
                              <span className="shrink-0 rounded bg-rose-100 dark:bg-rose-950/70 text-rose-700 dark:text-rose-300 text-[10px] font-bold px-1.5 py-0.2">
                                🔴 Away
                              </span>
                            )}
                          </div>
                          <span className="text-xs text-slate-500 dark:text-slate-400 truncate block">
                            {member.assigned_role || member.role_type} • {member.email}
                          </span>
                          {member.skills && member.skills.length > 0 && (
                            <div className="mt-1 flex flex-wrap gap-1">
                              {member.skills.slice(0, 3).map((s, idx) => (
                                <span
                                  key={idx}
                                  className="rounded bg-slate-100 dark:bg-slate-800 px-1.5 py-0.2 text-[9px] font-medium text-slate-600 dark:text-slate-400"
                                >
                                  {s}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      <div
                        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border text-xs font-bold ${
                          isSelected
                            ? "border-indigo-600 bg-indigo-600 text-white"
                            : "border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-transparent"
                        }`}
                      >
                        {isSelected && "✓"}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* 5. Assign Initial Tasks & Deadlines */}
          <div className="rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-6 md:p-8 shadow-xs space-y-5 sm:space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800/80 pb-4">
              <div className="flex items-center gap-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 font-bold text-sm">
                  5
                </span>
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                    Assign Event Tasks & Set Deadlines ({tasks.length})
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Assign duties to selected members. Enforces: <strong>1 volunteer can hold only 1 active task</strong>.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={addTask}
                className="self-start sm:self-auto rounded-xl bg-indigo-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-indigo-500 active:scale-95 transition"
              >
                + Add Task
              </button>
            </div>

            {tasks.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 py-6 text-center">
                <p className="text-sm text-slate-500 dark:text-slate-400">No tasks added yet.</p>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                  You can assign tasks now or later in the Event Workspace.
                </p>
                <button
                  type="button"
                  onClick={addTask}
                  className="mt-3 inline-block rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition"
                >
                  + Create First Task
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {tasks.map((task, index) => {
                  const selectedMemberObj = club.members.find((m) => m.user_id === task.assigned_to);

                  return (
                    <div
                      key={task.id}
                      className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 p-4 relative space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-extrabold uppercase tracking-wider text-indigo-700 dark:text-indigo-400">
                          Task #{index + 1}
                        </span>
                        <button
                          type="button"
                          onClick={() => removeTask(task.id)}
                          className="text-xs font-bold text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                        >
                          ✕ Remove
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                            Task Title *
                          </label>
                          <input
                            type="text"
                            required
                            value={task.name}
                            onChange={(e) => updateTask(task.id, "name", e.target.value)}
                            placeholder="e.g. Venue setup, Banner design, Guest coordination"
                            className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-800 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none transition"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                            Assign To Member
                          </label>
                          <select
                            value={task.assigned_to}
                            onChange={(e) => updateTask(task.id, "assigned_to", e.target.value)}
                            className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-bold text-slate-800 dark:text-slate-200 focus:border-indigo-500 focus:outline-none transition"
                          >
                            <option value="">-- Unassigned (Open for pickup) --</option>
                            {club.members
                              .filter((m) => selectedMembers.includes(m.user_id))
                              .map((m) => (
                                <option key={m.user_id} value={m.user_id} disabled={m.is_active === false}>
                                  {m.full_name} ({m.assigned_role || m.role_type}) {m.is_active === false ? "🔴 [Away / Deactivated]" : "🟢 [Available]"}
                                </option>
                              ))}
                          </select>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                            Description / Instructions
                          </label>
                          <input
                            type="text"
                            value={task.description}
                            onChange={(e) => updateTask(task.id, "description", e.target.value)}
                            placeholder="What does the volunteer need to accomplish?"
                            className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs text-slate-800 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none transition"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                            Task Deadline *
                          </label>
                          <input
                            type="datetime-local"
                            value={task.deadline}
                            onChange={(e) => updateTask(task.id, "deadline", e.target.value)}
                            className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-800 dark:text-slate-200 focus:border-indigo-500 focus:outline-none transition"
                          />
                        </div>
                      </div>

                      {selectedMemberObj && selectedMemberObj.skills && selectedMemberObj.skills.length > 0 && (
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 flex flex-wrap items-center gap-1.5 pt-1">
                          <span className="font-semibold text-indigo-700 dark:text-indigo-400">Assignee Skills:</span>
                          {selectedMemberObj.skills.map((s, i) => (
                            <span key={i} className="rounded bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200/50 dark:border-indigo-800/50 px-1.5 py-0.2 text-[10px] text-indigo-700 dark:text-indigo-300">
                              {s}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Submit Action */}
          <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-4">
            <Link
              href={`/club/${clubCode}`}
              className="w-full sm:w-auto text-center rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-5 py-3 text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
            >
              Cancel
            </Link>

            <button
              type="submit"
              disabled={submitting}
              className="w-full sm:w-auto rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-violet-600 px-7 py-3 text-sm font-bold text-white shadow-md shadow-indigo-500/20 hover:from-indigo-500 hover:to-violet-500 active:scale-98 transition disabled:opacity-50"
            >
              {submitting ? "Creating Event..." : "🚀 Launch Event & Workspace"}
            </button>
          </div>
        </form>
      </div>

      {/* Persistent Mobile Bottom Navigation Bar */}
      <MobileBottomNav clubCode={clubCode} />
    </main>
  );
}
