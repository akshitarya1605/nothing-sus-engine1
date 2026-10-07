"use client";

import { useState, useCallback, useRef } from "react";

interface VoltageRegulatorTaskProps {
  onSuccess: () => void;
  onCancel: () => void;
}

export function VoltageRegulatorTask({ onSuccess, onCancel }: VoltageRegulatorTaskProps) {
  // 4 capacitor switches, each controls power distribution
  const [switches, setSwitches] = useState<boolean[]>([false, true, false, false]);
  const [capacitors] = useState<number[]>([40, 25, 35, 20]); // base values
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

  // Current voltage is calculated from active switches
  // Target voltage is exactly 120V
  const currentVoltage =
    100 +
    switches.reduce((acc, on, idx) => (on ? acc + capacitors[idx] : acc), 0) -
    switches.reduce((acc, on, idx) => (!on ? acc + 10 : acc), 0);

  const isBalanced = currentVoltage >= 118 && currentVoltage <= 122;

  const toggleSwitch = (idx: number) => {
    if (busy) return;
    playTone(340 + idx * 50, 0.05);
    const next = [...switches];
    next[idx] = !next[idx];
    setSwitches(next);
  };

  const handleCommit = () => {
    if (busy) return;

    if (isBalanced) {
      setBusy(true);
      chime();
      setTimeout(() => onSuccess(), 500);
    } else {
      playTone(160, 0.2, "sawtooth");
    }
  };

  return (
    <div className="bg-[#080d16] text-[#e7eef8] rounded-[2.5rem] border border-[#29374a] p-4 sm:p-6 space-y-5 font-mono shadow-2xl max-w-lg w-full select-none">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#29374a] pb-3">
        <div>
          <span className="text-[10px] tracking-widest uppercase text-yellow-400 font-bold">
            DISTRIBUTION TRANSFORMER // VOLTAGE
          </span>
          <h2 className="text-lg font-black uppercase text-white tracking-tight">
            Voltage Regulator Node
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
            BUS 120V
          </span>
        </div>
      </div>

      <p className="text-xs text-[#8798b0] leading-relaxed">
        Toggle shunt capacitor switches to calibrate the main electrical transformer bus bar to <span className="text-emerald-400 font-bold">120V (±2V)</span>.
      </p>

      {/* Voltage Meter Display */}
      <div className="bg-[#070e18] p-5 rounded-[2.5rem] border border-[#29374a] space-y-4">
        <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
          <div>
            <div className="text-[10px] text-zinc-400">BUS VOLTAGE</div>
            <div className={`text-3xl font-black ${isBalanced ? "text-emerald-400 animate-pulse" : "text-amber-400"}`}>
              {currentVoltage} <span className="text-base text-zinc-500">VAC</span>
            </div>
          </div>
          <div className="text-right">
            <div className="text-[10px] text-zinc-400">TARGET</div>
            <div className="text-xl font-bold text-white">120 VAC</div>
            <div className={`text-[10px] font-bold ${isBalanced ? "text-emerald-400" : "text-zinc-500"}`}>
              {isBalanced ? "✓ SYNCHRONIZED" : `DELTA: ${currentVoltage - 120}V`}
            </div>
          </div>
        </div>

        {/* 4 Shunt Switches */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {switches.map((on, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => toggleSwitch(idx)}
              className={`p-3 rounded-xl border flex flex-col items-center justify-between gap-2 transition-all active:scale-95 ${
                on
                  ? "border-yellow-400 bg-yellow-950/30 text-yellow-300 shadow-[0_0_12px_rgba(250,204,21,0.2)]"
                  : "border-white/[0.08] bg-[#12121A]/60 backdrop-blur-[30px] text-zinc-500"
              }`}
            >
              <span className="text-[10px] font-bold">SHUNT #{idx + 1}</span>
              <span className="text-xl">{on ? "⚡" : "○"}</span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${on ? "bg-yellow-400 text-black" : "bg-white/[0.04] text-zinc-400"}`}>
                {on ? "CLOSED" : "OPEN"}
              </span>
            </button>
          ))}
        </div>

        {/* Commit Button */}
        <button
          type="button"
          onClick={handleCommit}
          disabled={busy}
          className={`w-full py-3.5 rounded-xl font-black text-xs uppercase tracking-wider shadow-lg active:scale-98 transition-all ${
            isBalanced
              ? "bg-emerald-500 hover:bg-emerald-400 text-black shadow-[0_0_20px_rgba(52,211,153,0.3)]"
              : "bg-white/[0.04] text-zinc-400 hover:bg-white/[0.08]"
          }`}
        >
          {isBalanced ? "COMMIT VOLTAGE STABILIZATION →" : "VOLTAGE OUT OF TOLERANCE"}
        </button>
      </div>

      {/* Footer controls */}
      <div className="flex items-center justify-between pt-2 border-t border-[#29374a]">
        <span className="text-[10px] text-[#8798b0]">
          {isBalanced ? "Bus bar in tolerance (120 VAC)" : "Tune capacitor switches to reach 120V"}
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
