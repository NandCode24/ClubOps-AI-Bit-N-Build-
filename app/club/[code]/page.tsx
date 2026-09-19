"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import ThemeToggle from "@/app/components/ThemeToggle";
import MobileBottomNav from "@/app/components/MobileBottomNav";

interface Member {
  membership_id: string;
  user_id: string;
  role_type: "leader" | "volunteer" | "member";
  assigned_role: string | null;
  joined_at: string;
  full_name: string;
  email: string;
  photo_url: string | null;
  skills: string[];
}

interface ClubRole {
  id: string;
  role_name: string;
  description: string | null;
}

interface JoinRequestItem {
  request_id: string;
  club_id: string;
  user_id: string;
  status: string;
  message: string | null;
  created_at: string;
  full_name: string;
  email: string;
  skills: string[];
  photo_url: string | null;
}

interface ClubDetails {
  id: string;
  club_code: string;
  name: string;
  description: string | null;
  profile_image: string | null;
  leader_id: string;
  leader_name: string;
  location: string | null;
  created_at: string;
  is_leader: boolean;
  is_member: boolean;
  user_role: string | null;
  member_count: number;
  members: Member[];
  roles: ClubRole[];
  pendingRequests: JoinRequestItem[];
}

interface ClubEventSummary {
  id: string;
  club_id: string;
  name: string;
  description: string | null;
  venue: string | null;
  mode: "offline" | "online" | "hybrid";
  start_time: string;
  end_time: string;
  meeting_link: string | null;
  meeting_code: string | null;
  creator_name: string | null;
  participant_count: number;
  total_tasks: number;
  completed_tasks: number;
  my_active_tasks: number;
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
          Dynamic Club Workspace
        </span>
      </div>
    </Link>
  );
}

