"use client";

import React from "react";

export function IsaHeader() {
  return (
    <div className="relative z-50 flex flex-wrap items-center justify-between gap-2 border-b border-cyan/20 bg-void/90 px-4 py-2 font-display text-[11px] font-bold uppercase tracking-widest text-cyan backdrop-blur-md sm:px-6 sm:text-xs">
      <div className="flex items-center gap-2">
        <span className="flex h-2 w-2 rounded-full bg-cyan animate-ping" />
        <span className="text-yellow font-extrabold">ISA</span>
        <span className="hidden text-fg-faint sm:inline">|</span>
        <span className="text-fg-dim">INTERNATIONAL SOCIETY OF AUTOMATION</span>
        <span className="hidden text-fg-faint md:inline">•</span>
        <span className="hidden font-extrabold text-cyan md:inline">MANIPAL UNIVERSITY JAIPUR</span>
      </div>
      <div className="flex items-center gap-3">
        <a
          href="https://www.instagram.com/isa_muj_chapter?stkn=MWFlMTNuMW10YmZ3Yg=="
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 rounded-full border border-pink-500/40 bg-pink-500/10 px-2.5 py-0.5 text-[10px] font-semibold text-pink-400 transition-all hover:bg-pink-500/20 hover:text-pink-300"
        >
          <span>📸</span>
          <span>@isa_muj_chapter</span>
        </a>
      </div>
    </div>
  );
}
