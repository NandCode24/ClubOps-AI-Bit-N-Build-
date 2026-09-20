"use client";

import React, { useState, useRef, useEffect } from "react";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

// Dedicated Radiant AI Sparkle Icon Component (with vivid gradient or brilliant white/gold styles)
function RadiantAiIcon({
  className = "w-6 h-6",
  idPrefix = "fab",
  variant = "gradient",
}: {
  className?: string;
  idPrefix?: string;
  variant?: "gradient" | "white";
}) {
  if (variant === "white") {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none">
        {/* Main 4-point radiant white star with subtle drop shadow */}
        <path
          d="M12 2C12 7.52285 7.52285 12 2 12C7.52285 12 12 16.4772 12 22C12 16.4772 16.4772 12 22 12C16.4772 12 12 7.52285 12 2Z"
          fill="#ffffff"
        />
        {/* Golden satellite accent sparkle */}
        <path
          d="M19 2.5C19 4.433 17.433 6 15.5 6C17.433 6 19 7.567 19 9.5C19 7.567 20.567 6 22.5 6C20.567 6 19 4.433 19 2.5Z"
          fill="#fef08a"
        />
        {/* Cyan bottom-left micro sparkle */}
        <path
          d="M5.5 16.5C5.5 17.605 4.605 18.5 3.5 18.5C4.605 18.5 5.5 19.395 5.5 20.5C5.5 19.395 6.395 18.5 7.5 18.5C6.395 18.5 5.5 17.605 5.5 16.5Z"
          fill="#67e8f9"
        />
        {/* Vibrant violet core */}
        <circle cx="12" cy="12" r="1.6" fill="#4f46e5" />
      </svg>
    );
  }

  const gradId = `radiantGrad_${idPrefix}`;
  const accentId = `radiantAccent_${idPrefix}`;

  return (
    <svg className={className} viewBox="0 0 24 24" fill="none">
      <defs>
        <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#6366f1" />
          <stop offset="50%" stopColor="#a855f7" />
          <stop offset="100%" stopColor="#06b6d4" />
        </linearGradient>
        <linearGradient id={accentId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#38bdf8" />
          <stop offset="100%" stopColor="#c084fc" />
        </linearGradient>
      </defs>
      {/* 4-point curved radiant star */}
      <path
        d="M12 2C12 7.52285 7.52285 12 2 12C7.52285 12 12 16.4772 12 22C12 16.4772 16.4772 12 22 12C16.4772 12 12 7.52285 12 2Z"
        fill={`url(#${gradId})`}
      />
      {/* Upper-right accent sparkle */}
      <path
        d="M19 2.5C19 4.433 17.433 6 15.5 6C17.433 6 19 7.567 19 9.5C19 7.567 20.567 6 22.5 6C20.567 6 19 4.433 19 2.5Z"
        fill={`url(#${accentId})`}
      />
      {/* Bottom-left micro sparkle */}
      <path
        d="M5.5 16.5C5.5 17.605 4.605 18.5 3.5 18.5C4.605 18.5 5.5 19.395 5.5 20.5C5.5 19.395 6.395 18.5 7.5 18.5C6.395 18.5 5.5 17.605 5.5 16.5Z"
        fill="#38bdf8"
      />
      {/* Luminous center nucleus */}
      <circle cx="12" cy="12" r="1.5" fill="#ffffff" />
    </svg>
  );
}

const STARTER_PROMPTS = [
  {
    icon: (
      <svg className="w-5 h-5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
      </svg>
    ),
    badge: "WORKLOAD GUARD",
    badgeColor: "bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300 border-amber-200 dark:border-amber-800/50",
    title: "1-Task Workload Rule",
    description: "How the platform prevents volunteer overload & burnout.",
    query: "How does the AI Workload Guard enforce the 1-task rule to prevent volunteer burnout?",
  },
  {
    icon: (
      <svg className="w-5 h-5 text-violet-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 100-6 3 3 0 000 6z" />
      </svg>
    ),
    badge: "AUDIO INTELLIGENCE",
    badgeColor: "bg-violet-50 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300 border-violet-200 dark:border-violet-800/50",
    title: "Meeting Summarizer",
    description: "Recording or uploading audio to generate broadcast announcements.",
    query: "How do I record or upload audio to generate meeting summaries and volunteer tasks?",
  },
  {
    icon: (
      <svg className="w-5 h-5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
      </svg>
    ),
    badge: "DIRECTORY",
    badgeColor: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/50",
    title: "Clubs & Upcoming Events",
    description: "Check active clubs, codes, and scheduled events across campus.",
    query: "What clubs and upcoming events exist in ClubOps AI right now?",
  },
  {
    icon: (
      <svg className="w-5 h-5 text-cyan-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
      </svg>
    ),
    badge: "AUTO-REALLOCATION",
    badgeColor: "bg-cyan-50 text-cyan-700 dark:bg-cyan-950/50 dark:text-cyan-300 border-cyan-200 dark:border-cyan-800/50",
    title: "Smart Skill Reallocation",
    description: "Automatic task reassignment when members become unavailable.",
    query: "What happens if a volunteer marks themselves unavailable or deactivates before an event?",
  },
];

