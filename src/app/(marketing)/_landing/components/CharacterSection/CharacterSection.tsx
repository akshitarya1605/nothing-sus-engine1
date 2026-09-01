"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { gsap, ScrollTrigger } from "../../lib/gsap";
import { CrewmateScene } from "../../three/CrewmateScene";
import "./CharacterSection.css";

const CAPTIONS = ["Everyone has a role.", "Engineer.", "Impostor."];

const isMobileViewport = () => window.innerWidth < 768;

export function CharacterSection() {
  const sectionRef = useRef<HTMLElement | null>(null);
  const pinRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const groupRef = useRef<THREE.Group | null>(null);
  const captionRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [lowQuality] = useState(() => isMobileViewport());

  useEffect(() => {
    const ctx = gsap.context(() => {
      const mm = gsap.matchMedia();

      mm.add(
        {
          isReduced: "(prefers-reduced-motion: reduce)",
          isMobile: "(max-width: 767px)",
        },
        (context) => {
          const { isReduced, isMobile } = context.conditions as {
            isReduced: boolean;
            isMobile: boolean;
          };

          if (isReduced) {
            gsap.fromTo(
              stageRef.current,
              { opacity: 0, scale: 0.92 },
              {
                opacity: 1,
                scale: 1,
                duration: 0.9,
                ease: "power2.out",
                scrollTrigger: { trigger: sectionRef.current, start: "top 70%" },
              },
            );
            captionRefs.current.forEach((el) => el && gsap.set(el, { opacity: 1, y: 0 }));
            return;
          }

          const scrollDistance = isMobile ? 1600 : 2400;

          const applyProgress = (progress: number) => {
            if (groupRef.current) {
              groupRef.current.rotation.y = progress * Math.PI * 2;
              groupRef.current.rotation.x = Math.sin(progress * Math.PI * 2) * 0.03;
            }

            // emergence: fade/scale in over the first 12%, fade out over the last 12%
            const inFactor = Math.min(1, progress / 0.12);
            const outFactor = Math.min(1, (1 - progress) / 0.12);
            const presence = Math.min(inFactor, outFactor);
            gsap.set(stageRef.current, {
              opacity: presence,
              scale: 0.82 + presence * 0.18,
              filter: `blur(${(1 - presence) * 10}px)`,
            });

            const windowFor = (center: number) => {
              const half = 0.16;
              return Math.max(0, 1 - Math.abs(progress - center) / half);
            };
            const centers = [0.14, 0.5, 0.86];
            captionRefs.current.forEach((el, i) => {
              if (!el) return;
              const op = windowFor(centers[i]);
              el.style.opacity = String(op);
              el.style.transform = `translateY(${(1 - op) * 14}px)`;
            });
          };

          applyProgress(0);

          ScrollTrigger.create({
            trigger: sectionRef.current,
            start: "top top",
            end: `+=${scrollDistance}`,
            pin: pinRef.current,
            scrub: 0.5,
            onUpdate: (self) => applyProgress(self.progress),
          });
        },
      );

      return () => mm.revert();
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section id="character" ref={sectionRef} className="character-section">
      <div ref={pinRef} className="character-pin">
        <div className="character-atmosphere" />
        <div className="character-ring" />

        <div ref={stageRef} className="character-stage">
          <CrewmateScene groupRef={groupRef} lowQuality={lowQuality} />
        </div>

        <div className="character-captions">
          {CAPTIONS.map((c, i) => (
            <div
              key={c}
              ref={(el) => {
                captionRefs.current[i] = el;
              }}
              className="character-caption"
            >
              {c}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}