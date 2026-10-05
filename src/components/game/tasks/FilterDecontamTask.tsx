"use client";

import { useState, useCallback, useRef } from "react";

interface FilterDecontamTaskProps {
  onSuccess: () => void;
  onCancel: () => void;
}

interface Particle {
  id: number;
  x: number;
  y: number;
  cleared: boolean;
}

export function FilterDecontamTask({ onSuccess, onCancel }: FilterDecontamTaskProps) {
  // 6 bio-contaminants floating inside the vortex filter
  const [particles, setParticles] = useState<Particle[]>(() =>
    Array.from({ length: 6 }, (_, i) => ({
      id: i,
      x: 15 + Math.floor(Math.random() * 70),
      y: 15 + Math.floor(Math.random() * 70),
      cleared: false,
    }))
  );

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

  const handleClearParticle = (id: number) => {
    if (busy) return;
    playTone(600, 0.06, "triangle");

    const updated = particles.map((p) => (p.id === id ? { ...p, cleared: true } : p));
    setParticles(updated);

    const remaining = updated.filter((p) => !p.cleared).length;
    if (remaining === 0) {
      setBusy(true);
      chime();
      setTimeout(() => onSuccess(), 500);
    }
  };

  const clearedCount = particles.filter((p) => p.cleared).length;

  return (
    <div className="bg-[#080d16] text-[#e7eef8] rounded-2xl border border-[#29374a] p-4 sm:p-6 space-y-5 font-mono shadow-2xl max-w-lg w-full select-none">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#29374a] pb-3">
        <div>
          <span className="text-[10px] tracking-widest uppercase text-emerald-400 font-bold">
            WASTE PURGE SYSTEM // SANITATION
          </span>
          <h2 className="text-lg font-black uppercase text-white tracking-tight">
            Filter Decontamination Purge
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSound(!sound)}
            className="text-[10px] px-2 py-1 rounded bg-[#1b293c] border border-[#29374a] text-zinc-300"
          >
            {sound ? "🔊" : "🔇"}
          </button>
          <span className="text-xs px-2.5 py-1 rounded bg-[#1b293c] border border-[#29374a] text-emerald-400 font-bold">
            {clearedCount} / 6 PURGED
          </span>
        </div>
      </div>

      <p className="text-xs text-[#8798b0] leading-relaxed">
        Tap and disintegrate all floating toxic bio-contaminants (<span className="text-red-400 font-bold">☣</span>) inside the primary vortex membrane.
      </p>

      {/* Vortex Filter Chamber */}
      <div className="bg-[#070e18] p-4 rounded-2xl border border-[#29374a] flex flex-col items-center space-y-4">
        <div className="relative w-64 h-64 rounded-full border-4 border-dashed border-emerald-900 bg-zinc-950 flex items-center justify-center overflow-hidden shadow-inner">
          {/* Swirling Vortex lines */}
          <div className="absolute inset-4 rounded-full border border-emerald-950/60 animate-spin" />
          <div className="absolute inset-12 rounded-full border border-emerald-900/60" />
          <div className="absolute inset-20 rounded-full border border-emerald-800/60" />
          <div className="w-8 h-8 rounded-full bg-emerald-950/80 border border-emerald-700 flex items-center justify-center text-[10px] text-emerald-400 font-bold">
            DRAIN
          </div>

          {/* Floating Contaminants */}
          {particles.map((p) => {
            if (p.cleared) return null;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => handleClearParticle(p.id)}
                className="absolute w-9 h-9 -ml-4.5 -mt-4.5 rounded-full bg-red-600/90 border-2 border-red-400 text-white flex items-center justify-center text-sm shadow-[0_0_15px_#ef4444] animate-bounce active:scale-75 transition-transform"
                style={{
                  left: `${p.x}%`,
                  top: `${p.y}%`,
                  animationDuration: `${1.8 + (p.id % 3) * 0.4}s`,
                }}
              >
                ☣
              </button>
            );
          })}
        </div>

        {/* Progress Bar */}
        <div className="w-full space-y-1">
          <div className="flex justify-between text-[10px] text-zinc-400">
            <span>MEMBRANE PURITY</span>
            <span className="font-bold text-emerald-400">{Math.round((clearedCount / 6) * 100)}%</span>
          </div>
          <div className="w-full h-2 rounded-full bg-zinc-900 overflow-hidden border border-zinc-800">
            <div
              className="h-full bg-emerald-500 transition-all duration-150"
              style={{ width: `${(clearedCount / 6) * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* Footer controls */}
      <div className="flex items-center justify-between pt-2 border-t border-[#29374a]">
        <span className="text-[10px] text-[#8798b0]">
          {clearedCount === 6 ? "✓ Filter clean · vortex restored" : "Tap contaminants to disintegrate"}
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
