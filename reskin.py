import re

with open("src/app/control/page.tsx", "r") as f:
    content = f.read()

# Replacements for dark mode glassmorphism
replacements = [
    (r'min-h-screen bg-black text-white font-mono', r'min-h-screen bg-[#0B0B0F] text-white font-sans'),
    (r'border-b border-zinc-900', r'border-b border-white/[0.08] backdrop-blur-md'),
    (r'font-mono tracking-widest', r'tracking-wider'),
    (r'font-mono text-xs', r'text-xs font-bold uppercase tracking-wider'),
    (r'font-mono text-sm', r'text-sm font-bold uppercase tracking-wider'),
    (r'font-mono text-\[10px\]', r'text-[10px] font-bold uppercase tracking-[0.1em]'),
    (r'bg-zinc-900 hover:bg-zinc-800', r'bg-white/[0.04] hover:bg-white/[0.08] transition-colors'),
    (r'bg-zinc-800 hover:bg-zinc-700', r'bg-white/[0.08] hover:bg-white/[0.12] transition-colors'),
    (r'border border-zinc-800', r'border border-white/[0.08]'),
    (r'bg-zinc-950', r'bg-[#12121A]/40 backdrop-blur-[20px]'),
    (r'text-zinc-500', r'text-zinc-500'),
    (r'text-zinc-400', r'text-zinc-400'),
    (r'bg-red-600 hover:bg-red-500', r'bg-[#FF3B5C] hover:bg-white text-black transition-all shadow-[0_0_15px_rgba(255,59,92,0.4)]'),
    (r'bg-red-950/80 border-red-500/40 text-red-400', r'bg-[#FF3B5C]/10 border-[#FF3B5C]/20 text-[#FF3B5C]'),
    (r'text-cyan-400', r'text-[#00F0FF]'),
    (r'text-emerald-400', r'text-[#B6FF3B]'),
    (r'bg-emerald-600 hover:bg-emerald-500', r'bg-[#B6FF3B] hover:bg-white text-black transition-all shadow-[0_0_15px_rgba(182,255,59,0.4)]'),
    (r'bg-red-900\/50', r'bg-[#FF3B5C]/10'),
    (r'bg-emerald-950', r'bg-[#B6FF3B]/10'),
    (r'border-emerald-500\/40', r'border-[#B6FF3B]/20'),
    (r'text-emerald-300', r'text-[#B6FF3B]'),
    (r'rounded-2xl', r'rounded-3xl'),
    (r'rounded-xl', r'rounded-2xl'),
    (r'rounded-lg', r'rounded-xl'),
    (r'font-mono', r'font-sans'),
]

for old, new in replacements:
    content = re.sub(old, new, content)

with open("src/app/control/page.tsx", "w") as f:
    f.write(content)