const FOLLOW_UP_SUGGESTIONS = [
  "What clubs are registered right now?",
  "How do student join requests work?",
  "Explain the 1-task overload rule",
  "How do I record meeting audio?",
];

export default function ChatbotWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Auto-scroll on message updates
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isStreaming, isOpen]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isOpen]);

  // Keyboard shortcut: ESC to close
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  async function handleSend(queryText?: string) {
    const textToSend = queryText || input;
    if (!textToSend.trim() || isStreaming) return;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: "user",
      content: textToSend.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
    };

    const assistantPlaceholderId = `assistant-${Date.now()}`;
    const assistantMessage: Message = {
      id: assistantPlaceholderId,
      role: "assistant",
      content: "",
      timestamp: new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userMessage, assistantMessage]);
    setInput("");
    setIsStreaming(true);

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      const historyPayload = messages.slice(-8).map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: textToSend.trim(),
          conversationHistory: historyPayload,
        }),
        signal: abortController.signal,
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || `Server responded with ${res.status}`);
      }

      if (!res.body) {
        throw new Error("No response body stream received.");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let streamedContent = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        streamedContent += chunk;

        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantPlaceholderId ? { ...msg, content: streamedContent } : msg
          )
        );
      }
    } catch (err: any) {
      if (err.name === "AbortError") {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantPlaceholderId
              ? { ...msg, content: msg.content + "\n\n*(Response stopped)*" }
              : msg
          )
        );
      } else {
        console.error("Chat streaming error:", err);
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantPlaceholderId
              ? {
                  ...msg,
                  content:
                    "I encountered a temporary connection issue. Please try again in a moment.",
                }
              : msg
          )
        );
      }
    } finally {
      setIsStreaming(false);
      abortControllerRef.current = null;
    }
  }

  function handleStop() {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  }

  function handleClearChat() {
    if (isStreaming) handleStop();
    setMessages([]);
    setInput("");
  }

  function handleCopy(id: string, text: string) {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  function renderMarkdown(content: string) {
    const lines = content.split("\n");
    const elements: React.ReactNode[] = [];
    let i = 0;

    while (i < lines.length) {
      const line = lines[i];

      // 1. Code fence block
      if (line.trim().startsWith("```")) {
        const lang = line.trim().slice(3);
        const codeLines: string[] = [];
        i++;
        while (i < lines.length && !lines[i].trim().startsWith("```")) {
          codeLines.push(lines[i]);
          i++;
        }
        i++; // skip closing ```
        elements.push(
          <div
            key={`code-${i}`}
            className="my-3 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-900 text-slate-100 font-mono text-xs shadow-xs"
          >
            {lang && (
              <div className="px-4 py-1.5 bg-slate-800/90 text-[10px] uppercase tracking-wider text-slate-400 font-semibold border-b border-slate-800">
                {lang}
              </div>
            )}
            <pre className="p-4 overflow-x-auto text-xs leading-relaxed [scrollbar-width:none]">
              <code>{codeLines.join("\n")}</code>
            </pre>
          </div>
        );
        continue;
      }

      // 2. Table block
      if (line.trim().startsWith("|") && line.trim().endsWith("|")) {
        const tableLines: string[] = [];
        while (i < lines.length && lines[i].trim().startsWith("|") && lines[i].trim().endsWith("|")) {
          tableLines.push(lines[i].trim());
          i++;
        }
        if (tableLines.length >= 2) {
          const headerCells = tableLines[0]
            .slice(1, -1)
            .split("|")
            .map((c) => c.trim());
          const dataRows = tableLines.slice(2).map((r) =>
            r
              .slice(1, -1)
              .split("|")
              .map((c) => c.trim())
          );
          elements.push(
            <div
              key={`table-${i}`}
              className="overflow-x-auto my-3 rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
            >
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60">
                    {headerCells.map((h, hIdx) => (
                      <th
                        key={hIdx}
                        className="px-3.5 py-2.5 font-semibold text-slate-900 dark:text-slate-100 whitespace-nowrap"
                      >
                        {formatInline(h)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                  {dataRows.map((row, rIdx) => (
                    <tr
                      key={rIdx}
                      className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors"
                    >
                      {row.map((cell, cIdx) => (
                        <td key={cIdx} className="px-3.5 py-2.5 text-slate-700 dark:text-slate-300">
                          {formatInline(cell)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
          continue;
        }
      }

      // 3. Headers
      if (line.startsWith("### ")) {
        elements.push(
          <h5
            key={`h5-${i}`}
            className="font-semibold text-slate-700 dark:text-slate-300 mt-3 text-xs uppercase tracking-wider"
          >
            {formatInline(line.slice(4))}
          </h5>
        );
        i++;
        continue;
      }
      if (line.startsWith("## ")) {
        elements.push(
          <h4
            key={`h4-${i}`}
            className="font-bold text-slate-900 dark:text-white mt-4 text-sm sm:text-base tracking-tight border-b border-slate-100 dark:border-slate-800 pb-1.5"
          >
            {formatInline(line.slice(3))}
          </h4>
        );
        i++;
        continue;
      }
      if (line.startsWith("# ")) {
        elements.push(
          <h3
            key={`h3-${i}`}
            className="font-bold text-slate-900 dark:text-white text-base sm:text-lg mt-4.5 tracking-tight"
          >
            {formatInline(line.slice(2))}
          </h3>
        );
        i++;
        continue;
      }

      // 4. Horizontal rule
      if (line.trim() === "---") {
        elements.push(
          <hr key={`hr-${i}`} className="my-3.5 border-slate-200/80 dark:border-slate-800" />
        );
        i++;
        continue;
      }

      // 5. Blockquote
      if (line.startsWith("> ")) {
        elements.push(
          <div
            key={`bq-${i}`}
            className="border-l-3 border-indigo-500 pl-3.5 py-1.5 my-2.5 text-slate-600 dark:text-slate-300 italic bg-slate-50 dark:bg-slate-850/60 rounded-r-lg text-xs sm:text-[13px]"
          >
            {formatInline(line.slice(2))}
          </div>
        );
        i++;
        continue;
      }

      // 6. Bullet points
      if (line.startsWith("- ") || line.startsWith("* ")) {
        elements.push(
          <div
            key={`bullet-${i}`}
            className="flex items-start gap-2.5 ml-1 text-slate-700 dark:text-slate-300"
          >
            <span className="text-indigo-600 dark:text-indigo-400 font-bold shrink-0 text-base mt-[-3px]">
              •
            </span>
            <span className="flex-1">{formatInline(line.slice(2))}</span>
          </div>
        );
        i++;
        continue;
      }

      // 7. Numbered lists
      const numMatch = line.match(/^(\d+)\.\s+(.*)/);
      if (numMatch) {
        elements.push(
          <div
            key={`num-${i}`}
            className="flex items-start gap-2.5 ml-1 text-slate-700 dark:text-slate-300"
          >
            <span className="inline-flex items-center justify-center h-5 w-5 rounded-md bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-semibold text-xs shrink-0 mt-0.5 border border-indigo-100 dark:border-indigo-900/50">
              {numMatch[1]}
            </span>
            <span className="flex-1">{formatInline(numMatch[2])}</span>
          </div>
        );
        i++;
        continue;
      }

      // 8. Empty line
      if (!line.trim()) {
        elements.push(<div key={`empty-${i}`} className="h-2" />);
        i++;
        continue;
      }

      // 9. Standard paragraph
      elements.push(<p key={`p-${i}`} className="leading-relaxed">{formatInline(line)}</p>);
      i++;
    }

    return (
      <div className="space-y-2 text-xs sm:text-[13px] leading-relaxed break-words text-slate-800 dark:text-slate-200">
        {elements}
      </div>
    );
  }

  function formatInline(text: string) {
    const parts = text.split(/(\*\*.*?\*\*|\*.*?\*|`.*?`)/g);
    return parts.map((part, i) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return (
          <strong key={i} className="font-semibold text-slate-900 dark:text-white">
            {part.slice(2, -2)}
          </strong>
        );
      }
      if (part.startsWith("*") && part.endsWith("*")) {
        return (
          <em key={i} className="italic text-slate-700 dark:text-slate-300">
            {part.slice(1, -1)}
          </em>
        );
      }
      if (part.startsWith("`") && part.endsWith("`")) {
        return (
          <code
            key={i}
            className="rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-1.5 py-0.5 font-mono text-[11px] text-slate-800 dark:text-slate-200 font-medium"
          >
            {part.slice(1, -1)}
          </code>
        );
      }
      return part;
    });
  }

  return (
    <>
      {/* FLOATING ACTION LAUNCHER WITH CONTINUOUS POPUP PROMPT */}
      {!isOpen && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 animate-float-gentle">
          {/* Continuous Floating Prompt Speech Card */}
          <button
            type="button"
            onClick={() => setIsOpen(true)}
            className="group relative flex items-center gap-3 rounded-2xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border border-indigo-200/80 dark:border-indigo-800/80 shadow-[0_12px_35px_rgba(79,70,229,0.2)] hover:shadow-[0_16px_45px_rgba(79,70,229,0.3)] px-4 py-2.5 text-left hover:scale-105 active:scale-95 transition-all duration-300 cursor-pointer"
            aria-label="Open ClubOps Assistant"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-600 via-violet-600 to-cyan-500 text-white shadow-md shadow-indigo-500/25 shrink-0">
              <RadiantAiIcon className="w-5 h-5" variant="white" />
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-xs text-slate-900 dark:text-white leading-tight">
                  Need help with your club?
                </span>
                <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
              </div>
              <span className="text-[11px] text-indigo-600 dark:text-indigo-400 font-semibold block mt-0.5">
                Ask ClubOps AI Copilot →
              </span>
            </div>
          </button>

          {/* Luminous Glowing Circular FAB - Vibrant Jewel Gradient (NOT dark!) */}
          <div className="relative flex items-center justify-center">
            {/* Multi-tone Ambient Breathing Aura */}
            <div className="absolute -inset-2.5 rounded-full bg-gradient-to-tr from-indigo-500 via-purple-500 to-cyan-400 opacity-75 blur-xl animate-pulse-glow pointer-events-none" />

            <button
              type="button"
              onClick={() => setIsOpen(true)}
              className="group relative flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-tr from-indigo-600 via-violet-600 to-cyan-500 text-white shadow-[0_12px_35px_rgba(79,70,229,0.55),0_0_25px_rgba(168,85,247,0.4)] hover:shadow-[0_18px_45px_rgba(79,70,229,0.75),0_0_35px_rgba(56,189,248,0.5)] border-2 border-white/60 ring-4 ring-indigo-500/20 hover:scale-110 active:scale-95 transition-all duration-300 cursor-pointer overflow-hidden"
              aria-label="Open ClubOps Assistant"
            >
              {/* Glossy Top Glass Shimmer */}
              <div className="absolute inset-0 rounded-full bg-gradient-to-b from-white/35 via-transparent to-transparent pointer-events-none" />

              {/* Radiant White & Gold AI Sparkle Icon with 45deg Hover Rotation */}
              <div className="relative z-10 transition-transform duration-500 ease-out group-hover:rotate-45 group-hover:scale-110">
                <RadiantAiIcon className="w-8 h-8 drop-shadow-[0_2px_10px_rgba(255,255,255,0.8)]" variant="white" />
              </div>

              {/* Live Status Radar Ping Dot */}
              <span className="absolute top-2.5 right-2.5 flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-300 opacity-90"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-400 border-2 border-white shadow-xs"></span>
              </span>
            </button>
          </div>
        </div>
      )}

      {/* CHAT WINDOW MODAL - SPACIOUS (520px x 700px) & VIBRANT MODERN DESIGN */}
      {isOpen && (
        <div className="fixed bottom-4 sm:bottom-6 right-3 sm:right-6 z-50 flex flex-col w-[520px] max-w-[calc(100vw-28px)] h-[700px] max-h-[90vh] rounded-3xl bg-white/95 dark:bg-slate-950/95 backdrop-blur-2xl border border-indigo-100/90 dark:border-indigo-900/50 shadow-[0_25px_70px_rgba(0,0,0,0.25)] dark:shadow-[0_25px_70px_rgba(0,0,0,0.8)] overflow-hidden transition-all duration-300 animate-in fade-in zoom-in-95">
          
          {/* HEADER - VIBRANT MODERN INDIGO-VIOLET GRADIENT BANNER */}
          <div className="relative z-10 flex items-center justify-between px-5 py-4 border-b border-indigo-700/40 bg-gradient-to-r from-indigo-600 via-indigo-700 to-violet-700 text-white shrink-0 shadow-md">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/20 border border-white/30 backdrop-blur-md shadow-inner">
                <RadiantAiIcon className="w-6 h-6" variant="white" />
              </div>
              <div>
                <h3 className="font-bold text-white text-sm sm:text-base tracking-tight flex items-center gap-2">
                  <span>ClubOps Assistant</span>
                  <span className="rounded-full bg-white/20 border border-white/30 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-white">
                    Copilot
                  </span>
                </h3>
                <div className="flex items-center gap-1.5 text-xs text-emerald-200 font-medium mt-0.5">
                  <span className="h-2 w-2 rounded-full bg-emerald-400 inline-block animate-pulse"></span>
                  <span>Online • Campus Guide</span>
                </div>
              </div>
            </div>

            {/* Window Controls */}
            <div className="flex items-center gap-1.5">
              {messages.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearChat}
                  title="Clear conversation"
                  className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/15 hover:bg-white/25 text-white transition duration-150 cursor-pointer text-xs"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                title="Minimize chat (Esc)"
                className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/15 hover:bg-white/25 text-white transition duration-150 cursor-pointer"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>


          {/* CHAT MESSAGES BODY */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4 select-text [scrollbar-width:thin] [scrollbar-color:rgba(156,163,175,0.3)_transparent] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-slate-200 dark:[&::-webkit-scrollbar-thumb]:bg-slate-800 [&::-webkit-scrollbar-thumb]:rounded-full">
            
            {/* WELCOME STATE */}
            {messages.length === 0 && (
              <div className="space-y-4 py-2">
                {/* Hero Greeting Card */}
                <div className="rounded-2xl border border-indigo-100 dark:border-indigo-950 bg-gradient-to-br from-indigo-50/80 via-white to-purple-50/60 dark:from-indigo-950/30 dark:via-slate-900/50 dark:to-purple-950/20 p-5 text-center shadow-xs">
                  <div className="inline-flex p-3.5 rounded-2xl bg-gradient-to-tr from-indigo-600 via-violet-600 to-cyan-500 text-white shadow-xl shadow-indigo-500/30 mb-3">
                    <RadiantAiIcon className="w-8 h-8" variant="white" />
                  </div>
                  <h4 className="font-bold text-slate-900 dark:text-white text-base sm:text-lg tracking-tight">
                    How can I assist your club today?
                  </h4>
                  <p className="text-xs sm:text-[13px] text-slate-600 dark:text-slate-300 leading-relaxed max-w-sm mx-auto mt-1.5">
                    Ask me about your club schedule, upcoming events, volunteer guidelines, and meeting audio announcements.
                  </p>
                </div>

                {/* Popular Questions Grid */}
                <div className="space-y-2">
                  <div className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 px-1">
                    Suggested Questions
                  </div>

                  <div className="grid grid-cols-1 gap-2.5">
                    {STARTER_PROMPTS.map((item, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => handleSend(item.query)}
                        className="group text-left rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 hover:border-indigo-500 dark:hover:border-indigo-500 hover:shadow-md hover:-translate-y-0.5 p-3.5 transition-all duration-200 flex items-center gap-3.5 cursor-pointer shadow-2xs"
                      >
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 shrink-0 group-hover:scale-110 transition-transform">
                          {item.icon}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="font-semibold text-slate-900 dark:text-slate-100 text-[13px] group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                              {item.title}
                            </span>
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold tracking-wider uppercase border ${item.badgeColor}`}>
                              {item.badge}
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1">
                            {item.description}
                          </p>
                        </div>
                        <span className="text-slate-300 dark:text-slate-600 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 group-hover:translate-x-1 transition-all text-base shrink-0 self-center">
                          →
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* CONVERSATION MESSAGES */}
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                {msg.role === "assistant" && (
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-600 via-violet-600 to-cyan-500 text-white shrink-0 mt-0.5 shadow-md shadow-indigo-500/20">
                    <RadiantAiIcon className="w-5 h-5" variant="white" />
                  </div>
                )}

                <div
                  className={`group relative max-w-[85%] rounded-2xl p-4 transition-all ${
                    msg.role === "user"
                      ? "bg-gradient-to-r from-indigo-600 via-indigo-600 to-violet-600 text-white rounded-tr-xs shadow-md shadow-indigo-500/15 text-xs sm:text-[13px] leading-relaxed"
                      : "bg-slate-50 dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 text-slate-800 dark:text-slate-100 rounded-tl-xs shadow-xs"
                  }`}
                >
                  {msg.role === "user" ? (
                    <p className="whitespace-pre-wrap font-medium">{msg.content}</p>
                  ) : (
                    <>
                      {msg.content ? (
                        renderMarkdown(msg.content)
                      ) : (
                        <div className="flex items-center gap-2 py-1 text-xs text-indigo-600 dark:text-indigo-400 font-medium">
                          <span className="flex h-2 w-2 rounded-full bg-indigo-500 animate-ping"></span>
                          <span>Generating response...</span>
                        </div>
                      )}

                      {/* Message Timestamp & Copy Action */}
                      {msg.content && !isStreaming && (
                        <div className="flex items-center justify-between border-t border-slate-200/60 dark:border-slate-800/80 mt-3 pt-2 text-[11px] text-slate-400">
                          <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">
                            {msg.timestamp}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleCopy(msg.id, msg.content)}
                            className="flex items-center gap-1.5 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 cursor-pointer transition text-xs rounded px-2 py-0.5 hover:bg-slate-100 dark:hover:bg-slate-800 font-medium"
                          >
                            {copiedId === msg.id ? (
                              <span className="text-emerald-500 font-semibold">✓ Copied</span>
                            ) : (
                              <>
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                </svg>
                                <span>Copy</span>
                              </>
                            )}
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            ))}

            <div ref={messagesEndRef} />
          </div>

          {/* FOLLOW-UP PILLS (CLEAN WITHOUT WINDOWS SCROLLBARS) */}
          {messages.length > 0 && !isStreaming && (
            <div className="px-4 py-2 overflow-x-auto flex gap-2 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
              {FOLLOW_UP_SUGGESTIONS.map((suggestion, sIdx) => (
                <button
                  key={sIdx}
                  type="button"
                  onClick={() => handleSend(suggestion)}
                  className="whitespace-nowrap rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:border-indigo-500 dark:hover:border-indigo-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition cursor-pointer shadow-2xs shrink-0"
                >
                  ✦ {suggestion}
                </button>
              ))}
            </div>
          )}

          {/* INPUT BAR */}
          <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-950 shrink-0">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSend();
              }}
              className="flex items-center gap-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-4 py-2 focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-500/20 focus-within:bg-white dark:focus-within:bg-slate-900 transition-all shadow-inner"
            >
              <textarea
                ref={inputRef}
                rows={1}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder="Ask about clubs, events, or volunteer tasks..."
                className="flex-1 bg-transparent text-xs sm:text-[13px] text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none resize-none py-1.5 max-h-24 leading-normal"
              />

              {isStreaming ? (
                <button
                  type="button"
                  onClick={handleStop}
                  title="Stop generating"
                  className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-500 hover:bg-rose-600 text-white transition active:scale-95 cursor-pointer shrink-0 shadow-xs"
                >
                  <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                    <rect x="6" y="6" width="12" height="12" rx="2" />
                  </svg>
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={!input.trim()}
                  title="Send message"
                  className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white shadow-md shadow-indigo-500/25 transition active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer shrink-0"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M5 12h14m-6-6l6 6-6 6" />
                  </svg>
                </button>
              )}
            </form>

            <div className="flex items-center justify-between text-[10px] text-slate-400 px-1 mt-2">
              <span>Press <kbd className="font-mono bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-[9px]">Enter ↵</kbd> to send</span>
              <span className="font-medium text-slate-500">ClubOps AI Assistant</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
