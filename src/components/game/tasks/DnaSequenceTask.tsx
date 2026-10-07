"use client";

import { useState, useCallback, useRef } from "react";

interface DnaSequenceTaskProps {
  onSuccess: () => void;
  onCancel: () => void;
}

type Base = "A" | "T" | "C" | "G";
const PAIRS: Record<Base, Base> = {
  A: "T",
  T: "A",
  C: "G",
  G: "C",
};

const BASE_COLORS: Record<Base, string> = {
  A: "bg-red-500/20 text-[#FF3B5C] border-red-500",
  T: "bg-blue-500/20 text-blue-400 border-blue-500",
  C: "bg-emerald-500/20 text-emerald-400 border-emerald-500",
  G: "bg-yellow-500/20 text-yellow-400 border-yellow-500",
};

export function DnaSequenceTask({ onSuccess, onCancel }: DnaSequenceTaskProps) {
  // 6 codons to match
  const [template] = useState<Base[]>(() => {
    const bases: Base[] = ["A", "T", "C", "G"];
    return Array.from({ length: 6 }, () => bases[Math.floor(Math.random() * bases.length)]);
  });

  const [matches, setMatches] = useState<(Base | null)[]>(Array(6).fill(null));
  const [currentIdx, setCurrentIdx] = useState(0);
  const [errorFlash, setErrorFlash] = useState(false);
  const [sound, setSound] = useState(true);
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

  const handleSelectBase = (selected: Base) => {
    if (currentIdx >= 6) return;

    const targetBase = template[currentIdx];
    const expected = PAIRS[targetBase];

    if (selected === expected) {
      playTone(520 + currentIdx * 60, 0.08);
      const updated = [...matches];
      updated[currentIdx] = selected;
      setMatches(updated);

      const nextIdx = currentIdx + 1;
      setCurrentIdx(nextIdx);

      if (nextIdx === 6) {
        chime();
        setTimeout(() => onSuccess(), 500);
      }
    } else {
      playTone(160, 0.25, "sawtooth");
      setErrorFlash(true);
      setTimeout(() => setErrorFlash(false), 400);
    }
  };

  return (
    <div className="bg-[#080d16] text-[#e7eef8] rounded-[2.5rem] border border-[#29374a] p-4 sm:p-6 space-y-5 font-mono shadow-2xl max-w-lg w-full select-none">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#29374a] pb-3">
        <div>
          <span className="text-[10px] tracking-widest uppercase text-emerald-400 font-bold">
            BIO-RESEARCH LAB // HARD TASK
          </span>
          <h2 className="text-lg font-black uppercase text-white tracking-tight">
            DNA Sequence Recombinator
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
            {currentIdx} / 6 BASE PAIRS
          </span>
        </div>
      </div>

      <p className="text-xs text-[#8798b0] leading-relaxed">
        Complement nucleotide codons according to base pair rules:
        <span className="text-white font-bold"> A ↔ T</span> and <span className="text-white font-bold">C ↔ G</span>.
      </p>

      {/* DNA Double Helix Columns */}
      <div className={`bg-[#070e18] p-4 rounded-[2.5rem] border transition-colors ${errorFlash ? "border-red-500 bg-[#FF3B5C]/10/20" : "border-[#29374a]"} space-y-3`}>
        <div className="flex justify-between items-center text-[10px] text-zinc-400 font-bold border-b border-white/[0.08] pb-2">
          <span>ORIGINAL STRAND</span>
          <span>COMPLEMENTARY STRAND</span>
        </div>

        <div className="space-y-2">
          {template.map((base, idx) => {
            const isMatched = matches[idx] !== null;
            const isCurrent = idx === currentIdx;

            return (
              <div
                key={idx}
                className={`flex items-center justify-between p-2 rounded-xl border text-xs font-bold transition-all ${
                  isCurrent
                    ? "border-emerald-400 bg-emerald-950/30"
                    : isMatched
                    ? "border-white/[0.08] bg-[#12121A]/60 backdrop-blur-[30px] opacity-60"
                    : "border-zinc-850 bg-[#12121A]/60 backdrop-blur-[30px]"
                }`}
              >
                {/* Left Template Base */}
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-zinc-500">#{idx + 1}</span>
                  <span className={`w-8 h-8 rounded-lg border flex items-center justify-center font-black ${BASE_COLORS[base]}`}>
                    {base}
                  </span>
                </div>

                {/* Hydrogen bond connector */}
                <div className="flex-1 mx-4 flex items-center justify-center text-zinc-600 tracking-widest text-[10px]">
                  {isMatched ? "═════" : isCurrent ? "·····" : "- - -"}
                </div>

                {/* Right Complementary Base */}
                <div>
                  {matches[idx] ? (
                    <span className={`w-8 h-8 rounded-lg border flex items-center justify-center font-black ${BASE_COLORS[matches[idx]!]}`}>
                      {matches[idx]}
                    </span>
                  ) : isCurrent ? (
                    <div className="w-8 h-8 rounded-lg border-2 border-dashed border-emerald-400 flex items-center justify-center text-emerald-400 animate-pulse">
                      ?
                    </div>
                  ) : (
                    <div className="w-8 h-8 rounded-lg border border-white/[0.08] bg-black/50" />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Nucleotide Input Buttons */}
      <div className="grid grid-cols-4 gap-2">
        {(["A", "T", "C", "G"] as Base[]).map((base) => (
          <button
            key={base}
            type="button"
            onClick={() => handleSelectBase(base)}
            disabled={currentIdx >= 6}
            className={`py-3 rounded-xl border-2 font-black text-base shadow-lg active:scale-95 transition-all ${BASE_COLORS[base]} hover:brightness-125`}
          >
            {base}
          </button>
        ))}
      </div>

      {/* Footer controls */}
      <div className="flex items-center justify-between pt-2 border-t border-[#29374a]">
        <span className="text-[10px] text-[#8798b0]">
          {errorFlash ? "Base pair mismatch! Remember: A-T, C-G" : "Select complementary nucleotide"}
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
