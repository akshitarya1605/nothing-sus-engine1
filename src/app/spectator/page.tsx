"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useGameRealtime } from "@/lib/realtime/useGameRealtime";
import { cn } from "@/lib/cn";
import { CountdownTimer } from "@/components/ui/CountdownTimer";
import { QRCode } from "@/components/ui/QRCode";
import { Starfield } from "@/components/ui/Starfield";
import { TaskProgress } from "@/components/game/TaskProgress";
import { EventFeed, type FeedEvent } from "@/components/game/EventFeed";
import { RevealCard } from "@/components/game/RevealCard";

interface ProjectorState {
  status: string;
  round: { number: number; name: string; msRemaining: number | null } | null;
  phase: string | null;
  globalProgress: { completed: number; inPlay: number; percentage: number };
  aliveCount: number;
  eliminatedCount: number;
  meetingState: { status: string; type: string } | null;
  votingState: { isOpen: boolean } | null;
  recentPublicEvents: FeedEvent[];
  eliminationReveal: { participantId: string; name: string; role: "ENGINEER" | "IMPOSTER" } | null;
  finalResult: { winner: string; reason: string; stats: unknown } | null;
}

export default function SpectatorPage() {
  const [state, setState] = useState<ProjectorState | null>(null);
  const [denied, setDenied] = useState(false);
  const [playUrl, setPlayUrl] = useState("/play");

  const refresh = useCallback(async () => {
    const res = await fetch("/api/game/state", { cache: "no-store" });
    if (!res.ok) {
      if (res.status === 401) setDenied(true);
      return;
    }
    setDenied(false);
    setState(await res.json());
  }, []);

  useEffect(() => {
    void refresh();
    setPlayUrl(`${window.location.origin}/play`);
  }, [refresh]);

  const onEvent = useCallback(() => void refresh(), [refresh]);
  useGameRealtime({ enabled: !denied, onEvent });

  // show a fresh elimination reveal for a beat, then fall back to the board
  const [showReveal, setShowReveal] = useState(false);
  const lastRevealId = useRef<string | null>(null);
  useEffect(() => {
    const r = state?.eliminationReveal;
    if (r && r.participantId !== lastRevealId.current) {
      lastRevealId.current = r.participantId;
      setShowReveal(true);
      const t = setTimeout(() => setShowReveal(false), 9000);
      return () => clearTimeout(t);
    }
  }, [state?.eliminationReveal]);

  if (denied) {
    return (
      <Shell>
        <p className="text-2xl text-fg-faint">Open this screen from your spectator link.</p>
      </Shell>
    );
  }
  if (!state) {
    return (
      <Shell>
        <p className="text-2xl text-fg-faint">Connecting…</p>
      </Shell>
    );
  }

  if (state.finalResult) return <WinnerScreen result={state.finalResult} />;
  if (showReveal && state.eliminationReveal) {
    return (
      <Shell>
        <RevealCard
          role={state.eliminationReveal.role}
          name={state.eliminationReveal.name}
          subtitle={state.eliminationReveal.role === "IMPOSTER" ? "An imposter is down." : "An innocent, gone."}
          className="scale-125"
        />
      </Shell>
    );
  }

  const inMeeting = !!state.meetingState;
  const preGame = !state.round && state.status !== "FINISHED";

  if (preGame) return <AttractScreen playUrl={playUrl} />;
  if (inMeeting) return <MeetingScreen state={state} />;
  return <LiveScreen state={state} />;
}

/* ------------------------------------------------------------------ */

function Shell({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <main className={cn("ns-screen relative grid place-items-center overflow-hidden bg-void px-[6vw] text-center", className)}>
      <Starfield className="pointer-events-none absolute inset-0 h-full w-full opacity-60" />
      <div className="relative z-10 w-full">{children}</div>
    </main>
  );
}

function BrandMark({ className }: { className?: string }) {
  return (
    <p className={cn("ns-outline font-display font-bold uppercase tracking-[0.2em] text-yellow", className)}>
      Nothing Sus
    </p>
  );
}

/* ------------------------------------------------------------------ */

