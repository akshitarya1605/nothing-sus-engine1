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
import { IsaHeader } from "@/components/ui/IsaHeader";

interface ProjectorState {
  status: string;
  round: { number: number; name: string; msRemaining: number | null } | null;
  phase: string | null;
  globalProgress: { completed: number; inPlay: number; percentage: number };
  aliveCount: number;
  eliminatedCount: number;
  playerRoster?: Array<{ id: string; name: string; playerNumber?: number | null; status: string }>;
  meetingState: { status: string; type: string } | null;
  votingState: { isOpen: boolean } | null;
  recentPublicEvents: FeedEvent[];
  eliminationReveal: { participantId: string; name: string; role: "ENGINEER" | "IMPOSTER" } | null;
  finalResult:
    | { winner: string; reason: string; stats: unknown; declaredByHost: boolean; championName: string | null }
    | null;
}

export default function SpectatorPage() {
  const [state, setState] = useState<ProjectorState | null>(null);
  const [denied, setDenied] = useState(false);
  const [playUrl, setPlayUrl] = useState("/play");

  const refresh = useCallback(async () => {
    const res = await fetch("/api/game/state?as=SPECTATOR", { cache: "no-store" });
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
    // The projector is the always-on room screen — use it as the heartbeat
    // that drives time-based progression (checkAutoAdvance runs on every
    // /api/game/state read), so meetings still fire during a quiet round.
    const beat = setInterval(() => void refresh(), 20_000);
    return () => clearInterval(beat);
  }, [refresh]);

  const onEvent = useCallback(() => void refresh(), [refresh]);
  useGameRealtime({ enabled: !denied, as: "SPECTATOR", onEvent });

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

  const roomCode = (state as unknown as { roomCode?: string })?.roomCode;
  if (preGame) return <AttractScreen playUrl={playUrl} roomCode={roomCode} state={state} />;
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

function AttractScreen({ playUrl, roomCode, state }: { playUrl: string; roomCode?: string; state?: ProjectorState }) {
  const joinedCount = state?.playerRoster?.length ?? 0;
  return (
    <main className="ns-screen relative flex flex-col justify-between overflow-hidden bg-void text-center">
      <IsaHeader />
      <Starfield className="pointer-events-none absolute inset-0 h-full w-full opacity-60" />
      <div className="relative z-10 flex flex-1 flex-col items-center justify-center gap-6 px-6 py-4">
        <BrandMark className="text-[6vw]" />
        
        {roomCode ? (
          <div className="rounded-3xl border-4 border-yellow bg-yellow/10 px-8 py-4 shadow-[0_0_50px_rgba(255,200,0,0.3)] backdrop-blur-md">
            <p className="font-display text-[1.4vw] font-bold uppercase tracking-[0.4em] text-fg-dim">ROOM CODE TO JOIN</p>
            <p className="font-display text-[7vw] font-black tracking-widest text-yellow animate-pulse my-1">{roomCode}</p>
            <p className="font-display text-[1.2vw] text-cyan font-bold">
              Scan QR or go to <span className="underline">{playUrl.replace(/^https?:\/\//, "")}</span>
            </p>
          </div>
        ) : (
          <p className="font-display text-[2vw] uppercase tracking-[0.4em] text-fg-dim">Waiting for Host to Launch Room…</p>
        )}

        <div className="mt-2 flex flex-col items-center gap-3">
          <QRCode value={playUrl} size={200} />
          {joinedCount > 0 && (
            <p className="font-display text-[1.6vw] font-bold text-green animate-bounce">
              🟢 {joinedCount} Players Joined in Lobby
            </p>
          )}
        </div>
      </div>
    </main>
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
          <div className="flex flex-col items-center gap-4 w-full">
            <TaskProgress {...state.globalProgress} size="hero" />
            {state.playerRoster && state.playerRoster.length > 0 && (
              <div className="mt-2 flex flex-wrap justify-center gap-2 max-w-5xl">
                {state.playerRoster.map((p) => {
                  const dead = p.status === "ELIMINATED" || p.status === "DISQUALIFIED";
                  return (
                    <div
                      key={p.id}
                      className={cn(
                        "flex items-center gap-1.5 rounded-full border-2 px-3 py-1 font-sans text-base font-bold transition-all",
                        dead
                          ? "border-red/60 bg-red/20 text-red line-through opacity-60"
                          : "border-cyan/60 bg-cyan/20 text-cyan",
                      )}
                    >
                      <span>{p.playerNumber ? `#${String(p.playerNumber).padStart(2, "0")}` : p.name}</span>
                      <span>{dead ? "💀" : "🟢"}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
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

function WinnerScreen({
  result,
}: {
  result: { winner: string; reason: string; declaredByHost: boolean; championName: string | null };
}) {
  const imposters = result.winner.toUpperCase().includes("IMPOSTER");
  const draw = result.winner.toUpperCase() === "NONE";
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
          <p className="text-[10vw]">{draw ? "🤝" : imposters ? "🔪" : "🛠"}</p>
          <h1
            className={cn(
              "ns-outline font-display text-[8vw] font-bold uppercase leading-none",
              draw ? "text-yellow" : imposters ? "text-red" : "text-cyan",
            )}
          >
            {draw ? "It's a draw" : `${result.winner} win`}
          </h1>
          <p className="max-w-[70vw] font-display text-[2.4vw] text-fg-dim">{result.reason}</p>
          {result.championName && (
            <p className="mt-2 font-display text-[3vw] font-bold text-yellow">
              ⭐ {result.championName}
            </p>
          )}
          {result.declaredByHost && (
            <p className="font-display text-[1.2vw] uppercase tracking-[0.3em] text-fg-faint">
              Called by the host
            </p>
          )}
        </motion.div>
      </AnimatePresence>
    </main>
  );
}
