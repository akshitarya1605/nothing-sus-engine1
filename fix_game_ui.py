import re

with open("src/app/player/game/page.tsx", "r") as f:
    content = f.read()

# Containers
content = content.replace('bg-zinc-950', 'bg-[#12121A]/60 backdrop-blur-[30px]')
content = content.replace('border-zinc-800', 'border-white/[0.08]')
content = content.replace('rounded-2xl border', 'rounded-[2.5rem] border')

# Modals
content = content.replace('bg-black/95 backdrop-blur-md', 'bg-black/70 backdrop-blur-[40px]')
content = content.replace('rounded-3xl border-2', 'rounded-[2.5rem] border border-white/[0.1]')
content = content.replace('shadow-red-950/80', 'shadow-[0_0_100px_rgba(255,59,92,0.4)]')
content = content.replace('shadow-cyan-950/80', 'shadow-[0_0_100px_rgba(0,240,255,0.4)]')

# Buttons & Colors
content = content.replace('bg-zinc-900', 'bg-black/50')
content = content.replace('border-zinc-700', 'border-white/[0.08]')

# Imposter Theme tweaks
content = content.replace('border-red-500 bg-zinc-950', 'border-[#FF3B5C]/50 bg-[#12121A]/80')
content = content.replace('border-cyan-500 bg-zinc-950', 'border-[#00F0FF]/50 bg-[#12121A]/80')

content = content.replace('bg-red-600 hover:bg-red-500 disabled:opacity-50', 'bg-[#FF3B5C] hover:bg-white text-[#0B0B0F] disabled:opacity-50')
content = content.replace('bg-red-600 hover:bg-red-500', 'bg-[#FF3B5C] hover:bg-white text-[#0B0B0F]')
content = content.replace('bg-cyan-600 hover:bg-cyan-500', 'bg-[#00F0FF] hover:bg-white text-[#0B0B0F]')

content = content.replace('text-red-500', 'text-[#FF3B5C]')
content = content.replace('text-red-400', 'text-[#FF3B5C]')
content = content.replace('border-red-500/50', 'border-[#FF3B5C]/30')
content = content.replace('border-red-500/40', 'border-[#FF3B5C]/30')
content = content.replace('border-red-500/30', 'border-[#FF3B5C]/30')
content = content.replace('bg-red-950/80', 'bg-[#FF3B5C]/10')
content = content.replace('bg-red-950/40', 'bg-[#FF3B5C]/5')
content = content.replace('bg-red-950', 'bg-[#FF3B5C]/10')

# Neutral UI bits
content = content.replace('text-cyan-400', 'text-[#00F0FF]')
content = content.replace('text-cyan-300', 'text-[#00F0FF]')
content = content.replace('border-cyan-500/40', 'border-[#00F0FF]/30')
content = content.replace('bg-cyan-950/70', 'bg-[#00F0FF]/10')

with open("src/app/player/game/page.tsx", "w") as f:
    f.write(content)
