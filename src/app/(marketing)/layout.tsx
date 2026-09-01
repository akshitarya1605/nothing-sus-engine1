import type { Metadata } from "next";
import "./_landing/landing-base.css";
import "./_landing/landing-fonts.css";

export const metadata: Metadata = {
  title: "Nothing Sus — a live game of trust and deception",
  description:
    "A live game of tasks, trust, deception and deduction. Step into the ship — one of you isn't who they say they are.",
  robots: { index: true, follow: true },
  openGraph: {
    title: "Nothing Sus",
    description: "A live game of tasks, trust, deception and deduction.",
    type: "website",
  },
};

export default function MarketingLayout({ children }: LayoutProps<"/">) {
  return children;
}
