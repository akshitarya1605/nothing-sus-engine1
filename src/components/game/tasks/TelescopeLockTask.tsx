"use client";

import { useEffect, useState, useRef, useCallback } from "react";

interface TelescopeLockTaskProps {
  onSuccess: () => void;
  onCancel: () => void;
}

export function TelescopeLockTask({ onSuccess, onCancel }: TelescopeLockTaskProps) {
  // Pulsar celestial coordinates
  const [target] = useState(() => ({
    x: 40 + Math.floor(Math.random() * 120),
    y: 40 + Math.floor(Math.random() * 120),
  }));

  const [reticle, setReticle] = useState({ x: 20, y: 20 });
  const [lockHold, setLockHold] = useState(0);
  const [busy, setBusy] = useState(false);
  const [sound, setSound] = useState(true);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const holdRef = useRef(0);

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

  const dx = reticle.x - target.x;
  const dy = reticle.y - target.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const isAligned = dist < 14;

  useEffect(() => {
    const timer = setInterval(() => {
      if (busy) return;
      if (isAligned) {
        holdRef.current = Math.min(100, holdRef.current + 8);
        playTone(600 + holdRef.current * 4, 0.04);
        if (holdRef.current >= 100) {
          setBusy(true);
          chime();
          setTimeout(() => onSuccess(), 500);
        }
      } else {
        holdRef.current = Math.max(0, holdRef.current - 12);
      }
      setLockHold(holdRef.current);
    }, 100);

    return () => clearInterval(timer);
  }, [isAligned, busy, chime, playTone, onSuccess]);

  const moveReticle = (mx: number, my: number) => {
    if (busy) return;
    playTone(320, 0.04);
    setReticle((prev) => ({
      x: Math.max(10, Math.min(190, prev.x + mx)),
      y: Math.max(10, Math.min(190, prev.y + my)),
    }));
  };

  return (
    <div className="bg-[#080d16] text-[#e7eef8] rounded-2xl border border-[#29374a] p-4 sm:p-6 space-y-5 font-mono shadow-2xl max-w-lg w-full select-none">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#29374a] pb-3">
        <div>
          <span className="text-[10px] tracking-widest uppercase text-cyan-400 font-bold">
            OBSERVATORY DOME // HARD TASK
          </span>
          <h2 className="text-lg font-black uppercase text-white tracking-tight">
            Telescope Deep Space Lock
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSound(!sound)}
            className="text-[10px] px-2 py-1 rounded bg-[#1b293c] border border-[#29374a] text-zinc-300"
          >
            {sound ? "🔊" : "🔇"}
          </button>
          <span className="text-xs px-2.5 py-1 rounded bg-[#1b293c] border border-[#29374a] text-cyan-400 font-bold">
            PULSAR TRACK
          </span>
        </div>
      </div>

      <p className="text-xs text-[#8798b0] leading-relaxed">
        Steer the astronomical telescope optic reticle directly onto the pulsating star beacon and hold stable.
      </p>

      {/* Deep Space Starfield Map */}
      <div className="bg-[#070e18] p-4 rounded-2xl border border-[#29374a] flex flex-col items-center space-y-4">
        <div className="relative w-64 h-64 rounded-2xl border-2 border-zinc-800 bg-black overflow-hidden shadow-2xl">
          {/* Static stars background */}
          <div className="absolute inset-0 opacity-40 bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:16px_16px]" />

          {/* Pulsar Beacon Target */}
          <div
            className="absolute w-8 h-8 -ml-4 -mt-4 rounded-full flex items-center justify-center pointer-events-none"
            style={{ left: `${(target.x / 200) * 100}%`, top: `${(target.y / 200) * 100}%` }}
          >
            <div className="w-4 h-4 rounded-full bg-cyan-400 animate-ping opacity-75" />
            <div className="w-2.5 h-2.5 rounded-full bg-white shadow-[0_0_12px_#38bdf8]" />
          </div>

          {/* User Reticle */}
          <div
            className={`absolute w-12 h-12 -ml-6 -mt-6 rounded-full border-2 transition-all flex items-center justify-center pointer-events-none ${
              isAligned
                ? "border-emerald-400 bg-emerald-500/20 shadow-[0_0_20px_#34d399]"
                : "border-red-400/80 bg-red-500/10"
            }`}
            style={{ left: `${(reticle.x / 200) * 100}%`, top: `${(reticle.y / 200) * 100}%` }}
          >
            <div className="w-1 h-1 bg-white rounded-full" />
            <div className="absolute w-full h-[1px] bg-white/40" />
            <div className="absolute h-full w-[1px] bg-white/40" />
          </div>
        </div>

        {/* Lock Hold Progress */}
        <div className="w-full space-y-1">
          <div className="flex justify-between text-[10px] text-zinc-400">
            <span>SPECTRAL FREQUENCY LOCK</span>
            <span className="font-bold text-cyan-400">{lockHold}%</span>
          </div>
          <div className="w-full h-2 rounded-full bg-zinc-900 overflow-hidden border border-zinc-800">
            <div
              className={`h-full transition-all duration-75 ${
                lockHold > 80 ? "bg-emerald-400" : "bg-cyan-400"
              }`}
              style={{ width: `${lockHold}%` }}
            />
          </div>
        </div>

        {/* Reticle Controls */}
        <div className="grid grid-cols-3 gap-2 w-48 pt-1">
          <div />
          <button
            type="button"
            onClick={() => moveReticle(0, -18)}
            className="py-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-white font-bold active:scale-95"
          >
            ▲
          </button>
          <div />

          <button
            type="button"
            onClick={() => moveReticle(-18, 0)}
            className="py-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-white font-bold active:scale-95"
          >
            ◀
          </button>
          <button
            type="button"
            onClick={() => moveReticle(0, 18)}
            className="py-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-white font-bold active:scale-95"
          >
            ▼
          </button>
          <button
            type="button"
            onClick={() => moveReticle(18, 0)}
            className="py-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-white font-bold active:scale-95"
          >
            ▶
          </button>
        </div>
      </div>

      {/* Footer controls */}
      <div className="flex items-center justify-between pt-2 border-t border-[#29374a]">
        <span className="text-[10px] text-[#8798b0]">
          {isAligned ? "Pulsar coordinate locked · syncing telemetry…" : "Align telescope reticle over pulsar"}
        </span>
        <button
          type="button"
          onClick={onCancel}
          className="text-xs px-4 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-400 border border-zinc-700 transition-colors"
        >
          Exit Console
        </button>
      </div>
    </div>
  );
}
