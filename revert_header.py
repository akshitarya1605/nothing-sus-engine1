with open("src/app/control/page.tsx", "r") as f:
    content = f.read()

content = content.replace('import { Header } from "@/components/header";', 'import { IsaHeader } from "@/components/ui/IsaHeader";')
content = content.replace('<Header />', '<IsaHeader />')

with open("src/app/control/page.tsx", "w") as f:
    f.write(content)
