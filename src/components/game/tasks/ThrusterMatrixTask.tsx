"use client";

import { useEffect, useState, useRef, useCallback } from "react";

interface ThrusterMatrixTaskProps {
  onSuccess: () => void;
  onCancel: () => void;
}

export function ThrusterMatrixTask({ onSuccess, onCancel }: ThrusterMatrixTaskProps) {
  // Vector X and Y between -50 and 50. Center (0,0) is stable.
  const [vector, setVector] = useState({ x: 35, y: -25 });
  const [drift, setDrift] = useState({ dx: -0.6, dy: 0.8 });
  const [stableHold, setStableHold] = useState(0); // 0 to 100%
  const [busy, setBusy] = useState(false);
  const [sound, setSound] = useState(true);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const animFrameRef = useRef<number | null>(null);
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

  // Gyroscopic drift animation
  useEffect(() => {
    const loop = () => {
      if (!busy) {
        setVector((prev) => {
          const nx = Math.max(-48, Math.min(48, prev.x + drift.dx * 0.15));
          const ny = Math.max(-48, Math.min(48, prev.y + drift.dy * 0.15));

          const dist = Math.sqrt(nx * nx + ny * ny);
          const inBullseye = dist <= 12; // Bullseye radius 12 units

          if (inBullseye) {
            holdRef.current = Math.min(100, holdRef.current + 2.2);
          } else {
            holdRef.current = Math.max(0, holdRef.current - 1.5);
          }
          setStableHold(holdRef.current);

          if (holdRef.current >= 100 && !busy) {
            setBusy(true);
            chime();
            setTimeout(() => onSuccess(), 500);
          }

          return { x: nx, y: ny };
        });
      }
      animFrameRef.current = requestAnimationFrame(loop);
    };

    animFrameRef.current = requestAnimationFrame(loop);
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [busy, drift, chime, onSuccess]);

  const fireThruster = (dir: "UP" | "DOWN" | "LEFT" | "RIGHT") => {
    if (busy) return;
    playTone(280, 0.05, "triangle");

    setVector((prev) => {
      let nx = prev.x;
      let ny = prev.y;
      if (dir === "UP") ny -= 14;
      if (dir === "DOWN") ny += 14;
      if (dir === "LEFT") nx -= 14;
      if (dir === "RIGHT") nx += 14;
      return {
        x: Math.max(-48, Math.min(48, nx)),
        y: Math.max(-48, Math.min(48, ny)),
      };
    });
  };

  const distFromCenter = Math.sqrt(vector.x * vector.x + vector.y * vector.y);
  const isCentered = distFromCenter <= 12;

  return (
    <div className="bg-[#080d16] text-[#e7eef8] rounded-2xl border border-[#29374a] p-4 sm:p-6 space-y-5 font-mono shadow-2xl max-w-lg w-full select-none">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#29374a] pb-3">
        <div>
          <span className="text-[10px] tracking-widest uppercase text-cyan-400 font-bold">
            PROPULSION CONTROL // HARD TASK
          </span>
          <h2 className="text-lg font-black uppercase text-white tracking-tight">
            Steering Thruster Matrix
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
            DRIFT LOCK
          </span>
        </div>
      </div>

      <p className="text-xs text-[#8798b0] leading-relaxed">
        Fire vector thrusters to steer the crosshair inside the center green reticle. Hold stable for 1.5 seconds.
      </p>

      {/* Gyroscopic Reticle Radar */}
      <div className="bg-[#070e18] p-4 rounded-2xl border border-[#29374a] flex flex-col items-center space-y-4">
        <div className="relative w-64 h-64 rounded-full border-2 border-cyan-900 bg-zinc-950 flex items-center justify-center overflow-hidden shadow-inner">
          {/* Radar Circles */}
          <div className="absolute w-48 h-48 rounded-full border border-cyan-950/60" />
          <div className="absolute w-32 h-32 rounded-full border border-cyan-900/60" />
          {/* Target Center Zone */}
          <div className="absolute w-16 h-16 rounded-full border-2 border-dashed border-emerald-500 bg-emerald-500/10 flex items-center justify-center animate-pulse">
            <span className="text-[8px] text-emerald-400 font-bold">STABLE</span>
          </div>

          {/* Crosshairs */}
          <div className="absolute w-full h-[1px] bg-cyan-950" />
          <div className="absolute h-full w-[1px] bg-cyan-950" />

          {/* Thruster Crosshair Marker */}
          <div
            className={`absolute w-6 h-6 -ml-3 -mt-3 rounded-full border-2 flex items-center justify-center transition-transform ${
              isCentered
                ? "border-emerald-400 bg-emerald-400 shadow-[0_0_15px_#34d399]"
                : "border-red-500 bg-red-500 shadow-[0_0_15px_#ef4444]"
            }`}
            style={{
              transform: `translate(${vector.x * 2.2}px, ${vector.y * 2.2}px)`,
            }}
          >
            <div className="w-1.5 h-1.5 rounded-full bg-white" />
          </div>
        </div>

        {/* Stability Hold Bar */}
        <div className="w-full space-y-1">
          <div className="flex justify-between text-[10px] text-zinc-400">
            <span>HOLD STABILIZATION</span>
            <span className="font-bold text-cyan-400">{Math.round(stableHold)}%</span>
          </div>
          <div className="w-full h-2.5 rounded-full bg-zinc-900 overflow-hidden border border-zinc-800">
            <div
              className={`h-full transition-all duration-75 ${
                stableHold > 70 ? "bg-emerald-400" : "bg-cyan-400"
              }`}
              style={{ width: `${stableHold}%` }}
            />
          </div>
        </div>

        {/* Thruster D-PAD Controls */}
        <div className="grid grid-cols-3 gap-2 w-48 pt-2">
          <div />
          <button
            type="button"
            onClick={() => fireThruster("UP")}
            className="py-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-white font-bold text-sm active:scale-95"
          >
            ▲
          </button>
          <div />

          <button
            type="button"
            onClick={() => fireThruster("LEFT")}
            className="py-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-white font-bold text-sm active:scale-95"
          >
            ◀
          </button>
          <button
            type="button"
            onClick={() => fireThruster("DOWN")}
            className="py-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-white font-bold text-sm active:scale-95"
          >
            ▼
          </button>
          <button
            type="button"
            onClick={() => fireThruster("RIGHT")}
            className="py-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-white font-bold text-sm active:scale-95"
          >
            ▶
          </button>
        </div>
      </div>

      {/* Footer controls */}
      <div className="flex items-center justify-between pt-2 border-t border-[#29374a]">
        <span className="text-[10px] text-[#8798b0]">
          {isCentered ? "Bullseye acquired · holding vector lock…" : "Gyroscopic drift active"}
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
