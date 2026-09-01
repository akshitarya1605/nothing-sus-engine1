"use client";

import { useEffect, useRef } from "react";
import { gsap, ScrollTrigger } from "../../lib/gsap";
import "./FinalCTA.css";

const HEADLINES = ["Ready?", "Trust no one.", "Nothing Sus"];

interface FinalCTAProps {
  participantUrl: string;
}

export function FinalCTA({ participantUrl }: FinalCTAProps) {
  const sectionRef = useRef<HTMLElement | null>(null);
  const pinRef = useRef<HTMLDivElement | null>(null);
  const headlineRefs = useRef<(HTMLDivElement | null)[]>([]);
  const ctaWrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      const mm = gsap.matchMedia();

      mm.add({ isReduced: "(prefers-reduced-motion: reduce)" }, (context) => {
        const { isReduced } = context.conditions as { isReduced: boolean };

        if (isReduced) {
          headlineRefs.current.forEach((el, i) =>
            gsap.set(el, { opacity: i === HEADLINES.length - 1 ? 1 : 0, position: "static" }),
          );
          gsap.set(ctaWrapRef.current, { opacity: 1, y: 0 });
          return;
        }

        const n = HEADLINES.length;
        const slot = 0.7 / n;

        const applyProgress = (progress: number) => {
          headlineRefs.current.forEach((el, i) => {
            if (!el) return;
            const isLast = i === n - 1;
            const center = slot * i + slot / 2;
            let presence: number;
            if (isLast) {
              const fadeIn = Math.min(1, Math.max(0, (progress - (center - slot * 0.62)) / (slot * 0.62)));
              presence = fadeIn;
            } else {
              const dist = (progress - center) / (slot * 0.62);
              presence = Math.max(0, 1 - Math.abs(dist));
            }
            el.style.opacity = String(presence);
            el.style.transform = `translateY(${(1 - presence) * 30}px)`;
          });

          const ctaProgress = Math.min(1, Math.max(0, (progress - 0.72) / 0.24));
          if (ctaWrapRef.current) {
            ctaWrapRef.current.style.opacity = String(ctaProgress);
            ctaWrapRef.current.style.transform = `translateY(${(1 - ctaProgress) * 24}px)`;
          }
        };

        applyProgress(0);

        ScrollTrigger.create({
          trigger: sectionRef.current,
          start: "top top",
          end: "+=1800",
          pin: pinRef.current,
          scrub: 0.4,
          onUpdate: (self) => applyProgress(self.progress),
        });
      });

      return () => mm.revert();
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section id="enter" ref={sectionRef} className="final-cta">
      <div ref={pinRef} className="final-cta-pin">
        <div className="final-cta-stack">
          {HEADLINES.map((h, i) => (
            <div
              key={h}
              ref={(el) => {
                headlineRefs.current[i] = el;
              }}
              className="final-cta-headline"
            >
              {h}
            </div>
          ))}
        </div>

        <div ref={ctaWrapRef} className="final-cta-actions">
          <a href={participantUrl} className="final-cta-button">
            Enter The Game
          </a>
          <p>Your role is waiting.</p>
        </div>
      </div>
    </section>
  );
}