import re

with open("src/app/control/page.tsx", "r") as f:
    content = f.read()

# Fix the duplicate font-bold text-white etc in the remaining buttons
content = re.sub(r'text-white text-xs font-bold uppercase tracking-wider font-bold uppercase tracking-wider', 'text-xs font-black uppercase tracking-wider', content)
content = re.sub(r'text-white text-xs font-bold uppercase tracking-wider font-bold uppercase', 'text-xs font-black uppercase tracking-wider', content)
content = re.sub(r'hover:bg-white text-black text-white', 'hover:bg-white text-[#0B0B0F]', content)
content = re.sub(r'bg-\[\#B6FF3B\] hover:bg-white text-black transition-all shadow-\[0_0_15px_rgba\(182,255,59,0\.4\)\] text-xs font-black uppercase tracking-wider transition-colors', 'bg-[#00F0FF] hover:bg-white text-[#0B0B0F] transition-all shadow-[0_0_15px_rgba(0,240,255,0.4)] text-xs font-black uppercase tracking-wider', content)

with open("src/app/control/page.tsx", "w") as f:
    f.write(content)
