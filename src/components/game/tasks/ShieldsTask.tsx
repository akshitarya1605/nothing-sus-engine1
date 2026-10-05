"use client";

import { useState } from "react";

interface ShieldsTaskProps {
  onSuccess: () => void;
  onCancel: () => void;
}

export function ShieldsTask({ onSuccess, onCancel }: ShieldsTaskProps) {
  // 7 shields: 0 is center, 1..6 are surrounding
  const [shields, setShields] = useState<boolean[]>([false, true, false, false, true, false, false]);

  const toggleShield = (idx: number) => {
    const next = [...shields];
    next[idx] = !next[idx];
    setShields(next);

    if (next.every((s) => s)) {
      setTimeout(() => onSuccess(), 400);
    }
  };

  const primedCount = shields.filter(Boolean).length;

  return (
    <div className="bg-[#080d16] text-[#e7eef8] rounded-2xl border border-[#29374a] p-4 sm:p-6 space-y-5 font-mono shadow-2xl max-w-sm w-full text-center">
      <div className="border-b border-[#29374a] pb-3 flex items-center justify-between">
        <div className="text-left">
          <span className="text-[10px] tracking-widest uppercase text-cyan-400 font-bold">
            DEFENSE STATION
          </span>
          <h2 className="text-base font-black uppercase text-white">Prime Shields</h2>
        </div>
        <span className="text-xs px-2 py-0.5 rounded bg-zinc-900 border border-zinc-700 text-cyan-300 font-bold">
          {primedCount} / 7 Primed
        </span>
      </div>

      <p className="text-xs text-[#8798b0]">
        Tap all unprimed <span className="text-red-400 font-bold">red</span> shields to activate deflector power until all 7 are <span className="text-emerald-400 font-bold">green</span>.
      </p>

      {/* Hexagonal Shield Grid */}
      <div className="flex flex-col items-center justify-center gap-3 py-4">
        {/* Top row */}
        <div className="flex gap-4">
          {[1, 2].map((idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => toggleShield(idx)}
              className={`w-16 h-16 rounded-2xl border-2 transition-all flex items-center justify-center text-lg ${
                shields[idx]
                  ? "bg-emerald-950/80 border-emerald-400 text-emerald-300 shadow-[0_0_15px_rgba(52,211,153,0.4)]"
                  : "bg-red-950/80 border-red-500 text-red-300 animate-pulse"
              }`}
            >
              {shields[idx] ? "🛡️" : "⚠️"}
            </button>
          ))}
        </div>

        {/* Center row */}
        <div className="flex gap-4 items-center">
          {[3, 0, 4].map((idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => toggleShield(idx)}
              className={`w-16 h-16 rounded-2xl border-2 transition-all flex items-center justify-center text-lg ${
                shields[idx]
                  ? "bg-emerald-950/80 border-emerald-400 text-emerald-300 shadow-[0_0_15px_rgba(52,211,153,0.4)]"
                  : "bg-red-950/80 border-red-500 text-red-300 animate-pulse"
              }`}
            >
              {shields[idx] ? "🛡️" : "⚠️"}
            </button>
          ))}
        </div>

        {/* Bottom row */}
        <div className="flex gap-4">
          {[5, 6].map((idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => toggleShield(idx)}
              className={`w-16 h-16 rounded-2xl border-2 transition-all flex items-center justify-center text-lg ${
                shields[idx]
                  ? "bg-emerald-950/80 border-emerald-400 text-emerald-300 shadow-[0_0_15px_rgba(52,211,153,0.4)]"
                  : "bg-red-950/80 border-red-500 text-red-300 animate-pulse"
              }`}
            >
              {shields[idx] ? "🛡️" : "⚠️"}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between pt-2 border-t border-[#29374a]">
        <span className="text-[10px] text-zinc-500">
          {primedCount === 7 ? "✓ All shields primed!" : "Shields offline"}
        </span>
        <button
          type="button"
          onClick={onCancel}
          className="text-xs px-3 py-1.5 rounded-lg bg-zinc-900 text-zinc-400 border border-zinc-700"
        >
          Exit
        </button>
      </div>
    </div>
  );
}
