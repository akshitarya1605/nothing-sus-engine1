"use client";

import { useState, useCallback, useRef } from "react";

interface ChemicalCentrifugeTaskProps {
  onSuccess: () => void;
  onCancel: () => void;
}

export function ChemicalCentrifugeTask({ onSuccess, onCancel }: ChemicalCentrifugeTaskProps) {
  const [temp, setTemp] = useState(40); // 0 to 100 °C (Target: 70-80)
  const [rpm, setRpm] = useState(3000); // 1000 to 9000 RPM (Target: 5500-6500)
  const [isSpinning, setIsSpinning] = useState(false);
  const [separationPct, setSeparationPct] = useState(0);
  const [status, setStatus] = useState("Adjust Heat & RPM to optimal green ranges, then run centrifuge.");
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

  const isTempOptimal = temp >= 68 && temp <= 82;
  const isRpmOptimal = rpm >= 5200 && rpm <= 6800;

  const handleStartSpin = () => {
    if (isSpinning) return;

    if (!isTempOptimal || !isRpmOptimal) {
      playTone(160, 0.2, "sawtooth");
      setStatus("Parameters out of range! Balance Temperature (75°C) and RPM (6000).");
      return;
    }

    setIsSpinning(true);
    setStatus("Centrifuge active: Separating chemical precipitates…");
    playTone(480, 0.4, "triangle");

    let progress = 0;
    const interval = setInterval(() => {
      progress += 10;
      setSeparationPct(progress);
      playTone(300 + progress * 8, 0.05);

      if (progress >= 100) {
        clearInterval(interval);
        chime();
        setStatus("✓ Chemical compound separated & sterilized!");
        setTimeout(() => onSuccess(), 600);
      }
    }, 150);
  };

  return (
    <div className="bg-[#080d16] text-[#e7eef8] rounded-[2.5rem] border border-[#29374a] p-4 sm:p-6 space-y-5 font-mono shadow-2xl max-w-lg w-full select-none">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#29374a] pb-3">
        <div>
          <span className="text-[10px] tracking-widest uppercase text-purple-400 font-bold">
            BIOCHEMISTRY STATION // CENTRIFUGE
          </span>
          <h2 className="text-lg font-black uppercase text-white tracking-tight">
            Spectral Chemical Centrifuge
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSound(!sound)}
            className="text-[10px] px-2 py-1 rounded bg-[#1b293c] border border-[#29374a] text-zinc-300"
          >
            {sound ? "🔊" : "🔇"}
          </button>
          <span className="text-xs px-2.5 py-1 rounded bg-[#1b293c] border border-[#29374a] text-purple-400 font-bold">
            {separationPct}% PURIFIED
          </span>
        </div>
      </div>

      <p className="text-xs text-[#8798b0] leading-relaxed">
        Regulate chamber thermal heaters to <span className="text-emerald-400 font-bold">~75°C</span> and kinetic rotor speed to <span className="text-emerald-400 font-bold">~6000 RPM</span> to trigger separation.
      </p>

      {/* Gauges */}
      <div className="grid grid-cols-2 gap-3">
        {/* Heat Gauge */}
        <div className={`p-4 rounded-xl border space-y-2 ${isTempOptimal ? "border-emerald-500 bg-emerald-950/20" : "border-white/[0.08] bg-[#070e18]"}`}>
          <div className="flex justify-between items-center text-xs">
            <span className="text-zinc-400">CHAMBER TEMP</span>
            <span className={`font-bold ${isTempOptimal ? "text-emerald-400" : "text-amber-400"}`}>
              {temp}°C
            </span>
          </div>
          <input
            type="range"
            min={20}
            max={100}
            step={2}
            value={temp}
            disabled={isSpinning}
            onChange={(e) => setTemp(parseInt(e.target.value))}
            className="w-full accent-purple-500 h-2 bg-white/[0.04] rounded-lg cursor-pointer"
          />
          <div className="text-[10px] text-zinc-500 text-center">Target: 70°C – 80°C</div>
        </div>

        {/* Rotor RPM */}
        <div className={`p-4 rounded-xl border space-y-2 ${isRpmOptimal ? "border-emerald-500 bg-emerald-950/20" : "border-white/[0.08] bg-[#070e18]"}`}>
          <div className="flex justify-between items-center text-xs">
            <span className="text-zinc-400">ROTOR VELOCITY</span>
            <span className={`font-bold ${isRpmOptimal ? "text-emerald-400" : "text-amber-400"}`}>
              {rpm} RPM
            </span>
          </div>
          <input
            type="range"
            min={1000}
            max={9000}
            step={200}
            value={rpm}
            disabled={isSpinning}
            onChange={(e) => setRpm(parseInt(e.target.value))}
            className="w-full accent-purple-500 h-2 bg-white/[0.04] rounded-lg cursor-pointer"
          />
          <div className="text-[10px] text-zinc-500 text-center">Target: 5500 – 6500 RPM</div>
        </div>
      </div>

      {/* Centrifuge Drum Visual */}
      <div className="bg-[#070e18] p-4 rounded-xl border border-[#29374a] flex flex-col items-center space-y-3">
        <div className={`w-24 h-24 rounded-full border-4 border-dashed flex items-center justify-center transition-all ${
          isSpinning
            ? "border-purple-400 animate-spin text-purple-300 shadow-[0_0_20px_rgba(168,85,247,0.4)]"
            : isTempOptimal && isRpmOptimal
            ? "border-emerald-500 text-emerald-400"
            : "border-white/[0.08] text-zinc-600"
        }`}>
          <span className="text-2xl font-black">🧪</span>
        </div>

        {/* Separation progress bar */}
        <div className="w-full space-y-1">
          <div className="flex justify-between text-[10px] text-zinc-400">
            <span>DENSITY PRECIPITATION</span>
            <span>{separationPct}%</span>
          </div>
          <div className="w-full h-2 rounded-full bg-black/50 overflow-hidden border border-white/[0.08]">
            <div
              className="h-full bg-gradient-to-r from-purple-500 to-emerald-400 transition-all duration-150"
              style={{ width: `${separationPct}%` }}
            />
          </div>
        </div>

        <button
          type="button"
          onClick={handleStartSpin}
          disabled={isSpinning}
          className="w-full py-3.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-black text-xs uppercase tracking-wider shadow-lg active:scale-98 transition-all disabled:opacity-40"
        >
          {isSpinning ? "PURIFYING IN PROGRESS…" : "ACTIVATE CENTRIFUGE →"}
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
