"use client";

/**
 * Nothing Sus — Admin Command Center (front page for organizers).
 *
 * Single-file React component: Tailwind for styling, lucide-react for icons.
 * Dark minimalist glassmorphism + asymmetric bento grid.
 *
 * Data: if the browser holds an admin session (opened via the secret
 * /control/<secret> link), the page polls /api/game/state?as=ADMIN and shows
 * LIVE telemetry. Otherwise it runs on a realistic DEMO roster so the
 * console stays fully interactive for briefings and rehearsals.
 * Meeting + sabotage timers run locally on this device (organizer tools).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MouseEvent as ReactMouseEvent, ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { Manrope } from "next/font/google";
import {
  Activity,
  AlarmClock,
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronRight,
  CircleCheck,
  CodeXml,
  Cpu,
  Crosshair,
  Eye,
  EyeOff,
  FlaskConical,
  Flame,
  Gauge,
  Ghost,
  KeyRound,
  LayoutDashboard,
  Lightbulb,
  Menu,
  Megaphone,
  MonitorPlay,
  Pause,
  Play,
  Printer,
  Puzzle,
  Radar,
  Radio,
  RotateCcw,
  Search,
  ShieldAlert,
  Siren,
  Skull,
  Sparkles,
  Tag,
  Target,
  Timer,
  TriangleAlert,
  Trophy,
  Undo2,
  Users,
  UserX,
  Vote,
  WifiOff,
  Wind,
  Wrench,
  X,
  Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

const manrope = Manrope({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

/* ───────────────────────────── constants & types ───────────────────────────── */

const POINT_TARGET = 10_000;
const MEETING_MS = 3 * 60 * 1000;
const TOTAL_IMPOSTORS = 4;

type Role = "CREW" | "IMPOSTOR";
type Status = "ALIVE" | "TAGGED" | "GHOST";
type Discipline = "Electronics" | "Mechanical" | "Software" | "Chemical" | "Civil";

interface Player {
  id: string;
  num: number;
  name: string;
  role: Role;
  status: Status;
  discipline: Discipline;
  color: string;
  points: number;
}

interface LiveState {
  game: { roomCode: string | null; status: string; currentRoundNumber: number };
  participants: Array<{
    id: string;
    name: string;
    playerNumber: number | null;
    role: string | null;
    status: string;
  }>;
  taskProgress: { completed: number; inPlay: number; percentage: number };
  activeMeeting: { status: string; voteCount: number; aliveVoterCount: number } | null;
}

const CREW_COLORS = [
  "#C51111", "#132ED1", "#117F2D", "#ED54BA", "#EF7D0D", "#F5F557",
  "#6B2FBB", "#38FEDC", "#50EF39", "#D6E0F0", "#71491E", "#3F474E",
];

const NAMES = [
  "Aarav", "Ishita", "Kabir", "Meera", "Rohan", "Ananya", "Vihaan", "Saanvi", "Arjun", "Diya",
  "Reyansh", "Kavya", "Advait", "Myra", "Dhruv", "Tara", "Aditya", "Nisha", "Krish", "Riya",
  "Yash", "Pooja", "Neel", "Sara", "Aryan", "Ira", "Kunal", "Zoya", "Veer", "Anika",
];

const DISCIPLINE_KEYS: Discipline[] = ["Electronics", "Mechanical", "Software", "Chemical", "Civil"];
const IMPOSTOR_IDX = new Set([4, 11, 19, 26]);
const TAGGED_IDX = new Set([7, 15]);
const GHOST_IDX = new Set([2, 21, 28]);

const DEMO_PLAYERS: Player[] = NAMES.map((name, i) => ({
  id: `demo-${i}`,
  num: i + 1,
  name,
  role: IMPOSTOR_IDX.has(i) ? "IMPOSTOR" : "CREW",
  status: GHOST_IDX.has(i) ? "GHOST" : TAGGED_IDX.has(i) ? "TAGGED" : "ALIVE",
  discipline: DISCIPLINE_KEYS[i % DISCIPLINE_KEYS.length],
  color: CREW_COLORS[i % CREW_COLORS.length],
  points: 80 + ((i * 137) % 340),
}));

const DISCIPLINES: Array<{
  key: Discipline;
  label: string;
  icon: LucideIcon;
  done: number;
  total: number;
  points: number;
}> = [
  { key: "Electronics", label: "Circuits & Electronics", icon: Cpu, done: 14, total: 20, points: 1680 },
  { key: "Mechanical", label: "Mechanical Assembly", icon: Wrench, done: 11, total: 18, points: 1320 },
  { key: "Software", label: "Code & Logic", icon: CodeXml, done: 16, total: 20, points: 1840 },
  { key: "Chemical", label: "Chemistry Lab", icon: FlaskConical, done: 7, total: 14, points: 860 },
  { key: "Civil", label: "Structural Design", icon: Puzzle, done: 6, total: 12, points: 720 },
];

const SABOTAGES: Array<{
  id: string;
  name: string;
  icon: LucideIcon;
  critical: boolean;
  seconds: number;
  fix: string;
}> = [
  { id: "reactor", name: "Reactor Meltdown", icon: Flame, critical: true, seconds: 90, fix: "Two crew hold both reactor pads simultaneously." },
  { id: "o2", name: "O₂ Depletion", icon: Wind, critical: true, seconds: 60, fix: "Enter the 5-digit code split across two rooms." },
  { id: "lights", name: "Lights Out", icon: Lightbulb, critical: false, seconds: 45, fix: "Flip the breaker sequence on the electrical panel." },
  { id: "comms", name: "Comms Jam", icon: WifiOff, critical: false, seconds: 45, fix: "Re-tune the frequency dial to the target band." },
];

const RIDDLES = [
  { q: "I have keys but open no locks, space but no room. You can enter, but never go outside.", a: "A keyboard" },
  { q: "12 V across a 4 Ω resistor. How much current flows?", a: "3 A (Ohm's law)" },
  { q: "Convert 0x2A to decimal.", a: "42" },
  { q: "I run forever unless you break me.", a: "An infinite loop — while(true)" },
];

const TICKER = [
  { icon: CircleCheck, text: "Kabir cleared Breaker Grid", meta: "+120 pts", tone: "cyan" },
  { icon: Tag, text: "Sabotage tag discovered · Bay 3", meta: "meeting called", tone: "red" },
  { icon: CircleCheck, text: "Ananya solved DNA Sequence", meta: "+180 pts", tone: "cyan" },
  { icon: Ghost, text: "Meera entered the Ghost Lounge", meta: "riddle 2/4", tone: "violet" },
  { icon: CircleCheck, text: "Dhruv calibrated Engine Thrusters", meta: "+150 pts", tone: "cyan" },
  { icon: Vote, text: "Vote closed · Reyansh ejected", meta: "was not an impostor", tone: "red" },
  { icon: CircleCheck, text: "Team Software passed 80%", meta: "+400 bonus", tone: "cyan" },
] as const;

const NAV = [
  { id: "overview", label: "Overview" },
  { id: "console", label: "Console" },
  { id: "mechanics", label: "Mechanics" },
  { id: "protocol", label: "Protocol" },
] as const;

type SectionId = (typeof NAV)[number]["id"];

/* ───────────────────────────────── helpers ─────────────────────────────────── */

function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

function formatClock(ms: number) {
  const total = Math.ceil(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function scrollToSection(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

/** Wall-clock accurate countdown (survives tab throttling). */
function useCountdown(initialMs: number) {
  const [remaining, setRemaining] = useState(initialMs);
  const [running, setRunning] = useState(false);
  const endAt = useRef(0);

  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => {
      const left = Math.max(0, endAt.current - Date.now());
      setRemaining(left);
      if (left === 0) setRunning(false);
    }, 200);
    return () => window.clearInterval(id);
  }, [running]);

  const arm = useCallback((ms: number) => {
    endAt.current = Date.now() + ms;
    setRemaining(ms);
    setRunning(true);
  }, []);

  const pause = useCallback(() => {
    setRunning(false);
    setRemaining(Math.max(0, endAt.current - Date.now()));
  }, []);

  const reset = useCallback((ms: number) => {
    setRunning(false);
    setRemaining(ms);
  }, []);

  return { remaining, running, arm, pause, reset };
}

/* ─────────────────────────────── primitives ───────────────────────────────── */

const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00F0FF]/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0B0B0F]";

const GLASS = "border border-white/[0.08] bg-[#12121A]/40 backdrop-blur-[20px]";

function CrewGlyph({ color, className, dimmed }: { color: string; className?: string; dimmed?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={cn(className, dimmed && "opacity-35 grayscale")}>
      <rect x="3.6" y="9" width="3.6" height="7.5" rx="1.4" fill={color} stroke="#000" strokeOpacity=".55" strokeWidth=".9" />
      <path
        d="M6.6 7.4A5.4 5.4 0 0 1 12 2a5.4 5.4 0 0 1 5.4 5.4V19.2a1.6 1.6 0 0 1-1.6 1.6h-1.9a1.6 1.6 0 0 1-1.6-1.6v-1.4h-.7v1.4a1.6 1.6 0 0 1-1.6 1.6H8.2a1.6 1.6 0 0 1-1.6-1.6Z"
        fill={color}
        stroke="#000"
        strokeOpacity=".55"
        strokeWidth=".9"
      />
      <rect x="10.6" y="5.6" width="8.6" height="4.8" rx="2.4" fill="#9BD3E6" stroke="#000" strokeOpacity=".55" strokeWidth=".9" />
      <rect x="13.4" y="6.5" width="3.6" height="1.3" rx=".65" fill="#fff" opacity=".85" />
    </svg>
  );
}

/** Glass card with a cursor-tracking spotlight and a hairline border that lights up. */
function BentoCard({
  children,
  className,
  glow = "cyan",
  as: Comp = "div",
}: {
  children: ReactNode;
  className?: string;
  glow?: "cyan" | "violet" | "red";
  as?: "div" | "article" | "li";
}) {
  const ref = useRef<HTMLElement | null>(null);
  const onMove = (e: ReactMouseEvent<HTMLElement>) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty("--mx", `${e.clientX - r.left}px`);
    el.style.setProperty("--my", `${e.clientY - r.top}px`);
  };

  const fill = {
    cyan: "bg-[radial-gradient(520px_circle_at_var(--mx)_var(--my),rgba(0,240,255,0.09),transparent_45%)]",
    violet: "bg-[radial-gradient(520px_circle_at_var(--mx)_var(--my),rgba(139,92,246,0.11),transparent_45%)]",
    red: "bg-[radial-gradient(520px_circle_at_var(--mx)_var(--my),rgba(255,59,92,0.10),transparent_45%)]",
  }[glow];

  const edge = {
    cyan: "bg-[radial-gradient(320px_circle_at_var(--mx)_var(--my),rgba(0,240,255,0.75),rgba(139,92,246,0.35)_45%,transparent_70%)]",
    violet: "bg-[radial-gradient(320px_circle_at_var(--mx)_var(--my),rgba(139,92,246,0.85),rgba(0,240,255,0.3)_45%,transparent_70%)]",
    red: "bg-[radial-gradient(320px_circle_at_var(--mx)_var(--my),rgba(255,59,92,0.8),rgba(139,92,246,0.3)_45%,transparent_70%)]",
  }[glow];

  return (
    <Comp
      ref={ref as never}
      onMouseMove={onMove}
      className={cn(
        "group/card relative overflow-hidden rounded-3xl [--mx:50%] [--my:50%]",
        GLASS,
        "transition-[transform,box-shadow,border-color] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]",
        "hover:-translate-y-1 hover:border-white/[0.14] hover:shadow-[0_24px_70px_-28px_rgba(0,240,255,0.35)]",
        className,
      )}
    >
      <div aria-hidden className={cn("pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover/card:opacity-100", fill)} />
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-0 rounded-[inherit] p-px opacity-0 transition-opacity duration-500 group-hover/card:opacity-100",
          "[mask:linear-gradient(#000_0_0)_content-box,linear-gradient(#000_0_0)] [mask-composite:exclude]",
          edge,
        )}
      />
      <div className="relative h-full">{children}</div>
    </Comp>
  );
}

