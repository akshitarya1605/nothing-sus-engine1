import re

with open("src/app/player/page.tsx", "r") as f:
    content = f.read()

# Replace main background colors
content = content.replace('bg-zinc-950', 'bg-[#12121A]/60 backdrop-blur-[30px]')
content = content.replace('border-zinc-800', 'border-white/[0.08]')

# Replace input boxes
content = content.replace('bg-zinc-900', 'bg-black/50')
content = content.replace('border-zinc-700', 'border-white/[0.08]')
content = content.replace('focus:border-red-500', 'focus:border-[#00F0FF]/50')
content = content.replace('placeholder-zinc-500', 'placeholder-zinc-600')

# Replace primary red buttons with the new glassmorphism #FF3B5C style
content = content.replace('bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-mono text-xs font-bold uppercase tracking-wider transition-all shadow-lg shadow-red-950/50', 'bg-[#FF3B5C] hover:bg-white disabled:opacity-50 text-[#0B0B0F] text-xs font-black uppercase tracking-widest transition-all shadow-[0_0_0_1px_rgba(255,59,92,0.4),0_10px_40px_-10px_rgba(255,59,92,0.65)] hover:shadow-[0_0_0_1px_rgba(255,255,255,0.6),0_14px_50px_-10px_rgba(255,59,92,0.8)]')

# Fix red-bordered boxes to the new style
content = content.replace('border-red-500/30', 'border-white/[0.08]')
content = content.replace('bg-red-950/40', 'bg-[#FF3B5C]/10')
content = content.replace('text-red-200', 'text-[#FF3B5C]')

# Secondary buttons
content = content.replace('bg-zinc-800 hover:bg-zinc-700', 'bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08]')

# Adjust padding/rounding for the modern bento look
content = content.replace('rounded-2xl border', 'rounded-[2.5rem] border')
content = content.replace('p-6 space-y-3', 'p-8 space-y-4')
content = content.replace('p-6 space-y-4', 'p-8 space-y-5')
content = content.replace('p-5 flex', 'p-6 flex')
content = content.replace('p-4 rounded-xl', 'p-5 rounded-2xl')

# Fix font-mono tracking-widest uppercase to font-sans tracking-widest uppercase for some labels
content = content.replace('font-mono tracking-widest uppercase text-zinc-500', 'font-sans text-[10px] uppercase tracking-widest text-zinc-500')
content = content.replace('text-xs font-mono text-zinc-400 mt-0.5', 'text-sm font-mono text-zinc-400 mt-1')

# Save
with open("src/app/player/page.tsx", "w") as f:
    f.write(content)