function AttractScreen({ playUrl }: { playUrl: string }) {
  return (
    <Shell>
      <div className="flex flex-col items-center gap-8">
        <BrandMark className="text-[7vw]" />
        <p className="font-display text-[2vw] uppercase tracking-[0.4em] text-fg-dim">Season 01 · Live Now</p>
        <div className="mt-4 flex flex-col items-center gap-4">
          <QRCode value={playUrl} size={260} />
          <p className="font-display text-[1.6vw] text-fg-dim">
            Scan to join · or go to{" "}
            <span className="text-cyan">{playUrl.replace(/^https?:\/\//, "")}</span>
          </p>
        </div>
      </div>
    </Shell>
  );
}

/* ------------------------------------------------------------------ */

function LiveScreen({ state }: { state: ProjectorState }) {
  return (
    <main className="ns-screen relative flex flex-col overflow-hidden bg-void px-[5vw] py-[4vh]">
      <Starfield className="pointer-events-none absolute inset-0 h-full w-full opacity-30" />
      <div className="relative z-10 flex flex-1 flex-col">
        <header className="flex items-start justify-between">
          <div>
            <p className="font-display text-[1.4vw] uppercase tracking-[0.3em] text-fg-faint">
              Round {state.round?.number}
            </p>
            <h1 className="ns-outline font-display text-[5vw] font-bold uppercase">{state.round?.name}</h1>
          </div>
          <div className="text-right">
            <p className="font-display text-[1.2vw] uppercase tracking-[0.3em] text-fg-faint">Time left</p>
            <p className="font-display text-[6vw] font-bold leading-none">
              <CountdownTimer msRemaining={state.round?.msRemaining ?? null} />
            </p>
          </div>
        </header>

        <div className="grid flex-1 place-items-center">
          <TaskProgress {...state.globalProgress} size="hero" />
        </div>

        <footer className="flex items-end justify-between">
          <div className="flex gap-[4vw]">
            <Counter label="Alive" value={state.aliveCount} tone="text-green" />
            <Counter label="Eliminated" value={state.eliminatedCount} tone="text-red" />
          </div>
          <div className="max-w-[45vw]">
            <EventFeed events={state.recentPublicEvents} variant="ticker" />
          </div>
        </footer>
      </div>
    </main>
  );
}

function Counter({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div>
      <div className={cn("font-display text-[5vw] font-bold leading-none tabular-nums", tone)}>{value}</div>
      <div className="font-display text-[1vw] uppercase tracking-[0.3em] text-fg-faint">{label}</div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function MeetingScreen({ state }: { state: ProjectorState }) {
  const voting = state.votingState?.isOpen;
  return (
    <main className="ns-screen relative grid place-items-center overflow-hidden bg-red-deep/20 px-[6vw] text-center">
      <Starfield className="pointer-events-none absolute inset-0 h-full w-full opacity-20" />
      <motion.div
        className="relative z-10 flex flex-col items-center gap-6"
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
      >
        <p className="text-[8vw]">🚨</p>
        <h1 className="ns-outline font-display text-[7vw] font-bold uppercase text-red">
          {voting ? "Voting Open" : "Emergency Meeting"}
        </h1>
        <p className="font-display text-[2vw] text-fg-dim">
          {voting ? "Cast your votes on your phone" : "Discuss. Accuse. Decide."}
        </p>
      </motion.div>
    </main>
  );
}

/* ------------------------------------------------------------------ */

function WinnerScreen({ result }: { result: { winner: string; reason: string } }) {
  const imposters = result.winner.toUpperCase().includes("IMPOSTER");
  return (
    <main
      className={cn(
        "ns-screen relative grid place-items-center overflow-hidden px-[6vw] text-center",
        imposters ? "bg-red-deep/30" : "bg-cyan-deep/25",
      )}
    >
      <Starfield className="pointer-events-none absolute inset-0 h-full w-full opacity-40" />
      <AnimatePresence>
        <motion.div
          className="relative z-10 flex flex-col items-center gap-6"
          initial={{ scale: 0.7, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 200, damping: 16 }}
        >
          <p className="text-[10vw]">{imposters ? "🔪" : "🛠"}</p>
          <h1
            className={cn(
              "ns-outline font-display text-[8vw] font-bold uppercase leading-none",
              imposters ? "text-red" : "text-cyan",
            )}
          >
            {result.winner} win
          </h1>
          <p className="font-display text-[2.4vw] text-fg-dim">{result.reason}</p>
        </motion.div>
      </AnimatePresence>
    </main>
  );
}
