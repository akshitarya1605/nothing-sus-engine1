"use client";

import { usePathname, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

export function FloatingBackButton() {
  const pathname = usePathname();
  const router = useRouter();

  if (pathname === "/") return null;

  return (
    <button
      onClick={() => router.back()}
      className="group fixed top-6 left-6 z-50 flex items-center justify-center gap-2 overflow-hidden rounded-full border border-white/[0.08] bg-[#12121A]/80 backdrop-blur-xl px-4 py-3 font-mono text-[10px] font-bold uppercase tracking-widest text-zinc-400 shadow-2xl transition-all duration-300 hover:border-[#00F0FF]/50 hover:text-[#00F0FF] hover:shadow-[0_0_20px_rgba(0,240,255,0.2)]"
      title="Go Back"
    >
      <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
      <span className="max-w-0 opacity-0 transition-all duration-300 group-hover:max-w-xs group-hover:opacity-100 whitespace-nowrap">
        Go Back
      </span>
    </button>
  );
}
