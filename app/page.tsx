"use client";

import { useState } from "react";
import Link from "next/link";
import { ThemeToggle } from "./components/ThemeToggle";

export default function Home() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#090D16] text-slate-900 dark:text-white selection:bg-indigo-500 selection:text-white relative overflow-hidden font-sans transition-colors duration-200">
      {/* Background Glow Elements */}
      <div className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 w-[900px] h-[500px] bg-gradient-to-tr from-indigo-400/20 via-violet-400/15 to-purple-500/10 dark:from-indigo-600/25 dark:via-violet-600/20 dark:to-purple-800/10 blur-[130px] rounded-full" />
      <div className="pointer-events-none absolute top-1/2 -right-40 w-[600px] h-[400px] bg-indigo-500/10 dark:bg-indigo-500/10 blur-[120px] rounded-full" />

      {/* Navigation */}
      <header className="relative z-30 border-b border-slate-200/80 dark:border-white/10 bg-white/80 dark:bg-[#090D16]/80 backdrop-blur-md px-4 py-3.5 sm:px-8 sm:py-4.5">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 sm:gap-3 group">
            <div className="flex h-10 w-10 sm:h-11 sm:w-11 items-center justify-center rounded-2xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-violet-600 text-white shadow-md shadow-indigo-500/20 group-hover:scale-105 transition-transform">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" fill="currentColor" />
              </svg>
            </div>
            <div>
              <span className="text-lg sm:text-xl font-black tracking-tight text-slate-900 dark:text-white">
                ClubOps <span className="bg-gradient-to-r from-indigo-600 to-violet-600 dark:from-indigo-400 dark:to-violet-400 bg-clip-text text-transparent">AI</span>
              </span>
              <span className="hidden sm:block text-[10px] font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">
                Centralized Operations Platform
              </span>
            </div>
          </Link>

          {/* Desktop Right Links */}
          <div className="hidden md:flex items-center gap-3">
            <ThemeToggle showLabel />
            <Link
              href="/signin"
              className="rounded-xl px-3.5 py-2 text-sm font-semibold text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white transition"
            >
              Sign In
            </Link>
            <Link
              href="/signup"
              className="rounded-xl border border-slate-200 bg-white hover:bg-slate-50 dark:border-white/10 dark:bg-white/10 dark:hover:bg-white/15 px-3.5 py-2 text-sm font-semibold text-slate-800 dark:text-white transition shadow-2xs"
            >
              Register
            </Link>
            <Link
              href="/dashboard"
              className="rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-4.5 py-2 text-sm font-bold text-white shadow-md shadow-indigo-500/25 hover:opacity-95 transition active:scale-95"
            >
              Dashboard →
            </Link>
          </div>

          {/* Mobile Action Row */}
          <div className="flex md:hidden items-center gap-2">
            <ThemeToggle />
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 p-2 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              aria-label="Toggle mobile menu"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                {mobileMenuOpen ? (
                  <path d="M18 6L6 18M6 6l12 12" />
                ) : (
                  <path d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile Dropdown Drawer */}
        {mobileMenuOpen && (
          <div className="md:hidden mt-3 pt-3 border-t border-slate-200 dark:border-slate-800 space-y-2 animate-in fade-in slide-in-from-top-2">
            <Link
              href="/signin"
              onClick={() => setMobileMenuOpen(false)}
              className="block w-full rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              Sign In
            </Link>
            <Link
              href="/signup"
              onClick={() => setMobileMenuOpen(false)}
              className="block w-full rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              Register
            </Link>
            <Link
              href="/dashboard"
              onClick={() => setMobileMenuOpen(false)}
              className="block w-full text-center rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 py-3 text-sm font-bold text-white shadow-sm"
            >
              Go to Dashboard →
            </Link>
          </div>
        )}
      </header>

      {/* Hero Section */}
      <main className="relative z-10 mx-auto max-w-6xl px-4 pt-12 pb-20 sm:px-6 sm:pt-24 sm:pb-28 text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-indigo-200 dark:border-indigo-500/30 bg-indigo-50/80 dark:bg-indigo-500/10 px-3.5 py-1.5 text-xs font-semibold text-indigo-700 dark:text-indigo-300 backdrop-blur-md mb-6 sm:mb-8">
          <span className="flex h-2 w-2 rounded-full bg-indigo-500 animate-pulse" />
          Centralized AI-Powered Event Operations for College Clubs
        </div>

        <h1 className="text-3xl sm:text-5xl md:text-7xl font-black tracking-tight text-slate-900 dark:text-white max-w-4xl mx-auto leading-[1.15]">
          Run your club with <br className="hidden sm:inline" />
          <span className="bg-gradient-to-r from-indigo-600 via-violet-600 to-purple-600 dark:from-indigo-400 dark:via-violet-300 dark:to-purple-400 bg-clip-text text-transparent">
            Unstoppable Operations
          </span>
        </h1>

        <p className="mt-4 sm:mt-6 text-base sm:text-xl text-slate-600 dark:text-slate-400 max-w-2xl mx-auto leading-relaxed px-2">
          Create your club space in seconds with a single invite code, manage volunteer roles, streamline event coordination, and prevent member overload with AI.
        </p>

        {/* Action Buttons */}
        <div className="mt-8 sm:mt-10 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 max-w-md sm:max-w-none mx-auto">
          <Link
            href="/createClub"
            className="w-full sm:w-auto rounded-2xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-violet-600 px-7 py-3.5 sm:px-8 sm:py-4 text-sm sm:text-base font-bold text-white shadow-xl shadow-indigo-500/25 hover:opacity-95 transition active:scale-98"
          >
            Create a Club (Leader) →
          </Link>
          <Link
            href="/joinClub"
            className="w-full sm:w-auto rounded-2xl border border-slate-200 dark:border-white/20 bg-white/80 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 px-7 py-3.5 sm:px-8 sm:py-4 text-sm sm:text-base font-bold text-slate-800 dark:text-white backdrop-blur-md transition active:scale-98 shadow-2xs"
          >
            Join with Club Code (Volunteer)
          </Link>
        </div>

        {/* 3 Core Workflow Pillars */}
        <div className="mt-16 sm:mt-24 grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 text-left">
          <div className="rounded-3xl border border-slate-200/80 dark:border-white/10 bg-white/90 dark:bg-white/[0.03] p-6 sm:p-7 backdrop-blur-md shadow-xs hover:border-indigo-500/40 transition">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 dark:bg-indigo-500/10 text-2xl border border-indigo-100 dark:border-indigo-500/20 mb-4 sm:mb-5">
              🔑
            </div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
              Instant Club ID System
            </h3>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              Auto-generates a unique 6-digit Club ID upon creation. Volunteers enter the code to request entry without manual admin hassle.
            </p>
          </div>

          <div className="rounded-3xl border border-slate-200/80 dark:border-white/10 bg-white/90 dark:bg-white/[0.03] p-6 sm:p-7 backdrop-blur-md shadow-xs hover:border-indigo-500/40 transition">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-50 dark:bg-violet-500/10 text-2xl border border-violet-100 dark:border-violet-500/20 mb-4 sm:mb-5">
              👑
            </div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
              Leader Role Assignment
            </h3>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              Leaders define custom roles (e.g. Technical, Logistics, PR) and review incoming volunteer requests directly from the dashboard.
            </p>
          </div>

          <div className="rounded-3xl border border-slate-200/80 dark:border-white/10 bg-white/90 dark:bg-white/[0.03] p-6 sm:p-7 backdrop-blur-md shadow-xs hover:border-indigo-500/40 transition">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-purple-50 dark:bg-purple-500/10 text-2xl border border-purple-100 dark:border-purple-500/20 mb-4 sm:mb-5">
              ⚡
            </div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
              AI Operations Engine
            </h3>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              Smart task matching based on volunteer skills, meeting audio transcription, and draft-to-announcement generators.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