function Eyebrow({ icon: Icon, children }: { icon: LucideIcon; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-400">
      <Icon className="h-3.5 w-3.5 text-[#00F0FF]" strokeWidth={2.25} />
      {children}
    </span>
  );
}

function SectionHeading({
  icon,
  eyebrow,
  title,
  sub,
  align = "left",
}: {
  icon: LucideIcon;
  eyebrow: string;
  title: ReactNode;
  sub: string;
  align?: "left" | "center";
}) {
  return (
    <div className={cn("mb-10 flex flex-col gap-4 md:mb-14", align === "center" && "items-center text-center")}>
      <Eyebrow icon={icon}>{eyebrow}</Eyebrow>
      <h2 className="max-w-3xl text-3xl font-extrabold leading-[1.05] tracking-[-0.03em] text-white sm:text-4xl md:text-5xl">
        {title}
      </h2>
      <p className="max-w-2xl text-[15px] leading-relaxed text-zinc-400 md:text-base">{sub}</p>
    </div>
  );
}

function PrimaryButton({
  href,
  onClick,
  children,
  icon: Icon = ArrowRight,
  className,
}: {
  href?: string;
  onClick?: () => void;
  children: ReactNode;
  icon?: LucideIcon;
  className?: string;
}) {
  const cls = cn(
    "group/btn relative inline-flex items-center justify-center gap-2 overflow-hidden rounded-full px-6 py-3 text-sm font-bold text-[#04121A]",
    "bg-[#00F0FF] shadow-[0_0_0_1px_rgba(0,240,255,0.4),0_10px_40px_-10px_rgba(0,240,255,0.65)]",
    "transition-all duration-300 hover:bg-white hover:shadow-[0_0_0_1px_rgba(255,255,255,0.6),0_14px_50px_-10px_rgba(0,240,255,0.8)] active:scale-[0.97]",
    FOCUS_RING,
    className,
  );
  const inner = (
    <>
      <span>{children}</span>
      <Icon className="h-4 w-4 transition-transform duration-300 group-hover/btn:translate-x-0.5" strokeWidth={2.5} />
    </>
  );
  return href ? (
    <Link href={href} className={cls}>
      {inner}
    </Link>
  ) : (
    <button type="button" onClick={onClick} className={cls}>
      {inner}
    </button>
  );
}

function GhostButton({
  href,
  onClick,
  children,
  icon: Icon,
  className,
}: {
  href?: string;
  onClick?: () => void;
  children: ReactNode;
  icon?: LucideIcon;
  className?: string;
}) {
  const cls = cn(
    "group/btn inline-flex items-center justify-center gap-2 rounded-full border border-white/[0.1] bg-white/[0.03] px-6 py-3 text-sm font-semibold text-zinc-200",
    "backdrop-blur-[20px] transition-all duration-300 hover:border-[#00F0FF]/40 hover:bg-[#00F0FF]/[0.06] hover:text-white active:scale-[0.97]",
    FOCUS_RING,
    className,
  );
  const inner = (
    <>
      {Icon && <Icon className="h-4 w-4 text-zinc-400 transition-colors duration-300 group-hover/btn:text-[#00F0FF]" />}
      <span>{children}</span>
    </>
  );
  return href ? (
    <Link href={href} className={cls}>
      {inner}
    </Link>
  ) : (
    <button type="button" onClick={onClick} className={cls}>
      {inner}
    </button>
  );
}

