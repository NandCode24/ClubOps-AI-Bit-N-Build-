import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-[#090D16] text-white selection:bg-indigo-500 selection:text-white relative overflow-hidden font-sans">
      {/* Background Glow Elements */}
      <div className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 w-[900px] h-[500px] bg-gradient-to-tr from-indigo-600/25 via-violet-600/20 to-purple-800/10 blur-[130px] rounded-full" />
      <div className="pointer-events-none absolute top-1/2 -right-40 w-[600px] h-[400px] bg-indigo-500/10 blur-[120px] rounded-full" />

      {/* Navigation */}
      <header className="relative z-20 border-b border-white/10 backdrop-blur-md px-6 py-4.5 sm:px-12">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-tr from-indigo-500 via-indigo-600 to-violet-600 text-white shadow-lg shadow-indigo-500/30">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" fill="currentColor" />
              </svg>
            </div>
            <div>
              <span className="text-xl font-black tracking-tight text-white">
                ClubOps <span className="bg-gradient-to-r from-indigo-400 to-violet-400 bg-clip-text text-transparent">AI</span>
              </span>
              <span className="block text-[10px] font-semibold uppercase tracking-widest text-slate-400">
                Centralized Operations Platform
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 sm:gap-4">
            <Link
              href="/signin"
              className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-300 hover:text-white transition"
            >
              Sign In
            </Link>
            <Link
              href="/signup"
              className="rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 px-4 py-2 text-sm font-semibold text-white transition"
            >
              Register
            </Link>
            <Link
              href="/dashboard"
              className="rounded-xl bg-gradient-to-r from-indigo-500 via-indigo-600 to-violet-600 px-4.5 py-2 text-sm font-bold text-white shadow-md shadow-indigo-500/25 hover:opacity-95 transition active:scale-95"
            >
              Dashboard →
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="relative z-10 mx-auto max-w-6xl px-6 pt-20 pb-28 sm:pt-28 text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-4 py-1.5 text-xs font-semibold text-indigo-300 backdrop-blur-md mb-8">
          <span className="flex h-2 w-2 rounded-full bg-indigo-400 animate-pulse" />
          Centralized AI-Powered Event Operations for College Clubs
        </div>

        <h1 className="text-4xl sm:text-6xl md:text-7xl font-extrabold tracking-tight text-white max-w-4xl mx-auto leading-[1.12]">
          Run your club with <br className="hidden sm:inline" />
          <span className="bg-gradient-to-r from-indigo-400 via-violet-300 to-purple-400 bg-clip-text text-transparent">
            Unstoppable Operations
          </span>
        </h1>

        <p className="mt-6 text-lg sm:text-xl text-slate-400 max-w-2xl mx-auto leading-relaxed">
          Create your club space in seconds with a single invite code, manage volunteer roles, streamline event coordination, and prevent member overload with AI.
        </p>

        {/* Action Buttons */}
        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href="/createClub"
            className="w-full sm:w-auto rounded-2xl bg-gradient-to-r from-indigo-500 via-indigo-600 to-violet-600 px-8 py-4 text-base font-bold text-white shadow-xl shadow-indigo-500/25 hover:opacity-95 transition active:scale-98"
          >
            Create a Club (Leader) →
          </Link>
          <Link
            href="/joinClub"
            className="w-full sm:w-auto rounded-2xl border border-white/20 bg-white/5 hover:bg-white/10 px-8 py-4 text-base font-bold text-white backdrop-blur-md transition active:scale-98"
          >
            Join with Club Code (Volunteer)
          </Link>
        </div>

        {/* 3 Core Workflow Pillars */}
        <div className="mt-24 grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-7 backdrop-blur-md hover:border-indigo-500/40 transition">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-500/10 text-2xl border border-indigo-500/20 mb-5">
              🔑
            </div>
            <h3 className="text-lg font-bold text-white">
              Instant Club ID System
            </h3>
            <p className="mt-2 text-sm text-slate-400 leading-relaxed">
              Auto-generates a unique 6-digit Club ID upon creation. Volunteers enter the code to request entry without manual admin hassle.
            </p>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-7 backdrop-blur-md hover:border-indigo-500/40 transition">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-500/10 text-2xl border border-violet-500/20 mb-5">
              👑
            </div>
            <h3 className="text-lg font-bold text-white">
              Leader Role Assignment
            </h3>
            <p className="mt-2 text-sm text-slate-400 leading-relaxed">
              Leaders define custom roles (e.g. Technical, Logistics, PR) and review incoming volunteer requests directly from the dashboard.
            </p>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-7 backdrop-blur-md hover:border-indigo-500/40 transition">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-purple-500/10 text-2xl border border-purple-500/20 mb-5">
              ⚡
            </div>
            <h3 className="text-lg font-bold text-white">
              AI Operations Engine
            </h3>
            <p className="mt-2 text-sm text-slate-400 leading-relaxed">
              Smart task matching based on volunteer skills, meeting audio transcription, and draft-to-announcement generators.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
