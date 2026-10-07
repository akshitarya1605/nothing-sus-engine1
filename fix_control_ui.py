import re

with open("src/app/control/page.tsx", "r") as f:
    content = f.read()

# Fix Inputs
content = content.replace('bg-zinc-900', 'bg-black/50 focus:bg-black focus:border-[#00F0FF]/50')
content = content.replace('focus:border-red-500', 'focus:border-[#00F0FF]/50')

# Fix panels/containers
content = content.replace('bg-[#12121A]/40 backdrop-blur-[20px] rounded-3xl', 'bg-[#12121A]/60 backdrop-blur-[30px] rounded-[2.5rem]')
content = content.replace('bg-zinc-950', 'bg-[#050508]')
content = content.replace('border-zinc-800', 'border-white/[0.08]')

# Fix Create button
content = content.replace('bg-[#FF3B5C] hover:bg-white text-black transition-all shadow-[0_0_15px_rgba(255,59,92,0.4)] text-white text-xs font-bold uppercase tracking-wider font-bold uppercase tracking-wider transition-colors', 'bg-[#00F0FF] hover:bg-cyan-400 text-black shadow-[0_0_15px_rgba(0,240,255,0.4)] text-xs font-black uppercase tracking-wider transition-all')

# Fix Start Game Button
content = content.replace('bg-[#FF3B5C] hover:bg-white text-black transition-all shadow-[0_0_15px_rgba(255,59,92,0.4)] disabled:opacity-50 text-white text-xs font-bold uppercase tracking-wider font-bold uppercase tracking-wider transition-all shadow-lg shadow-red-950/50 flex items-center justify-center gap-2', 'w-full py-4 px-4 rounded-xl bg-[#FF3B5C] hover:bg-white disabled:opacity-50 text-[#0B0B0F] text-sm font-black uppercase tracking-widest transition-all shadow-[0_0_0_1px_rgba(255,59,92,0.4),0_10px_40px_-10px_rgba(255,59,92,0.65)] hover:shadow-[0_0_0_1px_rgba(255,255,255,0.6),0_14px_50px_-10px_rgba(255,59,92,0.8)] flex items-center justify-center gap-2 group')

# Fix End Game button
content = content.replace('bg-[#FF3B5C] hover:bg-white text-black transition-all shadow-[0_0_15px_rgba(255,59,92,0.4)] disabled:opacity-40 text-white text-xs font-bold uppercase tracking-wider font-bold uppercase tracking-wider transition-all shadow-lg shadow-red-950/50', 'py-3 px-6 rounded-xl bg-[#FF3B5C] hover:bg-white text-[#0B0B0F] text-xs font-black uppercase tracking-widest transition-all shadow-[0_0_0_1px_rgba(255,59,92,0.4),0_10px_40px_-10px_rgba(255,59,92,0.65)]')

# Fix secondary buttons
content = content.replace('bg-white/[0.04] hover:bg-white/[0.08]', 'bg-white/[0.03] hover:bg-white/[0.06]')
content = content.replace('bg-zinc-800 text-white border border-white/[0.08]', 'bg-white/[0.08] text-white border-white/[0.12]')

with open("src/app/control/page.tsx", "w") as f:
    f.write(content)
