"use client";

import { useState, useCallback, useRef } from "react";

interface HydroPipeTaskProps {
  onSuccess: () => void;
  onCancel: () => void;
}

// 3x3 Pipe Grid with rotating valves to route coolant from top-left (0) to bottom-right (8)
interface PipeCell {
  shape: "STRAIGHT" | "CORNER";
  rot: number; // 0, 1, 2, 3
}

export function HydroPipeTask({ onSuccess, onCancel }: HydroPipeTaskProps) {
  // Solvable initial configuration with scrambled rotations
  const [grid, setGrid] = useState<PipeCell[]>([
    { shape: "CORNER", rot: 1 },
    { shape: "STRAIGHT", rot: 1 },
    { shape: "CORNER", rot: 2 },
    { shape: "STRAIGHT", rot: 0 },
    { shape: "CORNER", rot: 3 },
    { shape: "STRAIGHT", rot: 1 },
    { shape: "CORNER", rot: 0 },
    { shape: "STRAIGHT", rot: 1 },
    { shape: "CORNER", rot: 3 },
  ]);

  const [sound, setSound] = useState(true);
  const [busy, setBusy] = useState(false);
  const audioCtxRef = useRef<AudioContext | null>(null);

  const playTone = useCallback((freq = 440, dur = 0.08, type: OscillatorType = "sine") => {
    if (!sound) return;
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === "suspended") ctx.resume();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      gain.gain.setValueAtTime(0.06, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + dur);
    } catch {
      /* ignore audio */
    }
  }, [sound]);

  const chime = useCallback(() => {
    [523, 659, 784, 1047].forEach((f, i) => {
      setTimeout(() => playTone(f, 0.25, "triangle"), i * 90);
    });
  }, [playTone]);

  // Rotate tile
  const rotateTile = (idx: number) => {
    if (busy) return;
    playTone(320, 0.04);
    setGrid((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], rot: (next[idx].rot + 1) % 4 };
      return next;
    });
  };

  // Check connection: simple check if 0 -> 1 -> 4 -> 5 -> 8 or 0 -> 3 -> 4 -> 7 -> 8 connects
  // For accessibility and fun campus play, check key corner orientations:
  const isPipeConnected =
    (grid[0].rot % 2 === 1 || grid[0].rot === 2) &&
    (grid[8].rot % 2 === 1 || grid[8].rot === 0) &&
    grid[4].rot % 2 === 0;

  const handleTestFlow = () => {
    if (busy) return;

    if (isPipeConnected) {
      setBusy(true);
      chime();
      setTimeout(() => onSuccess(), 500);
    } else {
      playTone(160, 0.25, "sawtooth");
    }
  };

  return (
    <div className="bg-[#080d16] text-[#e7eef8] rounded-[2.5rem] border border-[#29374a] p-4 sm:p-6 space-y-5 font-mono shadow-2xl max-w-lg w-full select-none">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#29374a] pb-3">
        <div>
          <span className="text-[10px] tracking-widest uppercase text-[#00F0FF] font-bold">
            HYDRO-PROPULSION MANIFOLD // HARD TASK
          </span>
          <h2 className="text-lg font-black uppercase text-white tracking-tight">
            Hydro Pipe Junction
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSound(!sound)}
            className="text-[10px] px-2 py-1 rounded bg-[#1b293c] border border-[#29374a] text-zinc-300"
          >
            {sound ? "🔊" : "🔇"}
          </button>
          <span className="text-xs px-2.5 py-1 rounded bg-[#1b293c] border border-[#29374a] text-[#00F0FF] font-bold">
            VALVE FLOW
          </span>
        </div>
      </div>

      <p className="text-xs text-[#8798b0] leading-relaxed">
        Rotate hydraulic conduit tiles to route high-pressure coolant from Intake (<span className="text-[#00F0FF] font-bold">💧</span>) to Primary Core (<span className="text-emerald-400 font-bold">CORE</span>).
      </p>

      {/* 3x3 Pipe Grid */}
      <div className="bg-[#070e18] p-4 rounded-[2.5rem] border border-[#29374a] space-y-4">
        <div className="grid grid-cols-3 gap-2.5 max-w-[280px] mx-auto">
          {grid.map((cell, idx) => {
            const isStart = idx === 0;
            const isEnd = idx === 8;
            return (
              <button
                key={idx}
                type="button"
                onClick={() => rotateTile(idx)}
                className={`aspect-square rounded-xl border flex items-center justify-center relative p-2 transition-transform active:scale-95 ${
                  isStart
                    ? "border-cyan-400 bg-cyan-950/40"
                    : isEnd
                    ? "border-emerald-400 bg-emerald-950/40"
                    : "border-white/[0.08] bg-[#0c1522] hover:border-zinc-600"
                }`}
              >
                {/* Visual Pipe Graphic */}
                <div
                  className="w-full h-full flex items-center justify-center transition-transform duration-150"
                  style={{ transform: `rotate(${cell.rot * 90}deg)` }}
                >
                  {cell.shape === "STRAIGHT" ? (
                    <div className="w-4 h-full bg-cyan-500/80 rounded-sm shadow-[0_0_8px_rgba(6,182,212,0.4)]" />
                  ) : (
                    <div className="relative w-full h-full">
                      <div className="absolute top-0 left-1/2 -ml-2 w-4 h-1/2 bg-cyan-500/80 rounded-t-sm" />
                      <div className="absolute top-1/2 left-1/2 -mt-2 w-1/2 h-4 bg-cyan-500/80 rounded-r-sm" />
                    </div>
                  )}
                </div>

                {isStart && (
                  <span className="absolute top-1 left-1 text-[9px] font-bold text-[#00F0FF]">
                    IN
                  </span>
                )}
                {isEnd && (
                  <span className="absolute bottom-1 right-1 text-[9px] font-bold text-emerald-300">
                    OUT
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Test Flow Button */}
        <button
          type="button"
          onClick={handleTestFlow}
          disabled={busy}
          className="w-full py-3.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-black text-xs uppercase tracking-wider shadow-lg active:scale-98 transition-all"
        >
          {busy ? "PRESSURIZING PIPES…" : "TEST COOLANT FLOW →"}
        </button>
      </div>

      {/* Footer controls */}
      <div className="flex items-center justify-between pt-2 border-t border-[#29374a]">
        <span className="text-[10px] text-[#8798b0]">
          {isPipeConnected ? "Coolant conduit aligned · ready to pressurize" : "Rotate valves to bridge IN to OUT"}
        </span>
        <button
          type="button"
          onClick={onCancel}
          className="text-xs px-4 py-2 rounded-lg bg-black/50 hover:bg-white/[0.04] text-zinc-400 border border-white/[0.08] transition-colors"
        >
          Exit Console
        </button>
      </div>
    </div>
  );
}
