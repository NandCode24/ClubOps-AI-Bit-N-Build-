"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ThemeToggle } from "../components/ThemeToggle";

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

interface ClubMeta {
  id: string;
  club_code: string;
  name: string;
  description: string | null;
  profile_image: string | null;
  leader_id: string;
  leader_name: string;
  location: string | null;
  created_at: string;
  role_type: "leader" | "volunteer" | "member";
  assigned_role: string | null;
  is_leader: boolean;
  member_count?: number;
  members?: Member[];
  roles?: ClubRole[];
  pendingRequests?: JoinRequestItem[];
}

interface DashboardUser {
  id: string;
  email: string;
  full_name: string;
  username?: string | null;
  college_name?: string | null;
  skills: string[];
}

function Logo() {
  return (
    <div className="flex items-center gap-2.5 sm:gap-3">
      <div className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-2xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-violet-500 text-white shadow-md shadow-indigo-500/20">
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
      <div>
        <span className="text-[17px] sm:text-[19px] font-bold tracking-tight text-slate-900 dark:text-white">
          ClubOps <span className="bg-gradient-to-r from-indigo-600 to-violet-600 dark:from-indigo-400 dark:to-violet-400 bg-clip-text text-transparent">AI</span>
        </span>
        <span className="block text-[9px] sm:text-[10px] font-medium uppercase tracking-wider text-slate-400 dark:text-slate-500">
          Event Operations
        </span>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<DashboardUser | null>(null);
  const [hasClubs, setHasClubs] = useState(false);
  const [clubs, setClubs] = useState<ClubMeta[]>([]);
  const [activeClub, setActiveClub] = useState<ClubMeta | null>(null);

  // Volunteer request role assignment state: map of requestId -> selectedRoleName
  const [roleAssignments, setRoleAssignments] = useState<Record<string, string>>({});
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [copiedCode, setCopiedCode] = useState(false);
  const [newRequestPopup, setNewRequestPopup] = useState<{
    name: string;
    email: string;
    message: string | null;
  } | null>(null);

  const [clubEventsList, setClubEventsList] = useState<any[]>([]);

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

  async function loadDashboard(requestedClubId?: string) {
    try {
      setLoading(true);
      const url = requestedClubId ? `/api/dashboard?club_id=${requestedClubId}` : "/api/dashboard";
      const res = await fetch(url);

      if (res.status === 401) {
        router.push("/signin");
        return;
      }

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.message || "Failed to load dashboard.");
      }

      setUser(data.user);
      setHasClubs(data.hasClubs);
      setClubs(data.clubs || []);
      setActiveClub(data.activeClub || null);

      // Pre-select default role for any pending requests
      if (data.activeClub?.pendingRequests && data.activeClub?.roles) {
        const defaultRole = data.activeClub.roles[0]?.role_name || "Volunteer";
        const initialMap: Record<string, string> = {};
        for (const req of data.activeClub.pendingRequests) {
          initialMap[req.request_id] = defaultRole;
        }
        setRoleAssignments(initialMap);
      }

      if (data.activeClub?.id) {
        try {
          const evRes = await fetch(`/api/clubs/${data.activeClub.id}/events-list`);
          if (evRes.ok) {
            const evData = await evRes.json();
            if (evData.success && Array.isArray(evData.events)) {
              setClubEventsList(evData.events);
            }
          }
        } catch {
          // ignore
        }
      }
    } catch (err) {
      console.error("Failed to load dashboard:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDashboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Real-time SSE listener for incoming join requests
  useEffect(() => {
    if (!activeClub?.id || !activeClub.is_leader) return;

    let eventSource: EventSource | null = null;
    try {
      eventSource = new EventSource(`/api/clubs/${activeClub.id}/events`);

      eventSource.addEventListener("new_join_request", (event) => {
        const newReq = JSON.parse(event.data);

        setActiveClub((prev) => {
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
          [newReq.request_id]: activeClub.roles?.[0]?.role_name || "Volunteer",
        }));

        playNotificationChime();
        setNewRequestPopup({
          name: newReq.full_name,
          email: newReq.email,
          message: newReq.message,
        });
      });

      eventSource.addEventListener("task_updated", () => {
        if (activeClub?.id) {
          fetch(`/api/clubs/${activeClub.id}/events-list`)
            .then((r) => r.json())
            .then((d) => {
              if (d.success && Array.isArray(d.events)) setClubEventsList(d.events);
            })
            .catch(() => {});
        }
      });

      eventSource.addEventListener("club_event_updated", () => {
        if (activeClub?.id) {
          fetch(`/api/clubs/${activeClub.id}/events-list`)
            .then((r) => r.json())
            .then((d) => {
              if (d.success && Array.isArray(d.events)) setClubEventsList(d.events);
            })
            .catch(() => {});
        }
      });
    } catch (err) {
      console.error("SSE stream error:", err);
    }

    // Auto-polling backup every 4 seconds so no request is ever missed
    const pollInterval = setInterval(async () => {
      try {
        const res = await fetch(`/api/clubs/${activeClub.id}/requests`);
        if (res.ok) {
          const data = await res.json();
          if (data.success && Array.isArray(data.requests)) {
            setActiveClub((prev) => {
              if (!prev) return prev;
              return {
                ...prev,
                pendingRequests: data.requests,
              };
            });
          }
        }
      } catch {
        // silent sync
      }
    }, 4000);

    return () => {
      if (eventSource) eventSource.close();
      clearInterval(pollInterval);
    };
  }, [activeClub?.id, activeClub?.is_leader, activeClub?.roles]);

  function handleCopyClubCode(code: string) {
    navigator.clipboard.writeText(code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  }

  async function handleRequestAction(requestId: string, action: "accept" | "reject") {
    if (!activeClub) return;

    try {
      setActionLoading(requestId);
      setActionMessage(null);

      const assignedRole = roleAssignments[requestId] || activeClub.roles?.[0]?.role_name || "Volunteer";

      const res = await fetch(`/api/clubs/${activeClub.id}/requests`, {
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

      // Reload active club dashboard to refresh members and pending lists
      await loadDashboard(activeClub.id);
    } catch (err) {
      setActionMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Failed to process request.",
      });
    } finally {
      setActionLoading(null);
    }
  }

  async function handleSignOut() {
    try {
      await fetch("/api/auth/signout", { method: "POST" });
      router.push("/signin");
      router.refresh();
    } catch (e) {
      console.error(e);
      router.push("/signin");
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
          <p className="text-sm font-medium text-slate-500">Loading your club space...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#F8FAFC] dark:bg-[#090D16] transition-colors duration-200">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-30 border-b border-slate-200/80 dark:border-slate-800 bg-white/95 dark:bg-[#090D16]/95 backdrop-blur-md px-3 sm:px-8 py-3 transition-colors duration-200">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-2">
          <Logo />

          <div className="flex items-center gap-2 sm:gap-3">
            <ThemeToggle />

            {/* Quick Links */}
            <Link
              href="/createClub"
              className="hidden sm:inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:border-indigo-300 dark:hover:border-indigo-500 hover:text-indigo-600 dark:hover:text-indigo-400 shadow-2xs transition"
            >
              <span>+</span> Create Club
            </Link>

            <Link
              href="/joinClub"
              className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200/70 dark:border-indigo-800/60 px-3 py-1.5 text-xs font-semibold text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 transition"
            >
              <span>🔗</span> <span className="hidden xs:inline">Join Club</span>
            </Link>

            {/* User Profile Link */}
            <Link
              href="/profile"
              className="flex items-center gap-2 border-l border-slate-200 dark:border-slate-800 pl-2 sm:pl-3 hover:opacity-85 transition group"
              title="View Profile, Skills & Availability"
            >
              <div className="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-full bg-gradient-to-tr from-indigo-600 to-violet-600 text-xs font-bold text-white shadow-xs group-hover:ring-2 ring-indigo-500/30 transition">
                {user?.full_name?.charAt(0) || "U"}
              </div>
              <div className="hidden md:block text-left">
                <span className="block text-[10px] font-semibold text-indigo-600 dark:text-indigo-400 leading-tight">
                  Profile
                </span>
              </div>
            </Link>

            <button
              type="button"
              onClick={handleSignOut}
              title="Sign out"
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-600 dark:hover:text-slate-200 transition"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      {/* Main Body */}
      <div className="mx-auto max-w-7xl px-3 sm:px-8 py-6 sm:py-8">
        {/* Real-time Floating Popup Notification */}
        {newRequestPopup && (
          <div className="fixed top-20 right-4 sm:right-6 z-50 max-w-sm rounded-2xl border-2 border-indigo-400 dark:border-indigo-500 bg-white dark:bg-slate-900 p-4 shadow-2xl ring-4 ring-indigo-500/20 transition-all">
            <div className="flex items-start gap-3">
              <span className="text-2xl animate-bounce">🔔</span>
              <div className="flex-1">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 rounded-md">
                  Live Volunteer Request!
                </span>
                <h4 className="font-extrabold text-slate-900 dark:text-white text-sm mt-1">
                  {newRequestPopup.name} wants to join!
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400">{newRequestPopup.email}</p>
                {newRequestPopup.message && (
                  <p className="text-xs text-slate-600 dark:text-slate-300 italic mt-1.5 bg-slate-50 dark:bg-slate-800/80 p-1.5 rounded-md border border-slate-100 dark:border-slate-700">
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
        {/* Onboarding State: User has not joined or created any clubs */}
        {!hasClubs || !activeClub ? (
          <div className="mx-auto max-w-3xl py-8">
            <div className="text-center mb-10">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200/60 dark:border-indigo-800/60 px-3.5 py-1 text-xs font-semibold text-indigo-700 dark:text-indigo-300 mb-4">
                🎉 Welcome to ClubOps AI
              </span>
              <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                Ready to power your college events?
              </h1>
              <p className="mt-3 text-base sm:text-lg text-slate-600 dark:text-slate-400 max-w-xl mx-auto">
                Hello <span className="font-semibold text-slate-900 dark:text-white">{user?.full_name}</span>! Choose your path to get started with centralized event operations and AI tools.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Option 1: Create a Club */}
              <div className="group relative rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 sm:p-8 shadow-[0_8px_30px_rgba(15,23,42,0.04)] hover:border-indigo-300 dark:hover:border-indigo-500/50 hover:shadow-xl hover:shadow-indigo-500/5 transition-all duration-300 flex flex-col justify-between">
                <div>
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-100 dark:border-indigo-800 text-3xl shadow-sm mb-6 group-hover:scale-105 transition">
                    👑
                  </div>
                  <span className="text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                    Leader Path
                  </span>
                  <h2 className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">
                    Create a Club
                  </h2>
                  <p className="mt-3 text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                    Become a Club Leader. Get an official auto-generated Club Code, customize volunteer roles, accept member requests, and plan events with AI assistance.
                  </p>
                </div>
                <div className="mt-8">
                  <Link
                    href="/createClub"
                    className="inline-flex w-full items-center justify-center rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 py-3.5 text-sm font-bold text-white shadow-md shadow-indigo-500/20 hover:opacity-95 transition active:scale-98"
                  >
                    Create a New Club →
                  </Link>
                </div>
              </div>

              {/* Option 2: Join a Club */}
              <div className="group relative rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 sm:p-8 shadow-[0_8px_30px_rgba(15,23,42,0.04)] hover:border-violet-300 dark:hover:border-violet-500/50 hover:shadow-xl hover:shadow-violet-500/5 transition-all duration-300 flex flex-col justify-between">
                <div>
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-violet-50 dark:bg-violet-950/60 border border-violet-100 dark:border-violet-800 text-3xl shadow-sm mb-6 group-hover:scale-105 transition">
                    🤝
                  </div>
                  <span className="text-xs font-bold uppercase tracking-wider text-violet-600 dark:text-violet-400">
                    Volunteer Path
                  </span>
                  <h2 className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">
                    Join an Existing Club
                  </h2>
                  <p className="mt-3 text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                    Have a Club ID from your club leader? Enter the 6-character code to submit your volunteer request, get assigned your role, and receive tasks.
                  </p>
                </div>
                <div className="mt-8">
                  <Link
                    href="/joinClub"
                    className="inline-flex w-full items-center justify-center rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 py-3.5 text-sm font-bold hover:bg-slate-800 dark:hover:bg-slate-100 transition active:scale-98"
                  >
                    Enter Club Code to Join →
                  </Link>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Active Club Management View */
          <div>
            {/* Top Club Header & Switcher */}
            <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
              {/* Club selector if user is in multiple clubs */}
              {clubs.length > 1 ? (
                <div className="flex items-center gap-2">
                  <label htmlFor="club-select" className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                    Active Club:
                  </label>
                  <select
                    id="club-select"
                    value={activeClub.id}
                    onChange={(e) => loadDashboard(e.target.value)}
                    className="rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-sm font-bold text-slate-900 dark:text-white focus:border-indigo-500 focus:outline-none"
                  >
                    {clubs.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} {c.is_leader ? "(Leader)" : `(${c.assigned_role || "Member"})`}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200/60 dark:border-indigo-800/60 px-3 py-1 text-xs font-semibold text-indigo-700 dark:text-indigo-300">
                    {activeClub.is_leader ? "👑 You are Club Leader" : `🤝 Role: ${activeClub.assigned_role || "Volunteer"}`}
                  </span>
                </div>
              )}

              <div className="flex items-center gap-2">
                <Link
                  href="/createClub"
                  className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:border-slate-300 dark:hover:border-slate-700 transition"
                >
                  + New Club
                </Link>
                <Link
                  href="/joinClub"
                  className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:border-slate-300 dark:hover:border-slate-700 transition"
                >
                  + Join Another
                </Link>
              </div>
            </div>

            {/* Notification Banner */}
            {actionMessage && (
              <div
                className={`mb-6 rounded-2xl p-4 text-sm font-medium flex items-center justify-between ${
                  actionMessage.type === "success"
                    ? "bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300"
                    : "bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-300"
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

            {/* Club Hero Banner */}
            <div className="rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 sm:p-8 shadow-[0_8px_30px_rgba(15,23,42,0.03)] dark:shadow-none mb-8 transition-colors duration-200">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="flex items-start gap-4">
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-100 dark:border-indigo-800 text-3xl shadow-sm">
                    {activeClub.profile_image || "🏛️"}
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2.5">
                      <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                        {activeClub.name}
                      </h1>
                      <span className="rounded-full bg-slate-100 dark:bg-slate-800 px-2.5 py-0.5 text-xs font-semibold text-slate-600 dark:text-slate-300">
                        {activeClub.location || "Campus"}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                      Led by <strong className="text-slate-700 dark:text-slate-200">{activeClub.leader_name}</strong> • {activeClub.member_count} active member{activeClub.member_count === 1 ? "" : "s"}
                    </p>
                    {activeClub.description && (
                      <p className="mt-2 text-sm text-slate-600 dark:text-slate-300 max-w-2xl leading-relaxed">
                        {activeClub.description}
                      </p>
                    )}
                  </div>
                </div>

                {/* Club Code Share Card & Dynamic Route Link */}
                <div className="flex flex-col items-stretch gap-2.5 min-w-[240px]">
                  <div className="rounded-2xl border-2 border-dashed border-indigo-200 dark:border-indigo-800/80 bg-indigo-50/50 dark:bg-indigo-950/40 p-4 sm:p-5 text-center">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-400">
                      Club Invite Code
                    </span>
                    <div className="mt-1 flex items-center justify-center gap-2">
                      <span className="font-mono text-2xl font-black tracking-widest text-indigo-950 dark:text-indigo-200">
                        {activeClub.club_code}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleCopyClubCode(activeClub.club_code)}
                        className="rounded-lg bg-white dark:bg-slate-800 px-2.5 py-1 text-xs font-bold text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-700 shadow-2xs hover:bg-indigo-50 dark:hover:bg-slate-700 active:scale-95 transition"
                      >
                        {copiedCode ? "Copied! ✓" : "Copy"}
                      </button>
                    </div>
                    <span className="mt-1 block text-[11px] text-slate-400 dark:text-slate-500">
                      Share with students to join
                    </span>
                  </div>

                  <Link
                    href={`/club/${activeClub.club_code}`}
                    className="rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 py-2.5 px-4 text-center text-xs font-bold text-white shadow-sm hover:opacity-95 transition"
                  >
                    Open Dedicated Workspace (/club/{activeClub.club_code}) →
                  </Link>
                </div>
              </div>

              {/* Roles Chips Defined for Club */}
              {activeClub.roles && activeClub.roles.length > 0 && (
                <div className="mt-6 border-t border-slate-100 dark:border-slate-800 pt-4 flex flex-wrap items-center gap-2">
                  <span className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mr-1">
                    Defined Club Roles:
                  </span>
                  {activeClub.roles.map((r) => (
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

            {/* EVENTS & OPERATIONS PREVIEW */}
            <div className="mb-8 rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 sm:p-8 shadow-xs transition-colors duration-200">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4 mb-5">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 text-lg">
                    🗓️
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                      Club Events & Tasks ({clubEventsList.length})
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Active events and real-time volunteer task assignments for {activeClub.name}.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {activeClub.is_leader && (
                    <Link
                      href={`/club/${activeClub.club_code}/create-event`}
                      className="rounded-xl bg-indigo-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-indigo-500 transition"
                    >
                      + Create Event
                    </Link>
                  )}
                  <Link
                    href={`/club/${activeClub.club_code}`}
                    className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
                  >
                    View All in Club Workspace →
                  </Link>
                </div>
              </div>

              {clubEventsList.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 py-6 text-center text-sm text-slate-500 dark:text-slate-400">
                  No events planned yet.
                  {activeClub.is_leader && (
                    <span className="block mt-1">
                      <Link
                        href={`/club/${activeClub.club_code}/create-event`}
                        className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
                      >
                        Click here to create the first event
                      </Link>
                    </span>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  {clubEventsList.map((ev) => (
                    <div
                      key={ev.id}
                      className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 p-4 hover:border-indigo-300 dark:hover:border-indigo-500/50 hover:bg-white dark:hover:bg-slate-800 transition flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-1.5">
                          <span className="rounded-full bg-slate-200/70 dark:bg-slate-700 px-2 py-0.5 text-[10px] font-bold text-slate-700 dark:text-slate-200 uppercase">
                            {ev.mode}
                          </span>
                          {ev.my_active_tasks > 0 && (
                            <span className="rounded-full bg-rose-100 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 px-2 py-0.5 text-[10px] font-extrabold text-rose-700 dark:text-rose-300">
                              ⚠️ {ev.my_active_tasks} Task for you
                            </span>
                          )}
                        </div>
                        <h4 className="font-bold text-slate-900 dark:text-white text-sm">{ev.name}</h4>
                        <span className="text-[11px] text-slate-500 dark:text-slate-400 block mt-1">
                          📅 {new Date(ev.start_time).toLocaleString()}
                        </span>
                      </div>

                      <div className="mt-3 pt-2.5 border-t border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between">
                        <span className="text-xs text-indigo-700 dark:text-indigo-400 font-semibold">
                          {ev.completed_tasks}/{ev.total_tasks} tasks done
                        </span>
                        <Link
                          href={`/club/${activeClub.club_code}/event/${ev.id}`}
                          className="text-xs font-bold text-slate-900 dark:text-white hover:text-indigo-600 dark:hover:text-indigo-400 transition"
                        >
                          Open Space →
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* LEADER SECTION: Pending Volunteer Join Requests */}
            {activeClub.is_leader && (
              <div className="mb-8 rounded-3xl border border-amber-200/80 dark:border-amber-900/50 bg-amber-50/30 dark:bg-amber-950/20 p-6 sm:p-8 shadow-xs transition-colors duration-200">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200 text-base">
                      📬
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                        Pending Volunteer Join Requests
                      </h2>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Volunteers who entered your Club Code. Review and assign an official role to admit them.
                      </p>
                    </div>
                  </div>
                  <span className="rounded-full bg-amber-100 dark:bg-amber-900/60 px-3 py-1 text-xs font-bold text-amber-800 dark:text-amber-200">
                    {activeClub.pendingRequests?.length || 0} Pending
                  </span>
                </div>

                {/* List of Requests */}
                {!activeClub.pendingRequests || activeClub.pendingRequests.length === 0 ? (
                  <div className="rounded-2xl border border-slate-200/60 dark:border-slate-800 bg-white/70 dark:bg-slate-900/70 py-8 text-center text-sm text-slate-500 dark:text-slate-400">
                    ✨ No pending join requests right now. When volunteers enter code <strong>{activeClub.club_code}</strong>, their requests will appear here.
                  </div>
                ) : (
                  <div className="space-y-4 mt-4">
                    {activeClub.pendingRequests.map((req) => (
                      <div
                        key={req.request_id}
                        className="rounded-2xl border border-amber-200 dark:border-amber-900/60 bg-white dark:bg-slate-900 p-5 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-4"
                      >
                        <div className="flex items-start gap-3.5">
                          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-500 to-violet-500 text-sm font-bold text-white">
                            {req.full_name?.charAt(0) || "V"}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="font-bold text-slate-900 dark:text-white text-base">
                                {req.full_name}
                              </h3>
                              <span className="text-xs text-slate-400 dark:text-slate-500">
                                ({req.email})
                              </span>
                            </div>

                            {req.message && (
                              <p className="mt-1 text-xs italic text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-md p-2">
                                &ldquo;{req.message}&rdquo;
                              </p>
                            )}

                            {/* Skills Badges */}
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

                        {/* Leader Actions: Select Role & Accept/Reject */}
                        <div className="flex flex-wrap items-center gap-2.5 pt-3 lg:pt-0 border-t lg:border-t-0 border-slate-100 dark:border-slate-800">
                          <div className="flex items-center gap-1.5">
                            <label htmlFor={`role-select-${req.request_id}`} className="text-xs font-semibold text-slate-600 dark:text-slate-300 whitespace-nowrap">
                              Assign Role:
                            </label>
                            <select
                              id={`role-select-${req.request_id}`}
                              value={roleAssignments[req.request_id] || ""}
                              onChange={(e) =>
                                setRoleAssignments({
                                  ...roleAssignments,
                                  [req.request_id]: e.target.value,
                                })
                              }
                              className="rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-bold text-slate-900 dark:text-white focus:border-indigo-500 focus:outline-none"
                            >
                              {activeClub.roles?.map((r) => (
                                <option key={r.id} value={r.role_name}>
                                  {r.role_name}
                                </option>
                              ))}
                            </select>
                          </div>

                          <button
                            type="button"
                            disabled={actionLoading === req.request_id}
                            onClick={() => handleRequestAction(req.request_id, "accept")}
                            className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-emerald-500 active:scale-95 transition disabled:opacity-50"
                          >
                            {actionLoading === req.request_id ? "Processing..." : "✓ Accept & Assign"}
                          </button>

                          <button
                            type="button"
                            disabled={actionLoading === req.request_id}
                            onClick={() => handleRequestAction(req.request_id, "reject")}
                            className="rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition disabled:opacity-50"
                          >
                            Decline
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Club Members Directory */}
            <div className="rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 sm:p-8 shadow-[0_8px_30px_rgba(15,23,42,0.03)] dark:shadow-none transition-colors duration-200">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                    Club Members &amp; Volunteers
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    All leaders and volunteers currently assigned to {activeClub.name}.
                  </p>
                </div>
                <span className="rounded-full bg-slate-100 dark:bg-slate-800 px-3 py-1 text-xs font-bold text-slate-700 dark:text-slate-300">
                  {activeClub.members?.length || 0} Members
                </span>
              </div>

              <div className="overflow-x-auto">
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
                    {activeClub.members?.map((m) => (
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
        )}
      </div>
    </main>
  );
}
