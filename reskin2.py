import re
import os

replacements = [
    (r'bg-black', r'bg-[#0B0B0F]'),
    (r'border-zinc-900', r'border-white/[0.08] backdrop-blur-md'),
    (r'bg-zinc-900 hover:bg-zinc-800', r'bg-white/[0.04] hover:bg-white/[0.08] transition-colors'),
    (r'bg-zinc-800 hover:bg-zinc-700', r'bg-white/[0.08] hover:bg-white/[0.12] transition-colors'),
    (r'border border-zinc-800', r'border border-white/[0.08]'),
    (r'bg-zinc-950', r'bg-[#12121A]/40 backdrop-blur-[20px]'),
    (r'bg-red-600 hover:bg-red-500', r'bg-[#FF3B5C] hover:bg-white text-black transition-all shadow-[0_0_15px_rgba(255,59,92,0.4)]'),
    (r'bg-emerald-600 hover:bg-emerald-500', r'bg-[#B6FF3B] hover:bg-white text-black transition-all shadow-[0_0_15px_rgba(182,255,59,0.4)]'),
    (r'font-mono', r'font-sans'),
    (r'text-cyan-400', r'text-[#00F0FF]'),
    (r'rounded-2xl', r'rounded-3xl'),
    (r'rounded-xl', r'rounded-2xl'),
    (r'rounded-lg', r'rounded-xl'),
]

files = [
    "src/app/play/page.tsx",
    "src/app/spectator/page.tsx"
]

for file in files:
    if os.path.exists(file):
        with open(file, "r") as f:
            content = f.read()
        for old, new in replacements:
            content = re.sub(old, new, content)
        with open(file, "w") as f:
            f.write(content)

