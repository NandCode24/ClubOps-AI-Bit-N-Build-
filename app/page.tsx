"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { ThemeToggle } from "./components/ThemeToggle";
import { motion, useInView, useScroll, useTransform, AnimatePresence } from "framer-motion";

/* ─── Animated Counter Component ─── */
function AnimatedCounter({ target, suffix = "" }: { target: number; suffix?: string }) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true });

  useEffect(() => {
    if (!isInView) return;
    let start = 0;
    const duration = 2000;
    const step = Math.max(1, Math.floor(target / (duration / 16)));
    const timer = setInterval(() => {
      start += step;
      if (start >= target) {
        setCount(target);
        clearInterval(timer);
      } else {
        setCount(start);
      }
    }, 16);
    return () => clearInterval(timer);
  }, [isInView, target]);

  return (
    <span ref={ref}>
      {count}
      {suffix}
    </span>
  );
}

/* ─── Floating Particle Background ─── */
function FloatingParticles() {
  const [particles, setParticles] = useState<Array<{
    w: number; h: number; left: string; top: string;
    yMid: number; xMid: number; dur: number; del: number;
  }>>([]);

  useEffect(() => {
    setParticles(
      Array.from({ length: 20 }).map(() => ({
        w: Math.random() * 6 + 2,
        h: Math.random() * 6 + 2,
        left: `${Math.random() * 100}%`,
        top: `${Math.random() * 100}%`,
        yMid: -30 - Math.random() * 40,
        xMid: (Math.random() - 0.5) * 30,
        dur: 4 + Math.random() * 4,
        del: Math.random() * 3,
      }))
    );
  }, []);

  if (particles.length === 0) return null;

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {particles.map((p, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full bg-indigo-500/10 dark:bg-indigo-400/10"
          style={{ width: p.w, height: p.h, left: p.left, top: p.top }}
          animate={{
            y: [0, p.yMid, 0],
            x: [0, p.xMid, 0],
            opacity: [0.3, 0.8, 0.3],
          }}
          transition={{
            duration: p.dur,
            repeat: Infinity,
            ease: "easeInOut",
            delay: p.del,
          }}
        />
      ))}
    </div>
  );
}

/* ─── Grid Pattern SVG ─── */
function GridPattern() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden opacity-[0.03] dark:opacity-[0.04]">
      <svg className="absolute inset-0 h-full w-full" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="currentColor" strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" className="text-slate-900 dark:text-white" />
      </svg>
    </div>
  );
}

/* ─── Feature Card Icons (SVG-based) ─── */
const featureIcons = {
  mic: (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" x2="12" y1="19" y2="22" />
    </svg>
  ),
  shield: (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  ),
  brain: (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z" />
      <path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z" />
      <path d="M15 13a4.5 4.5 0 0 1-3-4 4.5 4.5 0 0 1-3 4" />
      <path d="M17.599 6.5a3 3 0 0 0 .399-1.375" />
      <path d="M6.003 5.125A3 3 0 0 0 6.401 6.5" />
      <path d="M3.477 10.896a4 4 0 0 1 .585-.396" />
      <path d="M19.938 10.5a4 4 0 0 1 .585.396" />
      <path d="M6 18a4 4 0 0 1-1.967-.516" />
      <path d="M19.967 17.484A4 4 0 0 1 18 18" />
    </svg>
  ),
  users: (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 21a8 8 0 0 0-16 0" />
      <circle cx="10" cy="8" r="5" />
      <path d="M22 20c0-3.37-2-6.5-4-8a5 5 0 0 0-.45-8.3" />
    </svg>
  ),
  zap: (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z" />
    </svg>
  ),
  megaphone: (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="m3 11 18-5v12L3 13v-2z" />
      <path d="M11.6 16.8a3 3 0 1 1-5.8-1.6" />
    </svg>
  ),
};

/* ─── Stagger animation variants ─── */
const staggerContainer = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.12,
    },
  },
};

const fadeInUp: any = {
  hidden: { opacity: 0, y: 30 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: "easeOut" },
  },
};

const scaleIn: any = {
  hidden: { opacity: 0, scale: 0.9 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.5, ease: "easeOut" },
  },
};

