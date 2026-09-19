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
  member_count: number;
  members: Member[];
  roles: ClubRole[];
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

export default function ClubMembersPage({
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
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");

  useEffect(() => {
    async function fetchClub() {
      try {
        setLoading(true);
        setError("");
        const res = await fetch(`/api/clubs/by-code/${clubCode}`);
        if (res.status === 401) {
          router.push(`/signin?redirect=/club/${clubCode}/members`);
          return;
        }

        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.message || "Failed to load club.");
        }

        setClub(data.club);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error loading club.");
      } finally {
        setLoading(false);
      }
    }

    if (clubCode) {
      fetchClub();
    }
  }, [clubCode, router]);

  const filteredMembers = useMemo(() => {
    if (!club?.members) return [];
    return club.members.filter((m) => {
      const matchesRole =
        roleFilter === "all" ||
        (roleFilter === "leader" && m.role_type === "leader") ||
        (roleFilter === "volunteer" && m.role_type === "volunteer") ||
        m.assigned_role?.toLowerCase() === roleFilter.toLowerCase();

      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        m.full_name.toLowerCase().includes(q) ||
        m.email.toLowerCase().includes(q) ||
        (m.assigned_role && m.assigned_role.toLowerCase().includes(q)) ||
        (m.skills && m.skills.some((s) => s.toLowerCase().includes(q)));

      return matchesRole && matchesSearch;
    });
  }, [club?.members, roleFilter, searchQuery]);

  if (loading) {
    return (
      <UniversalLoader
        badge="Club Directory"
        text="Loading club member roster..."
        subtext="Verifying leader credentials and fetching volunteer profiles..."
      />
    );
  }

  if (error || !club) {
    return (
      <main className="min-h-screen bg-slate-50 dark:bg-slate-950 px-6 py-12">
        <div className="mx-auto max-w-lg rounded-3xl border border-red-200 dark:border-red-900 bg-white dark:bg-slate-900 p-8 text-center shadow-lg">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 dark:bg-red-950/60 text-2xl mb-4">
            ⚠️
          </div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Club Not Found</h2>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{error || "Unable to load club."}</p>
          <div className="mt-6">
            <Link
              href="/dashboard"
              className="inline-block rounded-xl bg-slate-900 dark:bg-white px-5 py-2.5 text-sm font-semibold text-white dark:text-slate-900"
            >
              Back to Dashboard
            </Link>
          </div>
        </div>
      </main>
    );
  }

  // Strictly enforce Club Leader access
  if (!club.is_leader) {
    return (
      <main className="min-h-screen bg-[#F8FAFC] dark:bg-[#090D16] px-4 py-12 flex items-center justify-center">
        <div className="mx-auto max-w-md rounded-3xl border border-amber-200 dark:border-amber-900/60 bg-white dark:bg-slate-900 p-8 text-center shadow-xl">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-50 dark:bg-amber-950/60 text-3xl mb-4">
            🔒
          </div>
          <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white">
            Leader Access Only
          </h2>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
            The full member roster and volunteer management directory for <strong>{club.name}</strong> is restricted to the official Club Leader.
          </p>
          <div className="mt-6 flex flex-col sm:flex-row gap-2 justify-center">
            <Link
              href={`/club/${club.club_code}`}
              className="rounded-xl bg-indigo-600 px-5 py-2.5 text-xs sm:text-sm font-bold text-white hover:bg-indigo-500 transition"
            >
              Open Club Workspace
            </Link>
            <Link
              href="/dashboard"
              className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-5 py-2.5 text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 transition"
            >
              Dashboard
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#F8FAFC] dark:bg-[#090D16] transition-colors duration-200">
      {/* Top Header */}
      <header className="sticky top-0 z-30 border-b border-slate-200/80 dark:border-slate-800 bg-white/95 dark:bg-[#090D16]/95 backdrop-blur-md px-3 sm:px-8 py-2.5 sm:py-3 transition-colors duration-200">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-2">
          <Logo />

          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Link
              href={`/club/${club.club_code}`}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:border-slate-300 dark:hover:border-slate-700 transition"
            >
              ← Club Space
            </Link>
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200/70 dark:border-indigo-800/60 px-3 py-1.5 text-xs font-semibold text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 transition"
            >
              Dashboard
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="mx-auto max-w-7xl px-3 sm:px-8 py-6 sm:py-8 pb-28 md:pb-8">
        {/* Breadcrumb */}
        <div className="mb-4 flex items-center gap-2 text-xs font-medium text-slate-400 dark:text-slate-500">
          <Link href="/dashboard" className="hover:text-slate-600 dark:hover:text-slate-300 transition">
            Dashboard
          </Link>
          <span>/</span>
          <Link href={`/club/${club.club_code}`} className="hover:text-slate-600 dark:hover:text-slate-300 transition">
            {club.name}
          </Link>
          <span>/</span>
          <span className="font-bold text-indigo-600 dark:text-indigo-400">Members &amp; Volunteers</span>
        </div>

        {/* Page Banner Header */}
        <div className="mb-6 sm:mb-8 rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-8 shadow-xs">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 sm:h-16 sm:w-16 shrink-0 items-center justify-center rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-100 dark:border-indigo-800 text-3xl sm:text-4xl shadow-xs">
                {club.profile_image || "🏛️"}
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                    {club.name} Members Roster
                  </h1>
                  <span className="rounded-md bg-indigo-100 dark:bg-indigo-900/60 px-2 py-0.5 font-mono text-xs font-bold text-indigo-800 dark:text-indigo-300">
                    {club.club_code}
                  </span>
                  <span className="rounded-full bg-gradient-to-r from-indigo-600 to-violet-600 text-white px-2.5 py-0.5 text-[11px] font-bold shadow-xs">
                    👑 Club Leader Portal
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
                  Manage assigned volunteer roles, inspect member skill sets, and coordinate leadership.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 px-4 py-2 text-xs font-bold text-indigo-700 dark:text-indigo-300">
                👥 Total Members: {club.members?.length || 0}
              </span>
            </div>
          </div>

          {/* Search & Filter Bar */}
          <div className="mt-6 pt-5 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row gap-3 items-center justify-between">
            <div className="w-full sm:max-w-xs">
              <input
                type="text"
                placeholder="Search by name, email, or skill..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/60 px-3.5 py-2 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
              <button
                type="button"
                onClick={() => setRoleFilter("all")}
                className={`rounded-xl px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition ${
                  roleFilter === "all"
                    ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200"
                }`}
              >
                All ({club.members?.length || 0})
              </button>
              <button
                type="button"
                onClick={() => setRoleFilter("leader")}
                className={`rounded-xl px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition ${
                  roleFilter === "leader"
                    ? "bg-indigo-600 text-white font-bold"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200"
                }`}
              >
                👑 Leaders
              </button>
              <button
                type="button"
                onClick={() => setRoleFilter("volunteer")}
                className={`rounded-xl px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition ${
                  roleFilter === "volunteer"
                    ? "bg-indigo-600 text-white font-bold"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200"
                }`}
              >
                🤝 Volunteers
              </button>
            </div>
          </div>
        </div>

        {/* Member Directory Table & Cards */}
        <div className="rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-8 shadow-xs">
          {filteredMembers.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">
                No members found matching your search criteria.
              </p>
            </div>
          ) : (
            <>
              {/* Mobile Cards View */}
              <div className="md:hidden space-y-3">
                {filteredMembers.map((m) => (
                  <div
                    key={m.membership_id}
                    className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 p-4 space-y-2.5 shadow-2xs"
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
                        Role: <strong className="text-slate-800 dark:text-slate-200">{m.assigned_role || "Volunteer"}</strong>
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
                      <th className="pb-3 px-4">Skills &amp; Capabilities</th>
                      <th className="pb-3 pl-4">Joined Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredMembers.map((m) => (
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
            </>
          )}
        </div>
      </div>
      <MobileBottomNav clubCode={club.club_code} />
    </main>
  );
}
