"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

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

function Logo() {
  return (
    <Link href="/dashboard" className="flex items-center gap-3">
      <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-violet-500 text-white shadow-md shadow-indigo-500/20">
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
        <span className="text-[19px] font-bold tracking-tight text-slate-900">
          ClubOps <span className="bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent">AI</span>
        </span>
        <span className="block text-[10px] font-medium uppercase tracking-wider text-slate-400">
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
    } catch (err) {
      setError(err instanceof Error ? err.message : "Club not found.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadClub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clubCode]);

  // Real-time SSE listener for this club
  useEffect(() => {
    if (!club?.id || !club.is_leader) return;

    let eventSource: EventSource | null = null;
    try {
      eventSource = new EventSource(`/api/clubs/${club.id}/events`);

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
    } catch (err) {
      console.error("SSE stream error:", err);
    }

    // Auto-polling backup every 4s
    const pollInterval = setInterval(async () => {
      try {
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
    <main className="min-h-screen bg-[#F8FAFC]">
      {/* Top Navbar */}
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/95 backdrop-blur-md px-4 py-3.5 sm:px-8">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <Logo />

          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
            >
              ← My Dashboard
            </Link>

            <Link
              href="/joinClub"
              className="rounded-xl bg-indigo-50 border border-indigo-200/70 px-3.5 py-2 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 transition"
            >
              Join Another
            </Link>
          </div>
        </div>
      </header>

      {/* Main Dynamic View */}
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-8">
        {/* Real-time Floating Popup Notification */}
        {newRequestPopup && (
          <div className="fixed top-20 right-6 z-50 max-w-sm rounded-2xl border-2 border-indigo-400 bg-white p-4 shadow-2xl ring-4 ring-indigo-500/20 transition-all">
            <div className="flex items-start gap-3">
              <span className="text-2xl animate-bounce">🔔</span>
              <div className="flex-1">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md">
                  Live Volunteer Request!
                </span>
                <h4 className="font-extrabold text-slate-900 text-sm mt-1">
                  {newRequestPopup.name} wants to join!
                </h4>
                <p className="text-xs text-slate-500">{newRequestPopup.email}</p>
                {newRequestPopup.message && (
                  <p className="text-xs text-slate-600 italic mt-1.5 bg-slate-50 p-1.5 rounded-md border border-slate-100">
                    &ldquo;{newRequestPopup.message}&rdquo;
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setNewRequestPopup(null)}
                className="text-slate-400 hover:text-slate-600 font-bold text-xs"
              >
                ✕
              </button>
            </div>
          </div>
        )}
        {/* Dynamic Route Breadcrumb */}
        <div className="mb-4 flex items-center gap-2 text-xs font-medium text-slate-400">
          <Link href="/dashboard" className="hover:text-slate-600 transition">
            Dashboard
          </Link>
          <span>/</span>
          <span>Clubs</span>
          <span>/</span>
          <span className="font-bold text-indigo-600">{club.club_code}</span>
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
        <div className="rounded-3xl border border-slate-200/80 bg-white p-6 sm:p-8 shadow-[0_8px_30px_rgba(15,23,42,0.03)] mb-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-start gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-50 border border-indigo-100 text-3xl shadow-sm">
                {club.profile_image || "🏛️"}
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2.5">
                  <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
                    {club.name}
                  </h1>
                  <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600">
                    {club.location || "Campus"}
                  </span>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                      club.is_leader
                        ? "bg-indigo-100 text-indigo-800"
                        : "bg-emerald-100 text-emerald-800"
                    }`}
                  >
                    {club.is_leader ? "👑 Leader" : `🤝 ${club.user_role || "Member"}`}
                  </span>
                </div>
                <p className="mt-1 text-sm text-slate-500">
                  Led by <strong className="text-slate-700">{club.leader_name}</strong> • {club.member_count} active member{club.member_count === 1 ? "" : "s"}
                </p>
                {club.description && (
                  <p className="mt-2 text-sm text-slate-600 max-w-2xl">
                    {club.description}
                  </p>
                )}
              </div>
            </div>

            {/* Club Code Card */}
            <div className="rounded-2xl border-2 border-dashed border-indigo-200 bg-indigo-50/50 p-4 sm:p-5 text-center min-w-[240px]">
              <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-700">
                Official Club Code
              </span>
              <div className="mt-1 flex items-center justify-center gap-2">
                <span className="font-mono text-2xl font-black tracking-widest text-indigo-950">
                  {club.club_code}
                </span>
                <button
                  type="button"
                  onClick={copyCode}
                  className="rounded-lg bg-white px-2.5 py-1 text-xs font-bold text-indigo-600 border border-indigo-200 shadow-2xs hover:bg-indigo-50 active:scale-95 transition"
                >
                  {copied ? "Copied! ✓" : "Copy"}
                </button>
              </div>
              <span className="mt-1 block text-[11px] text-slate-400">
                Share with volunteers to invite them
              </span>
            </div>
          </div>

          {/* Defined Roles */}
          {club.roles && club.roles.length > 0 && (
            <div className="mt-6 border-t border-slate-100 pt-4 flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider mr-1">
                Defined Club Roles:
              </span>
              {club.roles.map((r) => (
                <span
                  key={r.id}
                  className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700"
                >
                  {r.role_name}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* LEADER SECTION: Pending Volunteer Join Requests */}
        {club.is_leader && (
          <div className="mb-8 rounded-3xl border border-amber-200/80 bg-amber-50/30 p-6 sm:p-8 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-100 text-amber-800 text-base">
                  📬
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900">
                    Pending Volunteer Join Requests
                  </h2>
                  <p className="text-xs text-slate-500">
                    Volunteers waiting for your approval. Assign an official role and accept them into the club.
                  </p>
                </div>
              </div>
              <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800">
                {club.pendingRequests?.length || 0} Pending
              </span>
            </div>

            {!club.pendingRequests || club.pendingRequests.length === 0 ? (
              <div className="rounded-2xl border border-slate-200/60 bg-white/70 py-8 text-center text-sm text-slate-500">
                ✨ No pending join requests right now. When volunteers enter code <strong>{club.club_code}</strong>, their applications will appear here.
              </div>
            ) : (
              <div className="space-y-4 mt-4">
                {club.pendingRequests.map((req) => (
                  <div
                    key={req.request_id}
                    className="rounded-2xl border border-amber-200 bg-white p-5 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-4"
                  >
                    <div className="flex items-start gap-3.5">
                      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-500 to-violet-500 text-sm font-bold text-white">
                        {req.full_name?.charAt(0) || "V"}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-slate-900 text-base">
                            {req.full_name}
                          </h3>
                          <span className="text-xs text-slate-400">
                            ({req.email})
                          </span>
                        </div>

                        {req.message && (
                          <p className="mt-1 text-xs italic text-slate-600 bg-slate-50 border border-slate-100 rounded-md p-2">
                            &ldquo;{req.message}&rdquo;
                          </p>
                        )}

                        {req.skills && req.skills.length > 0 && (
                          <div className="mt-2 flex flex-wrap items-center gap-1.5">
                            <span className="text-[11px] font-semibold text-slate-400">Skills:</span>
                            {req.skills.map((skill, sIdx) => (
                              <span
                                key={sIdx}
                                className="rounded bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold text-indigo-700 border border-indigo-100"
                              >
                                {skill}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Role assignment and actions */}
                    <div className="flex flex-wrap items-center gap-2.5 pt-3 lg:pt-0 border-t lg:border-t-0 border-slate-100">
                      <div className="flex items-center gap-1.5">
                        <label htmlFor={`dyn-role-select-${req.request_id}`} className="text-xs font-semibold text-slate-600 whitespace-nowrap">
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
                          className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-900 focus:border-indigo-500 focus:outline-none"
                        >
                          {club.roles?.map((r) => (
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
                        className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition disabled:opacity-50"
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
        <div className="rounded-3xl border border-slate-200/80 bg-white p-6 sm:p-8 shadow-[0_8px_30px_rgba(15,23,42,0.03)]">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-bold text-slate-900">
                Club Members &amp; Volunteers
              </h2>
              <p className="text-xs text-slate-500">
                All leaders and volunteers assigned to {club.name}.
              </p>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">
              {club.members?.length || 0} Members
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-xs font-semibold uppercase tracking-wider text-slate-400">
                  <th className="pb-3 pr-4">Member</th>
                  <th className="pb-3 px-4">Role Type</th>
                  <th className="pb-3 px-4">Assigned Role</th>
                  <th className="pb-3 px-4">Skills</th>
                  <th className="pb-3 pl-4">Joined</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {club.members?.map((m) => (
                  <tr key={m.membership_id} className="hover:bg-slate-50/60 transition">
                    <td className="py-3.5 pr-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 font-bold text-slate-700 text-xs">
                          {m.full_name?.charAt(0) || "U"}
                        </div>
                        <div>
                          <span className="font-bold text-slate-900 block">
                            {m.full_name}
                          </span>
                          <span className="text-xs text-slate-400 block">
                            {m.email}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`rounded-md px-2 py-0.5 text-xs font-bold ${
                          m.role_type === "leader"
                            ? "bg-indigo-100 text-indigo-800"
                            : "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {m.role_type === "leader" ? "👑 Leader" : "Volunteer"}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="font-semibold text-slate-800 text-xs">
                        {m.assigned_role || "Volunteer"}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex flex-wrap gap-1 max-w-xs">
                        {m.skills && m.skills.length > 0 ? (
                          m.skills.map((s, idx) => (
                            <span
                              key={idx}
                              className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600"
                            >
                              {s}
                            </span>
                          ))
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </div>
                    </td>
                    <td className="py-3.5 pl-4 text-xs text-slate-500 whitespace-nowrap">
                      {m.joined_at ? new Date(m.joined_at).toLocaleDateString() : "Recently"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </main>
  );
}
