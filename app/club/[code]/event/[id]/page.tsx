"use client";

import { use, useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import ThemeToggle from "@/app/components/ThemeToggle";
import MobileBottomNav from "@/app/components/MobileBottomNav";
import UniversalLoader from "@/app/components/UniversalLoader";

interface Participant {
  participant_id: string;
  user_id: string;
  assigned_role: string | null;
  joined_event_at: string;
  full_name: string;
  email: string;
  photo_url: string | null;
  skills: string[];
  is_available?: boolean;
  unavailable_until?: string | null;
  unavailable_reason?: string | null;
  is_active?: boolean;
}

interface TaskItem {
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
  assigned_to_name: string | null;
  assigned_to_email: string | null;
  assigned_to_photo: string | null;
  assigned_to_skills: string[] | null;
}

interface AnnouncementItem {
  id: string;
  club_id: string;
  event_id: string;
  title: string;
  content: string;
  audio_url: string | null;
  created_by: string;
  created_at: string;
  author_name: string | null;
  author_photo: string | null;
}

interface EventDetails {
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
  meeting_time: string | null;
  created_by: string;
  created_at: string;
  club_name: string;
  club_code: string;
  leader_id: string;
  leader_name: string;
  is_leader: boolean;
  is_participant: boolean;
  participants: Participant[];
  tasks: TaskItem[];
  user_tasks: TaskItem[];
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

export default function EventDetailPage({
  params,
}: {
  params: Promise<{ code: string; id: string }>;
}) {
  const router = useRouter();
  const { code: rawCode, id: eventId } = use(params);
  const clubCode = rawCode?.toUpperCase();

  const [loading, setLoading] = useState(true);
  const [eventData, setEventData] = useState<EventDetails | null>(null);
  const [error, setError] = useState("");

  // Live Toast for Real-time Task Updates
  const [realtimeToast, setRealtimeToast] = useState<{
    title: string;
    message: string;
    type: "completed" | "created" | "updated";
  } | null>(null);

  // New Task Modal for Leader
  const [showAddTaskModal, setShowAddTaskModal] = useState(false);
  const [newTaskName, setNewTaskName] = useState("");
  const [newTaskDesc, setNewTaskDesc] = useState("");
  const [newTaskAssignee, setNewTaskAssignee] = useState("");
  const [newTaskDeadline, setNewTaskDeadline] = useState("");
  const [addTaskLoading, setAddTaskLoading] = useState(false);
  const [addTaskError, setAddTaskError] = useState("");

  // Browser Notification state
  const [notificationPerm, setNotificationPerm] = useState<string>("default");

  // Toggling Task Loading Map
  const [togglingTaskId, setTogglingTaskId] = useState<string | null>(null);

  // Event Announcements
  const [announcements, setAnnouncements] = useState<AnnouncementItem[]>([]);
  const [announcementsLoading, setAnnouncementsLoading] = useState(false);
  const [announcementTitle, setAnnouncementTitle] = useState("");
  const [announcementContent, setAnnouncementContent] = useState("");
  const [postingAnnouncement, setPostingAnnouncement] = useState(false);
  const [announcementError, setAnnouncementError] = useState("");
  const [announcementSuccess, setAnnouncementSuccess] = useState("");

  async function loadAnnouncements() {
    try {
      setAnnouncementsLoading(true);
      const res = await fetch(`/api/events/${eventId}/announcements`);
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.announcements)) {
          setAnnouncements(data.announcements);
        }
      }
    } catch (e) {
      console.error("Error loading announcements:", e);
    } finally {
      setAnnouncementsLoading(false);
    }
  }

  async function handlePostAnnouncement(e: React.FormEvent) {
    e.preventDefault();
    if (!announcementContent.trim()) return;

    try {
      setPostingAnnouncement(true);
      setAnnouncementError("");
      setAnnouncementSuccess("");

      const res = await fetch(`/api/events/${eventId}/announcements`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: announcementTitle.trim() || "Leader Announcement",
          content: announcementContent.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || "Failed to post announcement.");
      }

      setAnnouncements((prev) => [data.announcement, ...prev]);
      setAnnouncementTitle("");
      setAnnouncementContent("");
      setAnnouncementSuccess("Announcement broadcasted successfully to all joined members!");
      setTimeout(() => setAnnouncementSuccess(""), 4000);
    } catch (err) {
      setAnnouncementError(err instanceof Error ? err.message : "Failed to post announcement.");
    } finally {
      setPostingAnnouncement(false);
    }
  }

  function playSuccessChime() {
    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
      osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.1); // E5
      osc.frequency.setValueAtTime(783.99, ctx.currentTime + 0.2); // G5
      osc.frequency.setValueAtTime(1046.5, ctx.currentTime + 0.3); // C6
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.55);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.55);
    } catch {
      // Audio context error or blocked
    }
  }

  // Load Event Details
  async function loadEvent() {
    try {
      setLoading(true);
      setError("");
      const res = await fetch(`/api/events/${eventId}`);
      if (res.status === 401) {
        router.push(`/signin?redirect=/club/${clubCode}/event/${eventId}`);
        return;
      }
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || "Failed to load event.");
      }
      setEventData(data.event);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error loading event.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (eventId) {
      loadEvent();
      loadAnnouncements();
    }
    if (typeof window !== "undefined" && "Notification" in window) {
      setNotificationPerm(Notification.permission);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  // Real-time SSE Connection for this Event
  useEffect(() => {
    if (!eventData?.club_id) return;

    let eventSource: EventSource | null = null;
    try {
      eventSource = new EventSource(`/api/clubs/${eventData.club_id}/events`);

      eventSource.addEventListener("task_updated", (e) => {
        const payload = JSON.parse(e.data);
        if (payload.event_id !== eventId) return;

        setEventData((prev) => {
          if (!prev) return prev;
          const updatedStatus = payload.status as "pending" | "in_progress" | "completed";
          const updatedTasks = prev.tasks.map((t) => {
            if (t.id === payload.task_id) {
              return {
                ...t,
                status: updatedStatus,
                completed_at: payload.status === "completed" ? new Date().toISOString() : null,
              };
            }
            return t;
          });

          // Also update user_tasks
          const updatedUserTasks = prev.user_tasks.map((t) => {
            if (t.id === payload.task_id) {
              return {
                ...t,
                status: updatedStatus,
                completed_at: payload.status === "completed" ? new Date().toISOString() : null,
              };
            }
            return t;
          });

          return {
            ...prev,
            tasks: updatedTasks,
            user_tasks: updatedUserTasks,
          };
        });

        // Trigger chime & toast if marked completed
        if (payload.status === "completed") {
          playSuccessChime();
          setRealtimeToast({
            title: "Task Completed! 🎉",
            message: `"${payload.name}" was marked as done by ${payload.assigned_to_name || "Volunteer"}.`,
            type: "completed",
          });
        }
      });
    } catch (err) {
      console.error("SSE stream error:", err);
    }

    // Auto-polling fallback every 4 seconds to guarantee sync
    const pollInterval = setInterval(async () => {
      try {
        const res = await fetch(`/api/events/${eventId}`);
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.event) {
            setEventData((prev) => {
              if (!prev) return data.event;
              return {
                ...prev,
                tasks: data.event.tasks,
                user_tasks: data.event.user_tasks,
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
  }, [eventData?.club_id, eventId]);

  // Request Browser Push Notification Permission
  async function requestNotificationPermission() {
    if (typeof window !== "undefined" && "Notification" in window) {
      const permission = await Notification.requestPermission();
      setNotificationPerm(permission);
      if (permission === "granted") {
        new Notification("ClubOps AI Notifications Active", {
          body: `You will be alerted about task updates and approaching deadlines for "${eventData?.name}".`,
          icon: "/favicon.ico",
        });
      }
    }
  }

  // Toggle Task Completion (by Volunteer or Leader)
  async function handleToggleTask(task: TaskItem) {
    const newStatus: "pending" | "in_progress" | "completed" =
      task.status === "completed" ? "pending" : "completed";
    setTogglingTaskId(task.id);

    // Optimistic state update
    setEventData((prev) => {
      if (!prev) return prev;
      const patchTasks = (list: TaskItem[]) =>
        list.map((t) =>
          t.id === task.id
            ? {
                ...t,
                status: newStatus,
                completed_at: newStatus === "completed" ? new Date().toISOString() : null,
              }
            : t
        );
      return {
        ...prev,
        tasks: patchTasks(prev.tasks),
        user_tasks: patchTasks(prev.user_tasks),
      };
    });

    if (newStatus === "completed") {
      playSuccessChime();
    }

    try {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || "Failed to update task status.");
      }
    } catch (err) {
      // Revert optimistic update on failure
      alert(err instanceof Error ? err.message : "Error updating task.");
      loadEvent();
    } finally {
      setTogglingTaskId(null);
    }
  }

  // Leader: Add Task to Event
  async function handleCreateTask(e: React.FormEvent) {
    e.preventDefault();
    if (!eventData) return;
    setAddTaskError("");

    if (!newTaskName.trim()) {
      setAddTaskError("Task name is required.");
      return;
    }

    try {
      setAddTaskLoading(true);

      const res = await fetch(`/api/events/${eventId}/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newTaskName.trim(),
          description: newTaskDesc.trim(),
          assigned_to: newTaskAssignee || null,
          deadline: newTaskDeadline ? new Date(newTaskDeadline).toISOString() : null,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || "Failed to assign task.");
      }

      // Reset form and close modal
      setNewTaskName("");
      setNewTaskDesc("");
      setNewTaskAssignee("");
      setNewTaskDeadline("");
      setShowAddTaskModal(false);

      // Reload fresh event data
      await loadEvent();
    } catch (err) {
      setAddTaskError(err instanceof Error ? err.message : "Error creating task.");
    } finally {
      setAddTaskLoading(false);
    }
  }

  // Calculate Urgency & Approaching Deadlines for Volunteer's Tasks
  const urgentTasks = useMemo(() => {
    if (!eventData?.user_tasks) return [];
    return eventData.user_tasks.filter((t) => {
      if (t.status === "completed" || !t.deadline) return false;
      const dueTime = new Date(t.deadline).getTime();
      const now = Date.now();
      const hoursRemaining = (dueTime - now) / (1000 * 60 * 60);
      // Alert if due within 24 hours or already overdue
      return hoursRemaining <= 24;
    });
  }, [eventData?.user_tasks]);

  // Overall Task Metrics
  const taskMetrics = useMemo(() => {
    if (!eventData?.tasks) return { total: 0, completed: 0, percentage: 0 };
    const total = eventData.tasks.length;
    const completed = eventData.tasks.filter((t) => t.status === "completed").length;
    const percentage = total === 0 ? 0 : Math.round((completed / total) * 100);
    return { total, completed, percentage };
  }, [eventData?.tasks]);

  if (loading) {
    return (
      <UniversalLoader
        badge="Live Event Operations"
        text="Loading live event workspace..."
        subtext="Syncing event tasks, volunteer assignments, and real-time status board..."
      />
    );
  }

  if (error || !eventData) {
    return (
      <main className="min-h-screen bg-slate-50 dark:bg-slate-950 px-4 sm:px-6 py-12">
        <div className="mx-auto max-w-lg rounded-3xl border border-red-200 dark:border-red-900/60 bg-white dark:bg-slate-900 p-6 sm:p-8 text-center shadow-lg">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 dark:bg-red-950/50 text-2xl mb-4">
            ⚠️
          </div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Event Not Found</h2>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{error || "Unable to locate this event."}</p>
          <div className="mt-6">
            <Link
              href={`/club/${clubCode}`}
              className="inline-block rounded-xl bg-slate-900 dark:bg-slate-100 px-5 py-2.5 text-sm font-semibold text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-white transition"
            >
              Back to Club
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const startDateFormatted = new Date(eventData.start_time).toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const endDateFormatted = new Date(eventData.end_time).toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <main className="min-h-screen bg-[#F8FAFC] dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors duration-200">
      {/* Top Navbar */}
      <header className="sticky top-0 z-30 border-b border-slate-200/80 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md px-3 sm:px-8 py-2.5 sm:py-3.5">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-2">
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
              className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-1.5 sm:px-3.5 sm:py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
            >
              ← <span className="hidden sm:inline">Back to </span>Club
            </Link>
            <Link
              href="/dashboard"
              className="hidden sm:inline-flex rounded-xl bg-slate-100 dark:bg-slate-800 px-3.5 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition"
            >
              Dashboard
            </Link>
          </div>
        </div>
      </header>

      {/* Floating Real-Time SSE Notification Toast */}
      {realtimeToast && (
        <div className="fixed top-16 sm:top-20 left-3 right-3 sm:left-auto sm:right-6 z-50 sm:max-w-sm rounded-2xl border-2 border-emerald-400 dark:border-emerald-500 bg-white dark:bg-slate-900 p-4 shadow-2xl ring-4 ring-emerald-500/20 transition-all animate-bounce">
          <div className="flex items-start gap-3">
            <span className="text-2xl shrink-0">⚡</span>
            <div className="flex-1 min-w-0">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/70 px-2 py-0.5 rounded-md">
                Live Real-Time Sync
              </span>
              <h4 className="font-extrabold text-slate-900 dark:text-white text-sm mt-1 truncate">{realtimeToast.title}</h4>
              <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5 truncate">{realtimeToast.message}</p>
            </div>
            <button
              type="button"
              onClick={() => setRealtimeToast(null)}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 font-bold text-xs"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      <div className="mx-auto max-w-7xl px-3 sm:px-8 py-4 sm:py-8 pb-28 md:pb-8">
        {/* Dynamic Breadcrumbs */}
        <div className="mb-4 flex flex-wrap items-center gap-2 text-xs font-medium text-slate-400 dark:text-slate-500">
          <Link href="/dashboard" className="hover:text-slate-600 dark:hover:text-slate-300 transition">
            Dashboard
          </Link>
          <span>/</span>
          <Link href={`/club/${clubCode}`} className="hover:text-slate-600 dark:hover:text-slate-300 transition truncate max-w-[150px] sm:max-w-none">
            {eventData.club_name} ({clubCode})
          </Link>
          <span>/</span>
          <span className="font-bold text-indigo-600 dark:text-indigo-400 truncate max-w-[180px] sm:max-w-none">{eventData.name}</span>
        </div>

        {/* URGENT DEADLINE BANNER FOR VOLUNTEERS */}
        {urgentTasks.length > 0 && (
          <div className="mb-6 rounded-3xl border-2 border-rose-400 dark:border-rose-700/80 bg-gradient-to-r from-rose-50 via-amber-50 to-orange-50 dark:from-rose-950/60 dark:via-amber-950/40 dark:to-orange-950/40 p-4 sm:p-5 shadow-lg shadow-rose-500/10 ring-4 ring-rose-500/10">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-start gap-3.5">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-rose-600 text-white text-xl animate-pulse shadow-md">
                  ⏰
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-md bg-rose-600 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-white">
                      Action Required: Approaching Deadline
                    </span>
                    <span className="text-xs font-bold text-rose-700 dark:text-rose-300">
                      {urgentTasks.length} task{urgentTasks.length === 1 ? "" : "s"} due soon!
                    </span>
                  </div>
                  <h3 className="text-base font-extrabold text-slate-900 dark:text-white mt-1">
                    Complete your task: &ldquo;{urgentTasks[0].name}&rdquo;
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
                    Deadline:{" "}
                    <strong className="text-rose-700 dark:text-rose-300">
                      {new Date(urgentTasks[0].deadline!).toLocaleString()}
                    </strong>
                    . Please tick the checkbox once completed to notify the leader in real time.
                  </p>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                {notificationPerm !== "granted" ? (
                  <button
                    type="button"
                    onClick={requestNotificationPermission}
                    className="w-full sm:w-auto min-h-[44px] flex items-center justify-center rounded-xl bg-white dark:bg-slate-900 border border-rose-300 dark:border-rose-800 px-4 py-2.5 text-xs font-bold text-rose-700 dark:text-rose-300 shadow-2xs hover:bg-rose-50 dark:hover:bg-rose-950/50 transition"
                  >
                    🔔 Enable Push Alerts
                  </button>
                ) : (
                  <span className="min-h-[44px] flex items-center justify-center rounded-xl bg-white/80 dark:bg-slate-900/80 border border-emerald-200 dark:border-emerald-800 px-4 py-2 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                    ✓ Alerts Enabled
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => handleToggleTask(urgentTasks[0])}
                  disabled={togglingTaskId === urgentTasks[0].id}
                  className="w-full sm:w-auto min-h-[44px] flex items-center justify-center rounded-xl bg-rose-600 px-5 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-rose-500 active:scale-95 transition disabled:opacity-50"
                >
                  {togglingTaskId === urgentTasks[0].id ? "Saving..." : "✓ Mark as Completed"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* HERO EVENT CARD */}
        <div className="rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-6 md:p-8 shadow-[0_8px_30px_rgba(15,23,42,0.03)] mb-6 sm:mb-8">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="space-y-2 max-w-3xl min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`rounded-full px-2.5 py-0.5 text-[11px] font-extrabold uppercase tracking-wider ${
                    eventData.mode === "online"
                      ? "bg-sky-100 dark:bg-sky-950/70 text-sky-800 dark:text-sky-300"
                      : eventData.mode === "hybrid"
                      ? "bg-purple-100 dark:bg-purple-950/70 text-purple-800 dark:text-purple-300"
                      : "bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300"
                  }`}
                >
                  {eventData.mode === "online"
                    ? "🌐 Online Virtual"
                    : eventData.mode === "hybrid"
                    ? "⚡ Hybrid (Campus + Virtual)"
                    : "🏛️ In-Person Campus"}
                </span>

                <span
                  className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                    eventData.is_leader
                      ? "bg-indigo-100 dark:bg-indigo-950/70 text-indigo-800 dark:text-indigo-300"
                      : "bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300"
                  }`}
                >
                  {eventData.is_leader ? "👑 Club Leader" : "🤝 Volunteer"}
                </span>

                <span className="text-xs text-slate-400 dark:text-slate-500">
                  Created by <strong className="text-slate-700 dark:text-slate-300">{eventData.leader_name}</strong>
                </span>
              </div>

              <h1 className="text-xl sm:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white break-words">
                {eventData.name}
              </h1>

              {eventData.description && (
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed pt-1">
                  {eventData.description}
                </p>
              )}

              {/* Timing & Venue details */}
              <div className="flex flex-wrap items-center gap-y-2 gap-x-6 pt-3 text-xs text-slate-600 dark:text-slate-400 border-t border-slate-100 dark:border-slate-800/80">
                <div className="flex items-center gap-2">
                  <span className="text-base">📅</span>
                  <span>
                    <strong className="text-slate-800 dark:text-slate-200">Starts:</strong> {startDateFormatted}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-base">🏁</span>
                  <span>
                    <strong className="text-slate-800 dark:text-slate-200">Ends:</strong> {endDateFormatted}
                  </span>
                </div>
                {eventData.venue && (
                  <div className="flex items-center gap-2">
                    <span className="text-base">📍</span>
                    <span>
                      <strong className="text-slate-800 dark:text-slate-200">Venue:</strong> {eventData.venue}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Quick Metrics Badge */}
            <div className="rounded-2xl bg-gradient-to-br from-indigo-50/80 via-white to-violet-50/80 dark:from-indigo-950/40 dark:via-slate-900 dark:to-violet-950/40 border border-indigo-100 dark:border-indigo-900/60 p-4 sm:p-5 text-center w-full lg:w-auto lg:min-w-[240px] shadow-xs">
              <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-400 block mb-1">
                Real-Time Task Progress
              </span>
              <div className="text-3xl font-black text-indigo-950 dark:text-indigo-200">
                {taskMetrics.percentage}%
              </div>
              <div className="mt-2 h-2.5 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-indigo-600 to-emerald-500 transition-all duration-500"
                  style={{ width: `${taskMetrics.percentage}%` }}
                />
              </div>
              <div className="mt-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
                {taskMetrics.completed} of {taskMetrics.total} tasks completed
              </div>
            </div>
          </div>

          {/* Virtual Meeting Section (if online or hybrid) */}
          {eventData.mode !== "offline" && eventData.meeting_link && (
            <div className="mt-6 rounded-2xl bg-indigo-50/60 dark:bg-indigo-950/40 border border-indigo-200/70 dark:border-indigo-900/70 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white text-lg">
                  📹
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 dark:text-white text-sm">Official Event Video Meeting</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Connect with fellow volunteers and leaders directly via this room.
                  </p>
                  {eventData.meeting_code && (
                    <span className="inline-block text-[11px] font-mono text-indigo-800 dark:text-indigo-300 bg-white dark:bg-slate-900 px-2 py-0.5 rounded border border-indigo-200 dark:border-indigo-800 mt-1">
                      Room Code: <strong>{eventData.meeting_code}</strong>
                    </span>
                  )}
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(eventData.meeting_link!);
                    alert("Meeting link copied to clipboard!");
                  }}
                  className="w-full sm:w-auto min-h-[44px] flex items-center justify-center rounded-xl border border-indigo-200 dark:border-indigo-800 bg-white dark:bg-slate-900 px-3.5 py-2 text-xs font-semibold text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 transition"
                >
                  Copy Link
                </button>
                <a
                  href={eventData.meeting_link}
                  target="_blank"
                  rel="noreferrer"
                  className="w-full sm:w-auto min-h-[44px] flex items-center justify-center rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-indigo-500 transition"
                >
                  Join Meeting Now →
                </a>
              </div>
            </div>
          )}
        </div>

        {/* EVENT ANNOUNCEMENTS SECTION (LEADER BROADCASTS & MEMBER FEED) */}
        <div className="mb-6 sm:mb-8 rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-6 md:p-8 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800/80 pb-4 mb-6">
            <div>
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-600 text-white font-bold text-sm shadow-sm shadow-indigo-500/20">
                  📢
                </span>
                <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                  Event Announcements ({announcements.length})
                </h2>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Official briefings and live broadcasts from the Club Leader to all volunteers joined for this event.
              </p>
            </div>

            <div className="flex items-center gap-2">
              {eventData.is_leader ? (
                <span className="text-xs font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/60 px-3 py-1 rounded-full border border-indigo-200/70 dark:border-indigo-800/70">
                  👑 Leader Broadcast Mode
                </span>
              ) : (
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800 px-3 py-1 rounded-full border border-slate-200 dark:border-slate-700">
                  Joined Member View
                </span>
              )}
            </div>
          </div>

          {/* LEADER ONLY: BROADCAST COMPOSER FORM */}
          {eventData.is_leader && (
            <div className="rounded-2xl border border-indigo-200/80 dark:border-indigo-800/70 bg-indigo-50/30 dark:bg-indigo-950/20 p-4 sm:p-6 mb-6">
              <div className="flex items-center justify-between gap-2 mb-3">
                <span className="text-xs font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-300">
                  Post New Announcement to Joined Members
                </span>
                <span className="text-[11px] text-slate-400 dark:text-slate-500">
                  Visible to all volunteers
                </span>
              </div>

              {announcementError && (
                <div className="mb-3 rounded-xl border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/40 p-3 text-xs text-red-700 dark:text-red-400">
                  {announcementError}
                </div>
              )}

              {announcementSuccess && (
                <div className="mb-3 rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 p-3 text-xs text-emerald-700 dark:text-emerald-300">
                  ✓ {announcementSuccess}
                </div>
              )}

              <form onSubmit={handlePostAnnouncement} className="space-y-3">
                <div>
                  <input
                    type="text"
                    placeholder="Announcement Title (e.g. Schedule Update, Stage Briefing)"
                    value={announcementTitle}
                    onChange={(e) => setAnnouncementTitle(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2.5 text-sm font-semibold text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none"
                  />
                </div>

                <div>
                  <textarea
                    rows={3}
                    required
                    placeholder="Write your announcement message for all joined members and volunteers..."
                    value={announcementContent}
                    onChange={(e) => setAnnouncementContent(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2.5 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none leading-relaxed"
                  />
                </div>

                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={postingAnnouncement || !announcementContent.trim()}
                    className="rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-5 py-2.5 text-xs sm:text-sm font-bold text-white shadow-md shadow-indigo-500/20 hover:opacity-95 transition active:scale-98 disabled:opacity-50 min-h-[40px] flex items-center gap-2"
                  >
                    {postingAnnouncement ? (
                      <>
                        <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                        <span>Broadcasting...</span>
                      </>
                    ) : (
                      <>
                        <span>📢 Broadcast Announcement</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* ANNOUNCEMENTS LIST / FEED */}
          {announcementsLoading ? (
            <div className="py-8 text-center text-xs text-slate-400 dark:text-slate-500 flex flex-col items-center gap-2">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
              <span>Loading announcements...</span>
            </div>
          ) : announcements.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 py-10 px-4 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-50 dark:bg-slate-800/80 text-2xl mb-3">
                📭
              </div>
              <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                No Announcements Posted Yet
              </h4>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                {eventData.is_leader
                  ? "Use the composer above to share instructions, schedule updates, or urgent briefs with joined members."
                  : "The Club Leader has not posted any announcements for this event yet. Check back soon for live updates."}
              </p>
            </div>
          ) : (
            <div className="space-y-3.5">
              {announcements.map((a) => (
                <div
                  key={a.id}
                  className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 p-4 sm:p-5 hover:border-indigo-200 dark:hover:border-indigo-800 transition shadow-2xs"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-700/60 pb-2.5 mb-2.5">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-tr from-indigo-600 to-violet-600 text-white font-bold text-xs shadow-xs">
                        {a.author_name ? a.author_name.charAt(0) : "L"}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white truncate">
                            {a.author_name || eventData.leader_name}
                          </span>
                          <span className="rounded-md bg-indigo-100 dark:bg-indigo-900/60 px-1.5 py-0.2 text-[10px] font-bold text-indigo-800 dark:text-indigo-300">
                            👑 Club Leader
                          </span>
                        </div>
                      </div>
                    </div>

                    <span className="text-[11px] font-medium text-slate-400 dark:text-slate-500 whitespace-nowrap">
                      {new Date(a.created_at).toLocaleString([], {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>

                  <h3 className="font-bold text-sm sm:text-base text-slate-900 dark:text-white">
                    {a.title}
                  </h3>
                  <p className="mt-1 text-xs sm:text-sm text-slate-600 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
                    {a.content}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* SECTION 1: MY ASSIGNED TASKS (FOR VOLUNTEER & LEADER) */}
        <div className="mb-6 sm:mb-8 rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-6 md:p-8 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800/80 pb-4 mb-6">
            <div>
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 font-bold text-xs">
                  ✓
                </span>
                <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                  My Assigned Tasks ({eventData.user_tasks.length})
                </h2>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Tasks specifically assigned to you by the Club Leader. Tick the box when finished to sync in real time.
              </p>
            </div>

            {eventData.user_tasks.length > 0 && (
              <span className="self-start sm:self-auto text-xs font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 px-3 py-1 rounded-full border border-emerald-200 dark:border-emerald-800">
                {eventData.user_tasks.filter((t) => t.status === "completed").length} /{" "}
                {eventData.user_tasks.length} Completed
              </span>
            )}
          </div>

          {eventData.user_tasks.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 py-8 text-center text-sm text-slate-500 dark:text-slate-400">
              ✨ You currently have no tasks assigned to you for this event.
            </div>
          ) : (
            <div className="space-y-3">
              {eventData.user_tasks.map((task) => {
                const isDone = task.status === "completed";
                const isToggling = togglingTaskId === task.id;

                return (
                  <div
                    key={task.id}
                    className={`rounded-2xl border p-4 sm:p-5 transition flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                      isDone
                        ? "border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/30 dark:bg-emerald-950/20"
                        : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/60 hover:border-slate-300 dark:hover:border-slate-700 shadow-2xs"
                    }`}
                  >
                    <div className="flex items-start gap-3.5">
                      <button
                        type="button"
                        disabled={isToggling}
                        onClick={() => handleToggleTask(task)}
                        className={`flex h-10 w-10 min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-xl border-2 transition active:scale-90 ${
                          isDone
                            ? "border-emerald-600 bg-emerald-600 text-white shadow-xs"
                            : "border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-indigo-500 dark:hover:border-indigo-400 text-transparent"
                        }`}
                        title={isDone ? "Mark incomplete" : "Tick as completed"}
                      >
                        {isDone ? "✓" : ""}
                      </button>

                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3
                            className={`font-bold text-sm sm:text-base transition ${
                              isDone ? "line-through text-slate-400 dark:text-slate-500" : "text-slate-900 dark:text-white"
                            }`}
                          >
                            {task.name}
                          </h3>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider ${
                              isDone
                                ? "bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300"
                                : "bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300"
                            }`}
                          >
                            {isDone ? "Completed ✓" : "Pending"}
                          </span>
                        </div>

                        {task.description && (
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{task.description}</p>
                        )}

                        {task.deadline && (
                          <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                            <span>⏰ Deadline:</span>
                            <span
                              className={`font-semibold ${
                                isDone
                                  ? "text-slate-400 dark:text-slate-500"
                                  : new Date(task.deadline).getTime() - Date.now() < 86400000
                                  ? "text-rose-600 dark:text-rose-400 font-bold"
                                  : "text-slate-700 dark:text-slate-300"
                              }`}
                            >
                              {new Date(task.deadline).toLocaleString()}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={isToggling}
                      onClick={() => handleToggleTask(task)}
                      className={`w-full sm:w-auto min-h-[44px] flex items-center justify-center shrink-0 rounded-xl px-4 py-2 text-xs font-bold transition ${
                        isDone
                          ? "border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
                          : "bg-emerald-600 text-white hover:bg-emerald-500 shadow-xs active:scale-95"
                      }`}
                    >
                      {isToggling ? "Updating..." : isDone ? "Mark Incomplete" : "✓ Mark Done"}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* SECTION 2: ALL EVENT TASKS (VISIBLE ONLY TO CLUB LEADER FOR VOLUNTEER PRIVACY) */}
        {eventData.is_leader && (
          <div className="mb-6 sm:mb-8 rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-6 md:p-8 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800/80 pb-4 mb-6">
              <div>
                <div className="flex items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 font-bold text-xs">
                    📋
                  </span>
                  <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                    All Event Tasks ({eventData.tasks.length})
                  </h2>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Leader Workspace: Full roster of assigned responsibilities. Updates live via Server-Sent Events without refresh.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowAddTaskModal(true)}
                className="w-full sm:w-auto min-h-[44px] flex items-center justify-center rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:from-indigo-500 hover:to-violet-500 active:scale-95 transition"
              >
                + Assign New Task
              </button>
            </div>

            {eventData.tasks.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 py-8 text-center text-sm text-slate-500 dark:text-slate-400">
                No tasks have been created for this event yet.
              </div>
            ) : (
              <div className="space-y-3">
                {eventData.tasks.map((task) => {
                  const isDone = task.status === "completed";

                  return (
                    <div
                      key={task.id}
                      className={`rounded-2xl border p-4 sm:p-5 transition flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                        isDone
                          ? "border-slate-200 dark:border-slate-800/80 bg-slate-50/60 dark:bg-slate-800/30 opacity-80"
                          : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/60 shadow-2xs"
                      }`}
                    >
                      <div className="flex items-start gap-3.5">
                        <div
                          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl font-bold text-sm ${
                            isDone
                              ? "bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300"
                              : "bg-indigo-50 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 border border-indigo-100 dark:border-indigo-900/60"
                          }`}
                        >
                          {isDone ? "✓" : "⚡"}
                        </div>
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h4
                              className={`font-bold text-sm sm:text-base ${
                                isDone ? "line-through text-slate-400 dark:text-slate-500" : "text-slate-900 dark:text-white"
                              }`}
                            >
                              {task.name}
                            </h4>
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider ${
                                isDone
                                  ? "bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300"
                                  : "bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300"
                              }`}
                            >
                              {isDone ? "Completed" : "In Progress"}
                            </span>
                          </div>

                          {task.description && (
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{task.description}</p>
                          )}

                          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
                            <div className="flex items-center gap-1.5">
                              <span className="font-semibold text-slate-400 dark:text-slate-500">Assigned:</span>
                              {task.assigned_to_name ? (
                                <span className="font-bold text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">
                                  👤 {task.assigned_to_name}
                                </span>
                              ) : (
                                <span className="italic text-slate-400 dark:text-slate-500">Unassigned</span>
                              )}
                            </div>

                            {task.deadline && (
                              <div className="flex items-center gap-1.5">
                                <span className="font-semibold text-slate-400 dark:text-slate-500">Due:</span>
                                <span
                                  className={`font-semibold ${
                                    !isDone &&
                                    new Date(task.deadline).getTime() - Date.now() < 86400000
                                      ? "text-rose-600 dark:text-rose-400 font-bold"
                                      : "text-slate-700 dark:text-slate-300"
                                  }`}
                                >
                                  {new Date(task.deadline).toLocaleString()}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleToggleTask(task)}
                        className="self-start md:self-center rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition shrink-0"
                      >
                        {isDone ? "Reopen Task" : "Mark as Done"}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* SECTION 3: PARTICIPATING MEMBERS ROSTER */}
        <div className="rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-6 md:p-8 shadow-xs">
          <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800/80 pb-4 mb-6">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 font-bold text-xs">
              👥
            </span>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                Participating Roster ({eventData.participants.length})
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Club volunteers and leaders designated to run this event.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {eventData.participants.map((member) => {
              const activeTaskCount = eventData.tasks.filter(
                (t) => t.assigned_to === member.user_id && t.status !== "completed"
              ).length;

              return (
                <div
                  key={member.user_id}
                  className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/60 p-3.5 flex items-center justify-between gap-3 shadow-2xs"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-500 to-violet-500 text-white font-bold text-sm">
                      {member.full_name?.charAt(0) || "M"}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-slate-900 dark:text-white text-sm truncate">
                          {member.full_name}
                        </span>
                        {member.user_id === eventData.leader_id && (
                          <span className="shrink-0 rounded bg-indigo-100 dark:bg-indigo-950 text-indigo-800 dark:text-indigo-300 px-1.5 py-0.2 text-[9px] font-bold">
                            Leader
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-slate-500 dark:text-slate-400 truncate block">
                        {member.assigned_role || "Volunteer"}
                      </span>
                    </div>
                  </div>

                  {/* Availability Badge */}
                  {member.is_active === false ? (
                    <span
                      className="shrink-0 rounded-md px-2 py-0.5 text-[10px] font-bold bg-rose-50 dark:bg-rose-950/70 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900"
                      title={member.unavailable_reason ? `Reason: ${member.unavailable_reason}` : "Temporarily on leave"}
                    >
                      🔴 Away
                    </span>
                  ) : activeTaskCount > 0 ? (
                    <span className="shrink-0 rounded-md px-2 py-0.5 text-[10px] font-bold bg-amber-50 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-900">
                      🟡 1 Active Task
                    </span>
                  ) : (
                    <span className="shrink-0 rounded-md px-2 py-0.5 text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900">
                      🟢 Available
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* LEADER ADD TASK MODAL */}
      {showAddTaskModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 dark:bg-black/70 p-3 sm:p-4 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl sm:rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 sm:p-6 md:p-8 shadow-2xl space-y-4 sm:space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Assign New Task</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Assign a volunteer responsibility. Workload rule: 1 active task per volunteer.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAddTaskModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 font-bold"
              >
                ✕
              </button>
            </div>

            {addTaskError && (
              <div className="rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/50 p-3 text-xs font-semibold text-red-700 dark:text-red-300">
                ⚠️ {addTaskError}
              </div>
            )}

            <form onSubmit={handleCreateTask} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Task Title *
                </label>
                <input
                  type="text"
                  required
                  value={newTaskName}
                  onChange={(e) => setNewTaskName(e.target.value)}
                  placeholder="e.g. Photography, Sound check, Welcome desk"
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 py-2 text-sm text-slate-800 dark:text-slate-200 focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-800 focus:outline-none transition"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Assign To Volunteer
                </label>
                <select
                  value={newTaskAssignee}
                  onChange={(e) => setNewTaskAssignee(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs font-bold text-slate-800 dark:text-slate-200 focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-800 focus:outline-none transition"
                >
                  <option value="">-- Unassigned (Open for pickup) --</option>
                  {eventData.participants.map((p) => {
                    const hasActiveTask = eventData.tasks.some(
                      (t) => t.assigned_to === p.user_id && t.status !== "completed"
                    );
                    const isAway = p.is_active === false;

                    return (
                      <option key={p.user_id} value={p.user_id} disabled={isAway}>
                        {p.full_name} ({p.assigned_role || "Volunteer"}) {isAway ? "🔴 [Away / Deactivated]" : hasActiveTask ? "🟡 [1 Active Task]" : "🟢 [Available]"}
                      </option>
                    );
                  })}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Description / Deliverables
                </label>
                <textarea
                  rows={2}
                  value={newTaskDesc}
                  onChange={(e) => setNewTaskDesc(e.target.value)}
                  placeholder="Specific actions, files to prepare, or expectations..."
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs text-slate-800 dark:text-slate-200 focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-800 focus:outline-none transition"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Task Deadline
                </label>
                <input
                  type="datetime-local"
                  value={newTaskDeadline}
                  onChange={(e) => setNewTaskDeadline(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-800 dark:text-slate-200 focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-800 focus:outline-none transition"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddTaskModal(false)}
                  className="rounded-xl border border-slate-200 dark:border-slate-700 px-4 py-2.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 min-h-[44px]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addTaskLoading}
                  className="rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-indigo-500 transition disabled:opacity-50 min-h-[44px]"
                >
                  {addTaskLoading ? "Assigning..." : "Assign Task"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Persistent Mobile Bottom Navigation Bar */}
      <MobileBottomNav clubCode={clubCode} />
    </main>
  );
}
