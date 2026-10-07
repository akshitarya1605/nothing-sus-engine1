"use client";

import { useEffect, useState, useCallback, useRef } from "react";

interface O2PressureTaskProps {
  onSuccess: () => void;
  onCancel: () => void;
}

// Clear, direct valve effects on 3 chambers:
// Valve 1 primarily drives Chamber A (+5, +1, 0)
// Valve 2 primarily drives Chamber B (+1, +5, +1)
// Valve 3 primarily drives Chamber C (0, +1, +5)
// Valve 4 drives master pressure boost (+2, +2, +2)
const VALVE_EFFECTS = [
  [5, 1, 0],
  [1, 5, 1],
  [0, 1, 5],
  [2, 2, 2],
];

export function O2PressureTask({ onSuccess, onCancel }: O2PressureTaskProps) {
  const [values, setValues] = useState<number[]>([1, 1, 1, 1]);
  const [targets, setTargets] = useState<number[]>([30, 30, 30]);
  const [stage, setStage] = useState(0);
  const [purgeActive, setPurgeActive] = useState(false);
  const [purgeSeq, setPurgeSeq] = useState<number[]>([]);
  const [purgeEntry, setPurgeEntry] = useState(0);
  const [watching, setWatching] = useState(false);
  const [activePad, setActivePad] = useState<number | null>(null);
  const [statusMsg, setStatusMsg] = useState("");
  const [sound, setSound] = useState(true);
  const audioCtxRef = useRef<AudioContext | null>(null);

  const playTone = useCallback((freq = 420, dur = 0.08, type: OscillatorType = "sine") => {
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
      gain.gain.setValueAtTime(0.07, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + dur);
    } catch {
      /* ignore audio error */
    }
  }, [sound]);

  const chime = useCallback(() => {
    [523, 659, 784, 1047].forEach((f, i) => {
      setTimeout(() => playTone(f, 0.25, "triangle"), i * 90);
    });
  }, [playTone]);

  const calculatePressure = useCallback((v: number[]) => {
    return [0, 1, 2].map((chamber) => {
      return 20 + v.reduce((sum, val, valve) => sum + val * VALVE_EFFECTS[valve][chamber], 0);
    });
  }, []);

  const newStage = useCallback((currentStageIndex: number) => {
    setValues([1, 1, 1, 1]);
    // Guaranteed solvable target generated from an exact integer combination
    const solution = Array.from({ length: 4 }, () => 1 + Math.floor(Math.random() * 4));
    const nextTargets = calculatePressure(solution);
    setTargets(nextTargets);
    setStatusMsg(`STAGE ${currentStageIndex + 1} / 2: Adjust valves to match targets within ±2 kPa`);
  }, [calculatePressure]);

  useEffect(() => {
    newStage(0);
  }, [newStage]);

  const currentPressure = calculatePressure(values);

  const handleAdjust = (valveIdx: number, delta: number) => {
    if (purgeActive) return;
    playTone(300 + valveIdx * 80, 0.04);
    setValues((prev) => {
      const next = [...prev];
      next[valveIdx] = Math.max(0, Math.min(8, next[valveIdx] + delta));
      return next;
    });
  };

  const playSequence = async (seq: number[]) => {
    setWatching(true);
    setStatusMsg("Memorize the 4-step purge pulse sequence…");

    for (const pad of seq) {
      await new Promise((r) => setTimeout(r, 350));
      setActivePad(pad);
      playTone(330 + pad * 110, 0.3);
      await new Promise((r) => setTimeout(r, 450));
      setActivePad(null);
    }

    setWatching(false);
    setStatusMsg("Repeat the sequence: 0 / 4");
  };

  const handleCommit = () => {
    if (purgeActive) return;
    // Friendly ±2 kPa tolerance
    const balanced = currentPressure.every((val, idx) => Math.abs(val - targets[idx]) <= 2);

    if (!balanced) {
      playTone(140, 0.2, "sawtooth");
      setStatusMsg("Pressure mismatch! Adjust valves to match all 3 chamber targets.");
      return;
    }

    chime();
    const nextStage = stage + 1;
    if (nextStage < 2) {
      setStage(nextStage);
      newStage(nextStage);
    } else {
      setPurgeActive(true);
      // Clean 4-step sequence
      const seq = Array.from({ length: 4 }, () => Math.floor(Math.random() * 4));
      setPurgeSeq(seq);
      setPurgeEntry(0);
      void playSequence(seq);
    }
  };

  const handlePadClick = (padIdx: number) => {
    if (watching) return;
    playTone(330 + padIdx * 110, 0.1);

    if (purgeSeq[purgeEntry] !== padIdx) {
      setPurgeEntry(0);
      setStatusMsg("Incorrect pulse! Tap 'Replay Sequence' to view again.");
      playTone(130, 0.25, "sawtooth");
      return;
    }

    const nextEntry = purgeEntry + 1;
    setPurgeEntry(nextEntry);
    setStatusMsg(`Sequence accepted: ${nextEntry} / 4`);

    if (nextEntry === 4) {
      chime();
      setStatusMsg("O2 filtration successfully equalized and purged!");
      setTimeout(() => onSuccess(), 600);
    }
  };

  return (
    <div className="bg-[#080d16] text-[#e7eef8] rounded-[2.5rem] border border-[#29374a] p-4 sm:p-6 space-y-5 font-mono shadow-2xl max-w-lg w-full">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#29374a] pb-3">
        <div>
          <span className="text-[10px] tracking-widest uppercase text-[#6fe5ba] font-bold">
            ROOM 02 // FILTRATION SYSTEM
          </span>
          <h2 className="text-lg font-black uppercase text-white tracking-tight">
            O2 Pressure Matrix
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSound(!sound)}
            className="text-[10px] px-2 py-1 rounded bg-[#1b293c] border border-[#29374a] text-zinc-300"
          >
            {sound ? "🔊" : "🔇"}
          </button>
          <span className="text-xs px-2.5 py-1 rounded bg-[#1b293c] border border-[#29374a] text-[#6fe5ba] font-bold">
            {purgeActive ? "MEMBRANE PURGE" : `STAGE ${stage + 1} / 2`}
          </span>
        </div>
      </div>

      <div className="text-xs text-[#8798b0] leading-relaxed">
        {purgeActive
          ? "Repeat the 4-step valve sequence to authorize membrane purge and complete O2 restoration."
          : "Adjust the valves to match the target pressure in Chambers A, B, and C within ±2 kPa, then commit."}
      </div>

      {!purgeActive ? (
        <div className="space-y-4">
          {/* Valves */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {values.map((val, idx) => {
              const labels = ["CH-A", "CH-B", "CH-C", "BOOST"];
              return (
                <div key={idx} className="bg-[#070e18] border border-[#29374a] rounded-xl p-3 text-center space-y-1.5">
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="uppercase text-[#6fe5ba] font-bold">V{idx + 1}</span>
                    <span className="text-zinc-500 font-mono text-[9px]">{labels[idx]}</span>
                  </div>
                  <div className="text-2xl font-black text-white">{val}</div>
                  <div className="flex justify-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => handleAdjust(idx, -1)}
                      disabled={val <= 0}
                      className="w-8 h-8 rounded-lg bg-[#1b293c] hover:bg-[#293d53] disabled:opacity-30 border border-[#29374a] text-base font-bold flex items-center justify-center text-white active:scale-95 transition-all"
                    >
                      −
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAdjust(idx, 1)}
                      disabled={val >= 8}
                      className="w-8 h-8 rounded-lg bg-[#1b293c] hover:bg-[#293d53] disabled:opacity-30 border border-[#29374a] text-base font-bold flex items-center justify-center text-white active:scale-95 transition-all"
                    >
                      +
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Telemetry Table */}
          <div className="bg-[#070e18] border border-[#29374a] rounded-xl p-3 text-xs space-y-2">
            <div className="text-[10px] uppercase text-[#8798b0] font-bold">Chamber Telemetry</div>
            <div className="grid grid-cols-3 gap-2 text-center">
              {["CHAMBER A", "CHAMBER B", "CHAMBER C"].map((name, i) => {
                const diff = currentPressure[i] - targets[i];
                const ok = Math.abs(diff) <= 2;
                return (
                  <div key={name} className={`p-2.5 rounded-lg border ${ok ? "border-emerald-500/50 bg-emerald-950/30" : "border-white/[0.08] bg-[#12121A]/60 backdrop-blur-[30px]"}`}>
                    <div className="text-[10px] text-[#8798b0] font-bold">{name}</div>
                    <div className={`text-base font-black ${ok ? "text-[#6fe5ba]" : "text-amber-400"}`}>
                      {currentPressure[i]} kPa
                    </div>
                    <div className="text-[9px] text-zinc-400 mt-0.5">Target: {targets[i]} kPa</div>
                    <div className={`text-[9px] font-bold mt-0.5 ${ok ? "text-emerald-400" : "text-zinc-500"}`}>
                      {ok ? "✓ BALANCED" : diff > 0 ? `▲ +${diff}` : `▼ ${diff}`}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <button
            type="button"
            onClick={handleCommit}
            className="w-full py-3 rounded-xl bg-[#6fe5ba] hover:brightness-110 text-[#08111b] font-bold text-xs uppercase tracking-wider transition-all shadow-lg active:scale-98"
          >
            Commit Pressure Balance →
          </button>
        </div>
      ) : (
        /* Purge Memory Sequence */
        <div className="space-y-4 bg-[#070e18] p-4 rounded-xl border border-[#29374a]">
          <div className="text-center text-xs text-zinc-300 font-bold">{statusMsg}</div>
          <div className="grid grid-cols-4 gap-2">
            {[0, 1, 2, 3].map((pad) => (
              <button
                key={pad}
                type="button"
                onClick={() => handlePadClick(pad)}
                disabled={watching}
                className={`py-6 rounded-xl border font-bold text-sm transition-all ${
                  activePad === pad
                    ? "bg-[#6fe5ba] border-[#6fe5ba] text-black shadow-[0_0_20px_#6fe5ba]"
                    : "bg-[#1b293c] border-[#29374a] text-white hover:border-[#6fe5ba] active:scale-95"
                }`}
              >
                V{pad + 1}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => void playSequence(purgeSeq)}
            disabled={watching}
            className="w-full py-2.5 rounded-lg bg-[#1b293c] hover:bg-[#293d53] text-zinc-300 border border-[#29374a] text-xs transition-colors"
          >
            Replay Sequence
          </button>
        </div>
      )}

      {/* Footer controls */}
      <div className="flex items-center justify-between pt-2 border-t border-[#29374a]">
        <span className="text-[10px] text-[#8798b0] truncate max-w-[250px]">{statusMsg}</span>
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