export default function ClubDynamicPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const router = useRouter();
  const { code: rawCode } = use(params);
  const clubCode = rawCode?.toUpperCase();

  const [loading, setLoading] = useState(true);
  const [club, setClub] = useState<ClubDetails | null>(null);
  const [error, setError] = useState("");

  const [copied, setCopied] = useState(false);
  const [roleAssignments, setRoleAssignments] = useState<Record<string, string>>({});
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [newRequestPopup, setNewRequestPopup] = useState<{
    name: string;
    email: string;
    message: string | null;
  } | null>(null);

  const [events, setEvents] = useState<ClubEventSummary[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);

  function playNotificationChime() {
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.1); // A5
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.45);
    } catch {
      // Audio context blocked
    }
  }

  async function loadClub() {
    try {
      setLoading(true);
      setError("");

      const res = await fetch(`/api/clubs/by-code/${clubCode}`);

      if (res.status === 401) {
        router.push(`/signin?redirect=/club/${clubCode}`);
        return;
      }

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.message || "Failed to load club.");
      }

      setClub(data.club);

      // Initialize role dropdown default selections
      if (data.club?.pendingRequests && data.club?.roles) {
        const defaultRole = data.club.roles[0]?.role_name || "Volunteer";
        const initialMap: Record<string, string> = {};
        for (const req of data.club.pendingRequests) {
          initialMap[req.request_id] = defaultRole;
        }
        setRoleAssignments(initialMap);
      }

      if (data.club?.id) {
        loadEvents(data.club.id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Club not found.");
    } finally {
      setLoading(false);
    }
  }

  async function loadEvents(clubId: string) {
    try {
      setEventsLoading(true);
      const res = await fetch(`/api/clubs/${clubId}/events-list`);
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.events)) {
          setEvents(data.events);
        }
      }
    } catch (err) {
      console.error("Error loading club events:", err);
    } finally {
      setEventsLoading(false);
    }
  }

  useEffect(() => {
    loadClub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clubCode]);

  // Real-time SSE listener for this club
  useEffect(() => {
    if (!club?.id) return;

    let eventSource: EventSource | null = null;
    try {
      eventSource = new EventSource(`/api/clubs/${club.id}/events`);

      if (club.is_leader) {
        eventSource.addEventListener("new_join_request", (event) => {
          const newReq = JSON.parse(event.data);

          setClub((prev) => {
            if (!prev) return prev;
            const currentList = prev.pendingRequests || [];
            if (currentList.some((r) => r.request_id === newReq.request_id)) {
              return prev;
            }
            return {
              ...prev,
              pendingRequests: [newReq, ...currentList],
            };
          });

          // Pre-select default role
          setRoleAssignments((prev) => ({
            ...prev,
            [newReq.request_id]: club.roles?.[0]?.role_name || "Volunteer",
          }));

          playNotificationChime();
          setNewRequestPopup({
            name: newReq.full_name,
            email: newReq.email,
            message: newReq.message,
          });
        });
      }

      eventSource.addEventListener("task_updated", () => {
        loadEvents(club.id);
      });

      eventSource.addEventListener("club_event_updated", () => {
        loadEvents(club.id);
      });
    } catch (err) {
      console.error("SSE stream error:", err);
    }

    // Auto-polling backup every 4s
    const pollInterval = setInterval(async () => {
      try {
        if (club.is_leader) {
          const res = await fetch(`/api/clubs/${club.id}/requests`);
          if (res.ok) {
            const data = await res.json();
            if (data.success && Array.isArray(data.requests)) {
              setClub((prev) => {
                if (!prev) return prev;
                return {
                  ...prev,
                  pendingRequests: data.requests,
                };
              });
            }
          }
        }
        loadEvents(club.id);
      } catch {
        // silent sync
      }
    }, 4000);

    return () => {
      if (eventSource) eventSource.close();
      clearInterval(pollInterval);
    };
  }, [club?.id, club?.is_leader, club?.roles]);

  function copyCode() {
    if (!club) return;
    navigator.clipboard.writeText(club.club_code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleRequestAction(requestId: string, action: "accept" | "reject") {
    if (!club) return;

    try {
      setActionLoading(requestId);
      setActionMessage(null);

      const assignedRole = roleAssignments[requestId] || club.roles?.[0]?.role_name || "Volunteer";

      const res = await fetch(`/api/clubs/${club.id}/requests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          request_id: requestId,
          action,
          assigned_role: assignedRole,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Action failed.");
      }

      setActionMessage({
        type: "success",
        text: action === "accept" ? `Volunteer accepted as "${assignedRole}"!` : "Request declined.",
      });

      // Reload club state
      await loadClub();
    } catch (err) {
      setActionMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Failed to process request.",
      });
    } finally {
      setActionLoading(null);
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
          <p className="text-sm font-medium text-slate-500">Loading dynamic club workspace...</p>
        </div>
      </main>
    );
  }

  if (error || !club) {
    return (
      <main className="min-h-screen bg-slate-50 px-6 py-12">
        <div className="mx-auto max-w-lg rounded-3xl border border-red-200 bg-white p-8 text-center shadow-lg">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-red-50 text-2xl mb-4">
            ⚠️
          </div>
          <h2 className="text-2xl font-bold text-slate-900">Club Not Found</h2>
          <p className="mt-2 text-sm text-slate-500">
            {error || `No club matches code "${clubCode}".`}
          </p>
          <div className="mt-6">
            <Link
              href="/dashboard"
              className="inline-block rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 transition"
            >
              Back to Dashboard
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#F8FAFC] dark:bg-[#090D16] transition-colors duration-200">
      {/* Top Navbar */}
      <header className="sticky top-0 z-30 border-b border-slate-200/80 dark:border-slate-800 bg-white/95 dark:bg-[#090D16]/95 backdrop-blur-md px-3 sm:px-8 py-2.5 sm:py-3 transition-colors duration-200">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-2">
          <Logo />

          <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
            <ThemeToggle />

            <Link
              href="/profile"
              className="hidden sm:inline-flex items-center rounded-xl border border-indigo-200/70 dark:border-indigo-800/70 bg-indigo-50/70 dark:bg-indigo-950/60 px-3 py-1.5 text-xs font-bold text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 transition"
            >
              👤 Profile
            </Link>

            <Link
              href="/dashboard"
              className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
            >
              ← <span className="hidden sm:inline">My </span>Dashboard
            </Link>
          </div>
        </div>
      </header>

      {/* Main Dynamic View */}
      <div className="mx-auto max-w-7xl px-3 sm:px-8 py-4 sm:py-8 pb-28 md:pb-8">
        {/* Real-time Floating Popup Notification */}
        {newRequestPopup && (
          <div className="fixed top-16 sm:top-20 left-3 right-3 sm:left-auto sm:right-6 z-50 sm:max-w-sm rounded-2xl border-2 border-indigo-400 dark:border-indigo-500 bg-white dark:bg-slate-900 p-4 shadow-2xl ring-4 ring-indigo-500/20 transition-all">
            <div className="flex items-start gap-3">
              <span className="text-2xl animate-bounce shrink-0">🔔</span>
              <div className="flex-1 min-w-0">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 rounded-md">
                  Live Volunteer Request!
                </span>
                <h4 className="font-extrabold text-slate-900 dark:text-white text-sm mt-1 truncate">
                  {newRequestPopup.name} wants to join!
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{newRequestPopup.email}</p>
                {newRequestPopup.message && (
                  <p className="text-xs text-slate-600 dark:text-slate-300 italic mt-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 p-1.5 rounded-md">
                    &ldquo;{newRequestPopup.message}&rdquo;
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setNewRequestPopup(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 font-bold text-xs"
              >
                ✕
              </button>
            </div>
          </div>
        )}
        {/* Dynamic Route Breadcrumb */}
        <div className="mb-4 flex flex-wrap items-center gap-2 text-xs font-medium text-slate-400 dark:text-slate-500">
          <Link href="/dashboard" className="hover:text-slate-600 dark:hover:text-slate-300 transition">
            Dashboard
          </Link>
          <span>/</span>
          <span>Clubs</span>
          <span>/</span>
          <span className="font-bold text-indigo-600 dark:text-indigo-400">{club.club_code}</span>
        </div>

        {/* Action Message Banner */}
        {actionMessage && (
          <div
            className={`mb-6 rounded-2xl p-4 text-sm font-medium flex items-center justify-between ${
              actionMessage.type === "success"
                ? "bg-emerald-50 border border-emerald-200 text-emerald-800"
                : "bg-red-50 border border-red-200 text-red-800"
            }`}
          >
            <span>{actionMessage.text}</span>
            <button
              type="button"
              onClick={() => setActionMessage(null)}
              className="text-xs opacity-70 hover:opacity-100"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Hero Card */}
        <div className="rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-8 shadow-[0_8px_30px_rgba(15,23,42,0.03)] dark:shadow-none mb-6 sm:mb-8 transition-colors duration-200">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-5 sm:gap-6">
            <div className="flex items-start gap-3 sm:gap-4 min-w-0">
              <div className="flex h-12 w-12 sm:h-16 sm:w-16 shrink-0 items-center justify-center rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-100 dark:border-indigo-800 text-2xl sm:text-3xl shadow-sm">
                {club.profile_image || "🏛️"}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white break-words">
                    {club.name}
                  </h1>
                  <span className="rounded-full bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                    {club.location || "Campus"}
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                      club.is_leader
                        ? "bg-indigo-100 dark:bg-indigo-950/70 text-indigo-800 dark:text-indigo-300"
                        : "bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300"
                    }`}
                  >
                    {club.is_leader ? "👑 Leader" : `🤝 ${club.user_role || "Member"}`}
                  </span>
                </div>
                <p className="mt-1 text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                  Led by <strong className="text-slate-700 dark:text-slate-200">{club.leader_name}</strong> • {club.member_count} active member{club.member_count === 1 ? "" : "s"}
                </p>
                {club.description && (
                  <p className="mt-2 text-xs sm:text-sm text-slate-600 dark:text-slate-300 max-w-2xl leading-relaxed">
                    {club.description}
                  </p>
                )}
              </div>
            </div>

            {/* Club Code Card */}
            <div className="rounded-2xl border-2 border-dashed border-indigo-200 dark:border-indigo-800/80 bg-indigo-50/50 dark:bg-indigo-950/40 p-4 sm:p-5 text-center w-full md:w-auto md:min-w-[240px]">
              <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-400">
                Official Club Code
              </span>
              <div className="mt-1 flex items-center justify-center gap-2">
                <span className="font-mono text-xl sm:text-2xl font-black tracking-widest text-indigo-950 dark:text-indigo-200">
                  {club.club_code}
                </span>
                <button
                  type="button"
                  onClick={copyCode}
                  className="rounded-lg bg-white dark:bg-slate-800 px-2.5 py-1 text-xs font-bold text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-700 shadow-2xs hover:bg-indigo-50 dark:hover:bg-slate-700 active:scale-95 transition"
                >
                  {copied ? "Copied! ✓" : "Copy"}
                </button>
              </div>
              <span className="mt-1 block text-[11px] text-slate-400 dark:text-slate-500">
                Share with volunteers to invite them
              </span>
            </div>
          </div>

          {/* Defined Roles */}
          {club.roles && club.roles.length > 0 && (
            <div className="mt-6 border-t border-slate-100 dark:border-slate-800 pt-4 flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mr-1">
                Defined Club Roles:
              </span>
              {club.roles.map((r) => (
                <span
                  key={r.id}
                  className="rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2.5 py-1 text-xs font-medium text-slate-700 dark:text-slate-300"
                >
                  {r.role_name}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* EVENTS & OPERATIONS SECTION */}
        <div className="mb-8 rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 sm:p-8 shadow-xs transition-colors duration-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4 mb-6">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 text-lg">
                🗓️
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                  Club Events & Operations
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Manage events, scheduled timings, volunteer assignments, and live task tracking.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <span className="rounded-full bg-slate-100 dark:bg-slate-800 px-3 py-1 text-xs font-bold text-slate-700 dark:text-slate-300">
                {events.length} Event{events.length === 1 ? "" : "s"}
              </span>

              {club.is_leader && (
                <Link
                  href={`/club/${club.club_code}/create-event`}
                  className="rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:from-indigo-500 hover:to-violet-500 active:scale-95 transition"
                >
                  + Create Event
                </Link>
              )}
            </div>
          </div>

          {events.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 py-10 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-2xl mb-3">
                🎪
              </div>
              <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">No events scheduled yet</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
                {club.is_leader
                  ? "As the club leader, you can create the first event, select participating volunteers, and assign tasks with deadlines."
                  : "Events created by the club leader will appear here with your assigned tasks."}
              </p>
              {club.is_leader && (
                <Link
                  href={`/club/${club.club_code}/create-event`}
                  className="mt-4 inline-block rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-indigo-500 transition"
                >
                  + Create First Event
                </Link>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {events.map((ev) => {
                const startDateStr = new Date(ev.start_time).toLocaleString(undefined, {
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                });
                const endDateStr = new Date(ev.end_time).toLocaleString(undefined, {
                  hour: "2-digit",
                  minute: "2-digit",
                });

                const taskPct = ev.total_tasks > 0 ? Math.round((ev.completed_tasks / ev.total_tasks) * 100) : 0;

                return (
                  <div
                    key={ev.id}
                    className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-800/40 p-5 hover:border-indigo-300 dark:hover:border-indigo-500/50 hover:bg-white dark:hover:bg-slate-800 hover:shadow-sm transition flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider ${
                            ev.mode === "online"
                              ? "bg-sky-100 dark:bg-sky-950/70 text-sky-800 dark:text-sky-300"
                              : ev.mode === "hybrid"
                              ? "bg-purple-100 dark:bg-purple-950/70 text-purple-800 dark:text-purple-300"
                              : "bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300"
                          }`}
                        >
                          {ev.mode === "online"
                            ? "🌐 Online"
                            : ev.mode === "hybrid"
                            ? "⚡ Hybrid"
                            : "🏛️ Offline"}
                        </span>

                        {ev.my_active_tasks > 0 && (
                          <span className="rounded-full bg-rose-100 dark:bg-rose-950/70 border border-rose-200 dark:border-rose-800 px-2 py-0.5 text-[10px] font-extrabold text-rose-700 dark:text-rose-300 animate-pulse">
                            🚨 {ev.my_active_tasks} Task Assigned to You
                          </span>
                        )}
                      </div>

                      <h3 className="text-lg font-bold text-slate-900 dark:text-white leading-snug">
                        {ev.name}
                      </h3>

                      {ev.description && (
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                          {ev.description}
                        </p>
                      )}

                      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-slate-600 dark:text-slate-400">
                        <div className="flex items-center gap-1.5">
                          <span>📅</span>
                          <span>{startDateStr} - {endDateStr}</span>
                        </div>
                        {ev.venue && (
                          <div className="flex items-center gap-1.5">
                            <span>📍</span>
                            <span>{ev.venue}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between gap-3">
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        <span className="font-semibold text-slate-700 dark:text-slate-200">{ev.participant_count}</span> members •{" "}
                        <span className="font-semibold text-indigo-700 dark:text-indigo-400">{ev.completed_tasks}/{ev.total_tasks} tasks ({taskPct}%)</span>
                      </div>

                      <Link
                        href={`/club/${club.club_code}/event/${ev.id}`}
                        className="rounded-xl bg-slate-900 dark:bg-white px-3.5 py-1.5 text-xs font-bold text-white dark:text-slate-900 hover:bg-indigo-600 dark:hover:bg-slate-100 transition shrink-0"
                      >
                        Enter Space →
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* LEADER SECTION: Pending Volunteer Join Requests */}
        {club.is_leader && (
          <div className="mb-8 rounded-3xl border border-amber-200/80 dark:border-amber-900/50 bg-amber-50/30 dark:bg-amber-950/20 p-4 sm:p-6 md:p-8 shadow-xs transition-colors duration-200">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200 text-base">
                  📬
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                    Pending Volunteer Join Requests
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Volunteers waiting for your approval. Assign an official role and accept them into the club.
                  </p>
                </div>
              </div>
              <span className="shrink-0 rounded-full bg-amber-100 dark:bg-amber-900/60 px-3 py-1 text-xs font-bold text-amber-800 dark:text-amber-200">
                {club.pendingRequests?.length || 0} Pending
              </span>
            </div>

            {!club.pendingRequests || club.pendingRequests.length === 0 ? (
              <div className="rounded-2xl border border-slate-200/60 dark:border-slate-800 bg-white/70 dark:bg-slate-900/70 py-8 text-center text-sm text-slate-500 dark:text-slate-400">
                ✨ No pending join requests right now. When volunteers enter code <strong>{club.club_code}</strong>, their applications will appear here.
              </div>
            ) : (
              <div className="space-y-4 mt-4">
                {club.pendingRequests.map((req) => (
                  <div
                    key={req.request_id}
                    className="rounded-2xl border border-amber-200 dark:border-amber-900/60 bg-white dark:bg-slate-900 p-4 sm:p-5 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-4"
                  >
                    <div className="flex items-start gap-3.5 min-w-0">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-500 to-violet-500 text-sm font-bold text-white">
                        {req.full_name?.charAt(0) || "V"}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-bold text-slate-900 dark:text-white text-sm sm:text-base">
                            {req.full_name}
                          </h3>
                          <span className="text-xs text-slate-400 dark:text-slate-500 break-all">
                            ({req.email})
                          </span>
                        </div>

                        {req.message && (
                          <p className="mt-1 text-xs italic text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-md p-2">
                            &ldquo;{req.message}&rdquo;
                          </p>
                        )}

                        {req.skills && req.skills.length > 0 && (
                          <div className="mt-2 flex flex-wrap items-center gap-1.5">
                            <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500">Skills:</span>
                            {req.skills.map((skill, sIdx) => (
                              <span
                                key={sIdx}
                                className="rounded bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 text-[10px] font-semibold text-indigo-700 dark:text-indigo-300 border border-indigo-100 dark:border-indigo-800"
                              >
                                {skill}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Role assignment and actions */}
                    <div className="flex flex-wrap items-center gap-2.5 pt-3 lg:pt-0 border-t lg:border-t-0 border-slate-100 dark:border-slate-800 w-full lg:w-auto">
                      <div className="flex items-center gap-1.5 w-full sm:w-auto">
                        <label htmlFor={`dyn-role-select-${req.request_id}`} className="text-xs font-semibold text-slate-600 dark:text-slate-300 whitespace-nowrap">
                          Assign Role:
                        </label>
                        <select
                          id={`dyn-role-select-${req.request_id}`}
                          value={roleAssignments[req.request_id] || ""}
                          onChange={(e) =>
                            setRoleAssignments({
                              ...roleAssignments,
                              [req.request_id]: e.target.value,
                            })
                          }
                          className="flex-1 sm:flex-initial rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-bold text-slate-900 dark:text-white focus:border-indigo-500 focus:outline-none min-h-[40px]"
                        >
                          {club.roles?.map((r) => (
                            <option key={r.id} value={r.role_name}>
                              {r.role_name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="flex items-center gap-2 w-full sm:w-auto">
                        <button
                          type="button"
                          disabled={actionLoading === req.request_id}
                          onClick={() => handleRequestAction(req.request_id, "accept")}
                          className="flex-1 sm:flex-initial rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-emerald-500 active:scale-95 transition disabled:opacity-50 min-h-[40px] flex items-center justify-center"
                        >
                          {actionLoading === req.request_id ? "Processing..." : "✓ Accept & Assign"}
                        </button>

                        <button
                          type="button"
                          disabled={actionLoading === req.request_id}
                          onClick={() => handleRequestAction(req.request_id, "reject")}
                          className="rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition disabled:opacity-50 min-h-[40px] flex items-center justify-center"
                        >
                          Decline
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Club Members Directory */}
        <div className="rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-8 shadow-[0_8px_30px_rgba(15,23,42,0.03)] dark:shadow-none transition-colors duration-200">
          <div className="flex items-center justify-between mb-4 sm:mb-6">
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white">
                Club Members &amp; Volunteers
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                All leaders and volunteers assigned to {club.name}.
              </p>
            </div>
            <span className="rounded-full bg-slate-100 dark:bg-slate-800 px-3 py-1 text-xs font-bold text-slate-700 dark:text-slate-300">
              {club.members?.length || 0} Members
            </span>
          </div>

          {/* Mobile Member Cards (No horizontal scroll needed on mobile) */}
          <div className="md:hidden space-y-3">
            {club.members?.map((m) => (
              <div
                key={m.membership_id}
                className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 p-4 space-y-2.5 transition active:scale-[0.99]"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-500 to-violet-500 text-white font-bold text-xs">
                      {m.full_name?.charAt(0) || "U"}
                    </div>
                    <div className="min-w-0">
                      <span className="font-bold text-sm text-slate-900 dark:text-white truncate block">
                        {m.full_name}
                      </span>
                      <span className="text-[11px] text-slate-400 dark:text-slate-500 truncate block">
                        {m.email}
                      </span>
                    </div>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                      m.role_type === "leader"
                        ? "bg-indigo-100 dark:bg-indigo-950/70 text-indigo-800 dark:text-indigo-300"
                        : "bg-slate-200/80 dark:bg-slate-700 text-slate-700 dark:text-slate-300"
                    }`}
                  >
                    {m.role_type === "leader" ? "👑 Leader" : "Volunteer"}
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-200/60 dark:border-slate-700/60">
                  <span className="text-slate-500 dark:text-slate-400">
                    Assigned: <strong className="text-slate-800 dark:text-slate-200">{m.assigned_role || "Volunteer"}</strong>
                  </span>
                  <span className="text-[11px] text-slate-400 dark:text-slate-500">
                    {m.joined_at ? new Date(m.joined_at).toLocaleDateString() : "Recently"}
                  </span>
                </div>

                {m.skills && m.skills.length > 0 && (
                  <div className="flex flex-wrap gap-1 pt-0.5">
                    {m.skills.map((s, idx) => (
                      <span
                        key={idx}
                        className="rounded bg-slate-200/60 dark:bg-slate-700/60 px-2 py-0.5 text-[10px] font-medium text-slate-600 dark:text-slate-300"
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  <th className="pb-3 pr-4">Member</th>
                  <th className="pb-3 px-4">Role Type</th>
                  <th className="pb-3 px-4">Assigned Role</th>
                  <th className="pb-3 px-4">Skills</th>
                  <th className="pb-3 pl-4">Joined</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {club.members?.map((m) => (
                  <tr key={m.membership_id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition">
                    <td className="py-3.5 pr-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 font-bold text-slate-700 dark:text-slate-300 text-xs">
                          {m.full_name?.charAt(0) || "U"}
                        </div>
                        <div>
                          <span className="font-bold text-slate-900 dark:text-white block">
                            {m.full_name}
                          </span>
                          <span className="text-xs text-slate-400 dark:text-slate-500 block">
                            {m.email}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`rounded-md px-2 py-0.5 text-xs font-bold ${
                          m.role_type === "leader"
                            ? "bg-indigo-100 dark:bg-indigo-950/70 text-indigo-800 dark:text-indigo-300"
                            : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                        }`}
                      >
                        {m.role_type === "leader" ? "👑 Leader" : "Volunteer"}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="font-semibold text-slate-800 dark:text-slate-200 text-xs">
                        {m.assigned_role || "Volunteer"}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex flex-wrap gap-1 max-w-xs">
                        {m.skills && m.skills.length > 0 ? (
                          m.skills.map((s, idx) => (
                            <span
                              key={idx}
                              className="rounded bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 text-[10px] font-medium text-slate-600 dark:text-slate-300"
                            >
                              {s}
                            </span>
                          ))
                        ) : (
                          <span className="text-xs text-slate-400 dark:text-slate-500">—</span>
                        )}
                      </div>
                    </td>
                    <td className="py-3.5 pl-4 text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
                      {m.joined_at ? new Date(m.joined_at).toLocaleDateString() : "Recently"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Persistent Mobile Bottom Navigation Bar */}
      <MobileBottomNav clubCode={club.club_code} />
    </main>
  );
}
