"use client";

import { useEffect, useState, useCallback, useRef } from "react";

interface CommsSpectralTaskProps {
  onSuccess: () => void;
  onCancel: () => void;
}

export function CommsSpectralTask({ onSuccess, onCancel }: CommsSpectralTaskProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [freq, setFreq] = useState(1.0);
  const [amp, setAmp] = useState(1.0);
  const [phase, setPhase] = useState(0);
  const [harm, setHarm] = useState(0.2);

  const [target, setTarget] = useState<number[]>([1.5, 1.0, 180, 0.2]);
  const [carrier, setCarrier] = useState(0);
  const [holdProgress, setHoldProgress] = useState(0);
  const [quality, setQuality] = useState(0);
  const [signalStatus, setSignalStatus] = useState("Searching for carrier…");
  const [sound, setSound] = useState(true);
  const [finished, setFinished] = useState(false);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const holdRef = useRef(0);
  const lastTimeRef = useRef(0);

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
      /* ignore audio */
    }
  }, [sound]);

  const chime = useCallback(() => {
    [523, 659, 784, 1047].forEach((f, i) => {
      setTimeout(() => playTone(f, 0.25, "triangle"), i * 90);
    });
  }, [playTone]);

  const newCarrier = useCallback((carrierIdx: number) => {
    const t = [
      (14 + Math.floor(Math.random() * 35)) / 20,
      (10 + Math.floor(Math.random() * 17)) / 20,
      Math.floor(Math.random() * 36) * 10,
      Math.floor(Math.random() * 10) / 20,
    ];
    setTarget(t);
    setHoldProgress(0);
    holdRef.current = 0;
    setSignalStatus(`CARRIER ${carrierIdx + 1} / 3: Align frequency, amplitude, phase & harmonics`);
  }, []);

  useEffect(() => {
    newCarrier(0);
  }, [newCarrier]);

  // Animation frame loop
  useEffect(() => {
    let animId: number;

    const frame = (now: number) => {
      if (finished) return;
      const dt = lastTimeRef.current ? Math.min(now - lastTimeRef.current, 80) : 0;
      lastTimeRef.current = now;

      // Errors
      const v = [freq, amp, phase, harm];
      const errs = [
        Math.abs(v[0] - target[0]) / (3.0 - 0.5),
        Math.abs(v[1] - target[1]) / (1.5 - 0.3),
        Math.min(Math.abs(v[2] - target[2]), 360 - Math.abs(v[2] - target[2])) / 180,
        Math.abs(v[3] - target[3]) / 0.6,
      ];

      const ok = errs[0] < 0.05 && errs[1] < 0.06 && errs[2] < 0.07 && errs[3] < 0.08;
      const avgQuality = Math.round(Math.max(0, 1 - errs.reduce((a, b) => a + b, 0) / 4) * 100);
      setQuality(avgQuality);

      if (ok) {
        holdRef.current += dt;
        setSignalStatus("Carrier aligned · stabilizing signal…");
      } else {
        holdRef.current = Math.max(0, holdRef.current - dt * 1.5);
        setSignalStatus("Searching for carrier…");
      }

      const progressPct = Math.min(100, (holdRef.current / 2000) * 100);
      setHoldProgress(progressPct);

      // Draw canvas
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext("2d");
        if (ctx) {
          const w = canvas.width;
          const h = canvas.height;
          ctx.clearRect(0, 0, w, h);

          // Grid
          ctx.strokeStyle = "#1b293c";
          ctx.lineWidth = 1;
          for (let x = 0; x < w; x += 35) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, h);
            ctx.stroke();
          }
          for (let y = 0; y < h; y += 30) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(w, y);
            ctx.stroke();
          }

          // Target wave (amber dashed)
          ctx.strokeStyle = "#f3bb68";
          ctx.lineWidth = 2;
          ctx.setLineDash([5, 4]);
          ctx.beginPath();
          for (let x = 0; x < w; x++) {
            const tVal = x * 0.018 * target[0] + (target[2] * Math.PI) / 180;
            const y = h / 2 + 45 * target[1] * (Math.sin(tVal) + target[3] * Math.sin(2 * tVal));
            x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
          }
          ctx.stroke();

          // User wave (cyan solid)
          ctx.strokeStyle = ok ? "#6fe5ba" : "#60dce9";
          ctx.lineWidth = 2.5;
          ctx.setLineDash([]);
          ctx.beginPath();
          for (let x = 0; x < w; x++) {
            const tVal = x * 0.018 * v[0] + (v[2] * Math.PI) / 180;
            const y = h / 2 + 45 * v[1] * (Math.sin(tVal) + v[3] * Math.sin(2 * tVal));
            x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
          }
          ctx.stroke();
        }
      }

      // Check lock
      if (holdRef.current >= 2000) {
        chime();
        const nextCarrier = carrier + 1;
        if (nextCarrier >= 3) {
          setFinished(true);
          setSignalStatus("All 3 carriers locked! Comms online.");
          setTimeout(() => onSuccess(), 600);
          return;
        } else {
          setCarrier(nextCarrier);
          newCarrier(nextCarrier);
        }
      }

      animId = requestAnimationFrame(frame);
    };

    animId = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(animId);
  }, [carrier, finished, freq, amp, phase, harm, target, chime, newCarrier, onSuccess]);

  return (
    <div className="bg-[#080d16] text-[#e7eef8] rounded-2xl border border-[#29374a] p-4 sm:p-6 space-y-5 font-mono shadow-2xl max-w-lg w-full">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#29374a] pb-3">
        <div>
          <span className="text-[10px] tracking-widest uppercase text-[#f3bb68] font-bold">
            ROOM 03 // SPECTRAL LOCK
          </span>
          <h2 className="text-lg font-black uppercase text-white tracking-tight">
            Comms Carrier Tuner
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSound(!sound)}
            className="text-[10px] px-2 py-1 rounded bg-[#1b293c] border border-[#29374a] text-zinc-300"
          >
            {sound ? "🔊" : "🔇"}
          </button>
          <span className="text-xs px-2.5 py-1 rounded bg-[#1b293c] border border-[#29374a] text-[#f3bb68] font-bold">
            CARRIER {carrier + 1} / 3
          </span>
        </div>
      </div>

      {/* Screen */}
      <div className="bg-[#070e18] border border-[#29374a] rounded-xl p-3 space-y-2">
        <div className="flex items-center justify-between text-[10px] text-[#8798b0]">
          <span>AMBER: TARGET • CYAN: YOUR SIGNAL</span>
          <span className="text-[#f3bb68] font-bold">ACCURACY: {quality}%</span>
        </div>
        <canvas
          ref={canvasRef}
          width={450}
          height={180}
          className="w-full h-36 bg-[#040810] rounded-lg border border-[#1b293c]"
        />

        {/* Hold progress bar */}
        <div className="space-y-1">
          <div className="flex justify-between text-[9px] text-[#8798b0]">
            <span>STABILITY HOLD (2s)</span>
            <span>{Math.round(holdProgress)}%</span>
          </div>
          <div className="w-full h-2 rounded-full bg-[#1b293c] overflow-hidden">
            <div
              className="h-full bg-[#f3bb68] transition-all duration-75"
              style={{ width: `${holdProgress}%` }}
            />
          </div>
        </div>
      </div>

      {/* Sliders */}
      <div className="grid grid-cols-2 gap-3 text-xs">
        <div className="bg-[#070e18] p-2.5 rounded-xl border border-[#29374a] space-y-1">
          <div className="flex justify-between text-[10px] text-[#8798b0]">
            <span>FREQUENCY</span>
            <span className="text-white font-bold">{freq.toFixed(2)} Hz</span>
          </div>
          <input
            type="range"
            min={0.5}
            max={3.0}
            step={0.05}
            value={freq}
            onChange={(e) => {
              setFreq(parseFloat(e.target.value));
              playTone(260, 0.03);
            }}
            className="w-full accent-[#f3bb68]"
          />
        </div>

        <div className="bg-[#070e18] p-2.5 rounded-xl border border-[#29374a] space-y-1">
          <div className="flex justify-between text-[10px] text-[#8798b0]">
            <span>AMPLITUDE</span>
            <span className="text-white font-bold">{amp.toFixed(2)}×</span>
          </div>
          <input
            type="range"
            min={0.3}
            max={1.5}
            step={0.05}
            value={amp}
            onChange={(e) => {
              setAmp(parseFloat(e.target.value));
              playTone(370, 0.03);
            }}
            className="w-full accent-[#f3bb68]"
          />
        </div>

        <div className="bg-[#070e18] p-2.5 rounded-xl border border-[#29374a] space-y-1">
          <div className="flex justify-between text-[10px] text-[#8798b0]">
            <span>PHASE SHIFT</span>
            <span className="text-white font-bold">{phase}°</span>
          </div>
          <input
            type="range"
            min={0}
            max={350}
            step={10}
            value={phase}
            onChange={(e) => {
              setPhase(parseInt(e.target.value));
              playTone(480, 0.03);
            }}
            className="w-full accent-[#f3bb68]"
          />
        </div>

        <div className="bg-[#070e18] p-2.5 rounded-xl border border-[#29374a] space-y-1">
          <div className="flex justify-between text-[10px] text-[#8798b0]">
            <span>HARMONICS</span>
            <span className="text-white font-bold">{harm.toFixed(2)}×</span>
          </div>
          <input
            type="range"
            min={0}
            max={0.6}
            step={0.05}
            value={harm}
            onChange={(e) => {
              setHarm(parseFloat(e.target.value));
              playTone(590, 0.03);
            }}
            className="w-full accent-[#f3bb68]"
          />
        </div>
      </div>

      {/* Footer status */}
      <div className="flex items-center justify-between pt-2 border-t border-[#29374a]">
        <span className="text-[10px] text-[#8798b0] truncate max-w-[250px]">{signalStatus}</span>
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
