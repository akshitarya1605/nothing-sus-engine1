import type { Metadata, Viewport } from "next";
import { Fredoka, Nunito } from "next/font/google";
import "./globals.css";

const fredoka = Fredoka({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-fredoka",
  display: "swap",
});

const nunito = Nunito({
  subsets: ["latin"],
  weight: ["400", "600", "700", "800", "900"],
  variable: "--font-nunito",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: {
    default: "Nothing Sus",
    template: "%s · Nothing Sus",
  },
  description:
    "A live game of tasks, trust, deception and deduction. Step into the ship — one of you isn't who they say they are.",
  applicationName: "Nothing Sus",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/favicon.png", apple: "/favicon.png" },
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "Nothing Sus" },
  openGraph: {
    title: "Nothing Sus",
    description: "A live game of tasks, trust, deception and deduction.",
    type: "website",
  },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#050508",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${fredoka.variable} ${nunito.variable}`}>
      <body>{children}</body>
    </html>
  );
}
