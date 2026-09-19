"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";

interface ThemeToggleProps {
  className?: string;
  showLabel?: boolean;
}

export function ThemeToggle({ className = "", showLabel = false }: ThemeToggleProps) {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <button
        type="button"
        disabled
        aria-label="Toggle theme"
        className={`relative inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white p-2 text-slate-400 opacity-70 dark:border-slate-800 dark:bg-slate-900 ${className}`}
      >
        <span className="h-4 w-4 rounded-full bg-slate-200 dark:bg-slate-700 animate-pulse" />
      </button>
    );
  }

  const isDark = resolvedTheme === "dark";

  const toggleTheme = () => {
    if (theme === "system") {
      setTheme(isDark ? "light" : "dark");
    } else if (theme === "light") {
      setTheme("dark");
    } else {
      setTheme("light");
    }
  };

  return (
    <div className="relative inline-flex items-center">
      <button
        type="button"
        onClick={toggleTheme}
        aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
        title={isDark ? "Switch to light mode" : "Switch to dark mode"}
        className={`group relative inline-flex h-9 items-center justify-center gap-2 rounded-xl border border-slate-200/80 bg-white/90 px-2.5 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs backdrop-blur-md transition-all duration-200 hover:border-slate-300 hover:bg-slate-50 active:scale-95 dark:border-slate-800 dark:bg-slate-900/90 dark:text-slate-200 dark:hover:border-slate-700 dark:hover:bg-slate-800 ${className}`}
      >
        {/* Sun Icon */}
        <span className="relative flex h-4 w-4 items-center justify-center">
          <svg
            className={`h-4 w-4 transition-all duration-300 transform ${
              isDark
                ? "rotate-90 scale-0 opacity-0 absolute"
                : "rotate-0 scale-100 opacity-100 text-amber-500"
            }`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2" />
            <path d="M12 20v2" />
            <path d="m4.93 4.93 1.41 1.41" />
            <path d="m17.66 17.66 1.41 1.41" />
            <path d="M2 12h2" />
            <path d="M20 12h2" />
            <path d="m6.34 17.66-1.41 1.41" />
            <path d="m19.07 4.93-1.41 1.41" />
          </svg>

          {/* Moon Icon */}
          <svg
            className={`h-4 w-4 transition-all duration-300 transform ${
              isDark
                ? "rotate-0 scale-100 opacity-100 text-indigo-400"
                : "-rotate-90 scale-0 opacity-0 absolute"
            }`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
          </svg>
        </span>

        {showLabel && (
          <span className="hidden sm:inline font-medium capitalize text-slate-600 dark:text-slate-300">
            {isDark ? "Dark" : "Light"}
          </span>
        )}
      </button>
    </div>
  );
}

export default ThemeToggle;
