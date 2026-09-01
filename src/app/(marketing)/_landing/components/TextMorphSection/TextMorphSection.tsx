"use client";

import { useEffect, useRef } from "react";
import { gsap, ScrollTrigger } from "../../lib/gsap";
import "./TextMorphSection.css";

export interface MorphLine {
  heading: string;
  sub?: string;
  accent?: "red" | "cyan" | "yellow";
}

interface TextMorphSectionProps {
  id: string;
  lines: MorphLine[];
  distancePerLine?: number;
  className?: string;
}

export function TextMorphSection({
  id,
  lines,
  distancePerLine = 900,
  className = "",
}: TextMorphSectionProps) {
  const sectionRef = useRef<HTMLElement | null>(null);
  const pinRef = useRef<HTMLDivElement | null>(null);
  const lineRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const ctx = gsap.context(() => {
      const mm = gsap.matchMedia();

      mm.add({ isReduced: "(prefers-reduced-motion: reduce)" }, (context) => {
        const { isReduced } = context.conditions as { isReduced: boolean };

        if (isReduced) {
          lineRefs.current.forEach((el) => el && gsap.set(el, { opacity: 1, y: 0, scale: 1 }));
          return;
        }

        const n = lines.length;
        const scrollDistance = distancePerLine * n;

        const applyProgress = (progress: number) => {
          const slot = 1 / n;
          lineRefs.current.forEach((el, i) => {
            if (!el) return;
            const center = slot * i + slot / 2;
            const dist = (progress - center) / (slot * 0.62);
            const presence = Math.max(0, 1 - Math.abs(dist));
            const direction = dist < 0 ? 1 : -1;
            el.style.opacity = String(presence);
            el.style.transform = `translateY(${(1 - presence) * 40 * direction}px) scale(${0.9 + presence * 0.1})`;
            el.style.filter = `blur(${(1 - presence) * 6}px)`;
          });
        };

        applyProgress(0);

        ScrollTrigger.create({
          trigger: sectionRef.current,
          start: "top top",
          end: `+=${scrollDistance}`,
          pin: pinRef.current,
          scrub: 0.4,
          onUpdate: (self) => applyProgress(self.progress),
        });
      });

      return () => mm.revert();
    }, sectionRef);

    return () => ctx.revert();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lines.length]);

  return (
    <section id={id} ref={sectionRef} className={`text-morph ${className}`}>
      <div ref={pinRef} className="text-morph-pin">
        <div className="text-morph-stack">
          {lines.map((line, i) => (
            <div
              key={line.heading}
              ref={(el) => {
                lineRefs.current[i] = el;
              }}
              className={`text-morph-line${line.accent ? ` is-${line.accent}` : ""}`}
            >
              <h2>{line.heading}</h2>
              {line.sub && <p>{line.sub}</p>}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}