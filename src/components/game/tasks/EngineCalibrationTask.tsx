"use client";

import { useEffect, useState, useRef, useCallback } from "react";

interface EngineCalibrationTaskProps {
  onSuccess: () => void;
  onCancel: () => void;
}

export function EngineCalibrationTask({ onSuccess, onCancel }: EngineCalibrationTaskProps) {
  const [stage, setStage] = useState(0); // 3 stages
  const [needlePos, setNeedlePos] = useState(50); // 0 to 100
  const [targetZone, setTargetZone] = useState<{ min: number; max: number }>({ min: 40, max: 60 });
  const [status, setStatus] = useState("Calibrate hydraulic flywheel: Lock needle in the green zone.");
  const [busy, setBusy] = useState(false);
  const [sound, setSound] = useState(true);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const dirRef = useRef(1);
  const speedRef = useRef(1.4);
  const animFrameRef = useRef<number | null>(null);

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

  // Setup new stage
  const setupStage = useCallback((stg: number) => {
    const zones = [
      { min: 42, max: 58 },
      { min: 65, max: 80 },
      { min: 20, max: 35 },
    ];
    setTargetZone(zones[stg % zones.length]);
    speedRef.current = 1.2 + stg * 0.45; // slightly faster each stage
    setStatus(`STAGE ${stg + 1} / 3: Tap LOCK when gauge is inside the resonance band!`);
  }, []);

  useEffect(() => {
    setupStage(0);
  }, [setupStage]);

  // Oscillation loop
  useEffect(() => {
    let currentPos = 50;
    const animate = () => {
      if (!busy) {
        currentPos += dirRef.current * speedRef.current;
        if (currentPos >= 96) {
          currentPos = 96;
          dirRef.current = -1;
        } else if (currentPos <= 4) {
          currentPos = 4;
          dirRef.current = 1;
        }
        setNeedlePos(currentPos);
      }
      animFrameRef.current = requestAnimationFrame(animate);
    };

    animFrameRef.current = requestAnimationFrame(animate);
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [busy]);

  const handleLock = () => {
    if (busy) return;

    const hit = needlePos >= targetZone.min && needlePos <= targetZone.max;

    if (hit) {
      playTone(660, 0.15, "triangle");
      const nextStage = stage + 1;
      setStage(nextStage);

      if (nextStage >= 3) {
        setBusy(true);
        chime();
        setStatus("✓ All 3 Engine Flywheels Calibrated!");
        setTimeout(() => onSuccess(), 600);
      } else {
        setBusy(true);
        setStatus("Flywheel locked! Engaging next harmonic stage…");
        setTimeout(() => {
          setupStage(nextStage);
          setBusy(false);
        }, 500);
      }
    } else {
      playTone(160, 0.2, "sawtooth");
      setStatus("Missed zone! Harmonic alignment slipped. Try again.");
    }
  };

  return (
    <div className="bg-[#080d16] text-[#e7eef8] rounded-[2.5rem] border border-[#29374a] p-4 sm:p-6 space-y-5 font-mono shadow-2xl max-w-lg w-full select-none">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#29374a] pb-3">
        <div>
          <span className="text-[10px] tracking-widest uppercase text-amber-400 font-bold">
            ENGINEERING BAY // PROPULSION
          </span>
          <h2 className="text-lg font-black uppercase text-white tracking-tight">
            Calibrate Engines
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSound(!sound)}
            className="text-[10px] px-2 py-1 rounded bg-[#1b293c] border border-[#29374a] text-zinc-300"
          >
            {sound ? "🔊" : "🔇"}
          </button>
          <span className="text-xs px-2.5 py-1 rounded bg-[#1b293c] border border-[#29374a] text-amber-400 font-bold">
            STAGE {stage + 1} / 3
          </span>
        </div>
      </div>

      <p className="text-xs text-[#8798b0] leading-relaxed">
        Time your command to lock the oscillating kinetic needle exactly inside the illuminated green resonance sector.
      </p>

      {/* Flywheel Gauge Visual */}
      <div className="bg-[#070e18] p-5 rounded-[2.5rem] border border-[#29374a] space-y-4">
        {/* Track */}
        <div className="relative h-12 bg-[#12121A]/60 backdrop-blur-[30px] rounded-xl border border-white/[0.08] overflow-hidden flex items-center shadow-inner">
          {/* Target Zone */}
          <div
            className="absolute top-0 bottom-0 bg-emerald-500/30 border-x-2 border-emerald-400 flex items-center justify-center"
            style={{
              left: `${targetZone.min}%`,
              width: `${targetZone.max - targetZone.min}%`,
            }}
          >
            <span className="text-[9px] font-bold text-emerald-300 uppercase tracking-widest hidden sm:inline">
              TARGET
            </span>
          </div>

          {/* Oscillating Needle */}
          <div
            className="absolute top-0 bottom-0 w-3 bg-amber-400 shadow-[0_0_15px_#f59e0b] rounded -ml-1.5 transition-none"
            style={{ left: `${needlePos}%` }}
          />
        </div>

        {/* Readouts */}
        <div className="flex justify-between items-center text-xs text-zinc-400">
          <span>0 RPM</span>
          <span className="text-amber-400 font-bold">{Math.round(needlePos * 64)} RPM</span>
          <span>6400 RPM</span>
        </div>

        {/* Big Lock Button */}
        <button
          type="button"
          onClick={handleLock}
          disabled={busy}
          className="w-full py-4 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-black text-sm uppercase tracking-wider shadow-lg active:scale-98 transition-all disabled:opacity-50"
        >
          ⚡ LOCK FLYWHEEL RESONANCE
        </button>
      </div>

      {/* Footer controls */}
      <div className="flex items-center justify-between pt-2 border-t border-[#29374a]">
        <span className="text-[10px] text-[#8798b0] truncate max-w-[250px]">{status}</span>
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
