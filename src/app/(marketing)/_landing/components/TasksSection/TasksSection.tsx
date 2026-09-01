"use client";

import { useEffect, useRef } from "react";
import { gsap, ScrollTrigger } from "../../lib/gsap";
import "./TasksSection.css";

const STATES = ["Locked", "Available", "In Progress", "Completed"];

export function TasksSection() {
  const sectionRef = useRef<HTMLElement | null>(null);
  const pinRef = useRef<HTMLDivElement | null>(null);
  const fillRef = useRef<HTMLDivElement | null>(null);
  const stateRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const barWrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      const mm = gsap.matchMedia();

      mm.add({ isReduced: "(prefers-reduced-motion: reduce)" }, (context) => {
        const { isReduced } = context.conditions as { isReduced: boolean };

        if (isReduced) {
          gsap.set(fillRef.current, { width: "100%" });
          stateRefs.current.forEach((el) => el?.classList.add("is-hit"));
          stateRefs.current[3]?.classList.add("is-active");
          return;
        }

        const applyProgress = (progress: number) => {
          if (fillRef.current) fillRef.current.style.width = `${progress * 100}%`;
          const activeIndex = Math.min(STATES.length - 1, Math.floor(progress * STATES.length));
          stateRefs.current.forEach((el, i) => {
            if (!el) return;
            el.classList.toggle("is-hit", i <= activeIndex);
            el.classList.toggle("is-active", i === activeIndex);
          });
        };

        applyProgress(0);

        ScrollTrigger.create({
          trigger: sectionRef.current,
          start: "top top",
          end: "+=1400",
          pin: pinRef.current,
          scrub: 0.4,
          onUpdate: (self) => applyProgress(self.progress),
        });

        gsap.from(barWrapRef.current, {
          opacity: 0,
          y: 30,
          duration: 0.8,
          ease: "power2.out",
          scrollTrigger: { trigger: sectionRef.current, start: "top 70%" },
        });
      });

      return () => mm.revert();
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section id="tasks" ref={sectionRef} className="tasks-section">
      <div ref={pinRef} className="tasks-pin">
        <div className="tasks-index">Task 07</div>
        <h2 className="tasks-title">Sensor Calibration</h2>
        <div className="tasks-location">LHC 209</div>

        <div ref={barWrapRef} className="tasks-bar-wrap">
          <div className="tasks-bar">
            <div ref={fillRef} className="tasks-bar-fill" />
          </div>
          <div className="tasks-states">
            {STATES.map((s, i) => (
              <span
                key={s}
                ref={(el) => {
                  stateRefs.current[i] = el;
                }}
                className="tasks-state"
              >
                {s}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}