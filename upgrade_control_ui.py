import re

with open("src/app/control/page.tsx", "r") as f:
    content = f.read()

# 1. Swap Header
content = content.replace('import { IsaHeader } from "@/components/ui/IsaHeader";', 'import { Header } from "@/components/header";')
content = content.replace('<IsaHeader />', '<Header />')

# 2. Add floating glow background like the login page
content = content.replace('<main className="flex-1 flex flex-col', '<main className="relative flex-1 flex flex-col z-10')
# We need to inject the background glow div right after Header
header_idx = content.find('<Header />')
if header_idx != -1:
    bg_glow = """
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="absolute -left-1/4 -top-1/4 h-[800px] w-[800px] rounded-full bg-[#00F0FF]/10 blur-[120px]" />
        <div className="absolute -right-1/4 top-1/4 h-[600px] w-[600px] rounded-full bg-[#FF3B5C]/10 blur-[120px]" />
      </div>
      <Header />
"""
    content = content.replace('<Header />', bg_glow)

# 3. Upgrade the Tabs to match the frosted glass pill design
old_nav = r'className="flex items-center gap-6 px-4 md:px-8 py-3 overflow-x-auto border-b border-white/\[0\.08\] backdrop-blur-md"'
new_nav = r'className="flex items-center justify-center gap-2 px-4 py-4 mt-8 relative z-10"'
content = re.sub(old_nav, new_nav, content)

old_tab_active = r'className="text-xs font-bold uppercase tracking-wider text-white border-b-2 border-white pb-1"'
new_tab_active = r'className="px-6 py-2.5 rounded-full bg-white/[0.12] text-white text-xs font-bold uppercase tracking-widest border border-white/10 shadow-[0_0_15px_rgba(255,255,255,0.1)]"'
content = content.replace(old_tab_active, new_tab_active)

old_tab_inactive = r'className="text-xs font-bold uppercase tracking-wider text-zinc-500 hover:text-zinc-300 transition-colors pb-1"'
new_tab_inactive = r'className="px-6 py-2.5 rounded-full text-zinc-500 text-xs font-bold uppercase tracking-widest hover:text-white transition-all hover:bg-white/[0.04]"'
content = content.replace(old_tab_inactive, new_tab_inactive)

# 4. Upgrade the big wrapper divs to frosted glass bento cards
content = content.replace('w-full max-w-4xl mx-auto space-y-6', 'w-full max-w-5xl mx-auto space-y-8 relative z-10 mt-6')
content = content.replace('bg-[#12121A]/40 backdrop-blur-[20px] border border-white/[0.08] rounded-3xl p-6 md:p-8', 'bg-[#12121A]/60 backdrop-blur-[30px] border border-white/[0.08] rounded-[2rem] p-8 md:p-12 shadow-2xl')

# 5. Fix ARSH235 placeholder
content = content.replace('ARSH235', 'NOTHINGSUS123')

with open("src/app/control/page.tsx", "w") as f:
    f.write(content)

