"use client";

import React from "react";

interface UniversalLoaderProps {
  /** Main title message (e.g. "Signing in...", "Loading your club space...") */
  text?: string;
  /** Explanatory subtext below the title */
  subtext?: string;
  /** Whether to render as a fixed full-screen modal overlay that blocks view and clicks */
  fullscreen?: boolean;
  /** Whether to apply background blur */
  blur?: boolean;
  /** Optional badge label above the title */
  badge?: string;
  /** Compact inline display instead of card */
  inline?: boolean;
}

export default function UniversalLoader({
  text = "Loading...",
  subtext = "Please wait a moment while we process your request",
  fullscreen = false,
  blur = true,
  badge = "ClubOps AI",
  inline = false,
}: UniversalLoaderProps) {
  const spinnerElement = (
    <div className="relative flex items-center justify-center">
      {/* Ambient Pulsing Glow Orb */}
      <div className="absolute -inset-4 rounded-full bg-gradient-to-tr from-indigo-600/40 via-violet-600/30 to-cyan-500/40 blur-xl animate-pulse-glow" />

      {/* Outer Ring - Clockwise Gradient Rotation */}
      <div className="relative h-20 w-20 sm:h-24 sm:w-24 rounded-full border-[3px] border-transparent border-t-indigo-600 border-r-violet-500 border-b-cyan-400 dark:border-t-indigo-400 dark:border-r-violet-400 dark:border-b-cyan-300 animate-spin" />

      {/* Orbiting Satellite Sparkle */}
      <div className="absolute h-20 w-20 sm:h-24 sm:w-24 animate-spin">
        <div className="absolute -top-1 left-1/2 -translate-x-1/2 h-2.5 w-2.5 rounded-full bg-cyan-400 shadow-[0_0_10px_#22d3ee]" />
      </div>

      {/* Middle Ring - Counter-Clockwise Dashed Rotation */}
      <div className="absolute h-14 w-14 sm:h-16 sm:w-16 rounded-full border-[2.5px] border-dashed border-indigo-500/70 dark:border-indigo-400/80 animate-spin-reverse" />

      {/* Center Core - Pulsing ClubOps Star Badge */}
      <div className="absolute flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-violet-500 text-white shadow-md shadow-indigo-500/30 animate-pulse">
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
    </div>
  );

  if (inline) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-6 text-center">
        {spinnerElement}
        <div className="space-y-1">
          <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{text}</p>
          {subtext && (
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs">{subtext}</p>
          )}
        </div>
      </div>
    );
  }

  const contentCard = (
    <div className="relative overflow-hidden rounded-3xl border border-white/60 dark:border-slate-800/80 bg-white/95 dark:bg-slate-900/95 p-7 sm:p-9 shadow-2xl shadow-indigo-500/10 backdrop-blur-2xl max-w-sm w-full mx-auto flex flex-col items-center text-center animate-float-gentle">
      {/* Top subtle highlight gradient */}
      <div className="absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-indigo-500/50 to-transparent" />

      {/* Brand Pill */}
      {badge && (
        <span className="mb-5 inline-flex items-center gap-1.5 rounded-full bg-indigo-50 dark:bg-indigo-950/70 border border-indigo-200/70 dark:border-indigo-800/70 px-3 py-1 text-[11px] font-semibold text-indigo-700 dark:text-indigo-300">
          <span className="h-1.5 w-1.5 rounded-full bg-indigo-600 dark:bg-indigo-400 animate-ping" />
          {badge}
        </span>
      )}

      {/* Animated Concentric Rings & Emblem */}
      <div className="my-2">{spinnerElement}</div>

      {/* Title */}
      <h3 className="mt-5 text-lg sm:text-xl font-extrabold tracking-tight text-slate-900 dark:text-white">
        {text}
      </h3>

      {/* Subtext */}
      {subtext && (
        <p className="mt-2 text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed max-w-[280px]">
          {subtext}
        </p>
      )}

      {/* Shimmering Progress Bar */}
      <div className="relative mt-5 h-1.5 w-44 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
        <div className="h-full w-24 rounded-full bg-gradient-to-r from-indigo-500 via-violet-500 to-cyan-400 animate-shimmer-sweep" />
      </div>

      {/* Activity Dots Indicator */}
      <div className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-indigo-600 dark:text-indigo-400">
        <span className="h-1.5 w-1.5 rounded-full bg-indigo-500 animate-bounce" style={{ animationDelay: "0ms" }} />
        <span className="h-1.5 w-1.5 rounded-full bg-indigo-500 animate-bounce" style={{ animationDelay: "150ms" }} />
        <span className="h-1.5 w-1.5 rounded-full bg-indigo-500 animate-bounce" style={{ animationDelay: "300ms" }} />
      </div>
    </div>
  );

  if (fullscreen) {
    return (
      <div
        role="status"
        aria-live="polite"
        className={`fixed inset-0 z-50 flex items-center justify-center p-4 transition-all duration-300 pointer-events-auto select-none ${
          blur
            ? "backdrop-blur-md bg-slate-900/60 dark:bg-[#030712]/80"
            : "bg-slate-900/40 dark:bg-[#030712]/60"
        }`}
      >
        {contentCard}
      </div>
    );
  }

  // Full page layout mode for initial page loading
  return (
    <main className="relative flex min-h-screen items-center justify-center bg-[#F8FAFC] dark:bg-[#090D16] p-4 overflow-hidden transition-colors duration-200">
      {/* Ambient background glowing accents */}
      <div className="pointer-events-none absolute -top-40 -left-40 h-96 w-96 rounded-full bg-indigo-500/15 dark:bg-indigo-500/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 -right-40 h-96 w-96 rounded-full bg-violet-500/15 dark:bg-violet-500/10 blur-3xl" />
      {contentCard}
    </main>
  );
}
