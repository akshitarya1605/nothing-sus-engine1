"use client";

import { useState } from "react";

interface WiresTaskProps {
  onSuccess: () => void;
  onCancel: () => void;
}

const WIRE_COLORS = [
  { id: "red", label: "Red", bg: "bg-red-500", border: "border-red-500", hex: "#ef4444" },
  { id: "blue", label: "Blue", bg: "bg-blue-500", border: "border-blue-500", hex: "#3b82f6" },
  { id: "yellow", label: "Yellow", bg: "bg-yellow-400", border: "border-yellow-400", hex: "#facc15" },
  { id: "pink", label: "Magenta", bg: "bg-fuchsia-500", border: "border-fuchsia-500", hex: "#d946ef" },
];

export function WiresTask({ onSuccess, onCancel }: WiresTaskProps) {
  const [selectedLeft, setSelectedLeft] = useState<string | null>(null);
  const [connections, setConnections] = useState<Record<string, string>>({});
  const [rightOrder] = useState(() => [...WIRE_COLORS].sort(() => Math.random() - 0.5));
  const [errorFlash, setErrorFlash] = useState<string | null>(null);

  const handleSelectLeft = (id: string) => {
    if (connections[id]) return;
    setSelectedLeft(id);
  };

  const handleSelectRight = (id: string) => {
    if (!selectedLeft) return;

    if (selectedLeft === id) {
      // Correct connection!
      const updated = { ...connections, [selectedLeft]: id };
      setConnections(updated);
      setSelectedLeft(null);

      if (Object.keys(updated).length === 4) {
        setTimeout(() => onSuccess(), 400);
      }
    } else {
      // Wrong wire: flash mismatch
      setErrorFlash(id);
      setTimeout(() => setErrorFlash(null), 500);
      setSelectedLeft(null);
    }
  };

  const connectedCount = Object.keys(connections).length;

  return (
    <div className="bg-[#080d16] text-[#e7eef8] rounded-[2.5rem] border border-[#29374a] p-4 sm:p-6 space-y-5 font-mono shadow-2xl max-w-sm w-full select-none">
      <div className="border-b border-[#29374a] pb-3 flex items-center justify-between">
        <div>
          <span className="text-[10px] tracking-widest uppercase text-yellow-400 font-bold">
            ELECTRICAL PANEL
          </span>
          <h2 className="text-base font-black uppercase text-white">Fix Wiring</h2>
        </div>
        <span className="text-xs px-2.5 py-1 rounded bg-[#1b293c] border border-[#29374a] text-yellow-400 font-bold">
          {connectedCount} / 4 Connected
        </span>
      </div>

      <p className="text-xs text-[#8798b0]">
        Tap a terminal on the left, then tap the matching colored terminal on the right.
      </p>

      {/* Wire Panels */}
      <div className="flex justify-between items-center py-4 px-2 gap-4">
        {/* Left Terminals */}
        <div className="space-y-4 flex-1">
          {WIRE_COLORS.map((wire) => {
            const isConnected = Boolean(connections[wire.id]);
            const isSelected = selectedLeft === wire.id;
            return (
              <button
                key={wire.id}
                type="button"
                onClick={() => handleSelectLeft(wire.id)}
                disabled={isConnected}
                className={`w-full flex items-center justify-between p-2.5 rounded-xl border text-xs font-bold transition-all touch-manipulation active:scale-95 ${
                  isConnected
                    ? "opacity-50 border-emerald-500/60 bg-emerald-950/20 text-emerald-300"
                    : isSelected
                    ? `border-white bg-[#1b293c] shadow-[0_0_12px_rgba(255,255,255,0.4)]`
                    : "border-white/[0.08] bg-[#0c1522] hover:border-zinc-600 text-zinc-300"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className={`w-3.5 h-3.5 rounded-full ${wire.bg} shadow-md`} />
                  <span>{wire.label}</span>
                </div>
                {isConnected ? (
                  <span className="text-emerald-400 text-xs font-bold">✓</span>
                ) : isSelected ? (
                  <span className="text-[#00F0FF] text-xs animate-pulse">●</span>
                ) : null}
              </button>
            );
          })}
        </div>

        {/* Center Connection Indicator */}
        <div className="text-xs font-bold font-mono text-center px-1 text-zinc-500">
          {selectedLeft ? (
            <span className="text-[#00F0FF] animate-pulse">Connect →</span>
          ) : (
            <span>⚡</span>
          )}
        </div>

        {/* Right Terminals */}
        <div className="space-y-4 flex-1">
          {rightOrder.map((wire) => {
            const isConnected = Object.values(connections).includes(wire.id);
            const isFlashErr = errorFlash === wire.id;
            return (
              <button
                key={wire.id}
                type="button"
                onClick={() => handleSelectRight(wire.id)}
                disabled={isConnected}
                className={`w-full flex items-center justify-between p-2.5 rounded-xl border text-xs font-bold transition-all touch-manipulation active:scale-95 ${
                  isConnected
                    ? "opacity-50 border-emerald-500/60 bg-emerald-950/20 text-emerald-300"
                    : isFlashErr
                    ? "border-red-500 bg-[#FF3B5C]/10/60 text-red-300 animate-shake"
                    : "border-white/[0.08] bg-[#0c1522] hover:border-zinc-600 text-zinc-300"
                }`}
              >
                {isConnected ? (
                  <span className="text-emerald-400 text-xs font-bold">✓</span>
                ) : <span />}
                <div className="flex items-center gap-2">
                  <span>{wire.label}</span>
                  <span className={`w-3.5 h-3.5 rounded-full ${wire.bg} shadow-md`} />
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex items-center justify-between pt-2 border-t border-[#29374a]">
        <span className="text-[10px] text-zinc-400">
          {connectedCount === 4 ? "✓ All circuits wired!" : "Circuits interrupted"}
        </span>
        <button
          type="button"
          onClick={onCancel}
          className="text-xs px-3.5 py-1.5 rounded-lg bg-black/50 hover:bg-white/[0.04] text-zinc-400 border border-white/[0.08] transition-colors"
        >
          Exit
        </button>
      </div>
    </div>
  );
}