/* ─── Features Data ─── */
const features = [
  {
    icon: featureIcons.mic,
    title: "AI Meeting Summarizer",
    description:
      "Record or upload meeting audio in any language. Get transcripts, action items, announcements, and auto-generated task matrices — all in one click.",
    gradient: "from-rose-500 to-pink-600",
    bgGlow: "bg-rose-500/10 dark:bg-rose-500/15",
    borderHover: "hover:border-rose-400/50",
  },
  {
    icon: featureIcons.shield,
    title: "Workload Guard",
    description:
      "Our strict 1-active-task rule prevents volunteer burnout. The AI blocks over-assignment and instantly recommends free members with matching skills.",
    gradient: "from-emerald-500 to-teal-600",
    bgGlow: "bg-emerald-500/10 dark:bg-emerald-500/15",
    borderHover: "hover:border-emerald-400/50",
  },
  {
    icon: featureIcons.brain,
    title: "Smart Risk Reallocation",
    description:
      "When a member becomes unavailable, our AI analyzes remaining volunteers and auto-reassigns critical tasks to the best skill-matched alternative.",
    gradient: "from-[#738852] to-[#859B62]",
    bgGlow: "bg-[#859B62]/10 dark:bg-[#859B62]/15",
    borderHover: "hover:border-[#859B62]/50",
  },
  {
    icon: featureIcons.users,
    title: "Instant Club ID System",
    description:
      "Create a club in seconds and get a unique CLB-XXXXXX code. Share it across campus — students enter it to request entry, no admin hassle.",
    gradient: "from-blue-500 to-cyan-600",
    bgGlow: "bg-blue-500/10 dark:bg-blue-500/15",
    borderHover: "hover:border-blue-400/50",
  },
  {
    icon: featureIcons.zap,
    title: "Real-Time Live Feeds",
    description:
      "Announcements and task updates are pushed instantly via Server-Sent Events. No page refresh needed — your team stays in sync live.",
    gradient: "from-amber-500 to-orange-600",
    bgGlow: "bg-amber-500/10 dark:bg-amber-500/15",
    borderHover: "hover:border-amber-400/50",
  },
  {
    icon: featureIcons.megaphone,
    title: "1-Click Announcements",
    description:
      "Turn AI-generated meeting summaries into polished club announcements instantly. Publish directly to event feeds with a single click.",
    gradient: "from-indigo-500 to-blue-600",
    bgGlow: "bg-indigo-500/10 dark:bg-indigo-500/15",
    borderHover: "hover:border-indigo-400/50",
  },
];

/* ─── How It Works Steps ─── */
const steps = [
  {
    number: "01",
    title: "Create Your Club",
    description: "Sign up, name your club, and get a unique invite code instantly.",
  },
  {
    number: "02",
    title: "Build Your Team",
    description: "Share the code — volunteers join in one click. Define custom roles and manage requests.",
  },
  {
    number: "03",
    title: "Run AI-Powered Events",
    description: "Create events, record meetings, auto-generate tasks, and let AI handle workload balancing.",
  },
];

/* ──────────────────────────────────────── MAIN PAGE ──────────────────────────────────────── */

