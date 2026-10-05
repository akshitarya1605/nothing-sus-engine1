"use client";

import { useState, useCallback, useRef } from "react";

interface BreakerGridTaskProps {
  onSuccess: () => void;
  onCancel: () => void;
}

export function BreakerGridTask({ onSuccess, onCancel }: BreakerGridTaskProps) {
  // 5 breaker nodes
  const [sequence, setSequence] = useState<number[]>([]);
  const [userStep, setUserStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeBreaker, setActiveBreaker] = useState<number | null>(null);
  const [status, setStatus] = useState("Tap 'Engage Diagnostics' to preview power relay sequence.");
  const [sound, setSound] = useState(true);

  const audioCtxRef = useRef<AudioContext | null>(null);

  const playTone = useCallback((freq = 440, dur = 0.15, type: OscillatorType = "sine") => {
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
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
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

  const startSequence = async () => {
    setIsPlaying(true);
    setUserStep(0);
    // 5-step relay pulse
    const seq = Array.from({ length: 5 }, () => Math.floor(Math.random() * 5));
    setSequence(seq);
    setStatus("Memorize the 5 breaker relay pulses…");

    for (let i = 0; i < seq.length; i++) {
      await new Promise((r) => setTimeout(r, 350));
      const node = seq[i];
      setActiveBreaker(node);
      playTone(320 + node * 90, 0.25, "square");
      await new Promise((r) => setTimeout(r, 400));
      setActiveBreaker(null);
    }

    setIsPlaying(false);
    setStatus("Repeat sequence: 0 / 5 Breakers");
  };

  const handleBreakerClick = (node: number) => {
    if (isPlaying || sequence.length === 0) return;

    playTone(320 + node * 90, 0.15, "square");

    if (sequence[userStep] === node) {
      const nextStep = userStep + 1;
      setUserStep(nextStep);
      setStatus(`Relay accepted: ${nextStep} / 5`);

      if (nextStep === 5) {
        chime();
        setStatus("✓ Auxiliary breaker grid successfully restored!");
        setTimeout(() => onSuccess(), 600);
      }
    } else {
      playTone(140, 0.3, "sawtooth");
      setStatus("Relay mismatch! Power tripped. Tap 'Engage Diagnostics' to retry.");
      setUserStep(0);
      setSequence([]);
    }
  };

  const BREAKER_COLORS = [
    "border-amber-500 text-amber-400 bg-amber-950/30",
    "border-cyan-500 text-cyan-400 bg-cyan-950/30",
    "border-red-500 text-red-400 bg-red-950/30",
    "border-emerald-500 text-emerald-400 bg-emerald-950/30",
    "border-purple-500 text-purple-400 bg-purple-950/30",
  ];

  return (
    <div className="bg-[#080d16] text-[#e7eef8] rounded-2xl border border-[#29374a] p-4 sm:p-6 space-y-5 font-mono shadow-2xl max-w-lg w-full select-none">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#29374a] pb-3">
        <div>
          <span className="text-[10px] tracking-widest uppercase text-yellow-400 font-bold">
            HIGH VOLTAGE SUBSTATION // HARD TASK
          </span>
          <h2 className="text-lg font-black uppercase text-white tracking-tight">
            Breaker Grid Sequencer
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSound(!sound)}
            className="text-[10px] px-2 py-1 rounded bg-[#1b293c] border border-[#29374a] text-zinc-300"
          >
            {sound ? "🔊" : "🔇"}
          </button>
          <span className="text-xs px-2.5 py-1 rounded bg-[#1b293c] border border-[#29374a] text-yellow-400 font-bold">
            {userStep} / 5 RELAYS
          </span>
        </div>
      </div>

      <p className="text-xs text-[#8798b0] leading-relaxed">
        Watch and memorize the sequence of high-voltage breaker pulses, then re-engage them in the exact order.
      </p>

      {/* Breaker Switch Matrix */}
      <div className="bg-[#070e18] p-5 rounded-2xl border border-[#29374a] space-y-4">
        <div className="grid grid-cols-5 gap-2">
          {[0, 1, 2, 3, 4].map((node) => {
            const isActive = activeBreaker === node;
            return (
              <button
                key={node}
                type="button"
                onClick={() => handleBreakerClick(node)}
                disabled={isPlaying}
                className={`aspect-[3/4] rounded-xl border-2 flex flex-col items-center justify-between p-2 font-black transition-all ${
                  isActive
                    ? "bg-white border-white text-black shadow-[0_0_25px_#fff] scale-105"
                    : BREAKER_COLORS[node]
                } hover:brightness-125 active:scale-95 disabled:cursor-not-allowed`}
              >
                <span className="text-[9px] opacity-75">BKR-{node + 1}</span>
                <span className="text-xl">⚡</span>
                <div className={`w-3 h-3 rounded-full ${isActive ? "bg-black" : "bg-zinc-700"}`} />
              </button>
            );
          })}
        </div>

        {sequence.length === 0 && (
          <button
            type="button"
            onClick={startSequence}
            disabled={isPlaying}
            className="w-full py-3.5 rounded-xl bg-yellow-500 hover:bg-yellow-400 text-black font-black text-xs uppercase tracking-wider shadow-lg active:scale-98 transition-all"
          >
            ENGAGE DIAGNOSTICS SEQUENCE →
          </button>
        )}
      </div>

      {/* Footer controls */}
      <div className="flex items-center justify-between pt-2 border-t border-[#29374a]">
        <span className="text-[10px] text-[#8798b0] truncate max-w-[250px]">{status}</span>
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