/** Equal-width segmented tabs with a sliding indicator (no layout measuring). */
function SegmentedTabs<T extends string>({
  items,
  value,
  onChange,
  label,
  idPrefix,
  size = "md",
}: {
  items: Array<{ id: T; label: string; icon?: LucideIcon; badge?: number }>;
  value: T;
  onChange: (id: T) => void;
  label: string;
  idPrefix: string;
  size?: "sm" | "md";
}) {
  const idx = Math.max(0, items.findIndex((i) => i.id === value));
  return (
    <div
      role="tablist"
      aria-label={label}
      className="relative grid rounded-full border border-white/[0.08] bg-black/30 p-1"
      style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}
    >
      <span
        aria-hidden
        className="absolute inset-y-1 left-1 rounded-full border border-[#00F0FF]/40 bg-[#00F0FF]/[0.1] shadow-[0_0_24px_-6px_rgba(0,240,255,0.6)] transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]"
        style={{ width: `calc((100% - 0.5rem) / ${items.length})`, transform: `translateX(${idx * 100}%)` }}
      />
      {items.map((item) => {
        const active = item.id === value;
        const Icon = item.icon;
        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            id={`${idPrefix}-tab-${item.id}`}
            aria-selected={active}
            aria-controls={`${idPrefix}-panel-${item.id}`}
            onClick={() => onChange(item.id)}
            className={cn(
              "relative z-10 flex items-center justify-center gap-2 rounded-full font-semibold transition-colors duration-300",
              size === "sm" ? "px-2 py-1.5 text-xs" : "px-2 py-2.5 text-[13px] sm:px-4",
              active ? "text-white" : "text-zinc-500 hover:text-zinc-200",
              FOCUS_RING,
            )}
          >
            {Icon && <Icon className={cn("h-4 w-4 shrink-0 transition-colors", active ? "text-[#00F0FF]" : "")} />}
            <span className={cn(Icon && size === "md" && "hidden sm:inline")}>{item.label}</span>
            {typeof item.badge === "number" && item.badge > 0 && (
              <span className="hidden rounded-full bg-white/10 px-1.5 text-[10px] tabular-nums text-zinc-300 sm:inline">
                {item.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/* ───────────────────────────────── navbar ─────────────────────────────────── */

function Navbar({
  active,
  mode,
  roomCode,
  alarm,
}: {
  active: SectionId;
  mode: "live" | "demo";
  roomCode: string | null;
  alarm: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const idx = Math.max(0, NAV.findIndex((n) => n.id === active));

  const go = (id: string) => {
    setOpen(false);
    scrollToSection(id);
  };

  return (
    <header className="pointer-events-none fixed inset-x-0 top-3 z-50 flex justify-center px-3 sm:top-5">
      <div className="pointer-events-auto w-full max-w-[860px]">
        <nav
          aria-label="Primary"
          className={cn(
            "flex items-center justify-between gap-2 rounded-full border bg-[#12121A]/55 py-1.5 pl-2 pr-1.5 backdrop-blur-[20px] transition-all duration-500",
            scrolled
              ? "border-white/[0.1] shadow-[0_20px_60px_-20px_rgba(0,0,0,0.9)]"
              : "border-white/[0.06]",
          )}
        >
          <button
            type="button"
            onClick={() => go("overview")}
            className={cn("group flex items-center gap-2 rounded-full pr-2", FOCUS_RING)}
            aria-label="Nothing Sus — back to top"
          >
            <span className="relative grid h-9 w-9 place-items-center rounded-full border border-white/[0.08] bg-gradient-to-b from-white/[0.08] to-transparent">
              <Image src="/assets/among-us/crewmate-logo.png" alt="" width={534} height={573} className="h-6 w-auto transition-transform duration-500 group-hover:-rotate-12" />
              <span
                className={cn(
                  "absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-[#12121A]",
                  alarm ? "bg-[#FF3B5C] motion-safe:animate-pulse" : mode === "live" ? "bg-emerald-400" : "bg-zinc-500",
                )}
              />
            </span>
            <span className="hidden text-sm font-extrabold tracking-[-0.02em] text-white sm:inline">
              Nothing<span className="text-[#FF3B5C]">Sus</span>
            </span>
          </button>

          {/* desktop links */}
          <div className="relative hidden grid-cols-4 rounded-full md:grid">
            <span
              aria-hidden
              className="absolute inset-y-0 left-0 w-1/4 rounded-full border border-[#00F0FF]/30 bg-[#00F0FF]/[0.08] transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]"
              style={{ transform: `translateX(${idx * 100}%)` }}
            />
            {NAV.map((n) => (
              <button
                key={n.id}
                type="button"
                onClick={() => go(n.id)}
                aria-current={active === n.id ? "true" : undefined}
                className={cn(
                  "relative z-10 w-[6.5rem] rounded-full py-2 text-[13px] font-semibold transition-colors duration-300",
                  active === n.id ? "text-white" : "text-zinc-500 hover:text-zinc-200",
                  FOCUS_RING,
                )}
              >
                {n.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1.5">
            <span
              className={cn(
                "hidden items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] lg:inline-flex",
                mode === "live"
                  ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-300"
                  : "border-white/10 bg-white/[0.04] text-zinc-400",
              )}
              title={mode === "live" ? "Synced with the game engine" : "Open your secret admin link to sync live data"}
            >
              <span className={cn("h-1.5 w-1.5 rounded-full", mode === "live" ? "bg-emerald-400 motion-safe:animate-pulse" : "bg-zinc-500")} />
              {mode === "live" ? (roomCode ? `Live · ${roomCode}` : "Live") : "Demo"}
            </span>
            {mode === "demo" ? (
              <Link
                href="/"
                className={cn(
                  "hidden items-center gap-1.5 rounded-full bg-[#FF3B5C] px-4 py-2 text-[13px] font-bold text-black transition-all duration-300 hover:bg-white sm:inline-flex shadow-[0_0_15px_rgba(255,59,92,0.5)]",
                  FOCUS_RING,
                )}
              >
                Admin Login
                <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={2.5} />
              </Link>
            ) : (
              <Link
                href="/control"
                className={cn(
                  "hidden items-center gap-1.5 rounded-full bg-[#00F0FF] px-4 py-2 text-[13px] font-bold text-[#04121A] transition-all duration-300 hover:bg-white sm:inline-flex",
                  FOCUS_RING,
                )}
              >
                Control Deck
                <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={2.5} />
              </Link>
            )}
            <button
              type="button"
              onClick={() => setOpen((o) => !o)}
              aria-expanded={open}
              aria-controls="mobile-nav"
              aria-label={open ? "Close menu" : "Open menu"}
              className={cn(
                "grid h-9 w-9 place-items-center rounded-full border border-white/[0.08] bg-white/[0.04] text-zinc-200 transition-colors hover:bg-white/[0.08] md:hidden",
                FOCUS_RING,
              )}
            >
              {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </button>
          </div>
        </nav>

        {/* mobile sheet */}
        <div
          id="mobile-nav"
          className={cn(
            "mt-2 origin-top overflow-hidden rounded-3xl md:hidden",
            GLASS,
            "bg-[#12121A]/80 transition-all duration-300 ease-out",
            open ? "pointer-events-auto scale-100 opacity-100" : "pointer-events-none scale-95 opacity-0",
          )}
        >
          <div className="flex flex-col p-2">
            {NAV.map((n) => (
              <button
                key={n.id}
                type="button"
                tabIndex={open ? 0 : -1}
                onClick={() => go(n.id)}
                className={cn(
                  "flex items-center justify-between rounded-2xl px-4 py-3 text-left text-sm font-semibold transition-colors",
                  active === n.id ? "bg-[#00F0FF]/[0.08] text-white" : "text-zinc-400 hover:bg-white/[0.04] hover:text-white",
                  FOCUS_RING,
                )}
              >
                {n.label}
                <ChevronRight className={cn("h-4 w-4", active === n.id ? "text-[#00F0FF]" : "text-zinc-600")} />
              </button>
            ))}
            <Link
              href="/control"
              tabIndex={open ? 0 : -1}
              className={cn(
                "mt-1 flex items-center justify-center gap-2 rounded-2xl bg-[#00F0FF] px-4 py-3 text-sm font-bold text-[#04121A] transition-colors hover:bg-white",
                FOCUS_RING,
              )}
            >
              Open Control Deck <ArrowUpRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}

/* ────────────────────────────────── hero ──────────────────────────────────── */

function Hero({ mode, roomCode, status }: { mode: "live" | "demo"; roomCode: string | null; status: string }) {
  return (
    <section id="overview" className="relative scroll-mt-28 pt-32 sm:pt-40 lg:pt-44">
      <div className="grid items-center gap-14 lg:grid-cols-[1.15fr_0.85fr] lg:gap-8">
        <div className="flex flex-col items-start">
          <Eyebrow icon={Radar}>Admin Command Center</Eyebrow>

          <h1 className="mt-6 text-[2.75rem] font-extrabold leading-[0.95] tracking-[-0.045em] text-white sm:text-6xl lg:text-7xl xl:text-[5.4rem]">
            <span className="block bg-gradient-to-b from-white via-white to-zinc-500 bg-clip-text text-transparent">
              Oversee the ship.
            </span>
            <span className="block bg-[linear-gradient(110deg,#00F0FF_0%,#7DD3FC_30%,#8B5CF6_55%,#00F0FF_100%)] bg-[length:200%_auto] bg-clip-text pb-2 text-transparent motion-safe:animate-[ns-shine_9s_linear_infinite]">
              Expose the impostors.
            </span>
          </h1>

          <p className="mt-6 max-w-xl text-base leading-relaxed text-zinc-400 sm:text-lg">
            Mission control for <span className="font-semibold text-zinc-200">Nothing Sus</span> — 30 engineers racing
            multi-disciplinary tasks to a point target while{" "}
            <span className="font-semibold text-[#FF3B5C]">4 hidden impostors</span> tag, sabotage and deceive. Track
            every player, call meetings, run sabotage clocks and rule on the endgame.
          </p>

          <div className="mt-9 flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
            <PrimaryButton href="/control">Launch Control Deck</PrimaryButton>
            <GhostButton onClick={() => scrollToSection("console")} icon={LayoutDashboard}>
              Open Mission Console
            </GhostButton>
          </div>

          <dl className="mt-10 grid w-full max-w-xl grid-cols-3 divide-x divide-white/[0.06] rounded-2xl border border-white/[0.06] bg-white/[0.02]">
            {[
              { k: "Room", v: roomCode ?? (mode === "live" ? "Not set" : "DEMO") },
              { k: "Engine", v: mode === "live" ? status.replace("_", " ") : "Offline" },
              { k: "Roster", v: "30 / 4" },
            ].map((row) => (
              <div key={row.k} className="px-4 py-3">
                <dt className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">{row.k}</dt>
                <dd className="mt-1 truncate font-mono text-sm font-semibold text-zinc-100">{row.v}</dd>
              </div>
            ))}
          </dl>
        </div>

        {/* visual */}
        <div className="relative mx-auto aspect-square w-full max-w-[460px]">
          <div aria-hidden className="absolute inset-[12%] rounded-full bg-[radial-gradient(circle,rgba(255,40,60,0.35),transparent_65%)] blur-2xl" />
          <div aria-hidden className="absolute inset-[4%] rounded-full bg-[radial-gradient(circle,rgba(0,240,255,0.14),transparent_60%)] blur-3xl" />
          <div aria-hidden className="absolute inset-[6%] rounded-full border border-white/[0.06]" />
          <div aria-hidden className="absolute inset-[18%] rounded-full border border-dashed border-[#00F0FF]/20 motion-safe:animate-[ns-spin_40s_linear_infinite]">
            <span className="absolute -top-1 left-1/2 h-2 w-2 -translate-x-1/2 rounded-full bg-[#00F0FF] shadow-[0_0_12px_#00F0FF]" />
          </div>
          <div aria-hidden className="absolute inset-[30%] rounded-full border border-[#8B5CF6]/20 motion-safe:animate-[ns-spin_28s_linear_infinite_reverse]">
            <span className="absolute -bottom-1 left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-[#8B5CF6] shadow-[0_0_12px_#8B5CF6]" />
          </div>

          <div className="absolute inset-[16%] grid place-items-center motion-safe:animate-[ns-float_7s_ease-in-out_infinite]">
            <Image
              src="/assets/among-us/crewmate-logo.png"
              alt="Nothing Sus crewmate"
              width={534}
              height={573}
              priority
              className="h-full w-auto object-contain drop-shadow-[0_30px_60px_rgba(255,30,50,0.35)]"
            />
          </div>

          {/* floating chips */}
          <div className={cn("absolute left-0 top-[14%] flex items-center gap-2.5 rounded-2xl px-3 py-2.5 motion-safe:animate-[ns-float_8s_ease-in-out_infinite_-2s] sm:-left-4", GLASS, "bg-[#12121A]/70")}>
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-[#FF3B5C]/15 text-[#FF3B5C]">
              <Skull className="h-4 w-4" />
            </span>
            <div className="leading-tight">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">Hidden</p>
              <p className="text-sm font-bold text-white">4 Impostors</p>
            </div>
          </div>
          <div className={cn("absolute bottom-[12%] right-0 flex items-center gap-2.5 rounded-2xl px-3 py-2.5 motion-safe:animate-[ns-float_9s_ease-in-out_infinite_-4s] sm:-right-4", GLASS, "bg-[#12121A]/70")}>
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-[#00F0FF]/15 text-[#00F0FF]">
              <Target className="h-4 w-4" />
            </span>
            <div className="leading-tight">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">Target</p>
              <p className="text-sm font-bold tabular-nums text-white">10,000 pts</p>
            </div>
          </div>
          <div className={cn("absolute bottom-[30%] left-[2%] hidden items-center gap-2 rounded-full px-3 py-1.5 sm:flex motion-safe:animate-[ns-float_10s_ease-in-out_infinite_-6s]", GLASS, "bg-[#12121A]/70")}>
            <Tag className="h-3.5 w-3.5 text-[#B6FF3B]" />
            <span className="text-xs font-semibold text-zinc-200">Tag mechanic armed</span>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────── ticker strip ─────────────────────────────── */

function Ticker() {
  const tone = { cyan: "text-[#00F0FF]", red: "text-[#FF3B5C]", violet: "text-[#A78BFA]" } as const;
  const row = [...TICKER, ...TICKER];
  return (
    <div className="relative mt-16 overflow-hidden border-y border-white/[0.06] py-4 [mask-image:linear-gradient(90deg,transparent,#000_12%,#000_88%,transparent)]">
      <div className="flex w-max gap-10 motion-safe:animate-[ns-marquee_45s_linear_infinite] hover:[animation-play-state:paused]">
        {row.map((t, i) => {
          const Icon = t.icon;
          return (
            <div key={i} className="flex shrink-0 items-center gap-2.5 text-sm">
              <Icon className={cn("h-4 w-4", tone[t.tone])} />
              <span className="font-medium text-zinc-300">{t.text}</span>
              <span className="font-mono text-xs text-zinc-600">{t.meta}</span>
              <span className="ml-8 h-1 w-1 rounded-full bg-white/15" />
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ──────────────────────────────── stat strip ──────────────────────────────── */

function StatStrip({
  aliveCrew,
  totalCrew,
  impostorsLeft,
  points,
  meetingRunning,
  meetingRemaining,
  sabotage,
}: {
  aliveCrew: number;
  totalCrew: number;
  impostorsLeft: number;
  points: number;
  meetingRunning: boolean;
  meetingRemaining: number;
  sabotage: { name: string; critical: boolean; remaining: number } | null;
}) {
  const pct = Math.min(100, Math.round((points / POINT_TARGET) * 100));
  const stats = [
    {
      icon: Users,
      label: "Crew alive",
      value: `${aliveCrew}`,
      suffix: `/ ${totalCrew}`,
      bar: totalCrew ? aliveCrew / totalCrew : 0,
      tone: "cyan" as const,
    },
    {
      icon: Skull,
      label: "Impostors active",
      value: `${impostorsLeft}`,
      suffix: `/ ${TOTAL_IMPOSTORS}`,
      bar: impostorsLeft / TOTAL_IMPOSTORS,
      tone: "red" as const,
    },
    {
      icon: Target,
      label: "Point target",
      value: points.toLocaleString("en-IN"),
      suffix: `${pct}%`,
      bar: pct / 100,
      tone: "cyan" as const,
    },
    sabotage
      ? {
          icon: Siren,
          label: sabotage.critical ? `${sabotage.name} · critical` : sabotage.name,
          value: formatClock(sabotage.remaining),
          suffix: "left",
          bar: 1,
          tone: "red" as const,
          alert: true,
        }
      : {
          icon: AlarmClock,
          label: meetingRunning ? "Meeting in session" : "Ship status",
          value: meetingRunning ? formatClock(meetingRemaining) : "Nominal",
          suffix: meetingRunning ? "left" : "",
          bar: meetingRunning ? meetingRemaining / MEETING_MS : 1,
          tone: "violet" as const,
        },
  ];
  const barTone = {
    cyan: "from-[#00F0FF] to-[#7DD3FC]",
    red: "from-[#FF3B5C] to-[#FF7A90]",
    violet: "from-[#8B5CF6] to-[#C4B5FD]",
  };
  return (
    <div className="mt-10 grid grid-cols-2 gap-3 lg:grid-cols-4">
      {stats.map((s) => {
        const Icon = s.icon;
        const alert = "alert" in s && s.alert;
        return (
          <BentoCard key={s.label} glow={s.tone} className={cn("p-4 sm:p-5", alert && "border-[#FF3B5C]/40")}>
            <div className="flex items-center justify-between">
              <span className="truncate text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-500">{s.label}</span>
              <Icon className={cn("h-4 w-4 shrink-0", s.tone === "red" ? "text-[#FF3B5C]" : s.tone === "violet" ? "text-[#A78BFA]" : "text-[#00F0FF]", alert && "motion-safe:animate-pulse")} />
            </div>
            <p className="mt-3 flex items-baseline gap-1.5">
              <span className={cn("text-2xl font-extrabold tabular-nums tracking-[-0.03em] sm:text-3xl", alert ? "text-[#FF3B5C]" : "text-white")}>
                {s.value}
              </span>
              <span className="text-xs font-semibold text-zinc-500">{s.suffix}</span>
            </p>
            <div className="mt-4 h-1 overflow-hidden rounded-full bg-white/[0.06]">
              <div
                className={cn("h-full rounded-full bg-gradient-to-r transition-[width] duration-700", barTone[s.tone])}
                style={{ width: `${Math.max(0, Math.min(1, s.bar)) * 100}%` }}
              />
            </div>
          </BentoCard>
        );
      })}
    </div>
  );
}

/* ───────────────────────────── mission console ────────────────────────────── */

type ConsoleTab = "roster" | "tasks" | "sabotage" | "ghosts";
type RosterFilter = "ALL" | Status;

const STATUS_STYLE: Record<Status, { label: string; cls: string }> = {
  ALIVE: { label: "Alive", cls: "border-emerald-400/25 bg-emerald-400/10 text-emerald-300" },
  TAGGED: { label: "Tagged", cls: "border-[#B6FF3B]/30 bg-[#B6FF3B]/10 text-[#D4FF7A]" },
  GHOST: { label: "Ghost", cls: "border-[#8B5CF6]/30 bg-[#8B5CF6]/10 text-[#C4B5FD]" },
};

function RosterPanel({
  players,
  editable,
  onSetStatus,
}: {
  players: Player[];
  editable: boolean;
  onSetStatus: (id: string, status: Status) => void;
}) {
  const [filter, setFilter] = useState<RosterFilter>("ALL");
  const [query, setQuery] = useState("");
  const [reveal, setReveal] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const counts = useMemo(
    () => ({
      ALL: players.length,
      ALIVE: players.filter((p) => p.status === "ALIVE").length,
      TAGGED: players.filter((p) => p.status === "TAGGED").length,
      GHOST: players.filter((p) => p.status === "GHOST").length,
    }),
    [players],
  );

  const visible = players.filter(
    (p) =>
      (filter === "ALL" || p.status === filter) &&
      (query.trim() === "" ||
        p.name.toLowerCase().includes(query.toLowerCase()) ||
        String(p.num).includes(query.trim())),
  );
  const selected = players.find((p) => p.id === selectedId) ?? null;

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_300px]">
      <div className="min-w-0">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <label className="relative flex-1">
            <span className="sr-only">Search players</span>
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name or #"
              className="w-full rounded-full border border-white/[0.08] bg-black/30 py-2.5 pl-10 pr-4 text-sm text-white placeholder:text-zinc-600 transition-colors focus:border-[#00F0FF]/50 focus:outline-none"
            />
          </label>
          <div className="sm:w-[340px]">
            <SegmentedTabs<RosterFilter>
              size="sm"
              label="Filter roster"
              idPrefix="roster"
              value={filter}
              onChange={setFilter}
              items={[
                { id: "ALL", label: `All ${counts.ALL}` },
                { id: "ALIVE", label: `Alive ${counts.ALIVE}` },
                { id: "TAGGED", label: `Tagged ${counts.TAGGED}` },
                { id: "GHOST", label: `Ghost ${counts.GHOST}` },
              ]}
            />
          </div>
          <button
            type="button"
            onClick={() => setReveal((r) => !r)}
            aria-pressed={reveal}
            className={cn(
              "inline-flex items-center justify-center gap-2 rounded-full border px-4 py-2.5 text-xs font-bold transition-all duration-300",
              reveal
                ? "border-[#FF3B5C]/40 bg-[#FF3B5C]/10 text-[#FF8FA1] hover:bg-[#FF3B5C]/15"
                : "border-white/[0.08] bg-white/[0.03] text-zinc-300 hover:border-white/20 hover:text-white",
              FOCUS_RING,
            )}
          >
            {reveal ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            {reveal ? "Hide roles" : "Reveal roles"}
          </button>
        </div>

        <ul className="mt-5 grid max-h-[460px] grid-cols-2 gap-2.5 overflow-y-auto pr-1 [scrollbar-color:rgba(255,255,255,0.12)_transparent] [scrollbar-width:thin] sm:grid-cols-3 xl:grid-cols-4">
          {players.length === 0 && (
            <div className="col-span-full py-12 text-center text-sm font-bold uppercase tracking-widest text-zinc-500">
              No players have signed up yet.
            </div>
          )}
          {visible.map((p) => {
            const isImp = reveal && p.role === "IMPOSTOR";
            const isSel = p.id === selectedId;
            return (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(isSel ? null : p.id)}
                  aria-pressed={isSel}
                  className={cn(
                    "group flex w-full items-center gap-3 rounded-2xl border p-2.5 text-left transition-all duration-300 hover:-translate-y-0.5",
                    isSel
                      ? "border-[#00F0FF]/50 bg-[#00F0FF]/[0.07]"
                      : isImp
                        ? "border-[#FF3B5C]/30 bg-[#FF3B5C]/[0.06] hover:border-[#FF3B5C]/50"
                        : "border-white/[0.06] bg-white/[0.02] hover:border-white/[0.14] hover:bg-white/[0.04]",
                    FOCUS_RING,
                  )}
                >
                  <span className="relative grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-black/40">
                    <CrewGlyph color={p.color} dimmed={p.status === "GHOST"} className="h-7 w-7" />
                    {p.status === "TAGGED" && (
                      <span className="absolute -right-1 -top-1 h-3 w-3 rotate-12 rounded-[3px] bg-[#B6FF3B] shadow-[0_0_10px_#B6FF3B]" />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                      <span className="font-mono text-[10px] text-zinc-600">#{String(p.num).padStart(2, "0")}</span>
                      <span className={cn("truncate text-sm font-bold", p.status === "GHOST" ? "text-zinc-500" : "text-white")}>
                        {p.name}
                      </span>
                    </span>
                    <span className="mt-0.5 flex items-center gap-1.5">
                      {isImp ? (
                        <span className="rounded-full bg-[#FF3B5C]/15 px-1.5 py-px text-[9px] font-extrabold uppercase tracking-wider text-[#FF6B83]">
                          Impostor
                        </span>
                      ) : (
                        <span className={cn("rounded-full border px-1.5 py-px text-[9px] font-bold uppercase tracking-wider", STATUS_STYLE[p.status].cls)}>
                          {STATUS_STYLE[p.status].label}
                        </span>
                      )}
                      <span className="truncate text-[10px] text-zinc-500">{p.discipline}</span>
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
          {visible.length === 0 && (
            <li className="col-span-full rounded-2xl border border-dashed border-white/[0.08] py-12 text-center text-sm text-zinc-500">
              No players match this filter.
            </li>
          )}
        </ul>
      </div>

      {/* inspector */}
      <aside className="rounded-2xl border border-white/[0.06] bg-black/25 p-5">
        {selected ? (
          <div className="flex h-full flex-col">
            <div className="flex items-center gap-3">
              <span className="grid h-14 w-14 place-items-center rounded-2xl border border-white/[0.06] bg-black/40">
                <CrewGlyph color={selected.color} dimmed={selected.status === "GHOST"} className="h-10 w-10" />
              </span>
              <div className="min-w-0">
                <p className="font-mono text-[11px] text-zinc-500">Player #{String(selected.num).padStart(2, "0")}</p>
                <p className="truncate text-lg font-extrabold text-white">{selected.name}</p>
              </div>
            </div>
            <dl className="mt-5 grid grid-cols-2 gap-2 text-xs">
              {[
                ["Role", reveal ? (selected.role === "IMPOSTOR" ? "Impostor" : "Crewmate") : "Hidden"],
                ["Status", STATUS_STYLE[selected.status].label],
                ["Discipline", selected.discipline],
                ["Points", selected.points.toString()],
              ].map(([k, v]) => (
                <div key={k} className="rounded-xl border border-white/[0.05] bg-white/[0.02] p-2.5">
                  <dt className="text-[10px] uppercase tracking-[0.14em] text-zinc-600">{k}</dt>
                  <dd className={cn("mt-0.5 font-bold", k === "Role" && v === "Impostor" ? "text-[#FF6B83]" : "text-zinc-100")}>{v}</dd>
                </div>
              ))}
            </dl>

            {editable ? (
              <div className="mt-5 flex flex-col gap-2">
                <button
                  type="button"
                  disabled={selected.status !== "ALIVE"}
                  onClick={() => onSetStatus(selected.id, "TAGGED")}
                  className={cn(
                    "flex items-center justify-center gap-2 rounded-xl border border-[#B6FF3B]/30 bg-[#B6FF3B]/[0.08] py-2.5 text-xs font-bold text-[#D4FF7A] transition-all hover:bg-[#B6FF3B]/15 disabled:cursor-not-allowed disabled:opacity-30",
                    FOCUS_RING,
                  )}
                >
                  <Tag className="h-3.5 w-3.5" /> Confirm sabotage tag
                </button>
                <button
                  type="button"
                  disabled={selected.status === "GHOST"}
                  onClick={() => onSetStatus(selected.id, "GHOST")}
                  className={cn(
                    "flex items-center justify-center gap-2 rounded-xl border border-[#8B5CF6]/30 bg-[#8B5CF6]/[0.08] py-2.5 text-xs font-bold text-[#C4B5FD] transition-all hover:bg-[#8B5CF6]/15 disabled:cursor-not-allowed disabled:opacity-30",
                    FOCUS_RING,
                  )}
                >
                  <Ghost className="h-3.5 w-3.5" /> Send to Ghost Lounge
                </button>
                <button
                  type="button"
                  disabled={selected.status === "ALIVE"}
                  onClick={() => onSetStatus(selected.id, "ALIVE")}
                  className={cn(
                    "flex items-center justify-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] py-2.5 text-xs font-bold text-zinc-300 transition-all hover:bg-white/[0.06] hover:text-white disabled:cursor-not-allowed disabled:opacity-30",
                    FOCUS_RING,
                  )}
                >
                  <Undo2 className="h-3.5 w-3.5" /> Restore to alive
                </button>
                <p className="mt-1 text-[10px] leading-relaxed text-zinc-600">Demo roster — changes stay on this device.</p>
              </div>
            ) : (
              <Link
                href="/control"
                className={cn(
                  "mt-5 flex items-center justify-center gap-2 rounded-xl border border-[#00F0FF]/30 bg-[#00F0FF]/[0.08] py-2.5 text-xs font-bold text-[#7FF7FF] transition-colors hover:bg-[#00F0FF]/15",
                  FOCUS_RING,
                )}
              >
                Manage in Control Deck <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            )}
          </div>
        ) : (
          <div className="flex h-full min-h-[220px] flex-col items-center justify-center text-center">
            <span className="grid h-12 w-12 place-items-center rounded-2xl border border-white/[0.06] bg-white/[0.02]">
              <Crosshair className="h-5 w-5 text-zinc-500" />
            </span>
            <p className="mt-4 text-sm font-bold text-zinc-200">Select a player</p>
            <p className="mt-1 max-w-[220px] text-xs leading-relaxed text-zinc-500">
              Inspect role, discipline and status. Confirm tags or move eliminated crew to the Ghost Lounge.
            </p>
          </div>
        )}
      </aside>
    </div>
  );
}

function ProgressRing({ value, size = 168 }: { value: number; size?: number }) {
  const stroke = 12;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
      <defs>
        <linearGradient id="ns-ring" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#00F0FF" />
          <stop offset="100%" stopColor="#8B5CF6" />
        </linearGradient>
      </defs>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={stroke} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="url(#ns-ring)"
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - Math.min(1, value))}
        className="transition-[stroke-dashoffset] duration-1000 ease-out"
      />
    </svg>
  );
}

function TasksPanel({ points, live }: { points: number; live: LiveState["taskProgress"] | null }) {
  const pct = Math.min(100, Math.round((points / POINT_TARGET) * 100));
  return (
    <div className="grid gap-5 lg:grid-cols-[280px_1fr]">
      <div className="flex flex-col items-center justify-center rounded-2xl border border-white/[0.06] bg-black/25 p-6">
        <div className="relative">
          <ProgressRing value={pct / 100} />
          <div className="absolute inset-0 grid place-items-center text-center">
            <div>
              <p className="text-4xl font-extrabold tabular-nums tracking-[-0.04em] text-white">{pct}%</p>
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">of target</p>
            </div>
          </div>
        </div>
        <p className="mt-5 font-mono text-sm text-zinc-300">
          {points.toLocaleString("en-IN")} <span className="text-zinc-600">/ {POINT_TARGET.toLocaleString("en-IN")}</span>
        </p>
        {live && (
          <p className="mt-2 text-xs text-zinc-500">
            {live.completed} completed · {live.inPlay} in play
          </p>
        )}
        <p className="mt-4 rounded-full border border-[#00F0FF]/20 bg-[#00F0FF]/[0.06] px-3 py-1 text-[11px] font-semibold text-[#7FF7FF]">
          {(POINT_TARGET - points).toLocaleString("en-IN")} pts to crew victory
        </p>
      </div>

      <ul className="flex flex-col gap-2.5">
        {DISCIPLINES.map((d) => {
          const Icon = d.icon;
          const p = Math.round((d.done / d.total) * 100);
          return (
            <li
              key={d.key}
              className="group rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 transition-all duration-300 hover:-translate-y-0.5 hover:border-white/[0.12] hover:bg-white/[0.035]"
            >
              <div className="flex items-center gap-3">
                <span className="grid h-9 w-9 place-items-center rounded-xl border border-white/[0.06] bg-black/30 text-zinc-400 transition-colors group-hover:text-[#00F0FF]">
                  <Icon className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-3">
                    <p className="truncate text-sm font-bold text-white">{d.label}</p>
                    <p className="shrink-0 font-mono text-xs text-zinc-400">
                      {d.done}/{d.total} <span className="text-zinc-600">tasks</span>
                    </p>
                  </div>
                  <div className="mt-2 flex items-center gap-3">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
                      <div className="h-full rounded-full bg-gradient-to-r from-[#00F0FF] to-[#8B5CF6]" style={{ width: `${p}%` }} />
                    </div>
                    <span className="w-16 text-right font-mono text-[11px] text-[#7FF7FF]">{d.points.toLocaleString("en-IN")}</span>
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function SabotagePanel({
  activeId,
  remaining,
  running,
  onTrigger,
  onResolve,
  onPause,
  onResume,
}: {
  activeId: string | null;
  remaining: number;
  running: boolean;
  onTrigger: (id: string) => void;
  onResolve: () => void;
  onPause: () => void;
  onResume: () => void;
}) {
  const active = SABOTAGES.find((s) => s.id === activeId) ?? null;
  const expired = !!active && remaining === 0;

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
      <ul className="grid gap-2.5 sm:grid-cols-2">
        {SABOTAGES.map((s) => {
          const Icon = s.icon;
          const isActive = s.id === activeId;
          return (
            <li
              key={s.id}
              className={cn(
                "flex flex-col rounded-2xl border p-4 transition-all duration-300 hover:-translate-y-0.5",
                isActive
                  ? "border-[#FF3B5C]/50 bg-[#FF3B5C]/[0.08] shadow-[0_0_40px_-12px_rgba(255,59,92,0.6)]"
                  : "border-white/[0.06] bg-white/[0.02] hover:border-white/[0.12]",
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <span className={cn("grid h-10 w-10 place-items-center rounded-xl", s.critical ? "bg-[#FF3B5C]/12 text-[#FF3B5C]" : "bg-amber-400/10 text-amber-300")}>
                  <Icon className="h-5 w-5" />
                </span>
                <span
                  className={cn(
                    "rounded-full border px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-[0.14em]",
                    s.critical ? "border-[#FF3B5C]/30 text-[#FF6B83]" : "border-amber-400/25 text-amber-300",
                  )}
                >
                  {s.critical ? `Critical · ${s.seconds}s` : `Disruptive · ${s.seconds}s`}
                </span>
              </div>
              <p className="mt-4 text-sm font-extrabold text-white">{s.name}</p>
              <p className="mt-1 flex-1 text-xs leading-relaxed text-zinc-500">{s.fix}</p>
              <button
                type="button"
                onClick={() => onTrigger(s.id)}
                disabled={!!active && !expired && !isActive}
                className={cn(
                  "mt-4 inline-flex items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-bold transition-all duration-300 disabled:cursor-not-allowed disabled:opacity-30",
                  isActive
                    ? "bg-[#FF3B5C] text-white hover:bg-[#FF5873]"
                    : "border border-white/[0.08] bg-white/[0.03] text-zinc-200 hover:border-[#FF3B5C]/40 hover:bg-[#FF3B5C]/10 hover:text-white",
                  FOCUS_RING,
                )}
              >
                {isActive ? <RotateCcw className="h-3.5 w-3.5" /> : <Zap className="h-3.5 w-3.5" />}
                {isActive ? "Restart countdown" : "Trigger sabotage"}
              </button>
            </li>
          );
        })}
      </ul>

      <div
        className={cn(
          "relative flex flex-col items-center justify-center overflow-hidden rounded-2xl border p-6 text-center transition-colors duration-500",
          active ? "border-[#FF3B5C]/40 bg-[#FF3B5C]/[0.06]" : "border-white/[0.06] bg-black/25",
        )}
      >
        {active && !expired && (
          <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_40%,rgba(255,59,92,0.25),transparent_60%)] motion-safe:animate-pulse" />
        )}
        <div className="relative">
          {active ? (
            <>
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#FF6B83]">
                {expired ? (active.critical ? "Countdown expired" : "Sabotage elapsed") : active.name}
              </p>
              <p
                role="timer"
                aria-live="off"
                className={cn("mt-3 font-mono text-6xl font-bold tabular-nums tracking-tight", expired ? "text-[#FF3B5C]" : "text-white")}
              >
                {formatClock(remaining)}
              </p>
              {expired && active.critical ? (
                <p className="mt-3 inline-flex items-center gap-2 rounded-full bg-[#FF3B5C]/15 px-3 py-1 text-xs font-bold text-[#FF8FA1]">
                  <TriangleAlert className="h-3.5 w-3.5" /> Impostors win by sabotage
                </p>
              ) : (
                <p className="mt-3 text-xs text-zinc-400">{active.fix}</p>
              )}
              <div className="mt-5 flex flex-wrap justify-center gap-2">
                {!expired &&
                  (running ? (
                    <button type="button" onClick={onPause} className={cn("inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-xs font-bold text-zinc-200 transition-colors hover:bg-white/[0.08]", FOCUS_RING)}>
                      <Pause className="h-3.5 w-3.5" /> Pause
                    </button>
                  ) : (
                    <button type="button" onClick={onResume} className={cn("inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-xs font-bold text-zinc-200 transition-colors hover:bg-white/[0.08]", FOCUS_RING)}>
                      <Play className="h-3.5 w-3.5" /> Resume
                    </button>
                  ))}
                <button type="button" onClick={onResolve} className={cn("inline-flex items-center gap-1.5 rounded-full bg-emerald-400 px-4 py-2 text-xs font-bold text-emerald-950 transition-colors hover:bg-emerald-300", FOCUS_RING)}>
                  <Check className="h-3.5 w-3.5" strokeWidth={3} /> {expired ? "Clear" : "Mark resolved"}
                </button>
              </div>
            </>
          ) : (
            <>
              <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl border border-emerald-400/20 bg-emerald-400/10 text-emerald-300">
                <ShieldAlert className="h-6 w-6" />
              </span>
              <p className="mt-4 text-sm font-extrabold text-white">All systems nominal</p>
              <p className="mx-auto mt-1 max-w-[230px] text-xs leading-relaxed text-zinc-500">
                When an impostor requests a sabotage, trigger it here. The clock runs on this device — mirror it on the projector.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function GhostPanel({ ghosts }: { ghosts: Player[] }) {
  const [revealed, setRevealed] = useState<Set<number>>(() => new Set());
  const [solved, setSolved] = useState<Set<number>>(() => new Set([0]));

  const toggle = (set: Set<number>, i: number) => {
    const next = new Set(set);
    if (next.has(i)) next.delete(i);
    else next.add(i);
    return next;
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[260px_1fr]">
      <div className="rounded-2xl border border-white/[0.06] bg-black/25 p-5">
        <div className="flex items-center justify-between">
          <p className="text-sm font-extrabold text-white">In the lounge</p>
          <span className="rounded-full bg-[#8B5CF6]/15 px-2 py-0.5 font-mono text-xs text-[#C4B5FD]">{ghosts.length}</span>
        </div>
        <p className="mt-1 text-xs text-zinc-500">Silent zone · no talking to the living.</p>
        <ul className="mt-4 flex flex-col gap-2">
          {ghosts.map((g) => (
            <li key={g.id} className="flex items-center gap-2.5 rounded-xl border border-white/[0.05] bg-white/[0.02] p-2">
              <CrewGlyph color={g.color} dimmed className="h-6 w-6" />
              <span className="text-sm font-semibold text-zinc-300">{g.name}</span>
              <span className="ml-auto font-mono text-[10px] text-zinc-600">#{String(g.num).padStart(2, "0")}</span>
            </li>
          ))}
          {ghosts.length === 0 && <li className="py-6 text-center text-xs text-zinc-600">No ghosts yet.</li>}
        </ul>
      </div>

      <ul className="grid gap-2.5 sm:grid-cols-2">
        {RIDDLES.map((r, i) => {
          const isSolved = solved.has(i);
          const isRevealed = revealed.has(i);
          return (
            <li
              key={i}
              className={cn(
                "flex flex-col rounded-2xl border p-4 transition-all duration-300 hover:-translate-y-0.5",
                isSolved ? "border-emerald-400/25 bg-emerald-400/[0.04]" : "border-white/[0.06] bg-white/[0.02] hover:border-[#8B5CF6]/30",
              )}
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-[11px] text-zinc-600">RIDDLE {String(i + 1).padStart(2, "0")}</span>
                {isSolved && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-emerald-300">
                    <Check className="h-3 w-3" strokeWidth={3} /> Solved
                  </span>
                )}
              </div>
              <p className="mt-2 flex-1 text-sm font-semibold leading-relaxed text-zinc-200">{r.q}</p>
              <p
                className={cn(
                  "mt-3 rounded-lg border border-dashed px-3 py-2 font-mono text-xs transition-all duration-300",
                  isRevealed ? "border-[#8B5CF6]/30 text-[#C4B5FD]" : "select-none border-white/[0.06] text-transparent [text-shadow:0_0_8px_rgba(255,255,255,0.5)]",
                )}
              >
                {r.a}
              </p>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => setRevealed((s) => toggle(s, i))}
                  className={cn("inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.03] py-2 text-[11px] font-bold text-zinc-300 transition-colors hover:text-white", FOCUS_RING)}
                >
                  <KeyRound className="h-3.5 w-3.5" /> {isRevealed ? "Hide" : "Answer"}
                </button>
                <button
                  type="button"
                  onClick={() => setSolved((s) => toggle(s, i))}
                  className={cn(
                    "inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-[11px] font-bold transition-colors",
                    isSolved ? "bg-emerald-400/15 text-emerald-300 hover:bg-emerald-400/20" : "bg-[#8B5CF6]/15 text-[#C4B5FD] hover:bg-[#8B5CF6]/25",
                    FOCUS_RING,
                  )}
                >
                  <Check className="h-3.5 w-3.5" /> {isSolved ? "Undo" : "Mark solved"}
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/* ─────────────────────────────── mechanics ────────────────────────────────── */

function TagVisual() {
  return (
    <div className="relative mx-auto h-48 w-full max-w-sm sm:h-56">
      {/* chair */}
      <div className="absolute bottom-6 left-1/2 h-28 w-40 -translate-x-1/2 rounded-t-[2.5rem] rounded-b-xl border border-white/[0.08] bg-gradient-to-b from-white/[0.07] to-white/[0.02] sm:h-32 sm:w-48" />
      <div className="absolute bottom-2 left-1/2 h-5 w-52 -translate-x-1/2 rounded-xl border border-white/[0.08] bg-white/[0.04] sm:w-60" />
      {/* crewmate at task */}
      <div className="absolute bottom-10 left-1/2 -translate-x-1/2">
        <CrewGlyph color="#132ED1" className="h-24 w-24 sm:h-28 sm:w-28" />
      </div>
      {/* neon tag */}
      <div className="absolute bottom-[7.25rem] left-[calc(50%-5.25rem)] motion-safe:animate-[ns-tag_2.6s_ease-in-out_infinite] sm:bottom-[8.5rem] sm:left-[calc(50%-6.25rem)]">
        <div className="rounded-md bg-[#B6FF3B] px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-black shadow-[0_0_24px_rgba(182,255,59,0.75)]">
          Tagged
        </div>
      </div>
      {/* lurking impostor */}
      <div className="absolute bottom-10 right-[6%] opacity-80 transition-transform duration-700 group-hover/card:-translate-x-3">
        <CrewGlyph color="#C51111" className="h-16 w-16 -scale-x-100 sm:h-20 sm:w-20" />
      </div>
      <div aria-hidden className="absolute inset-x-8 bottom-0 h-10 rounded-full bg-[#B6FF3B]/10 blur-2xl" />
    </div>
  );
}

function MeetingTimerCard({
  remaining,
  running,
  onStart,
  onPause,
  onReset,
}: {
  remaining: number;
  running: boolean;
  onStart: () => void;
  onPause: () => void;
  onReset: () => void;
}) {
  const progress = remaining / MEETING_MS;
  const done = remaining === 0;
  return (
    <BentoCard glow="violet" className="p-6 sm:p-7 lg:col-span-2 lg:row-span-2">
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between">
          <span className="grid h-11 w-11 place-items-center rounded-2xl border border-[#8B5CF6]/25 bg-[#8B5CF6]/10 text-[#C4B5FD]">
            <Megaphone className="h-5 w-5" />
          </span>
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em]",
              running ? "border-[#FF3B5C]/30 bg-[#FF3B5C]/10 text-[#FF8FA1]" : "border-white/10 text-zinc-500",
            )}
          >
            <span className={cn("h-1.5 w-1.5 rounded-full", running ? "bg-[#FF3B5C] motion-safe:animate-pulse" : "bg-zinc-600")} />
            {running ? "In session" : done ? "Vote now" : "Standby"}
          </span>
        </div>
        <h3 className="mt-6 text-xl font-extrabold tracking-[-0.02em] text-white">Emergency Meeting</h3>
        <p className="mt-2 text-sm leading-relaxed text-zinc-400">
          A tag is discovered → anyone calls it. Three minutes to debate, then a vote ejects a suspect.
        </p>

        <div className="relative mx-auto my-7 grid place-items-center">
          <div className="relative">
            <svg width="180" height="180" viewBox="0 0 180 180" className="-rotate-90">
              <circle cx="90" cy="90" r="80" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="8" />
              <circle
                cx="90"
                cy="90"
                r="80"
                fill="none"
                stroke={done ? "#FF3B5C" : "#8B5CF6"}
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={2 * Math.PI * 80}
                strokeDashoffset={2 * Math.PI * 80 * (1 - progress)}
                className="transition-[stroke-dashoffset] duration-200 ease-linear"
              />
            </svg>
            <div className="absolute inset-0 grid place-items-center">
              <div className="text-center">
                <p role="timer" className={cn("font-mono text-4xl font-bold tabular-nums", done ? "text-[#FF3B5C]" : "text-white")}>
                  {formatClock(remaining)}
                </p>
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">discussion</p>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-auto grid grid-cols-[1fr_auto] gap-2">
          <button
            type="button"
            onClick={running ? onPause : onStart}
            className={cn(
              "inline-flex items-center justify-center gap-2 rounded-full py-3 text-sm font-bold transition-all duration-300 active:scale-[0.97]",
              running
                ? "border border-white/10 bg-white/[0.05] text-white hover:bg-white/[0.09]"
                : "bg-[#8B5CF6] text-white shadow-[0_10px_40px_-12px_rgba(139,92,246,0.8)] hover:bg-[#9D74FF]",
              FOCUS_RING,
            )}
          >
            {running ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            {running ? "Pause" : done ? "Restart meeting" : remaining < MEETING_MS ? "Resume" : "Call meeting"}
          </button>
          <button
            type="button"
            onClick={onReset}
            aria-label="Reset meeting timer"
            className={cn("grid h-full w-12 place-items-center rounded-full border border-white/10 bg-white/[0.03] text-zinc-400 transition-colors hover:text-white", FOCUS_RING)}
          >
            <RotateCcw className="h-4 w-4" />
          </button>
        </div>
      </div>
    </BentoCard>
  );
}

function VictoryCard() {
  const [side, setSide] = useState<"crew" | "impostor">("crew");
  const rules =
    side === "crew"
      ? [
          { icon: Target, title: "Hit the point target", body: "Crew collectively reach 10,000 task points." },
          { icon: Vote, title: "Eject all 4 impostors", body: "Every impostor voted out in emergency meetings." },
        ]
      : [
          { icon: Users, title: "Reach parity", body: "Living crew count drops to equal the impostors." },
          { icon: Siren, title: "Critical sabotage expires", body: "A reactor or O₂ countdown runs out unresolved." },
        ];
  return (
    <BentoCard glow={side === "crew" ? "cyan" : "red"} className="p-6 sm:p-7 lg:col-span-3">
      <div className="flex flex-col gap-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-2xl border border-amber-300/20 bg-amber-300/10 text-amber-200">
              <Trophy className="h-5 w-5" />
            </span>
            <h3 className="text-xl font-extrabold tracking-[-0.02em] text-white">Victory conditions</h3>
          </div>
          <div className="w-full sm:w-64">
            <SegmentedTabs
              size="sm"
              label="Victory side"
              idPrefix="victory"
              value={side}
              onChange={setSide}
              items={[
                { id: "crew", label: "Crewmates" },
                { id: "impostor", label: "Impostors" },
              ]}
            />
          </div>
        </div>
        <div id={`victory-panel-${side}`} role="tabpanel" aria-labelledby={`victory-tab-${side}`} key={side} className="grid gap-2.5 sm:grid-cols-2 motion-safe:animate-[ns-in_0.45s_ease-out]">
          {rules.map((r) => {
            const Icon = r.icon;
            return (
              <div key={r.title} className="rounded-2xl border border-white/[0.06] bg-black/25 p-4">
                <Icon className={cn("h-5 w-5", side === "crew" ? "text-[#00F0FF]" : "text-[#FF3B5C]")} />
                <p className="mt-3 text-sm font-bold text-white">{r.title}</p>
                <p className="mt-1 text-xs leading-relaxed text-zinc-500">{r.body}</p>
              </div>
            );
          })}
        </div>
      </div>
    </BentoCard>
  );
}

/* ──────────────────────────────── protocol ────────────────────────────────── */

const PROTOCOL: Array<{ icon: LucideIcon; title: string; body: string; meta: string }> = [
  { icon: Wrench, title: "Execute tasks", body: "Engineers rotate through hands-on stations across five disciplines. Verify each completion and award points.", meta: "Continuous" },
  { icon: Tag, title: "Sabotage tag", body: "Impostors slip a neon sticker or clothespin onto a focused crewmate's chair or collar. No workflow interruption.", meta: "Silent kill" },
  { icon: Siren, title: "Emergency meeting", body: "Whoever discovers a tag calls the meeting. Freeze tasks, gather the crew and start the 3-minute clock.", meta: "3 minutes" },
  { icon: Vote, title: "Vote & eject", body: "Tally the vote, eject the suspect and reveal. Tagged crew head silently to the Ghost Lounge for backup riddles.", meta: "Resolve" },
];

/* ─────────────────────────────────── page ─────────────────────────────────── */

export default function AdminLandingPage() {
  const [live, setLive] = useState<LiveState | null>(null);
  const [demoPlayers, setDemoPlayers] = useState<Player[]>([]);
  const [section, setSection] = useState<SectionId>("overview");
  const [tab, setTab] = useState<ConsoleTab>("roster");
  const [sabotageId, setSabotageId] = useState<string | null>(null);

  const meeting = useCountdown(MEETING_MS);
  const sabotage = useCountdown(0);

  const [registeredUsers, setRegisteredUsers] = useState<Array<{ id: string; fullName: string; activeParticipation: { status: string } | null }>>([]);

  /* live engine sync (admin session cookie set by /control/<secret>) */
  useEffect(() => {
    let cancelled = false;
    const timerRef: { current: number | undefined } = { current: undefined };
    const load = async () => {
      try {
        const [res, peopleRes] = await Promise.all([
          fetch("/api/game/state?as=ADMIN", { cache: "no-store" }),
          fetch("/api/admin/people", { cache: "no-store" }),
        ]);

        if (peopleRes.ok) {
          const peopleData = await peopleRes.json();
          if (!cancelled && peopleData?.accounts) setRegisteredUsers(peopleData.accounts);
        }

        if (!res.ok) {
          if (!cancelled) setLive(null);
          if (res.status === 401 && timerRef.current !== undefined) {
            window.clearInterval(timerRef.current);
          }
          return;
        }
        const data = (await res.json()) as LiveState;
        if (!cancelled && data?.game) setLive(data);
      } catch {
        if (!cancelled) setLive(null);
      }
    };
    void load();
    timerRef.current = window.setInterval(load, 5000);
    return () => {
      cancelled = true;
      if (timerRef.current !== undefined) {
        window.clearInterval(timerRef.current);
      }
    };
  }, []);

  /* Map registered users to Demo Players if no live data is available */
  useEffect(() => {
    if (registeredUsers.length > 0) {
      const realPlayers = registeredUsers.map((user, i) => ({
        id: user.id,
        num: i + 1,
        name: user.fullName,
        role: "CREW" as Role, // default to crew in demo mode
        status: (user.activeParticipation ? user.activeParticipation.status : "ALIVE") as Status,
        discipline: DISCIPLINE_KEYS[i % DISCIPLINE_KEYS.length],
        color: CREW_COLORS[i % CREW_COLORS.length],
        points: 80 + ((i * 137) % 340),
      }));
      setDemoPlayers(realPlayers);
    }
  }, [registeredUsers]);

  /* active section tracking for the pill nav */
  useEffect(() => {
    const els = NAV.map((n) => document.getElementById(n.id)).filter((el): el is HTMLElement => !!el);
    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible) setSection(visible.target.id as SectionId);
      },
      { rootMargin: "-35% 0px -55% 0px", threshold: [0, 0.25, 0.5, 1] },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  const mode: "live" | "demo" = live ? "live" : "demo";

  const players: Player[] = useMemo(() => {
    if (!live || live.participants.length === 0) return demoPlayers;
    return live.participants
      .filter((p) => p.status === "ALIVE" || p.status === "ELIMINATED")
      .map((p, i) => ({
        id: p.id,
        num: p.playerNumber ?? i + 1,
        name: p.name,
        role: p.role === "IMPOSTER" ? "IMPOSTOR" : "CREW",
        status: p.status === "ALIVE" ? "ALIVE" : "GHOST",
        discipline: DISCIPLINE_KEYS[i % DISCIPLINE_KEYS.length],
        color: CREW_COLORS[i % CREW_COLORS.length],
        points: 0,
      }));
  }, [live, demoPlayers]);

  const rosterIsDemo = !live || live.participants.length === 0;
  const crew = players.filter((p) => p.role === "CREW");
  const aliveCrew = crew.filter((p) => p.status === "ALIVE").length;
  const impostorsLeft = players.filter((p) => p.role === "IMPOSTOR" && p.status !== "GHOST").length;
  const ghosts = players.filter((p) => p.status === "GHOST");
  const points = live ? Math.round((live.taskProgress.percentage / 100) * POINT_TARGET) : 6_420;

  const activeSabotage = SABOTAGES.find((s) => s.id === sabotageId) ?? null;

  const setStatus = useCallback((id: string, status: Status) => {
    setDemoPlayers((prev) => prev.map((p) => (p.id === id ? { ...p, status } : p)));
  }, []);

  const triggerSabotage = (id: string) => {
    const s = SABOTAGES.find((x) => x.id === id);
    if (!s) return;
    setSabotageId(id);
    sabotage.arm(s.seconds * 1000);
  };
  const resolveSabotage = () => {
    setSabotageId(null);
    sabotage.reset(0);
  };

  const consoleTabs: Array<{ id: ConsoleTab; label: string; icon: LucideIcon; badge?: number }> = [
    { id: "roster", label: "Crew Roster", icon: Users, badge: players.length },
    { id: "tasks", label: "Task Matrix", icon: Gauge },
    { id: "sabotage", label: "Sabotage", icon: Siren },
    { id: "ghosts", label: "Ghost Lounge", icon: Ghost, badge: ghosts.length },
  ];

  return (
    <div
      className={cn(
        manrope.className,
        "relative min-h-screen overflow-x-clip bg-[#0B0B0F] text-zinc-100 antialiased",
        "[&_:is(h1,h2,h3,h4)]:[font-family:inherit] selection:bg-[#00F0FF]/30 selection:text-white",
      )}
    >
      {/* keyframes (Tailwind arbitrary animations reference these) */}
      <style>{`
        @keyframes ns-float { 0%,100% { transform: translateY(0) rotate(-2deg) } 50% { transform: translateY(-14px) rotate(2deg) } }
        @keyframes ns-spin { to { transform: rotate(360deg) } }
        @keyframes ns-marquee { to { transform: translateX(-50%) } }
        @keyframes ns-shine { to { background-position: 200% center } }
        @keyframes ns-tag { 0%,100% { transform: rotate(-10deg) scale(1) } 50% { transform: rotate(-4deg) scale(1.08) } }
        @keyframes ns-in { from { opacity: 0; transform: translateY(8px) } to { opacity: 1; transform: none } }
      `}</style>

      {/* ambient background */}
      <div aria-hidden className="pointer-events-none fixed inset-0">
        <div className="absolute -top-40 left-1/2 h-[600px] w-[1100px] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(0,240,255,0.10),transparent)]" />
        <div className="absolute right-[-200px] top-[30%] h-[520px] w-[520px] rounded-full bg-[radial-gradient(closest-side,rgba(139,92,246,0.10),transparent)]" />
        <div className="absolute bottom-[-200px] left-[-160px] h-[520px] w-[520px] rounded-full bg-[radial-gradient(closest-side,rgba(255,59,92,0.07),transparent)]" />
        <div className="absolute inset-0 bg-[radial-gradient(rgba(255,255,255,0.07)_1px,transparent_1px)] [background-size:28px_28px] [mask-image:radial-gradient(ellipse_at_top,#000_20%,transparent_70%)]" />
      </div>

      <Navbar active={section} mode={mode} roomCode={live?.game.roomCode ?? null} alarm={!!activeSabotage && sabotage.remaining > 0} />

      <main className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <Hero mode={mode} roomCode={live?.game.roomCode ?? null} status={live?.game.status ?? "SETUP"} />

        <StatStrip
          aliveCrew={aliveCrew}
          totalCrew={crew.length}
          impostorsLeft={impostorsLeft}
          points={points}
          meetingRunning={meeting.running}
          meetingRemaining={meeting.remaining}
          sabotage={activeSabotage ? { name: activeSabotage.name, critical: activeSabotage.critical, remaining: sabotage.remaining } : null}
        />
      </main>

      <Ticker />

      <main className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* ── console ── */}
        <section id="console" className="scroll-mt-28 pt-24 sm:pt-32">
          <SectionHeading
            icon={Activity}
            eyebrow="Mission console"
            title={
              <>
                Every crewmate, every clock —{" "}
                <span className="bg-gradient-to-r from-[#00F0FF] to-[#8B5CF6] bg-clip-text text-transparent">one console.</span>
              </>
            }
            sub="Monitor the roster with role reveal, track discipline progress toward the point target, run sabotage countdowns and referee the Ghost Lounge."
          />

          <div className={cn("rounded-[2rem] p-3 sm:p-5", GLASS)}>
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="w-full md:max-w-[640px]">
                <SegmentedTabs label="Mission console" idPrefix="console" value={tab} onChange={setTab} items={consoleTabs} />
              </div>
              <div className="flex items-center gap-2 px-1 text-xs text-zinc-500">
                <Radio className={cn("h-3.5 w-3.5", mode === "live" ? "text-emerald-400" : "text-zinc-600")} />
                {mode === "live" ? "Synced every 5s with the game engine" : rosterIsDemo ? "Demo roster · open your admin link to sync" : ""}
              </div>
            </div>

            <div
              key={tab}
              id={`console-panel-${tab}`}
              role="tabpanel"
              aria-labelledby={`console-tab-${tab}`}
              className="mt-5 motion-safe:animate-[ns-in_0.45s_ease-out]"
            >
              {tab === "roster" && <RosterPanel players={players} editable={rosterIsDemo} onSetStatus={setStatus} />}
              {tab === "tasks" && <TasksPanel points={points} live={live?.taskProgress ?? null} />}
              {tab === "sabotage" && (
                <SabotagePanel
                  activeId={sabotageId}
                  remaining={sabotage.remaining}
                  running={sabotage.running}
                  onTrigger={triggerSabotage}
                  onResolve={resolveSabotage}
                  onPause={sabotage.pause}
                  onResume={() => sabotage.arm(sabotage.remaining)}
                />
              )}
              {tab === "ghosts" && <GhostPanel ghosts={ghosts} />}
            </div>
          </div>
        </section>

        {/* ── mechanics bento ── */}
        <section id="mechanics" className="scroll-mt-28 pt-24 sm:pt-32">
          <SectionHeading
            icon={Sparkles}
            eyebrow="Game mechanics"
            title={
              <>
                Built for a live room. <span className="text-zinc-500">Zero workflow interruptions.</span>
              </>
            }
            sub="The rules you'll be refereeing tonight — from the silent sabotage tag to the endgame triggers."
          />

          <div className="grid auto-rows-[minmax(0,auto)] grid-cols-1 gap-3 sm:gap-4 lg:grid-cols-6">
            {/* A — sabotage tag */}
            <BentoCard as="article" className="p-6 sm:p-8 lg:col-span-4 lg:row-span-2">
              <div className="flex h-full flex-col">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="grid h-11 w-11 place-items-center rounded-2xl border border-[#B6FF3B]/25 bg-[#B6FF3B]/10 text-[#D4FF7A]">
                    <Tag className="h-5 w-5" />
                  </span>
                  <span className="rounded-full border border-white/[0.08] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-400">
                    Signature mechanic
                  </span>
                </div>
                <h3 className="mt-6 max-w-lg text-2xl font-extrabold tracking-[-0.03em] text-white sm:text-3xl">
                  The Sabotage Tag — a kill that never stops the work.
                </h3>
                <p className="mt-3 max-w-xl text-sm leading-relaxed text-zinc-400 sm:text-[15px]">
                  Impostors secretly place a neon sticker or clothespin on a crewmate&apos;s chair or collar while they&apos;re
                  locked into a task. The victim keeps working — until someone notices.
                </p>
                <div className="my-6 flex-1">
                  <TagVisual />
                </div>
                <ol className="grid gap-2 sm:grid-cols-3">
                  {["Impostor places tag", "Tag is discovered", "Meeting is called"].map((s, i) => (
                    <li key={s} className="flex items-center gap-2.5 rounded-xl border border-white/[0.06] bg-black/25 px-3 py-2.5">
                      <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-white/[0.06] font-mono text-[11px] text-zinc-300">{i + 1}</span>
                      <span className="text-xs font-semibold text-zinc-300">{s}</span>
                    </li>
                  ))}
                </ol>
              </div>
            </BentoCard>

            {/* B — meeting timer */}
            <MeetingTimerCard
              remaining={meeting.remaining}
              running={meeting.running}
              onStart={() => meeting.arm(meeting.remaining === 0 ? MEETING_MS : meeting.remaining)}
              onPause={meeting.pause}
              onReset={() => meeting.reset(MEETING_MS)}
            />

            {/* C — impostors */}
            <BentoCard as="article" glow="red" className="p-6 lg:col-span-2">
              <div className="flex items-center justify-between">
                <span className="grid h-11 w-11 place-items-center rounded-2xl border border-[#FF3B5C]/25 bg-[#FF3B5C]/10 text-[#FF6B83]">
                  <Skull className="h-5 w-5" />
                </span>
                <span className="text-4xl font-extrabold tabular-nums tracking-[-0.04em] text-white">
                  {impostorsLeft}
                  <span className="text-lg text-zinc-600">/{TOTAL_IMPOSTORS}</span>
                </span>
              </div>
              <h3 className="mt-5 text-lg font-extrabold text-white">Hidden impostors</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-zinc-400">Blend in, tag crew, and request room-wide sabotages through organizers.</p>
              <div className="mt-5 flex gap-1.5">
                {Array.from({ length: TOTAL_IMPOSTORS }).map((_, i) => (
                  <span
                    key={i}
                    className={cn(
                      "h-1.5 flex-1 rounded-full transition-colors duration-500",
                      i < impostorsLeft ? "bg-[#FF3B5C] shadow-[0_0_10px_rgba(255,59,92,0.6)]" : "bg-white/[0.08]",
                    )}
                  />
                ))}
              </div>
            </BentoCard>

            {/* D — ghost lounge */}
            <BentoCard as="article" glow="violet" className="p-6 lg:col-span-2">
              <div className="flex items-center justify-between">
                <span className="grid h-11 w-11 place-items-center rounded-2xl border border-[#8B5CF6]/25 bg-[#8B5CF6]/10 text-[#C4B5FD]">
                  <Ghost className="h-5 w-5" />
                </span>
                <div className="flex -space-x-2">
                  {ghosts.slice(0, 4).map((g) => (
                    <span key={g.id} className="grid h-8 w-8 place-items-center rounded-full border-2 border-[#12121A] bg-black/60">
                      <CrewGlyph color={g.color} dimmed className="h-5 w-5" />
                    </span>
                  ))}
                </div>
              </div>
              <h3 className="mt-5 text-lg font-extrabold text-white">Ghost Lounge</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-zinc-400">
                Eliminated crew move here to solve backup riddles — silently. {ghosts.length} in the lounge.
              </p>
              <button
                type="button"
                onClick={() => {
                  setTab("ghosts");
                  scrollToSection("console");
                }}
                className={cn("mt-5 inline-flex items-center gap-1.5 text-xs font-bold text-[#C4B5FD] transition-colors hover:text-white", FOCUS_RING, "rounded")}
              >
                Open riddle board <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </BentoCard>

            {/* E — point target */}
            <BentoCard as="article" className="p-6 lg:col-span-2">
              <div className="flex items-center justify-between">
                <span className="grid h-11 w-11 place-items-center rounded-2xl border border-[#00F0FF]/25 bg-[#00F0FF]/10 text-[#7FF7FF]">
                  <Target className="h-5 w-5" />
                </span>
                <span className="font-mono text-xs text-zinc-500">{Math.round((points / POINT_TARGET) * 100)}%</span>
              </div>
              <h3 className="mt-5 text-lg font-extrabold text-white">Point target</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-zinc-400">Multi-disciplinary hands-on tasks feed one shared crew score.</p>
              <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/[0.06]">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[#00F0FF] to-[#8B5CF6] transition-[width] duration-1000"
                  style={{ width: `${Math.min(100, (points / POINT_TARGET) * 100)}%` }}
                />
              </div>
              <p className="mt-2 font-mono text-[11px] text-zinc-500">
                {points.toLocaleString("en-IN")} / {POINT_TARGET.toLocaleString("en-IN")}
              </p>
            </BentoCard>

            {/* F — critical sabotage */}
            <BentoCard as="article" glow="red" className="p-6 sm:p-7 lg:col-span-3">
              <div className="flex h-full flex-col gap-5 sm:flex-row sm:items-center">
                <div className="flex-1">
                  <span className="grid h-11 w-11 place-items-center rounded-2xl border border-[#FF3B5C]/25 bg-[#FF3B5C]/10 text-[#FF6B83]">
                    <Siren className="h-5 w-5" />
                  </span>
                  <h3 className="mt-5 text-xl font-extrabold tracking-[-0.02em] text-white">Critical sabotage</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-zinc-400">
                    Room-wide emergencies triggered via organizers. If the countdown expires, the impostors win outright.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setTab("sabotage");
                    scrollToSection("console");
                  }}
                  className={cn(
                    "group/s flex shrink-0 flex-col items-center justify-center rounded-2xl border px-6 py-5 transition-all duration-300",
                    activeSabotage && sabotage.remaining > 0
                      ? "border-[#FF3B5C]/50 bg-[#FF3B5C]/10"
                      : "border-white/[0.08] bg-black/25 hover:border-[#FF3B5C]/40 hover:bg-[#FF3B5C]/[0.06]",
                    FOCUS_RING,
                  )}
                >
                  <span className={cn("font-mono text-3xl font-bold tabular-nums", activeSabotage ? "text-[#FF3B5C]" : "text-zinc-300")}>
                    {activeSabotage ? formatClock(sabotage.remaining) : "--:--"}
                  </span>
                  <span className="mt-1 inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-500 transition-colors group-hover/s:text-[#FF8FA1]">
                    {activeSabotage ? activeSabotage.name : "Open panel"} <ChevronRight className="h-3 w-3" />
                  </span>
                </button>
              </div>
            </BentoCard>

            {/* G — victory */}
            <VictoryCard />
          </div>
        </section>

        {/* ── protocol ── */}
        <section id="protocol" className="scroll-mt-28 pt-24 sm:pt-32">
          <SectionHeading
            icon={Timer}
            eyebrow="Round protocol"
            title="The loop you'll run, round after round."
            sub="A four-beat cycle. Keep it tight and the room stays electric."
            align="center"
          />
          <ol className="relative grid gap-3 sm:grid-cols-2 lg:grid-cols-4 lg:gap-4">
            <span aria-hidden className="absolute left-[12%] right-[12%] top-[2.9rem] hidden h-px bg-gradient-to-r from-transparent via-[#00F0FF]/30 to-transparent lg:block" />
            {PROTOCOL.map((step, i) => {
              const Icon = step.icon;
              return (
                <BentoCard as="li" key={step.title} glow={i % 2 ? "violet" : "cyan"} className="p-6">
                  <div className="flex items-center justify-between">
                    <span className="relative grid h-11 w-11 place-items-center rounded-2xl border border-white/[0.1] bg-[#0B0B0F] text-[#00F0FF]">
                      <Icon className="h-5 w-5" />
                    </span>
                    <span className="font-mono text-4xl font-bold text-white/[0.06]">0{i + 1}</span>
                  </div>
                  <h3 className="mt-6 text-lg font-extrabold text-white">{step.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-zinc-400">{step.body}</p>
                  <span className="mt-5 inline-flex rounded-full border border-white/[0.08] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-500">
                    {step.meta}
                  </span>
                </BentoCard>
              );
            })}
          </ol>
        </section>

        {/* ── final CTA ── */}
        <section className="pb-10 pt-24 sm:pt-32">
          <div className={cn("relative overflow-hidden rounded-[2rem] px-6 py-14 text-center sm:px-12 sm:py-20", GLASS)}>
            <div aria-hidden className="absolute inset-x-0 -top-40 mx-auto h-80 w-[680px] max-w-full rounded-full bg-[radial-gradient(closest-side,rgba(0,240,255,0.18),transparent)]" />
            <div aria-hidden className="absolute inset-x-0 top-0 mx-auto h-px w-2/3 bg-gradient-to-r from-transparent via-[#00F0FF]/60 to-transparent" />
            <div className="relative">
              <Image
                src="/assets/among-us/crewmate-logo.png"
                alt=""
                width={534}
                height={573}
                className="mx-auto h-16 w-auto drop-shadow-[0_10px_30px_rgba(255,30,50,0.4)] transition-transform duration-500 hover:-rotate-12 hover:scale-110"
              />
              <h2 className="mx-auto mt-6 max-w-2xl text-3xl font-extrabold leading-[1.05] tracking-[-0.035em] text-white sm:text-5xl">
                The crew is counting on you.{" "}
                <span className="bg-gradient-to-r from-[#00F0FF] to-[#8B5CF6] bg-clip-text text-transparent">Take the helm.</span>
              </h2>
              <p className="mx-auto mt-4 max-w-lg text-sm leading-relaxed text-zinc-400 sm:text-base">
                Spin up the room, approve players, lock roles and put the live game on the big screen.
              </p>
              <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <PrimaryButton href="/control">Launch Control Deck</PrimaryButton>
                <GhostButton href="/spectator" icon={MonitorPlay}>
                  Projector view
                </GhostButton>
                <GhostButton href="/control/print" icon={Printer}>
                  Print kit
                </GhostButton>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="relative border-t border-white/[0.06]">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 py-8 text-xs text-zinc-500 sm:flex-row sm:px-6 lg:px-8">
          <div className="flex items-center gap-2.5">
            <Image src="/assets/among-us/crewmate-logo.png" alt="" width={534} height={573} className="h-5 w-auto" />
            <span className="font-bold text-zinc-300">
              Nothing<span className="text-[#FF3B5C]">Sus</span>
            </span>
            <span className="text-zinc-700">·</span>
            <span>Admin Command Center</span>
          </div>
          <div className="flex items-center gap-1">
            {[
              { href: "/control", label: "Control" },
              { href: "/control/presets", label: "Presets" },
              { href: "/spectator", label: "Projector" },
              { href: "/", label: "Public site" },
            ].map((l) => (
              <Link key={l.href} href={l.href} className={cn("rounded-full px-3 py-1.5 transition-colors hover:bg-white/[0.04] hover:text-white", FOCUS_RING)}>
                {l.label}
              </Link>
            ))}
          </div>
          <span className="inline-flex items-center gap-1.5">
            <UserX className="h-3.5 w-3.5" /> Organizers only — keep this screen private
          </span>
        </div>
      </footer>
    </div>
  );
}
