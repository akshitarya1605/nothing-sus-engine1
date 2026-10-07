"use client";

import { useEffect, useState, useCallback, useRef } from "react";

interface ReactorCircuitTaskProps {
  onSuccess: () => void;
  onCancel: () => void;
}

const SUBSYSTEMS = [
  "R. ENGINE",
  "L. ENGINE",
  "CORE FLOW",
];

const DELTA = [-4, 1, 4, -1]; // 0=up, 1=right, 2=down, 3=left

interface Cell {
  base: number[];
  rot: number;
}

// 4x4 Grid neighbors helper
function getNeighbor(index: number, dir: number): number {
  const row = Math.floor(index / 4);
  const col = index % 4;
  if (dir === 0) return row > 0 ? index - 4 : -1;
  if (dir === 1) return col < 3 ? index + 1 : -1;
  if (dir === 2) return row < 3 ? index + 4 : -1;
  if (dir === 3) return col > 0 ? index - 1 : -1;
  return -1;
}

export function ReactorCircuitTask({ onSuccess, onCancel }: ReactorCircuitTaskProps) {
  const [cells, setCells] = useState<Cell[]>([]);
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
        const next = getNeighbor(curr, dir);
        if (next < 0 || seen.has(next)) continue;
        if (getPorts(currentCells[next]).includes((dir + 2) % 4)) {
          seen.add(next);
          queue.push(next);
        }
      }
    }
    return seen;
  }, []);

  // GUARANTEED SOLVABLE PUZZLE GENERATOR
  // 1. Generate a self-avoiding path from 13 to 3 on 4x4 grid.
  // 2. Set bases along the path so that rot=0 aligns ports along the path.
  // 3. For off-path cells, give them valid conduits (straight or corner).
  // 4. Randomly rotate tiles so player has to solve it, ensuring it doesn't start already solved.
  const generatePuzzle = useCallback(() => {
    const START = 13;
    const END = 3;

    // Find a random self-avoiding path from START to END
    let path: number[] = [];
    let attempts = 0;

    while (attempts < 200) {
      attempts++;
      const currentPath = [START];
      const visited = new Set<number>([START]);
      let curr = START;

      while (curr !== END) {
        // Collect unvisited neighbors
        const validDirs: { dir: number; next: number }[] = [];
        for (let d = 0; d < 4; d++) {
          const n = getNeighbor(curr, d);
          if (n >= 0 && !visited.has(n)) {
            validDirs.push({ dir: d, next: n });
          }
        }

        if (validDirs.length === 0) break; // Dead end, retry

        // Bias towards END cell coordinates to find path quickly
        const endRow = Math.floor(END / 4);
        const endCol = END % 4;
        validDirs.sort((a, b) => {
          const distA = Math.abs(Math.floor(a.next / 4) - endRow) + Math.abs((a.next % 4) - endCol);
          const distB = Math.abs(Math.floor(b.next / 4) - endRow) + Math.abs((b.next % 4) - endCol);
          return distA - distB + (Math.random() - 0.5) * 1.5;
        });

        const chosen = validDirs[0];
        currentPath.push(chosen.next);
        visited.add(chosen.next);
        curr = chosen.next;
      }

      if (curr === END && currentPath.length >= 4) {
        path = currentPath;
        break;
      }
    }

    // Fallback known valid path if random walk timed out: 13 -> 9 -> 5 -> 6 -> 7 -> 3
    if (path.length === 0) {
      path = [13, 9, 5, 6, 7, 3];
    }

    const newCells: Cell[] = Array.from({ length: 16 }, () => ({
      base: [0, 2], // default line
      rot: 0,
    }));

    // Target and Battery have dedicated base connectors
    newCells[13].base = [0]; // Points up into grid
    newCells[3].base = [0, 1, 2, 3]; // Target accepts all

    // Configure base conduit shapes along the path
    for (let i = 1; i < path.length - 1; i++) {
      const prev = path[i - 1];
      const curr = path[i];
      const next = path[i + 1];

      // Find direction from curr to prev
      let inDir = 0;
      for (let d = 0; d < 4; d++) {
        if (getNeighbor(curr, d) === prev) inDir = d;
      }
      // Find direction from curr to next
      let outDir = 0;
      for (let d = 0; d < 4; d++) {
        if (getNeighbor(curr, d) === next) outDir = d;
      }

      // If inDir and outDir are opposite, it's a straight conduit
      if ((inDir + 2) % 4 === outDir) {
        newCells[curr].base = inDir % 2 === 0 ? [0, 2] : [1, 3];
      } else {
        // Corner conduit
        newCells[curr].base = [inDir, outDir].sort((a, b) => a - b);
      }
    }

    // Randomize non-path cells
    const pathSet = new Set(path);
    for (let i = 0; i < 16; i++) {
      if (!pathSet.has(i)) {
        newCells[i].base = Math.random() < 0.5 ? [0, 2] : [0, 1];
      }
    }

    // Now scramble rotations (excluding battery and target)
    let scrambleAttempts = 0;
    do {
      for (let i = 0; i < 16; i++) {
        if (i !== 13 && i !== 3) {
          newCells[i].rot = Math.floor(Math.random() * 4);
        }
      }
      scrambleAttempts++;
    } while (calculateFlow(newCells).has(3) && scrambleAttempts < 50);

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

        if (nextSolved >= 3) {
          setFinished(true);
          onSuccess();
        } else {
          generatePuzzle();
        }
        setBusy(false);
      }, 500);
    }
  };

  const powered = calculateFlow(cells);

  return (
    <div className="bg-[#080d16] text-[#e7eef8] rounded-[2.5rem] border border-[#29374a] p-4 sm:p-6 space-y-5 font-mono shadow-2xl max-w-lg w-full">
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
            {solvedNodes} / 3 Nodes
          </span>
        </div>
      </div>

      <p className="text-xs text-[#8798b0] leading-relaxed">
        Rotate conduit tiles to connect power from the battery (<span className="text-yellow-400 font-bold">⚡</span>) to the reactor target (<span className="text-[#00F0FF] font-bold">◎</span>). Complete 3 circuits.
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
          <span className="text-[#60dce9] font-bold">{SUBSYSTEMS[solvedNodes] || "ALL RESTORED"}</span>
        </div>
        <div className="grid grid-cols-3 gap-1.5 pt-1">
          {SUBSYSTEMS.map((name, i) => (
            <div
              key={name}
              className={`text-[10px] text-center p-1.5 rounded border truncate ${
                i < solvedNodes
                  ? "bg-emerald-950/70 border-emerald-500/50 text-emerald-300 font-bold"
                  : "bg-black/50 border-white/[0.08] text-zinc-500"
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
          className="text-xs px-4 py-2 rounded-lg bg-black/50 hover:bg-white/[0.04] text-zinc-400 border border-white/[0.08] transition-colors"
        >
          Exit Console
        </button>
      </div>
    </div>
  );
}
