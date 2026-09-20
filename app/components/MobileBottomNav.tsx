"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

export default function MobileBottomNav({ clubCode }: { clubCode?: string }) {
  const pathname = usePathname();
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Hide on signin and signup pages
  if (pathname === "/signin" || pathname === "/signup") {
    return null;
  }

  const isDark = resolvedTheme === "dark";

  const toggleTheme = () => {
    setTheme(isDark ? "light" : "dark");
  };

  const isDashboardActive = pathname === "/dashboard";
  const isProfileActive = pathname === "/profile";
  const isClubActive = pathname.startsWith("/club/");
  const isCreateOrJoinActive = pathname === "/createClub" || pathname === "/joinClub";

  return (
    <nav
      aria-label="Mobile Navigation"
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-[#E2DDD0] dark:border-[#283422] bg-[#F6F4EE]/95 dark:bg-[#121810]/95 backdrop-blur-lg px-2 py-1.5 pb-[max(0.375rem,env(safe-area-inset-bottom))] shadow-[0_-4px_20px_rgba(0,0,0,0.05)] dark:shadow-[0_-4px_20px_rgba(0,0,0,0.4)] transition-colors duration-200"
    >
      <div className="mx-auto flex max-w-md items-center justify-around">
        {/* 1. Dashboard */}
        <Link
          href="/dashboard"
          className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl transition active:scale-95 ${
            isDashboardActive
              ? "text-indigo-600 dark:text-indigo-400 font-bold"
              : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
          }`}
        >
          <span className="text-lg leading-none mb-0.5">
            {isDashboardActive ? "🏠" : "🏡"}
          </span>
          <span className="text-[10px] tracking-tight">Dashboard</span>
        </Link>

        {/* 2. Club Workspace (or Join if no club) */}
        <Link
          href={clubCode ? `/club/${clubCode}` : "/dashboard"}
          className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl transition active:scale-95 ${
            isClubActive
              ? "text-indigo-600 dark:text-indigo-400 font-bold"
              : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
          }`}
        >
          <span className="text-lg leading-none mb-0.5">
            {isClubActive ? "🏛️" : "🎪"}
          </span>
          <span className="text-[10px] tracking-tight">Club Space</span>
        </Link>

        {/* 3. Action Center: Create or Join */}
        <Link
          href="/createClub"
          className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl transition active:scale-95 ${
            isCreateOrJoinActive
              ? "text-indigo-600 dark:text-indigo-400 font-bold"
              : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
          }`}
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-600 text-white font-bold text-base shadow-sm -mt-2">
            +
          </span>
          <span className="text-[10px] tracking-tight mt-0.5">New Club</span>
        </Link>

        {/* 4. Profile & Skillet */}
        <Link
          href="/profile"
          className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl transition active:scale-95 ${
            isProfileActive
              ? "text-indigo-600 dark:text-indigo-400 font-bold"
              : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
          }`}
        >
          <span className="text-lg leading-none mb-0.5">
            {isProfileActive ? "👤" : "🪪"}
          </span>
          <span className="text-[10px] tracking-tight">Profile</span>
        </Link>

        {/* 5. Theme Toggle Button */}
        {mounted ? (
          <button
            type="button"
            onClick={toggleTheme}
            aria-label="Switch Theme"
            className="flex flex-col items-center justify-center py-1 px-3 rounded-xl text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition active:scale-95"
          >
            <span className="text-lg leading-none mb-0.5">
              {isDark ? "🌙" : "☀️"}
            </span>
            <span className="text-[10px] tracking-tight">
              {isDark ? "Dark" : "Light"}
            </span>
          </button>
        ) : (
          <div className="flex flex-col items-center justify-center py-1 px-3 opacity-0">
            <span className="text-lg leading-none mb-0.5">🌓</span>
            <span className="text-[10px] tracking-tight">Theme</span>
          </div>
        )}
      </div>
    </nav>
  );
}
