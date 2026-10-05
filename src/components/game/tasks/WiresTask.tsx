"use client";

import { useState } from "react";

interface WiresTaskProps {
  onSuccess: () => void;
  onCancel: () => void;
}

const WIRE_COLORS = [
  { id: "red", label: "Red", bg: "bg-red-500", text: "text-red-400", hex: "#ef4444" },
  { id: "blue", label: "Blue", bg: "bg-blue-500", text: "text-blue-400", hex: "#3b82f6" },
  { id: "yellow", label: "Yellow", bg: "bg-yellow-400", text: "text-yellow-400", hex: "#facc15" },
  { id: "pink", label: "Magenta", bg: "bg-fuchsia-500", text: "text-fuchsia-400", hex: "#d946ef" },
];

export function WiresTask({ onSuccess, onCancel }: WiresTaskProps) {
  const [selectedLeft, setSelectedLeft] = useState<string | null>(null);
  // Connections map: leftId -> rightId
  const [connections, setConnections] = useState<Record<string, string>>({});
  // Fixed left order, shuffled right order
  const [rightOrder] = useState(() => [...WIRE_COLORS].sort(() => Math.random() - 0.5));

  const handleSelectLeft = (id: string) => {
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
      // Wrong wire
      setSelectedLeft(null);
    }
  };

  const connectedCount = Object.keys(connections).length;

  return (
    <div className="bg-[#080d16] text-[#e7eef8] rounded-2xl border border-[#29374a] p-4 sm:p-6 space-y-5 font-mono shadow-2xl max-w-sm w-full">
      <div className="border-b border-[#29374a] pb-3 flex items-center justify-between">
        <div>
          <span className="text-[10px] tracking-widest uppercase text-yellow-400 font-bold">
            ELECTRICAL PANEL
          </span>
          <h2 className="text-base font-black uppercase text-white">Fix Wiring</h2>
        </div>
        <span className="text-xs px-2 py-0.5 rounded bg-zinc-900 border border-zinc-700 text-yellow-400 font-bold">
          {connectedCount} / 4 Connected
        </span>
      </div>

      <p className="text-xs text-[#8798b0]">
        Tap a wire terminal on the left, then tap the matching colored terminal on the right.
      </p>

      {/* Wire Panels */}
      <div className="flex justify-between items-center py-4 px-2 gap-4">
        {/* Left Terminals */}
        <div className="space-y-4">
          {WIRE_COLORS.map((wire) => {
            const isConnected = Boolean(connections[wire.id]);
            const isSelected = selectedLeft === wire.id;
            return (
              <button
                key={wire.id}
                type="button"
                onClick={() => handleSelectLeft(wire.id)}
                disabled={isConnected}
                className={`flex items-center gap-2 p-2 rounded-xl border text-xs font-bold transition-all ${
                  isConnected
                    ? "opacity-50 border-emerald-500 bg-zinc-900"
                    : isSelected
                    ? "border-white bg-zinc-800 scale-105"
                    : "border-zinc-800 bg-zinc-950 hover:border-zinc-700"
                }`}
              >
                <span className={`w-4 h-4 rounded-full ${wire.bg} shadow-md`} />
                <span>{wire.label}</span>
                {isConnected && <span className="text-emerald-400 text-[10px]">✓</span>}
              </button>
            );
          })}
        </div>

        {/* Center Connection Indicator */}
        <div className="text-zinc-600 text-xs select-none">
          {selectedLeft ? "Connect →" : "←"}
        </div>

        {/* Right Terminals */}
        <div className="space-y-4">
          {rightOrder.map((wire) => {
            const isConnected = Object.values(connections).includes(wire.id);
            return (
              <button
                key={wire.id}
                type="button"
                onClick={() => handleSelectRight(wire.id)}
                disabled={isConnected}
                className={`flex items-center gap-2 p-2 rounded-xl border text-xs font-bold transition-all ${
                  isConnected
                    ? "opacity-50 border-emerald-500 bg-zinc-900"
                    : "border-zinc-800 bg-zinc-950 hover:border-zinc-700"
                }`}
              >
                <span>{wire.label}</span>
                <span className={`w-4 h-4 rounded-full ${wire.bg} shadow-md`} />
                {isConnected && <span className="text-emerald-400 text-[10px]">✓</span>}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex items-center justify-between pt-2 border-t border-[#29374a]">
        <span className="text-[10px] text-zinc-500">
          {connectedCount === 4 ? "✓ All circuits wired!" : "Circuits interrupted"}
        </span>
        <button
          type="button"
          onClick={onCancel}
          className="text-xs px-3 py-1.5 rounded-lg bg-zinc-900 text-zinc-400 border border-zinc-700"
        >
          Exit
        </button>
      </div>
    </div>
  );
}
