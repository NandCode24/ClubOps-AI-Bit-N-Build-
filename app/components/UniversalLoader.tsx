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
      <div className="absolute -inset-4 rounded-full bg-gradient-to-tr from-[#738852]/30 via-[#859B62]/25 to-[#9AB277]/30 blur-xl animate-pulse-glow" />

      {/* Outer Ring - Clockwise Gradient Rotation */}
      <div className="relative h-20 w-20 sm:h-24 sm:w-24 rounded-full border-[3px] border-transparent border-t-[#738852] border-r-[#859B62] border-b-[#9AB277] dark:border-t-[#8FA96D] dark:border-r-[#9AB277] dark:border-b-[#B7CCA0] animate-spin" />

      {/* Orbiting Satellite Sparkle */}
      <div className="absolute h-20 w-20 sm:h-24 sm:w-24 animate-spin">
        <div className="absolute -top-1 left-1/2 -translate-x-1/2 h-2.5 w-2.5 rounded-full bg-[#859B62] dark:bg-[#9AB277] shadow-[0_0_12px_#859B62]" />
      </div>

      {/* Middle Ring - Counter-Clockwise Dashed Rotation */}
      <div className="absolute h-14 w-14 sm:h-16 sm:w-16 rounded-full border-[2.5px] border-dashed border-[#859B62]/60 dark:border-[#9AB277]/70 animate-spin-reverse" />

      {/* Center Core - Pulsing ClubOps Star Badge */}
      <div className="absolute flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-[#5C7040] via-[#738852] to-[#859B62] text-white shadow-md shadow-[#859B62]/25 animate-pulse">
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
          <p className="text-sm font-bold text-[#1B2213] dark:text-[#F4F6F0]">{text}</p>
          {subtext && (
            <p className="text-xs text-[#5C7040] dark:text-[#9AB277] max-w-xs">{subtext}</p>
          )}
        </div>
      </div>
    );
  }

  const contentCard = (
    <div className="relative overflow-hidden rounded-3xl border border-[#E2DDD0] dark:border-[#283422] bg-[#F6F4EE]/95 dark:bg-[#141C12]/95 p-7 sm:p-9 shadow-2xl shadow-black/20 dark:shadow-black/50 backdrop-blur-2xl max-w-sm w-full mx-auto flex flex-col items-center text-center animate-float-gentle">
      {/* Top subtle highlight gradient */}
      <div className="absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-[#859B62]/50 to-transparent" />

      {/* Brand Pill */}
      {badge && (
        <span className="mb-5 inline-flex items-center gap-1.5 rounded-full bg-[#EAF0E2] dark:bg-[#202A1B] border border-[#859B62]/30 dark:border-[#859B62]/40 px-3 py-1 text-[11px] font-semibold text-[#45522B] dark:text-[#B7CCA0]">
          <span className="h-1.5 w-1.5 rounded-full bg-[#859B62] dark:bg-[#9AB277] animate-ping" />
          {badge}
        </span>
      )}

      {/* Animated Concentric Rings & Emblem */}
      <div className="my-2">{spinnerElement}</div>

      {/* Title */}
      <h3 className="mt-5 text-lg sm:text-xl font-extrabold tracking-tight text-[#1B2213] dark:text-[#F4F6F0]">
        {text}
      </h3>

      {/* Subtext */}
      {subtext && (
        <p className="mt-2 text-xs sm:text-sm text-[#45522B]/80 dark:text-[#CBD8C4]/80 leading-relaxed max-w-[280px]">
          {subtext}
        </p>
      )}

      {/* Shimmering Progress Bar */}
      <div className="relative mt-5 h-1.5 w-44 overflow-hidden rounded-full bg-[#E2DDD0] dark:bg-[#283422]">
        <div className="h-full w-24 rounded-full bg-gradient-to-r from-[#5C7040] via-[#859B62] to-[#9AB277] animate-shimmer-sweep" />
      </div>

      {/* Activity Dots Indicator */}
      <div className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-[#859B62] dark:text-[#9AB277]">
        <span className="h-1.5 w-1.5 rounded-full bg-[#859B62] dark:bg-[#9AB277] animate-bounce" style={{ animationDelay: "0ms" }} />
        <span className="h-1.5 w-1.5 rounded-full bg-[#859B62] dark:bg-[#9AB277] animate-bounce" style={{ animationDelay: "150ms" }} />
        <span className="h-1.5 w-1.5 rounded-full bg-[#859B62] dark:bg-[#9AB277] animate-bounce" style={{ animationDelay: "300ms" }} />
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
            ? "backdrop-blur-md bg-[#0D130C]/75 dark:bg-[#080D07]/85"
            : "bg-[#0D130C]/50 dark:bg-[#080D07]/70"
        }`}
      >
        {contentCard}
      </div>
    );
  }

  // Full page layout mode for initial page loading
  return (
    <main className="relative flex min-h-screen items-center justify-center bg-[#F6F4EE] dark:bg-[#121810] p-4 overflow-hidden transition-colors duration-200">
      {/* Ambient background glowing accents */}
      <div className="pointer-events-none absolute -top-40 -left-40 h-96 w-96 rounded-full bg-[#859B62]/15 dark:bg-[#859B62]/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 -right-40 h-96 w-96 rounded-full bg-[#738852]/15 dark:bg-[#738852]/10 blur-3xl" />
      {contentCard}
    </main>
  );
}
