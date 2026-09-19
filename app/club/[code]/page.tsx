"use client";

import { use, useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import ThemeToggle from "@/app/components/ThemeToggle";
import MobileBottomNav from "@/app/components/MobileBottomNav";
import UniversalLoader from "@/app/components/UniversalLoader";

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

interface ClubTaskItem {
  id: string;
  club_id: string;
  event_id: string;
  name: string;
  description: string | null;
  assigned_to: string | null;
  deadline: string | null;
  status: "pending" | "in_progress" | "completed";
  completed_at: string | null;
  created_at: string;
  event_name: string;
  assigned_to_name: string | null;
  assigned_to_email: string | null;
  assigned_to_photo: string | null;
}

interface ClubAnnouncementItem {
  id: string;
  club_id: string;
  event_id: string | null;
  title: string;
  content: string;
  audio_url: string | null;
  created_by: string;
  created_at: string;
  event_name: string | null;
  author_name: string | null;
  author_photo: string | null;
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

  // Filter out events whose deadline/end_time has passed
  const activeEvents = useMemo(() => {
    return events.filter((ev) => {
      if (!ev.end_time) return true;
      return new Date(ev.end_time).getTime() >= Date.now();
    });
  }, [events]);

  // Club Announcements State (Visible to all joined members, new & existing)
  const [announcements, setAnnouncements] = useState<ClubAnnouncementItem[]>([]);
  const [announcementsLoading, setAnnouncementsLoading] = useState(false);
  const [newAnnouncementTitle, setNewAnnouncementTitle] = useState("");
  const [newAnnouncementContent, setNewAnnouncementContent] = useState("");
  const [postingAnnouncement, setPostingAnnouncement] = useState(false);
  const [announcementMsg, setAnnouncementMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Delete Club & Delete Event Modals
  const [showDeleteClubModal, setShowDeleteClubModal] = useState(false);
  const [deletingClub, setDeletingClub] = useState(false);
  const [deleteClubError, setDeleteClubError] = useState("");

  const [eventToDelete, setEventToDelete] = useState<ClubEventSummary | null>(null);
  const [deletingEventId, setDeletingEventId] = useState<string | null>(null);

  const [clubTasks, setClubTasks] = useState<ClubTaskItem[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [taskFilter, setTaskFilter] = useState<"all" | "my">("all");
  const [selectedEventId, setSelectedEventId] = useState<string>("all");
  const [togglingTaskId, setTogglingTaskId] = useState<string | null>(null);

  const filteredTasks = useMemo(() => {
    return clubTasks.filter((t) => {
      const matchesUser = taskFilter === "all" || (taskFilter === "my" && t.assigned_to === currentUserId);
      const matchesEvent = selectedEventId === "all" || t.event_id === selectedEventId;
      return matchesUser && matchesEvent;
    });
  }, [clubTasks, taskFilter, currentUserId, selectedEventId]);

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
      if (data.user?.id) {
        setCurrentUserId(data.user.id);
      }

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
        loadAnnouncements(data.club.id);
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
        if (data.success) {
          if (Array.isArray(data.events)) {
            setEvents(data.events);
          }
          if (Array.isArray(data.tasks)) {
            setClubTasks(data.tasks);
          }
        }
      }
    } catch (err) {
      console.error("Error loading club events:", err);
    } finally {
      setEventsLoading(false);
    }
  }

  async function loadAnnouncements(clubId: string) {
    try {
      setAnnouncementsLoading(true);
      const res = await fetch(`/api/clubs/${clubId}/announcements`);
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.announcements)) {
          setAnnouncements(data.announcements);
        }
      }
    } catch (err) {
      console.error("Error loading club announcements:", err);
    } finally {
      setAnnouncementsLoading(false);
    }
  }

  async function handlePostAnnouncement(e: React.FormEvent) {
    e.preventDefault();
    if (!club?.id || !newAnnouncementContent.trim()) return;
    setPostingAnnouncement(true);
    setAnnouncementMsg(null);
    try {
      const res = await fetch(`/api/clubs/${club.id}/announcements`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newAnnouncementTitle.trim() || "Club Announcement",
          content: newAnnouncementContent.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || "Failed to post announcement.");
      setAnnouncementMsg({ type: "success", text: "Announcement broadcasted successfully to all joined members!" });
      setNewAnnouncementTitle("");
      setNewAnnouncementContent("");
      if (club?.id) loadAnnouncements(club.id);
      setTimeout(() => setAnnouncementMsg(null), 4000);
    } catch (err) {
      setAnnouncementMsg({ type: "error", text: err instanceof Error ? err.message : "Failed to post." });
    } finally {
      setPostingAnnouncement(false);
    }
  }

  async function handleDeleteClub() {
    if (!club) return;
    setDeletingClub(true);
    setDeleteClubError("");
    try {
      const res = await fetch(`/api/clubs/by-code/${club.club_code}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || "Failed to delete club.");
      router.push("/dashboard");
    } catch (err) {
      setDeleteClubError(err instanceof Error ? err.message : "Failed to delete club.");
      setDeletingClub(false);
    }
  }

  async function handleConfirmDeleteEvent() {
    if (!eventToDelete || !club) return;
    setDeletingEventId(eventToDelete.id);
    try {
      const res = await fetch(`/api/events/${eventToDelete.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || "Failed to delete event.");
      setEventToDelete(null);
      loadEvents(club.id);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete event.");
    } finally {
      setDeletingEventId(null);
    }
  }

  async function handleToggleClubTask(task: ClubTaskItem) {
    const newStatus = task.status === "completed" ? "pending" : "completed";
    setTogglingTaskId(task.id);

    // Optimistic update
    setClubTasks((prev) =>
      prev.map((t) => (t.id === task.id ? { ...t, status: newStatus as any } : t))
    );

    try {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error("Failed to update task.");
      if (club?.id) loadEvents(club.id);
    } catch (err) {
      console.error("Error toggling task:", err);
      // Revert on error
      setClubTasks((prev) =>
        prev.map((t) => (t.id === task.id ? { ...t, status: task.status } : t))
      );
    } finally {
      setTogglingTaskId(null);
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
      <UniversalLoader
        badge="ClubOps AI Workspace"
        text="Loading dynamic club workspace..."
        subtext="Retrieving event operations, volunteer rosters, and team schedule..."
      />
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

                {/* Club Leader Route to Member Directory */}
                {club.is_leader && (
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <Link
                      href={`/club/${club.club_code}/members`}
                      className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white px-4 py-2.5 text-xs font-bold shadow-md shadow-indigo-500/20 transition active:scale-95 min-h-[40px]"
                    >
                      <span>👥</span> Manage Members &amp; Volunteers Directory ({club.member_count}) →
                    </Link>
                  </div>
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

        {/* OFFICIAL CLUB ANNOUNCEMENTS SECTION (VISIBLE TO ALL JOINED MEMBERS) */}
        <div className="mb-8 rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 sm:p-8 shadow-xs transition-colors duration-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4 mb-6">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-600 text-white text-lg shadow-sm shadow-indigo-500/20">
                📢
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                  Official Club Announcements ({announcements.length})
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Broadcasts, directives, and briefings from the Club Leader. Newly joined volunteers can review all past briefings below.
                </p>
              </div>
            </div>

            <span className="rounded-full bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 px-3 py-1 text-xs font-bold text-indigo-700 dark:text-indigo-300 self-start sm:self-auto">
              📜 All Past Briefings Visible
            </span>
          </div>

          {/* LEADER BROADCAST FORM */}
          {club.is_leader && (
            <div className="rounded-2xl border border-indigo-200/80 dark:border-indigo-800/70 bg-indigo-50/30 dark:bg-indigo-950/20 p-4 sm:p-6 mb-6">
              <span className="text-xs font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-300 block mb-3">
                Broadcast New Announcement to All Club Members
              </span>

              {announcementMsg && (
                <div
                  className={`mb-3 rounded-xl p-3 text-xs font-semibold ${
                    announcementMsg.type === "success"
                      ? "bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300"
                      : "bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-300"
                  }`}
                >
                  {announcementMsg.text}
                </div>
              )}

              <form onSubmit={handlePostAnnouncement} className="space-y-3">
                <input
                  type="text"
                  placeholder="Announcement Title (e.g. Orientation Meeting, Club Schedule Update)"
                  value={newAnnouncementTitle}
                  onChange={(e) => setNewAnnouncementTitle(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2.5 text-xs text-slate-800 dark:text-slate-200 focus:border-indigo-500 focus:outline-none transition"
                />
                <textarea
                  rows={2}
                  placeholder="Write your announcement message for all volunteers and members..."
                  value={newAnnouncementContent}
                  onChange={(e) => setNewAnnouncementContent(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-3.5 text-xs text-slate-800 dark:text-slate-200 focus:border-indigo-500 focus:outline-none transition"
                />
                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={postingAnnouncement || !newAnnouncementContent.trim()}
                    className="rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-5 py-2 text-xs font-bold text-white shadow-xs hover:from-indigo-500 hover:to-violet-500 transition disabled:opacity-50 min-h-[40px]"
                  >
                    {postingAnnouncement ? "Broadcasting..." : "📢 Broadcast Announcement"}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* ANNOUNCEMENTS FEED */}
          {announcementsLoading ? (
            <div className="py-8 text-center text-xs text-slate-400 dark:text-slate-500">
              Loading announcements...
            </div>
          ) : announcements.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 py-8 text-center text-xs text-slate-500 dark:text-slate-400">
              No announcements posted yet.
            </div>
          ) : (
            <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1">
              {announcements.map((a) => (
                <div
                  key={a.id}
                  className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 p-4 sm:p-5"
                >
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-bold text-xs text-slate-700 dark:text-slate-300">
                        {a.author_name || "Club Leader"}
                      </span>
                      {a.event_name && (
                        <span className="rounded bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 text-[10px] font-bold truncate">
                          Event: {a.event_name}
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] text-slate-400 dark:text-slate-500 shrink-0">
                      {new Date(a.created_at).toLocaleString(undefined, {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                  <h4 className="font-bold text-sm text-slate-900 dark:text-white">{a.title}</h4>
                  <p className="mt-1 text-xs sm:text-sm text-slate-600 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
                    {a.content}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* EVENTS & OPERATIONS SECTION (DEADLINE EXPIRED EVENTS AUTOMATICALLY FILTERED) */}
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
                  Active &amp; upcoming club events. Events with completed deadlines are automatically removed from the list.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <span className="rounded-full bg-slate-100 dark:bg-slate-800 px-3 py-1 text-xs font-bold text-slate-700 dark:text-slate-300">
                {activeEvents.length} Active Event{activeEvents.length === 1 ? "" : "s"}
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

          {activeEvents.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 py-10 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-2xl mb-3">
                🎪
              </div>
              <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">No active events currently scheduled</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
                {club.is_leader
                  ? "As the club leader, you can create a new event, select participating volunteers, and assign tasks with deadlines."
                  : "Active and upcoming events created by the club leader will appear here with your assigned tasks."}
              </p>
              {club.is_leader && (
                <Link
                  href={`/club/${club.club_code}/create-event`}
                  className="mt-4 inline-block rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-indigo-500 transition"
                >
                  + Create New Event
                </Link>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {activeEvents.map((ev) => {
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

                      <div className="flex items-center gap-2">
                        {club.is_leader && (
                          <button
                            type="button"
                            onClick={() => setEventToDelete(ev)}
                            className="rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50/60 dark:bg-rose-950/40 p-1.5 text-xs text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-900/60 transition"
                            title="Delete this event"
                          >
                            🗑️
                          </button>
                        )}
                        <Link
                          href={`/club/${club.club_code}/event/${ev.id}`}
                          className="rounded-xl bg-slate-900 dark:bg-white px-3.5 py-1.5 text-xs font-bold text-white dark:text-slate-900 hover:bg-indigo-600 dark:hover:bg-slate-100 transition shrink-0"
                        >
                          Enter Space →
                        </Link>
                      </div>
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

        {/* TASKS ACROSS ALL EVENTS IN THIS CLUB */}
        <div className="mb-8 rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-8 shadow-xs transition-colors duration-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4 mb-6">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-100 dark:bg-violet-950/60 text-violet-700 dark:text-violet-300 text-lg">
                ✅
              </div>
              <div>
                <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white">
                  Tasks Across Club Events ({clubTasks.length})
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  All volunteer task assignments and responsibilities across {club.name} events.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setTaskFilter("all")}
                className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
                  taskFilter === "all"
                    ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
                }`}
              >
                All Tasks ({clubTasks.length})
              </button>
              <button
                type="button"
                onClick={() => setTaskFilter("my")}
                className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
                  taskFilter === "my"
                    ? "bg-indigo-600 text-white font-bold"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
                }`}
              >
                🎯 My Assigned Tasks ({clubTasks.filter((t) => t.assigned_to === currentUserId).length})
              </button>
            </div>
          </div>

          {events.length > 1 && (
            <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-1">
              <span className="text-xs font-medium text-slate-400 dark:text-slate-500 shrink-0">Filter Event:</span>
              <button
                type="button"
                onClick={() => setSelectedEventId("all")}
                className={`rounded-lg px-2.5 py-1 text-xs whitespace-nowrap transition ${
                  selectedEventId === "all"
                    ? "bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 font-bold"
                    : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                }`}
              >
                All Events
              </button>
              {activeEvents.map((ev) => (
                <button
                  key={ev.id}
                  type="button"
                  onClick={() => setSelectedEventId(ev.id)}
                  className={`rounded-lg px-2.5 py-1 text-xs whitespace-nowrap transition ${
                    selectedEventId === ev.id
                      ? "bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 font-bold"
                      : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                  }`}
                >
                  {ev.name}
                </button>
              ))}
            </div>
          )}

          {filteredTasks.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 py-8 text-center text-sm text-slate-500 dark:text-slate-400">
              {taskFilter === "my"
                ? "✨ You have no tasks assigned to you across these events."
                : "No tasks found matching your filter."}
            </div>
          ) : (
            <div className="space-y-3">
              {filteredTasks.map((task) => {
                const isDone = task.status === "completed";
                const isMyTask = task.assigned_to === currentUserId;
                const isToggling = togglingTaskId === task.id;

                return (
                  <div
                    key={task.id}
                    className={`rounded-2xl border p-4 sm:p-5 transition flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                      isDone
                        ? "border-slate-200 dark:border-slate-800/80 bg-slate-50/60 dark:bg-slate-800/30 opacity-80"
                        : isMyTask
                        ? "border-indigo-300 dark:border-indigo-800 bg-indigo-50/30 dark:bg-indigo-950/20 shadow-xs ring-1 ring-indigo-500/20"
                        : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/60 shadow-2xs"
                    }`}
                  >
                    <div className="flex items-start gap-3.5 min-w-0">
                      <div
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl font-bold text-xs ${
                          isDone
                            ? "bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300"
                            : isMyTask
                            ? "bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300"
                            : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                        }`}
                      >
                        {isDone ? "✓" : isMyTask ? "🎯" : "⚡"}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h4
                            className={`font-bold text-sm sm:text-base ${
                              isDone ? "line-through text-slate-400 dark:text-slate-500" : "text-slate-900 dark:text-white"
                            }`}
                          >
                            {task.name}
                          </h4>
                          <Link
                            href={`/club/${club.club_code}/event/${task.event_id}`}
                            className="rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 px-2.5 py-0.5 text-[10px] font-bold text-slate-700 dark:text-slate-300 hover:text-indigo-600 transition"
                          >
                            🗓️ {task.event_name} →
                          </Link>
                          {isMyTask && (
                            <span className="rounded-full bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 text-[10px] font-extrabold">
                              Assigned to You
                            </span>
                          )}
                        </div>

                        {task.description && (
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-xl">
                            {task.description}
                          </p>
                        )}

                        <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-slate-500 dark:text-slate-400">
                          {task.assigned_to_name ? (
                            <div className="flex items-center gap-1.5">
                              <span className="h-5 w-5 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-[10px] font-bold">
                                {task.assigned_to_name.charAt(0)}
                              </span>
                              <span>
                                Assignee: <strong className="text-slate-700 dark:text-slate-200">{task.assigned_to_name}</strong>
                              </span>
                            </div>
                          ) : (
                            <span className="text-amber-600 dark:text-amber-400">⚠️ Unassigned</span>
                          )}

                          {task.deadline && (
                            <div className="flex items-center gap-1">
                              <span>⏱️ Due:</span>
                              <span className="font-semibold text-slate-700 dark:text-slate-300">
                                {new Date(task.deadline).toLocaleString(undefined, {
                                  month: "short",
                                  day: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {(club.is_leader || isMyTask) && (
                      <button
                        type="button"
                        disabled={isToggling}
                        onClick={() => handleToggleClubTask(task)}
                        className={`self-start md:self-center rounded-xl px-4 py-2 text-xs font-bold transition shrink-0 min-h-[40px] flex items-center justify-center ${
                          isDone
                            ? "border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
                            : "bg-emerald-600 text-white hover:bg-emerald-500 shadow-xs active:scale-95"
                        }`}
                      >
                        {isToggling ? "Saving..." : isDone ? "Reopen Task" : "✓ Mark as Done"}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* LEADER DANGER ZONE: DELETE CLUB */}
        {club.is_leader && (
          <div className="rounded-3xl border border-rose-200 dark:border-rose-900/60 bg-rose-50/40 dark:bg-rose-950/20 p-6 sm:p-8 shadow-xs mb-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-base sm:text-lg font-bold text-rose-900 dark:text-rose-200">
                  Danger Zone: Delete Club
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 max-w-xl">
                  Permanently delete &ldquo;{club.name}&rdquo; and all of its scheduled events, participant records, assigned tasks, and announcements. This action is irreversible.
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setDeleteClubError("");
                  setShowDeleteClubModal(true);
                }}
                className="w-full sm:w-auto min-h-[44px] flex items-center justify-center rounded-xl bg-rose-600 px-5 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-rose-500 active:scale-95 transition shrink-0"
              >
                🗑️ Delete This Club
              </button>
            </div>
          </div>
        )}
      </div>

      {/* CONFIRM DELETE EVENT MODAL */}
      {eventToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 dark:bg-black/70 p-3 sm:p-4 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl sm:rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 sm:p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-rose-600 dark:text-rose-400">
              <span className="text-2xl">⚠️</span>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Delete Event?</h3>
            </div>

            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              Are you sure you want to permanently delete <strong className="text-slate-900 dark:text-white">&ldquo;{eventToDelete.name}&rdquo;</strong>?
              All tasks and participants for this event will be erased.
            </p>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                disabled={Boolean(deletingEventId)}
                onClick={() => setEventToDelete(null)}
                className="rounded-xl border border-slate-200 dark:border-slate-700 px-4 py-2.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 min-h-[44px]"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={Boolean(deletingEventId)}
                onClick={handleConfirmDeleteEvent}
                className="rounded-xl bg-rose-600 px-5 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-rose-500 transition disabled:opacity-50 min-h-[44px]"
              >
                {deletingEventId ? "Deleting..." : "Yes, Delete Event"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRM DELETE CLUB MODAL */}
      {showDeleteClubModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 dark:bg-black/70 p-3 sm:p-4 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl sm:rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 sm:p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-rose-600 dark:text-rose-400">
              <span className="text-2xl">⚠️</span>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Delete Entire Club?</h3>
            </div>

            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              Are you sure you want to delete <strong className="text-slate-900 dark:text-white">&ldquo;{club.name}&rdquo; ({club.club_code})</strong>?
              This will permanently delete the club, all volunteer roles, join requests, member directories, events, tasks, and announcements.
            </p>

            {deleteClubError && (
              <div className="rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/50 p-3 text-xs font-semibold text-red-700 dark:text-red-300">
                ⚠️ {deleteClubError}
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                disabled={deletingClub}
                onClick={() => setShowDeleteClubModal(false)}
                className="rounded-xl border border-slate-200 dark:border-slate-700 px-4 py-2.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 min-h-[44px]"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deletingClub}
                onClick={handleDeleteClub}
                className="rounded-xl bg-rose-600 px-5 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-rose-500 transition disabled:opacity-50 min-h-[44px]"
              >
                {deletingClub ? "Deleting Club..." : "Yes, Delete Club"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Persistent Mobile Bottom Navigation Bar */}
      <MobileBottomNav clubCode={club.club_code} />
    </main>
  );
}
