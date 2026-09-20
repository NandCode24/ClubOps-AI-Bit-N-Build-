"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import ThemeToggle from "../components/ThemeToggle";
import MobileBottomNav from "../components/MobileBottomNav";
import UniversalLoader from "../components/UniversalLoader";
import { authClient } from "../lib/auth-client";

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
    <div className="flex items-center gap-2 sm:gap-3 min-w-0">
      <div className="flex h-8 w-8 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-xl sm:rounded-2xl bg-gradient-to-tr from-[#738852] to-[#859B62] text-[#F2ECE1] shadow-md shadow-[#859B62]/25">
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
        <span className="text-[15px] sm:text-[19px] font-bold tracking-tight text-[#1B2213] dark:text-[#F4F6F0] truncate block">
          ClubOps <span className="text-[#859B62] dark:text-[#9AB277]">AI</span>
        </span>
        <span className="hidden sm:block text-[9px] sm:text-[10px] font-medium uppercase tracking-wider text-[#737E67] dark:text-[#8E9A82] truncate">
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
  const [clubTasksList, setClubTasksList] = useState<any[]>([]);

  // Delete Club Modal in Dashboard
  const [clubToDelete, setClubToDelete] = useState<ClubMeta | null>(null);
  const [deletingClub, setDeletingClub] = useState(false);
  const [deleteClubError, setDeleteClubError] = useState("");

  async function handleDeleteClubFromDashboard() {
    if (!clubToDelete) return;
    setDeletingClub(true);
    setDeleteClubError("");
    try {
      const res = await fetch(`/api/clubs/by-code/${clubToDelete.club_code}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || "Failed to delete club.");
      setClubToDelete(null);
      await loadDashboard();
    } catch (err) {
      setDeleteClubError(err instanceof Error ? err.message : "Failed to delete club.");
    } finally {
      setDeletingClub(false);
    }
  }

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
            if (evData.success) {
              if (Array.isArray(evData.events)) setClubEventsList(evData.events);
              if (Array.isArray(evData.tasks)) setClubTasksList(evData.tasks);
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
            .catch(() => { });
        }
      });

      eventSource.addEventListener("club_event_updated", () => {
        if (activeClub?.id) {
          fetch(`/api/clubs/${activeClub.id}/events-list`)
            .then((r) => r.json())
            .then((d) => {
              if (d.success && Array.isArray(d.events)) setClubEventsList(d.events);
            })
            .catch(() => { });
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
      await authClient.signOut();
      await fetch("/api/auth/signout", { method: "POST" });
    } catch (e) {
      console.error("Error during sign out:", e);
    } finally {
      window.location.href = "/signin";
    }
  }

  if (loading) {
    return (
      <UniversalLoader
        badge="ClubOps AI Dashboard"
        text="Loading your club space..."
        subtext="Syncing memberships, live event schedules, and role assignments..."
      />
    );
  }

  return (
    <>
      {actionLoading && (
        <UniversalLoader
          fullscreen
          blur
          badge="Club Operations"
          text="Processing Request..."
          subtext="Updating volunteer membership and assigning role permissions..."
        />
      )}

      <main
        className={`min-h-screen bg-[#F2ECE1] dark:bg-[#121810] text-[#1B2213] dark:text-[#F4F6F0] transition-all duration-200 ${actionLoading ? "filter blur-sm pointer-events-none select-none" : ""
          }`}
      >
        {/* Top Navigation Bar */}
        <header className="sticky top-0 z-30 border-b border-[#DFD7C8] dark:border-[#283422] bg-[#F2ECE1]/90 dark:bg-[#121810]/90 backdrop-blur-md px-3 sm:px-8 py-2.5 sm:py-3 transition-colors duration-200">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-2">
            <Logo />

            <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
              <ThemeToggle />

              {/* Quick Links on tablet/desktop */}
              <Link
                href="/createClub"
                className="hidden sm:inline-flex items-center gap-1.5 rounded-xl border border-[#DDD7C8] dark:border-[#283422] bg-white dark:bg-[#192015] px-3 py-1.5 text-xs font-semibold text-[#1B2213] dark:text-[#E4EAE0] hover:border-[#859B62] dark:hover:border-[#9AB277] hover:text-[#859B62] dark:hover:text-[#9AB277] shadow-xs transition"
              >
                <span>+</span> Create Club
              </Link>

              <Link
                href="/joinClub"
                className="hidden sm:inline-flex items-center gap-1.5 rounded-xl bg-[#EBF0E2] dark:bg-[#202A1B] border border-[#D0DBC2] dark:border-[#2E3C27] px-3 py-1.5 text-xs font-semibold text-[#3D4A27] dark:text-[#A0BC7B] hover:bg-[#E2EAD5] dark:hover:bg-[#273421] transition"
              >
                <span>🔗</span> Join Club
              </Link>

              {/* User Profile Link */}
              <Link
                href="/profile"
                className="flex items-center gap-2 border-l border-[#E2DDD0] dark:border-[#283422] pl-2 sm:pl-3 hover:opacity-85 transition group"
                title="View Profile, Skills & Availability"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-tr from-[#738852] to-[#859B62] text-xs font-bold text-white shadow-xs group-hover:ring-2 ring-[#859B62]/30 transition">
                  {user?.full_name?.charAt(0) || "U"}
                </div>
                <div className="hidden md:block text-left">
                  <span className="block text-[10px] font-semibold text-[#859B62] dark:text-[#9AB277] leading-tight">
                    Profile
                  </span>
                </div>
              </Link>

              <button
                type="button"
                onClick={handleSignOut}
                title="Sign out"
                className="rounded-lg p-1.5 text-[#737E67] hover:bg-[#EBF0E2] dark:hover:bg-[#202A1B] hover:text-[#859B62] dark:hover:text-[#9AB277] transition"
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
        <div className="mx-auto max-w-7xl px-3 sm:px-8 py-4 sm:py-8 pb-28 md:pb-8">
          {/* Real-time Floating Popup Notification */}
          {newRequestPopup && (
            <div className="fixed top-16 sm:top-20 left-3 right-3 sm:left-auto sm:right-6 z-50 sm:max-w-sm rounded-2xl border-2 border-[#859B62] dark:border-[#9AB277] bg-white dark:bg-[#192015] p-4 shadow-2xl ring-4 ring-[#859B62]/20 transition-all">
              <div className="flex items-start gap-3">
                <span className="text-2xl animate-bounce shrink-0">🔔</span>
                <div className="flex-1 min-w-0">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#3D4A27] dark:text-[#A0BC7B] bg-[#EBF0E2] dark:bg-[#202A1B] px-2 py-0.5 rounded-md">
                    Live Volunteer Request!
                  </span>
                  <h4 className="font-extrabold text-[#1B2213] dark:text-[#F4F6F0] text-sm mt-1 truncate">
                    {newRequestPopup.name} wants to join!
                  </h4>
                  <p className="text-xs text-[#737E67] dark:text-[#8E9A82] truncate">{newRequestPopup.email}</p>
                  {newRequestPopup.message && (
                    <p className="text-xs text-[#4B5540] dark:text-[#C2CBB7] italic mt-1.5 bg-[#FAF8F2] dark:bg-[#202A1B] p-1.5 rounded-md border border-[#E2DDD0] dark:border-[#283422]">
                      &ldquo;{newRequestPopup.message}&rdquo;
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setNewRequestPopup(null)}
                  className="text-[#737E67] hover:text-[#1B2213] dark:hover:text-[#F4F6F0] font-bold text-xs"
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
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[#EBF0E2] dark:bg-[#202A1B] border border-[#D0DBC2] dark:border-[#2E3C27] px-3.5 py-1 text-xs font-semibold text-[#3D4A27] dark:text-[#A0BC7B] mb-4">
                  🎉 Welcome to ClubOps AI
                </span>
                <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-[#1B2213] dark:text-[#F4F6F0]">
                  Ready to power your college events?
                </h1>
                <p className="mt-3 text-base sm:text-lg text-[#4B5540] dark:text-[#C2CBB7] max-w-xl mx-auto">
                  Hello <span className="font-semibold text-[#1B2213] dark:text-[#F4F6F0]">{user?.full_name}</span>! Choose your path to get started with centralized event operations and AI tools.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Option 1: Create a Club */}
                <div className="group relative rounded-3xl border border-[#E2DDD0] dark:border-[#283422] bg-white dark:bg-[#192015] p-6 sm:p-8 shadow-sm hover:border-[#859B62] dark:hover:border-[#9AB277]/50 hover:shadow-xl transition-all duration-300 flex flex-col justify-between">
                  <div>
                    <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#EBF0E2] dark:bg-[#202A1B] border border-[#D0DBC2] dark:border-[#2E3C27] text-3xl shadow-xs mb-6 group-hover:scale-105 transition">
                      👑
                    </div>
                    <span className="text-xs font-bold uppercase tracking-wider text-[#859B62] dark:text-[#9AB277]">
                      Leader Path
                    </span>
                    <h2 className="mt-1 text-2xl font-bold text-[#1B2213] dark:text-[#F4F6F0]">
                      Create a Club
                    </h2>
                    <p className="mt-3 text-sm text-[#737E67] dark:text-[#8E9A82] leading-relaxed">
                      Become a Club Leader. Get an official auto-generated Club Code, customize volunteer roles, accept member requests, and plan events with AI assistance.
                    </p>
                  </div>
                  <div className="mt-8">
                    <Link
                      href="/createClub"
                      className="inline-flex w-full items-center justify-center rounded-xl bg-[#859B62] hover:bg-[#738852] py-3.5 text-sm font-bold text-white shadow-sm hover:opacity-95 transition active:scale-98"
                    >
                      Create a New Club →
                    </Link>
                  </div>
                </div>

                {/* Option 2: Join a Club */}
                <div className="group relative rounded-3xl border border-[#E2DDD0] dark:border-[#283422] bg-white dark:bg-[#192015] p-6 sm:p-8 shadow-sm hover:border-[#859B62] dark:hover:border-[#9AB277]/50 hover:shadow-xl transition-all duration-300 flex flex-col justify-between">
                  <div>
                    <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#EBF0E2] dark:bg-[#202A1B] border border-[#D0DBC2] dark:border-[#2E3C27] text-3xl shadow-xs mb-6 group-hover:scale-105 transition">
                      🤝
                    </div>
                    <span className="text-xs font-bold uppercase tracking-wider text-[#3D4A27] dark:text-[#A0BC7B]">
                      Volunteer Path
                    </span>
                    <h2 className="mt-1 text-2xl font-bold text-[#1B2213] dark:text-[#F4F6F0]">
                      Join an Existing Club
                    </h2>
                    <p className="mt-3 text-sm text-[#737E67] dark:text-[#8E9A82] leading-relaxed">
                      Have a Club ID from your club leader? Enter the 6-character code to submit your volunteer request, get assigned your role, and receive tasks.
                    </p>
                  </div>
                  <div className="mt-8">
                    <Link
                      href="/joinClub"
                      className="inline-flex w-full items-center justify-center rounded-xl bg-[#1B2213] dark:bg-[#F4F6F0] text-[#F2ECE1] dark:text-[#1B2213] py-3.5 text-sm font-bold hover:bg-[#28321C] dark:hover:bg-[#E4EAE0] transition active:scale-98"
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
              {/* SECTION: ALL USER CLUBS & WORKSPACES */}
              <div className="mb-8 rounded-3xl border border-[#E2DDD0] dark:border-[#283422] bg-white/80 dark:bg-[#192015]/80 p-4 sm:p-6 backdrop-blur-md shadow-xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5 border-b border-[#E2DDD0]/80 dark:border-[#283422]/80 pb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#EBF0E2] dark:bg-[#202A1B] text-[#3D4A27] dark:text-[#A0BC7B] font-bold text-xs">
                        🏛️
                      </span>
                      <h2 className="text-base sm:text-lg font-extrabold tracking-tight text-[#1B2213] dark:text-[#F4F6F0]">
                        Your Clubs & Workspaces
                      </h2>
                      <span className="rounded-full bg-[#EBF0E2] dark:bg-[#202A1B] px-2.5 py-0.5 text-xs font-bold text-[#3D4A27] dark:text-[#A0BC7B]">
                        {clubs.length}
                      </span>
                    </div>
                    <p className="text-xs text-[#737E67] dark:text-[#8E9A82] mt-1">
                      Select a club to switch your active workspace, volunteer requests, events, and operations.
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Link
                      href="/createClub"
                      className="inline-flex items-center gap-1.5 rounded-xl border border-[#DDD7C8] dark:border-[#283422] bg-white dark:bg-[#192015] px-3.5 py-2 text-xs font-semibold text-[#1B2213] dark:text-[#E4EAE0] hover:border-[#859B62] dark:hover:border-[#9AB277] hover:text-[#859B62] dark:hover:text-[#9AB277] transition shadow-2xs"
                    >
                      <span>+</span> Create Club
                    </Link>
                    <Link
                      href="/joinClub"
                      className="inline-flex items-center gap-1.5 rounded-xl bg-[#EBF0E2] dark:bg-[#202A1B] border border-[#D0DBC2] dark:border-[#2E3C27] px-3.5 py-2 text-xs font-semibold text-[#3D4A27] dark:text-[#A0BC7B] hover:bg-[#E2EAD5] dark:hover:bg-[#273421] transition"
                    >
                      <span>🔗</span> Join Club
                    </Link>
                  </div>
                </div>

                {/* Grid of All Clubs */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {clubs.map((c) => {
                    const isActive = c.id === activeClub.id;

                    return (
                      <div
                        key={c.id}
                        className={`relative rounded-2xl p-4 sm:p-5 transition-all duration-200 flex flex-col justify-between ${isActive
                            ? "border-2 border-[#859B62] dark:border-[#9AB277] bg-gradient-to-b from-[#F2F6ED] via-white to-white dark:from-[#1E2819] dark:via-[#192015] dark:to-[#192015] shadow-md ring-2 ring-[#859B62]/20"
                            : "border border-[#E2DDD0] dark:border-[#283422] bg-white dark:bg-[#192015] hover:border-[#859B62]/60 dark:hover:border-[#384830] shadow-2xs hover:shadow-sm"
                          }`}
                      >
                        <div>
                          {/* Top Meta Row */}
                          <div className="flex items-start justify-between gap-2.5 mb-3">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#FAF8F2] dark:bg-[#202A1B] border border-[#E2DDD0] dark:border-[#283422] text-2xl shadow-xs">
                                {c.profile_image || "🏛️"}
                              </div>
                              <div className="min-w-0">
                                <h3 className="font-extrabold text-[#1B2213] dark:text-[#F4F6F0] text-sm sm:text-base truncate" title={c.name}>
                                  {c.name}
                                </h3>
                                <div className="flex items-center gap-1.5 mt-0.5">
                                  <span className="font-mono text-[11px] font-bold text-[#364221] dark:text-[#A0BC7B] bg-[#EAF0E2] dark:bg-[#202A1B] px-2 py-0.5 rounded border border-[#B7CCA0] dark:border-[#384A2F]">
                                    {c.club_code}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleCopyClubCode(c.club_code);
                                    }}
                                    title="Copy club code"
                                    className="text-[11px] text-[#737E67] hover:text-[#859B62] dark:hover:text-[#9AB277] transition"
                                  >
                                    📋
                                  </button>
                                </div>
                              </div>
                            </div>

                            {/* Role Badge */}
                            <span
                              className={`shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-bold ${c.is_leader
                                  ? "bg-[#859B62] text-white shadow-xs"
                                  : "bg-[#EAF0E2] dark:bg-[#202A1B] text-[#364221] dark:text-[#A0BC7B] border border-[#B7CCA0] dark:border-[#384A2F]"
                                }`}
                            >
                              {c.is_leader ? "👑 Leader" : `🤝 ${c.assigned_role || "Volunteer"}`}
                            </span>
                          </div>

                          {/* Location & Details */}
                          <div className="text-xs text-[#737E67] dark:text-[#8E9A82] space-y-0.5 my-2.5">
                            <p className="truncate">
                              Lead: <strong className="text-[#1B2213] dark:text-[#F4F6F0]">{c.leader_name}</strong>
                            </p>
                            <p className="truncate">
                              Location: {c.location || "Campus"}
                            </p>
                          </div>
                        </div>

                        {/* Card Bottom Actions */}
                        <div className="pt-3 border-t border-[#E2DDD0]/70 dark:border-[#283422]/70 flex items-center gap-2 mt-2">
                          <Link
                            href={`/club/${c.club_code}`}
                            className="flex-1 rounded-xl bg-[#859B62] hover:bg-[#738852] text-white py-2.5 text-xs font-bold text-center transition min-h-[40px] flex items-center justify-center shadow-xs"
                          >
                            Enter Club Space →
                          </Link>

                          {c.is_leader && (
                            <>
                              <Link
                                href={`/club/${c.club_code}/members`}
                                className="rounded-xl border border-[#DDD7C8] dark:border-[#283422] bg-white dark:bg-[#192015] px-3 py-2 text-xs font-semibold text-[#1B2213] dark:text-[#E4EAE0] hover:bg-[#F2ECE1] dark:hover:bg-[#202A1B] transition min-h-[40px] flex items-center shrink-0"
                                title="Manage member roster"
                              >
                                👥 Members
                              </Link>
                              <button
                                type="button"
                                onClick={() => {
                                  setDeleteClubError("");
                                  setClubToDelete(c);
                                }}
                                className="rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50/60 dark:bg-rose-950/40 p-2 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/60 transition min-h-[40px] flex items-center justify-center shrink-0"
                                title="Delete club"
                              >
                                🗑️
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Notification Banner */}
              {actionMessage && (
                <div
                  className={`mb-6 rounded-2xl p-4 text-sm font-medium flex items-center justify-between ${actionMessage.type === "success"
                      ? "bg-[#EBF0E2] dark:bg-[#202A1B] border border-[#D0DBC2] dark:border-[#2E3C27] text-[#3D4A27] dark:text-[#A0BC7B]"
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

              {/* Direct Navigation to Events Banner */}
              <div className="mb-8 rounded-3xl border border-[#D0DBC2] dark:border-[#2E3C27] bg-gradient-to-r from-[#EBF0E2]/80 via-white to-[#EBF0E2]/60 dark:from-[#1E2819]/70 dark:via-[#192015] dark:to-[#1E2819]/70 p-5 sm:p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-start sm:items-center gap-3.5">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#859B62] text-white text-2xl shadow-md shadow-[#859B62]/25">
                    🎯
                  </div>
                  <div>
                    <h3 className="font-extrabold text-[#1B2213] dark:text-[#F4F6F0] text-base">
                      Events &amp; Operations Live Inside Your Clubs
                    </h3>
                    <p className="text-xs text-[#4B5540] dark:text-[#C2CBB7] mt-0.5">
                      Click <strong>&ldquo;Enter Club Space&rdquo;</strong> on any club above to view its events (e.g. SIH 2026), access tasks, and collaborate with your team.
                    </p>
                  </div>
                </div>

                <Link
                  href={`/club/${activeClub.club_code}`}
                  className="shrink-0 rounded-xl bg-[#859B62] hover:bg-[#738852] text-white px-4 py-2.5 text-xs font-bold transition shadow-xs text-center min-h-[40px] flex items-center justify-center"
                >
                  Open {activeClub.name} Space →
                </Link>
              </div>

              {/* LEADER SECTION: Pending Volunteer Join Requests */}
              {activeClub.is_leader && (
                <div className="mb-8 rounded-3xl border border-[#D0DBC2] dark:border-[#2E3C27] bg-[#FAF8F2] dark:bg-[#161D13] p-4 sm:p-6 md:p-8 shadow-xs transition-colors duration-200">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#EBF0E2] dark:bg-[#202A1B] text-[#3D4A27] dark:text-[#A0BC7B] text-base border border-[#D0DBC2] dark:border-[#2E3C27]">
                        📬
                      </div>
                      <div>
                        <h2 className="text-base sm:text-lg font-bold text-[#1B2213] dark:text-[#F4F6F0]">
                          Pending Volunteer Join Requests
                        </h2>
                        <p className="text-xs text-[#737E67] dark:text-[#8E9A82]">
                          Volunteers who entered your Club Code. Review and assign an official role to admit them.
                        </p>
                      </div>
                    </div>
                    <span className="shrink-0 rounded-full bg-[#EBF0E2] dark:bg-[#202A1B] border border-[#D0DBC2] dark:border-[#2E3C27] px-3 py-1 text-xs font-bold text-[#3D4A27] dark:text-[#A0BC7B]">
                      {activeClub.pendingRequests?.length || 0} Pending
                    </span>
                  </div>

                  {/* List of Requests */}
                  {!activeClub.pendingRequests || activeClub.pendingRequests.length === 0 ? (
                    <div className="rounded-2xl border border-[#E2DDD0] dark:border-[#283422] bg-white/70 dark:bg-[#192015]/70 py-8 text-center text-sm text-[#737E67] dark:text-[#8E9A82]">
                      ✨ No pending join requests right now. When volunteers enter code <strong className="text-[#1B2213] dark:text-[#F4F6F0]">{activeClub.club_code}</strong>, their requests will appear here.
                    </div>
                  ) : (
                    <div className="space-y-4 mt-4">
                      {activeClub.pendingRequests.map((req) => (
                        <div
                          key={req.request_id}
                          className="rounded-2xl border border-[#E2DDD0] dark:border-[#283422] bg-white dark:bg-[#192015] p-4 sm:p-5 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4"
                        >
                          <div className="flex items-start gap-3.5 min-w-0">
                            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#859B62] text-white text-sm font-bold shadow-xs">
                              {req.full_name?.charAt(0) || "V"}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <h3 className="font-bold text-[#1B2213] dark:text-[#F4F6F0] text-sm sm:text-base">
                                  {req.full_name}
                                </h3>
                                <span className="text-xs text-[#737E67] dark:text-[#8E9A82] break-all">
                                  ({req.email})
                                </span>
                              </div>

                              {req.message && (
                                <p className="mt-1 text-xs italic text-[#4B5540] dark:text-[#C2CBB7] bg-[#FAF8F2] dark:bg-[#202A1B] border border-[#E2DDD0] dark:border-[#283422] rounded-md p-2">
                                  &ldquo;{req.message}&rdquo;
                                </p>
                              )}

                              {/* Skills Badges */}
                              {req.skills && req.skills.length > 0 && (
                                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                                  <span className="text-[11px] font-semibold text-[#737E67] dark:text-[#8E9A82]">Skills:</span>
                                  {req.skills.map((skill, sIdx) => (
                                    <span
                                      key={sIdx}
                                      className="rounded bg-[#EBF0E2] dark:bg-[#202A1B] px-2 py-0.5 text-[10px] font-semibold text-[#3D4A27] dark:text-[#A0BC7B] border border-[#D0DBC2] dark:border-[#2E3C27]"
                                    >
                                      {skill}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Leader Actions: Select Role & Accept/Reject */}
                          <div className="flex flex-wrap items-center gap-2.5 pt-3 lg:pt-0 border-t lg:border-t-0 border-[#E2DDD0] dark:border-[#283422] w-full lg:w-auto">
                            <div className="flex items-center gap-1.5 w-full sm:w-auto">
                              <label htmlFor={`role-select-${req.request_id}`} className="text-xs font-semibold text-[#4B5540] dark:text-[#C2CBB7] whitespace-nowrap">
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
                                className="flex-1 sm:flex-initial rounded-xl border border-[#DDD7C8] dark:border-[#283422] bg-white dark:bg-[#192015] px-3 py-2 text-xs font-bold text-[#1B2213] dark:text-[#F4F6F0] focus:border-[#859B62] focus:outline-none min-h-[40px]"
                              >
                                {activeClub.roles?.map((r) => (
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
                                className="flex-1 sm:flex-initial rounded-xl bg-[#859B62] px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-[#738852] active:scale-95 transition disabled:opacity-50 min-h-[40px] flex items-center justify-center"
                              >
                                {actionLoading === req.request_id ? "Processing..." : "✓ Accept & Assign"}
                              </button>

                              <button
                                type="button"
                                disabled={actionLoading === req.request_id}
                                onClick={() => handleRequestAction(req.request_id, "reject")}
                                className="rounded-xl border border-[#DDD7C8] dark:border-[#283422] bg-white dark:bg-[#192015] px-3.5 py-2 text-xs font-semibold text-[#4B5540] dark:text-[#C2CBB7] hover:bg-[#F2ECE1] dark:hover:bg-[#202A1B] transition disabled:opacity-50 min-h-[40px] flex items-center justify-center"
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

            </div>
          )}
        </div>

        {/* CONFIRM DELETE CLUB MODAL */}
        {clubToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 sm:p-4 backdrop-blur-xs">
            <div className="w-full max-w-md rounded-2xl sm:rounded-3xl bg-[#FAF8F2] dark:bg-[#192015] border border-[#E2DDD0] dark:border-[#283422] p-5 sm:p-6 shadow-2xl space-y-4">
              <div className="flex items-center gap-3 text-rose-600 dark:text-rose-400">
                <span className="text-2xl">⚠️</span>
                <h3 className="text-lg font-bold text-[#1B2213] dark:text-[#F4F6F0]">Delete Entire Club?</h3>
              </div>

              <p className="text-xs sm:text-sm text-[#4B5540] dark:text-[#C2CBB7] leading-relaxed">
                Are you sure you want to permanently delete <strong className="text-[#1B2213] dark:text-[#F4F6F0]">&ldquo;{clubToDelete.name}&rdquo; ({clubToDelete.club_code})</strong>?
                This will erase the club, all volunteer roles, join requests, member rosters, events, tasks, and announcements. This action cannot be undone.
              </p>

              {deleteClubError && (
                <div className="rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/50 p-3 text-xs font-semibold text-red-700 dark:text-red-300">
                  ⚠️ {deleteClubError}
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#E2DDD0] dark:border-[#283422]">
                <button
                  type="button"
                  disabled={deletingClub}
                  onClick={() => setClubToDelete(null)}
                  className="rounded-xl border border-[#DDD7C8] dark:border-[#283422] px-4 py-2.5 text-xs font-semibold text-[#4B5540] dark:text-[#C2CBB7] hover:bg-[#F2ECE1] dark:hover:bg-[#202A1B] min-h-[44px]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={deletingClub}
                  onClick={handleDeleteClubFromDashboard}
                  className="rounded-xl bg-rose-600 px-5 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-rose-500 transition disabled:opacity-50 min-h-[44px]"
                >
                  {deletingClub ? "Deleting Club..." : "Yes, Delete Club"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Persistent Mobile Bottom Navigation Bar */}
        <MobileBottomNav clubCode={activeClub?.club_code} />
      </main>
    </>
  );
}
