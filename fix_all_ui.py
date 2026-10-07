import os

def process_file(filepath):
    with open(filepath, "r") as f:
        content = f.read()

    # Base background and borders
    new_content = content.replace('bg-zinc-950', 'bg-[#12121A]/60 backdrop-blur-[30px]')
    new_content = new_content.replace('border-zinc-800', 'border-white/[0.08]')
    new_content = new_content.replace('rounded-2xl border', 'rounded-[2.5rem] border')
    new_content = new_content.replace('bg-zinc-900', 'bg-black/50')
    new_content = new_content.replace('border-zinc-700', 'border-white/[0.08]')

    # Primary red/cyan brand colors
    new_content = new_content.replace('bg-red-600 hover:bg-red-500', 'bg-[#FF3B5C] hover:bg-white text-[#0B0B0F]')
    new_content = new_content.replace('text-red-500', 'text-[#FF3B5C]')
    new_content = new_content.replace('text-red-400', 'text-[#FF3B5C]')
    new_content = new_content.replace('border-red-500/50', 'border-[#FF3B5C]/30')
    new_content = new_content.replace('border-red-500/40', 'border-[#FF3B5C]/30')
    new_content = new_content.replace('border-red-500/30', 'border-[#FF3B5C]/30')
    new_content = new_content.replace('bg-red-950/80', 'bg-[#FF3B5C]/10')
    new_content = new_content.replace('bg-red-950/40', 'bg-[#FF3B5C]/5')
    new_content = new_content.replace('bg-red-950', 'bg-[#FF3B5C]/10')

    new_content = new_content.replace('text-cyan-400', 'text-[#00F0FF]')
    new_content = new_content.replace('text-cyan-300', 'text-[#00F0FF]')
    new_content = new_content.replace('border-cyan-500/40', 'border-[#00F0FF]/30')
    new_content = new_content.replace('bg-cyan-950/70', 'bg-[#00F0FF]/10')

    # General neutral grays to pure black/white mix
    new_content = new_content.replace('bg-zinc-800', 'bg-white/[0.04]')
    new_content = new_content.replace('hover:bg-zinc-700', 'hover:bg-white/[0.08]')
    
    if new_content != content:
        with open(filepath, "w") as f:
            f.write(new_content)
        print(f"Updated {filepath}")

for root, _, files in os.walk("src"):
    for file in files:
        if file.endswith(".tsx") or file.endswith(".ts"):
            process_file(os.path.join(root, file))

