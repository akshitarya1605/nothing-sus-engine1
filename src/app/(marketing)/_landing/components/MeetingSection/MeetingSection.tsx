"use client";

import { useEffect, useRef } from "react";
import { gsap, ScrollTrigger } from "../../lib/gsap";
import "./MeetingSection.css";

const PLAYER_COLORS = ["#e2313d", "#3fe8e0", "#ffd93f", "#4be36b", "#c58bf2", "#ff8f3f", "#5a6070", "#f28ec9"];

export function MeetingSection() {
  const sectionRef = useRef<HTMLElement | null>(null);
  const pinRef = useRef<HTMLDivElement | null>(null);
  const alertRef = useRef<HTMLDivElement | null>(null);
  const questionRef = useRef<HTMLDivElement | null>(null);
  const avatarsRef = useRef<HTMLDivElement | null>(null);
  const darkenRef = useRef<HTMLDivElement | null>(null);
  const avatarRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const ctx = gsap.context(() => {
      const mm = gsap.matchMedia();

      mm.add({ isReduced: "(prefers-reduced-motion: reduce)" }, (context) => {
        const { isReduced } = context.conditions as { isReduced: boolean };

        if (isReduced) {
          gsap.set(alertRef.current, { opacity: 1, scale: 1 });
          gsap.set(questionRef.current, { opacity: 1, y: 0 });
          gsap.set(avatarsRef.current, { opacity: 1 });
          return;
        }

        const applyProgress = (progress: number) => {
          const alertOp = Math.max(0, 1 - Math.abs(progress - 0.18) / 0.18);
          const questionOp = Math.max(0, 1 - Math.abs(progress - 0.55) / 0.2);
          const darken = progress > 0.82 ? (progress - 0.82) / 0.18 : 0;

          gsap.set(alertRef.current, {
            opacity: alertOp,
            scale: 0.9 + alertOp * 0.1,
          });
          gsap.set(questionRef.current, {
            opacity: questionOp,
            y: (1 - questionOp) * 20,
          });
          if (avatarsRef.current) avatarsRef.current.style.opacity = String(questionOp);
          avatarRefs.current.forEach((el, i) => {
            if (!el) return;
            const delay = i * 0.02;
            const localOp = Math.max(0, Math.min(1, (questionOp - delay) * 2));
            el.style.opacity = String(localOp);
            el.style.transform = `translateY(${(1 - localOp) * 16}px)`;
          });
          if (darkenRef.current) darkenRef.current.style.opacity = String(darken);
        };

        applyProgress(0);

        ScrollTrigger.create({
          trigger: sectionRef.current,
          start: "top top",
          end: "+=1800",
          pin: pinRef.current,
          scrub: 0.5,
          onUpdate: (self) => applyProgress(self.progress),
        });
      });

      return () => mm.revert();
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section id="meeting" ref={sectionRef} className="meeting-section">
      <div ref={pinRef} className="meeting-pin">
        <div className="meeting-pulse-ring r1" />
        <div className="meeting-pulse-ring r2" />
        <div className="meeting-pulse-ring r3" />

        <div ref={alertRef} className="meeting-alert">
          <span>Emergency</span>
          <span>Meeting</span>
        </div>

        <div ref={questionRef} className="meeting-question">
          Who is sus?
        </div>

        <div ref={avatarsRef} className="meeting-avatars">
          {PLAYER_COLORS.map((c, i) => (
            <div
              key={c}
              ref={(el) => {
                avatarRefs.current[i] = el;
              }}
              className="meeting-avatar"
              style={{ background: c }}
            />
          ))}
        </div>

        <div ref={darkenRef} className="meeting-darken" />
      </div>
    </section>
  );
}