export default function Home() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const heroRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"],
  });
  const heroOpacity = useTransform(scrollYProgress, [0, 1], [1, 0]);
  const heroScale = useTransform(scrollYProgress, [0, 1], [1, 0.95]);

  /* Typing animation for hero tagline */
  const taglines = [
    "Manage Volunteers with AI",
    "Summarize Meetings Instantly",
    "Prevent Member Burnout",
    "Run Events Effortlessly",
  ];
  const [currentTagline, setCurrentTagline] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTagline((prev) => (prev + 1) % taglines.length);
    }, 3000);
    return () => clearInterval(interval);
  }, [taglines.length]);

  return (
    <div className="min-h-screen bg-[#F2ECE1] dark:bg-[#121810] text-[#1B2213] dark:text-[#F4F6F0] selection:bg-[#859B62] selection:text-white relative overflow-hidden font-sans transition-colors duration-200">
      <GridPattern />

      {/* ─── Ambient Background Glows ─── */}
      <div className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 w-[600px] sm:w-[900px] h-[500px] bg-gradient-to-b from-[#859B62]/15 via-[#B7CCA0]/10 to-transparent dark:from-[#859B62]/10 dark:via-[#45522B]/10 blur-[120px] rounded-full" />
      <div className="pointer-events-none absolute top-[60vh] -right-40 w-[400px] h-[400px] bg-gradient-to-br from-[#859B62]/10 to-[#A0BC7B]/10 dark:from-[#859B62]/10 dark:to-[#45522B]/15 blur-[100px] rounded-full" />
      <div className="pointer-events-none absolute top-[120vh] -left-40 w-[350px] h-[350px] bg-gradient-to-tr from-[#D5E2C5]/20 to-[#EAF0E2]/20 dark:from-[#202A1B] dark:to-[#192015] blur-[100px] rounded-full" />

      {/* ─── Navigation ─── */}
      <header className="sticky top-0 z-50 border-b border-[#DFD7C8] dark:border-[#283422] bg-[#F2ECE1]/85 dark:bg-[#121810]/85 backdrop-blur-xl px-4 sm:px-8">
        <div className="mx-auto flex max-w-7xl items-center justify-between h-16 sm:h-[72px]">
          <Link href="/" className="flex items-center gap-2.5 group min-w-0">
            <div className="flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-[#738852] to-[#859B62] text-white shadow-lg shadow-[#859B62]/25 group-hover:shadow-[#859B62]/40 group-hover:scale-105 transition-all duration-300">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" fill="currentColor" />
              </svg>
            </div>
            <div className="min-w-0">
              <span className="text-lg sm:text-xl font-black tracking-tight text-[#1B2213] dark:text-[#F4F6F0]">
                ClubOps{" "}
                <span className="text-[#859B62] dark:text-[#9AB277]">
                  AI
                </span>
              </span>
            </div>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-1">
            <a href="#features" className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition rounded-lg hover:bg-slate-100 dark:hover:bg-white/5">Features</a>
            <a href="#how-it-works" className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition rounded-lg hover:bg-slate-100 dark:hover:bg-white/5">How It Works</a>
            <a href="#stats" className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition rounded-lg hover:bg-slate-100 dark:hover:bg-white/5">Impact</a>
          </nav>

          {/* Desktop Right */}
          <div className="hidden md:flex items-center gap-2.5">
            <ThemeToggle showLabel />
            <Link
              href="/signin"
              className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white transition hover:bg-slate-100 dark:hover:bg-white/5"
            >
              Sign In
            </Link>
            <Link
              href="/dashboard"
              className="rounded-xl bg-[#859B62] hover:bg-[#738852] px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-[#859B62]/25 hover:shadow-[#859B62]/40 hover:scale-[1.02] transition-all duration-300 active:scale-95"
            >
              Get Started →
            </Link>
          </div>

          {/* Mobile */}
          <div className="flex md:hidden items-center gap-2 shrink-0">
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

        {/* Mobile Dropdown */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="md:hidden overflow-hidden border-t border-slate-200/60 dark:border-white/[0.06]"
            >
              <div className="py-3 space-y-1">
                <a href="#features" onClick={() => setMobileMenuOpen(false)} className="block px-4 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg">Features</a>
                <a href="#how-it-works" onClick={() => setMobileMenuOpen(false)} className="block px-4 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg">How It Works</a>
                <Link href="/signin" onClick={() => setMobileMenuOpen(false)} className="block px-4 py-2.5 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg">Sign In</Link>
                <Link href="/dashboard" onClick={() => setMobileMenuOpen(false)} className="block text-center mt-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 py-3 text-sm font-bold text-white shadow-sm">Get Started →</Link>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* ─── Hero Section ─── */}
      <motion.section
        ref={heroRef}
        style={{ opacity: heroOpacity, scale: heroScale }}
        className="relative z-10 mx-auto max-w-7xl px-4 pt-16 pb-24 sm:px-6 sm:pt-28 sm:pb-36 text-center"
      >
        <FloatingParticles />

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="inline-flex items-center gap-2.5 rounded-full border border-indigo-200/80 dark:border-indigo-500/25 bg-indigo-50/80 dark:bg-indigo-500/[0.08] px-4 py-2 text-xs font-semibold text-indigo-700 dark:text-indigo-300 backdrop-blur-md mb-8"
        >
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-indigo-500 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-indigo-600 dark:bg-indigo-400" />
          </span>
          Centralized AI Operations for College Clubs
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
          className="text-4xl sm:text-6xl md:text-7xl lg:text-8xl font-black tracking-tight text-[#1B2213] dark:text-[#F4F6F0] max-w-5xl mx-auto leading-[1.08]"
        >
          Run your club with
          <br />
          <span className="bg-gradient-to-r from-[#6E834F] via-[#859B62] to-[#9AB277] dark:from-[#8FA96D] dark:via-[#9AB277] dark:to-[#BCD1A6] bg-clip-text text-transparent">
            AI Superpowers
          </span>
        </motion.h1>

        {/* Animated rotating tagline */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-6 sm:mt-8 h-8 sm:h-10 flex items-center justify-center"
        >
          <AnimatePresence mode="wait">
            <motion.p
              key={currentTagline}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.4 }}
              className="text-lg sm:text-xl md:text-2xl font-medium text-indigo-600/80 dark:text-indigo-400/80"
            >
              {taglines[currentTagline]}
            </motion.p>
          </AnimatePresence>
        </motion.div>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="mt-4 sm:mt-6 text-base sm:text-lg text-slate-500 dark:text-slate-400 max-w-2xl mx-auto leading-relaxed"
        >
          From meeting recordings to task allocation, ClubOps AI automates the busywork
          so your team can focus on building something great.
        </motion.p>

        {/* CTA Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.6 }}
          className="mt-10 sm:mt-12 flex flex-col sm:flex-row items-center justify-center gap-4"
        >
          <Link
            href="/createClub"
            className="group w-full sm:w-auto relative rounded-2xl bg-gradient-to-r from-[#738852] to-[#859B62] px-8 py-4 text-base font-bold text-white shadow-xl shadow-[#859B62]/25 hover:shadow-2xl hover:shadow-[#859B62]/35 transition-all duration-300 active:scale-[0.97] overflow-hidden"
          >
            <span className="relative z-10">Create a Club →</span>
            <div className="absolute inset-0 bg-gradient-to-r from-[#859B62] to-[#9AB277] opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          </Link>
          <Link
            href="/joinClub"
            className="w-full sm:w-auto rounded-2xl border border-[#DDD7C8] dark:border-[#283422] bg-white/80 dark:bg-[#192015]/80 hover:bg-[#F2ECE1] dark:hover:bg-[#202A1B] px-8 py-4 text-base font-bold text-[#1B2213] dark:text-[#F4F6F0] backdrop-blur-md transition-all duration-300 active:scale-[0.97] shadow-sm hover:shadow-md"
          >
            Join with Club Code
          </Link>
        </motion.div>

        {/* Floating trust indicators */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1, duration: 0.8 }}
          className="mt-14 sm:mt-20 flex flex-wrap items-center justify-center gap-6 sm:gap-10 text-sm text-slate-400 dark:text-slate-500"
        >
          <div className="flex items-center gap-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-emerald-500"><path d="m9 12 2 2 4-4" /><circle cx="12" cy="12" r="10" /></svg>
            <span>Free & Open Source</span>
          </div>
          <div className="flex items-center gap-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-emerald-500"><path d="m9 12 2 2 4-4" /><circle cx="12" cy="12" r="10" /></svg>
            <span>No Credit Card Required</span>
          </div>
          <div className="flex items-center gap-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-emerald-500"><path d="m9 12 2 2 4-4" /><circle cx="12" cy="12" r="10" /></svg>
            <span>Setup in 30 Seconds</span>
          </div>
        </motion.div>
      </motion.section>

      {/* ─── Features Section ─── */}
      <section id="features" className="relative z-10 py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            className="text-center mb-16 sm:mb-20"
          >
            <motion.div variants={fadeInUp} className="inline-flex items-center gap-2 rounded-full border border-[#D0DBC2] dark:border-[#2E3C27] bg-[#EBF0E2] dark:bg-[#202A1B] px-4 py-1.5 text-xs font-semibold text-[#3D4A27] dark:text-[#A0BC7B] mb-6">
              ✦ Powerful Features
            </motion.div>
            <motion.h2 variants={fadeInUp} className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight text-[#1B2213] dark:text-[#F4F6F0]">
              Everything your club needs,{" "}
              <span className="bg-gradient-to-r from-[#6E834F] to-[#859B62] dark:from-[#8FA96D] dark:to-[#BCD1A6] bg-clip-text text-transparent">
                powered by AI
              </span>
            </motion.h2>
            <motion.p variants={fadeInUp} className="mt-4 text-base sm:text-lg text-slate-500 dark:text-slate-400 max-w-2xl mx-auto">
              Six intelligent modules working together to eliminate chaos and keep your team operating at peak efficiency.
            </motion.p>
          </motion.div>

          <motion.div
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-50px" }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6"
          >
            {features.map((feature, index) => (
              <motion.div
                key={feature.title}
                variants={fadeInUp}
                whileHover={{ y: -6, transition: { duration: 0.25 } }}
                className={`group relative rounded-2xl sm:rounded-3xl border border-slate-200/60 dark:border-white/[0.06] bg-white/80 dark:bg-white/[0.02] p-7 sm:p-8 backdrop-blur-md shadow-sm hover:shadow-xl transition-all duration-300 ${feature.borderHover}`}
              >
                {/* Glow on hover */}
                <div className={`absolute -inset-px rounded-2xl sm:rounded-3xl ${feature.bgGlow} opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-xl -z-10`} />

                <div className={`flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br ${feature.gradient} text-white shadow-lg mb-5`}>
                  {feature.icon}
                </div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">
                  {feature.title}
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                  {feature.description}
                </p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ─── How It Works Section ─── */}
      <section id="how-it-works" className="relative z-10 py-24 sm:py-32">
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            className="text-center mb-16 sm:mb-20"
          >
            <motion.div variants={fadeInUp} className="inline-flex items-center gap-2 rounded-full border border-emerald-200/60 dark:border-emerald-500/20 bg-emerald-50/80 dark:bg-emerald-500/[0.06] px-4 py-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300 mb-6">
              ✦ Simple Workflow
            </motion.div>
            <motion.h2 variants={fadeInUp} className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight text-slate-900 dark:text-white">
              Up and running in{" "}
              <span className="bg-gradient-to-r from-emerald-600 to-teal-600 dark:from-emerald-400 dark:to-teal-400 bg-clip-text text-transparent">
                3 simple steps
              </span>
            </motion.h2>
          </motion.div>

          <motion.div
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-50px" }}
            className="grid grid-cols-1 md:grid-cols-3 gap-8 sm:gap-10"
          >
            {steps.map((step, i) => (
              <motion.div key={step.number} variants={fadeInUp} className="relative text-center">
                {/* Connector line */}
                {i < steps.length - 1 && (
                  <div className="hidden md:block absolute top-10 left-[calc(50%+40px)] w-[calc(100%-80px)] h-[2px] bg-gradient-to-r from-indigo-300 to-transparent dark:from-indigo-600 dark:to-transparent" />
                )}
                <motion.div
                  whileHover={{ scale: 1.08 }}
                  className="inline-flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-[#738852] to-[#859B62] text-white text-2xl font-black shadow-xl shadow-[#859B62]/25 mb-6"
                >
                  {step.number}
                </motion.div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
                  {step.title}
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed max-w-xs mx-auto">
                  {step.description}
                </p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ─── Stats / Impact Section ─── */}
      <section id="stats" className="relative z-10 py-24 sm:py-32">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-50px" }}
            variants={staggerContainer}
            className="rounded-3xl sm:rounded-[2rem] border border-[#D0DBC2] dark:border-[#2E3C27] bg-gradient-to-br from-[#45522B] via-[#5C7040] to-[#738852] p-10 sm:p-16 relative overflow-hidden shadow-xl"
          >
            {/* Decorative elements */}
            <div className="absolute top-0 right-0 w-80 h-80 bg-white/[0.05] rounded-full blur-3xl -translate-y-1/2 translate-x-1/3" />
            <div className="absolute bottom-0 left-0 w-60 h-60 bg-[#859B62]/20 rounded-full blur-3xl translate-y-1/3 -translate-x-1/4" />

            <motion.div variants={fadeInUp} className="text-center mb-12 relative z-10">
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-white tracking-tight">
                Built for Impact
              </h2>
              <p className="mt-3 text-[#EAF0E2] text-base sm:text-lg max-w-xl mx-auto">
                Designed to solve the real operational challenges faced by college clubs every day.
              </p>
            </motion.div>

            <motion.div
              variants={staggerContainer}
              className="grid grid-cols-2 md:grid-cols-4 gap-6 sm:gap-8 relative z-10"
            >
              {[
                { value: 100, suffix: "%", label: "Burnout Prevention" },
                { value: 30, suffix: "s", label: "Club Setup Time" },
                { value: 10, suffix: "x", label: "Faster Task Assignment" },
                { value: 0, suffix: "", label: "Manual Overhead", display: "Zero" },
              ].map((stat) => (
                <motion.div
                  key={stat.label}
                  variants={scaleIn}
                  className="text-center rounded-2xl bg-white/[0.08] backdrop-blur-md border border-white/[0.08] p-5 sm:p-6 hover:bg-white/[0.12] transition-colors duration-300"
                >
                  <div className="text-3xl sm:text-4xl md:text-5xl font-black text-white">
                    {stat.display ? stat.display : <AnimatedCounter target={stat.value} suffix={stat.suffix} />}
                  </div>
                  <div className="mt-2 text-xs sm:text-sm font-medium text-indigo-100/70">
                    {stat.label}
                  </div>
                </motion.div>
              ))}
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* ─── AI Copilot Highlight Section ─── */}
      <section className="relative z-10 py-24 sm:py-32">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center"
          >
            {/* Left: Text */}
            <div>
              <motion.div variants={fadeInUp} className="inline-flex items-center gap-2 rounded-full border border-amber-200/60 dark:border-amber-500/20 bg-amber-50/80 dark:bg-amber-500/[0.06] px-4 py-1.5 text-xs font-semibold text-amber-700 dark:text-amber-300 mb-6">
                ✦ AI Copilot
              </motion.div>
              <motion.h2 variants={fadeInUp} className="text-3xl sm:text-4xl font-black tracking-tight text-slate-900 dark:text-white leading-tight">
                Your intelligent assistant,{" "}
                <span className="bg-gradient-to-r from-amber-500 to-orange-600 dark:from-amber-400 dark:to-orange-400 bg-clip-text text-transparent">
                  always ready
                </span>
              </motion.h2>
              <motion.p variants={fadeInUp} className="mt-4 text-base text-slate-500 dark:text-slate-400 leading-relaxed">
                Ask anything about your clubs, events, tasks, or members. The AI Copilot has full context
                of your platform and delivers instant, helpful answers.
              </motion.p>
              <motion.ul variants={staggerContainer} className="mt-8 space-y-4">
                {[
                  "Knows all your clubs, members, and events",
                  "Answers queries about tasks and assignments",
                  "Guides you through any platform feature",
                  "Available 24/7 with contextual awareness",
                ].map((item) => (
                  <motion.li key={item} variants={fadeInUp} className="flex items-start gap-3 text-sm text-slate-600 dark:text-slate-300">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="shrink-0 mt-0.5 text-indigo-500">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5" />
                      <path d="m9 12 2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    {item}
                  </motion.li>
                ))}
              </motion.ul>
            </div>

            {/* Right: Mockup */}
            <motion.div variants={scaleIn} className="relative">
              <div className="rounded-2xl sm:rounded-3xl border border-slate-200/60 dark:border-white/[0.06] bg-white/80 dark:bg-white/[0.03] backdrop-blur-md p-6 sm:p-8 shadow-2xl">
                {/* Mock chat header */}
                <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-200/60 dark:border-white/[0.06]">
                  <div className="h-10 w-10 rounded-full bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center text-white">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" /></svg>
                  </div>
                  <div>
                    <div className="font-bold text-sm text-slate-900 dark:text-white">ClubOps AI Copilot</div>
                    <div className="text-xs text-emerald-500 flex items-center gap-1">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Online
                    </div>
                  </div>
                </div>

                {/* Mock messages */}
                <div className="space-y-4">
                  <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.3 }}
                    className="ml-auto max-w-[80%] rounded-2xl rounded-tr-md bg-indigo-600 text-white px-4 py-2.5 text-sm"
                  >
                    How many events does our tech club have next week?
                  </motion.div>
                  <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.6 }}
                    className="mr-auto max-w-[85%] rounded-2xl rounded-tl-md bg-slate-100 dark:bg-white/[0.06] text-slate-800 dark:text-slate-200 px-4 py-2.5 text-sm"
                  >
                    Your <strong>Tech Innovators Club</strong> has <strong>3 upcoming events</strong> next week:
                    a Workshop, a Hackathon Prep session, and a Guest Speaker event. Would you like details? 🎯
                  </motion.div>
                </div>

                {/* Input mockup */}
                <div className="mt-6 flex items-center gap-2 rounded-xl border border-slate-200/60 dark:border-white/[0.06] bg-slate-50 dark:bg-white/[0.03] px-4 py-3">
                  <span className="text-sm text-slate-400">Ask anything about your clubs...</span>
                  <div className="ml-auto h-8 w-8 rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 flex items-center justify-center text-white shrink-0">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="m5 12h14M12 5l7 7-7 7" /></svg>
                  </div>
                </div>
              </div>

              {/* Decorative dots */}
              <div className="absolute -z-10 -top-4 -right-4 w-24 h-24 rounded-full bg-gradient-to-br from-amber-400/20 to-orange-400/20 blur-2xl" />
              <div className="absolute -z-10 -bottom-6 -left-6 w-32 h-32 rounded-full bg-gradient-to-br from-indigo-400/15 to-violet-400/15 blur-2xl" />
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* ─── Final CTA Section ─── */}
      <section className="relative z-10 py-24 sm:py-32">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 text-center">
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
          >
            <motion.h2 variants={fadeInUp} className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight text-[#1B2213] dark:text-[#F4F6F0]">
              Ready to supercharge{" "}
              <span className="bg-gradient-to-r from-[#6E834F] via-[#859B62] to-[#9AB277] dark:from-[#8FA96D] dark:via-[#9AB277] dark:to-[#BCD1A6] bg-clip-text text-transparent">
                your club?
              </span>
            </motion.h2>
            <motion.p variants={fadeInUp} className="mt-4 text-base sm:text-lg text-[#737E67] dark:text-[#8E9A82] max-w-xl mx-auto">
              Join the clubs already running smarter with AI-powered operations.
              Create your club or jump in as a volunteer — it only takes 30 seconds.
            </motion.p>
            <motion.div variants={fadeInUp} className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/createClub"
                className="group w-full sm:w-auto relative rounded-2xl bg-gradient-to-r from-[#738852] to-[#859B62] px-10 py-4.5 text-base font-bold text-white shadow-xl shadow-[#859B62]/25 hover:shadow-2xl hover:shadow-[#859B62]/35 transition-all duration-300 active:scale-[0.97] overflow-hidden"
              >
                <span className="relative z-10">Create Your Club →</span>
                <div className="absolute inset-0 bg-gradient-to-r from-[#859B62] to-[#9AB277] opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              </Link>
              <Link
                href="/joinClub"
                className="w-full sm:w-auto rounded-2xl border border-[#DDD7C8] dark:border-[#283422] bg-white/80 dark:bg-[#192015]/80 hover:bg-[#F2ECE1] dark:hover:bg-[#202A1B] px-10 py-4.5 text-base font-bold text-[#1B2213] dark:text-[#F4F6F0] backdrop-blur-md transition-all duration-300 active:scale-[0.97] shadow-sm hover:shadow-md"
              >
                Join a Club
              </Link>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* ─── Footer ─── */}
      <footer className="relative z-10 border-t border-slate-200/60 dark:border-white/[0.06] py-10">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-tr from-[#738852] to-[#859B62] text-white shadow-xs">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" fill="currentColor" />
              </svg>
            </div>
            <span className="font-bold text-[#1B2213] dark:text-[#F4F6F0]">
              ClubOps <span className="text-[#859B62] dark:text-[#9AB277]">AI</span>
            </span>
          </div>
          <p className="text-sm text-slate-400 dark:text-slate-500">
            © {new Date().getFullYear()} ClubOps AI. Built with ❤️ for college clubs.
          </p>
        </div>
      </footer>
    </div>
  );
}
