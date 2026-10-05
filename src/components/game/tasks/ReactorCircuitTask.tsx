"use client";

import { useEffect, useState, useCallback, useRef } from "react";

interface ReactorCircuitTaskProps {
  onSuccess: () => void;
  onCancel: () => void;
}

const SUBSYSTEMS = [
  "R. ENGINE",
  "L. ENGINE",
  "WEAPONS",
  "SHIELDS",
  "NAVIGATION",
  "COMMS",
  "O2",
  "SECURITY",
];

const DELTA = [-4, 1, 4, -1]; // 0=up, 1=right, 2=down, 3=left

interface Cell {
  base: number[];
  rot: number;
}

export function ReactorCircuitTask({ onSuccess, onCancel }: ReactorCircuitTaskProps) {
  const [cells, setCells] = useState<Cell[]>([]);
  const [currentNode, setCurrentNode] = useState(0);
  const [solvedNodes, setSolvedNodes] = useState(0);
  const [busy, setBusy] = useState(false);
  const [finished, setFinished] = useState(false);
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

  const adjacent = (index: number, dir: number) => {
    const next = index + DELTA[dir];
    if (next < 0 || next >= 16) return -1;
    if (dir % 2 === 1 && Math.floor(index / 4) !== Math.floor(next / 4)) return -1;
    return next;
  };

  const getPorts = (cell: Cell) => {
    return cell.base.map((dir) => (dir + cell.rot) % 4);
  };

  const calculateFlow = useCallback((currentCells: Cell[]) => {
    if (currentCells.length !== 16) return new Set<number>();
    const seen = new Set<number>([13]);
    const queue = [13];

    while (queue.length > 0) {
      const curr = queue.shift()!;
      for (const dir of getPorts(currentCells[curr])) {
        const next = adjacent(curr, dir);
        if (next < 0 || seen.has(next)) continue;
        if (getPorts(currentCells[next]).includes((dir + 2) % 4)) {
          seen.add(next);
          queue.push(next);
        }
      }
    }
    return seen;
  }, []);

  const generatePuzzle = useCallback(() => {
    const newCells: Cell[] = Array.from({ length: 16 }, () => ({
      base: Math.random() < 0.5 ? [0, 2] : [0, 1],
      rot: 0,
    }));

    newCells[13].base = [0]; // Battery
    newCells[3].base = [0, 1, 2, 3]; // Target

    for (let i = 0; i < 16; i++) {
      if (i !== 13 && i !== 3) {
        newCells[i].rot = Math.floor(Math.random() * 4);
      }
    }

    let attempts = 0;
    while (calculateFlow(newCells).has(3) && attempts < 50) {
      for (let i = 0; i < 16; i++) {
        if (i !== 13 && i !== 3) {
          newCells[i].rot = Math.floor(Math.random() * 4);
        }
      }
      attempts++;
    }

    setCells(newCells);
  }, [calculateFlow]);

  useEffect(() => {
    generatePuzzle();
  }, [generatePuzzle]);

  const handleRotate = (index: number) => {
    if (busy || finished || index === 13 || index === 3) return;
    playTone(380, 0.035);

    const updated = cells.map((c, i) => (i === index ? { ...c, rot: (c.rot + 1) % 4 } : c));
    setCells(updated);

    const flow = calculateFlow(updated);
    if (flow.has(3)) {
      setBusy(true);
      chime();

      setTimeout(() => {
        const nextSolved = solvedNodes + 1;
        setSolvedNodes(nextSolved);

        if (nextSolved >= 8) {
          setFinished(true);
          onSuccess();
        } else {
          setCurrentNode(nextSolved);
          generatePuzzle();
        }
        setBusy(false);
      }, 500);
    }
  };

  const powered = calculateFlow(cells);

  return (
    <div className="bg-[#080d16] text-[#e7eef8] rounded-2xl border border-[#29374a] p-4 sm:p-6 space-y-5 font-mono shadow-2xl max-w-lg w-full">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#29374a] pb-3">
        <div>
          <span className="text-[10px] tracking-widest uppercase text-[#60dce9] font-bold">
            ROOM 01 // REACTOR MATRIX
          </span>
          <h2 className="text-lg font-black uppercase text-white tracking-tight">
            Reactor Circuit Router
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSound(!sound)}
            className="text-[10px] px-2 py-1 rounded bg-[#1b293c] border border-[#29374a] text-zinc-300"
          >
            {sound ? "🔊" : "🔇"}
          </button>
          <span className="text-xs px-2.5 py-1 rounded bg-[#1b293c] border border-[#29374a] text-[#60dce9] font-bold">
            {solvedNodes} / 8 Nodes
          </span>
        </div>
      </div>

      <p className="text-xs text-[#8798b0] leading-relaxed">
        Rotate conduit tiles to connect power from the battery (<span className="text-yellow-400 font-bold">⚡</span>) to the reactor target (<span className="text-cyan-400 font-bold">◎</span>). Restore all 8 subsystems.
      </p>

      {/* Grid */}
      <div className="grid grid-cols-4 gap-2 bg-[#070e18] p-3 rounded-xl border border-[#29374a]">
        {cells.map((cell, idx) => {
          const isPowered = powered.has(idx);
          const isBattery = idx === 13;
          const isTarget = idx === 3;
          const ends = [
            [50, 0],
            [100, 50],
            [50, 100],
            [0, 50],
          ];

          return (
            <button
              key={idx}
              type="button"
              onClick={() => handleRotate(idx)}
              disabled={busy || finished || isBattery || isTarget}
              className={`aspect-square p-1 rounded-xl transition-all border flex items-center justify-center relative ${
                isPowered
                  ? "border-[#60dce9] bg-[#0c1a29] shadow-[0_0_12px_rgba(96,220,233,0.3)]"
                  : "border-[#1e2a3b] bg-[#0c1522] hover:border-zinc-600"
              }`}
            >
              {isBattery ? (
                <span className="text-2xl text-yellow-400 animate-pulse">⚡</span>
              ) : isTarget ? (
                <span className={`text-2xl font-bold ${isPowered ? "text-[#60dce9]" : "text-zinc-600"}`}>
                  ◎
                </span>
              ) : (
                <svg viewBox="0 0 100 100" className="w-full h-full pointer-events-none">
                  {getPorts(cell).map((dir) => {
                    const pt = ends[dir];
                    return (
                      <line
                        key={dir}
                        x1="50"
                        y1="50"
                        x2={pt[0]}
                        y2={pt[1]}
                        stroke={isPowered ? "#60dce9" : "#536880"}
                        strokeWidth="14"
                        strokeLinecap="round"
                      />
                    );
                  })}
                  <circle cx="50" cy="50" r="10" fill={isPowered ? "#60dce9" : "#8ca0b8"} />
                </svg>
              )}
            </button>
          );
        })}
      </div>

      {/* Subsystem status */}
      <div className="bg-[#0c1522] p-3 rounded-xl border border-[#29374a] space-y-2">
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-[#8798b0]">CURRENT TARGET:</span>
          <span className="text-[#60dce9] font-bold">{SUBSYSTEMS[currentNode] || "ALL RESTORED"}</span>
        </div>
        <div className="grid grid-cols-4 gap-1.5 pt-1">
          {SUBSYSTEMS.map((name, i) => (
            <div
              key={name}
              className={`text-[9px] text-center p-1 rounded border truncate ${
                i < solvedNodes
                  ? "bg-emerald-950/70 border-emerald-500/50 text-emerald-300 font-bold"
                  : "bg-zinc-900 border-zinc-800 text-zinc-500"
              }`}
            >
              {name}
            </div>
          ))}
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between pt-2">
        <button
          type="button"
          onClick={generatePuzzle}
          disabled={busy || finished}
          className="text-xs px-3 py-2 rounded-lg bg-[#1b293c] hover:bg-[#293d53] text-zinc-300 border border-[#29374a] transition-colors"
        >
          Re-shuffle
        </button>
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
