"use client";

import { useEffect, useMemo, useRef } from "react";
import { gsap } from "../../lib/gsap";
import { sampleTextPoints } from "../../utils/textParticles";
import type { StarFieldHandle } from "../StarField/StarField";
import "./IntroAnimation.css";

const TITLE = "NOTHING SUS";

function buildExtrusionShadow(): string {
  const layers: string[] = [];
  const depth = 11;
  for (let i = 1; i <= depth; i++) {
    layers.push(`${i * 0.6}px ${i * 0.6}px 0 var(--c-red-deep)`);
  }
  layers.push("0 18px 40px rgba(0,0,0,0.55)");
  layers.push("0 0 55px rgba(255,77,94,0.35)");
  return layers.join(", ");
}

interface IntroAnimationProps {
  starFieldRef: React.RefObject<StarFieldHandle | null>;
  reducedMotion: boolean;
  onDone: () => void;
}

export function IntroAnimation({ starFieldRef, reducedMotion, onDone }: IntroAnimationProps) {
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const titleWrapRef = useRef<HTMLDivElement | null>(null);
  const titleRef = useRef<HTMLHeadingElement | null>(null);
  const subRef = useRef<HTMLDivElement | null>(null);
  const letterRefs = useRef<(HTMLSpanElement | null)[]>([]);

  const extrusionShadow = useMemo(() => buildExtrusionShadow(), []);
  const letters = useMemo(() => TITLE.split(""), []);

  useEffect(() => {
    letterRefs.current = letterRefs.current.slice(0, letters.length);

    const ctx = gsap.context(() => {
      const validLetters = letterRefs.current.filter(Boolean) as HTMLSpanElement[];

      gsap.set(overlayRef.current, { opacity: 1 });
      gsap.set(validLetters, {
        opacity: 0,
        y: 40,
        rotateX: -70,
        filter: "blur(6px)",
        transformOrigin: "50% 100%",
      });
      gsap.set(subRef.current, { opacity: 0, y: 8 });

      const tl = gsap.timeline({
        delay: 0.15,
        onComplete: onDone,
      });

      // ambient star atmosphere begins immediately, subtle
      tl.call(() => starFieldRef.current?.seedAmbient(reducedMotion ? 40 : undefined), [], 0.05);

      if (reducedMotion) {
        tl.to(validLetters, { opacity: 1, y: 0, rotateX: 0, filter: "blur(0px)", duration: 0.5, ease: "power2.out" }, 0.1);
        tl.to(subRef.current, { opacity: 1, y: 0, duration: 0.4 }, 0.3);
        tl.to({}, { duration: 0.6 });
        tl.to([validLetters, subRef.current], { opacity: 0, duration: 0.45, ease: "power1.in" }, ">");
        tl.to(overlayRef.current, { backgroundColor: "rgba(5,5,8,0)", duration: 0.5 }, "<");
        return;
      }

      // entrance
      tl.to(
        validLetters,
        {
          opacity: 1,
          y: 0,
          rotateX: 0,
          filter: "blur(0px)",
          duration: 1.15,
          ease: "power3.out",
          stagger: { each: 0.045, from: "center" },
        },
        0.15,
      );
      tl.to(subRef.current, { opacity: 1, y: 0, duration: 0.7, ease: "power2.out" }, "-=0.4");

      // subtle idle float while held on screen — built directly as a
      // timeline child (tl.to), not gsap.to()+tl.add(). The latter starts
      // the tween playing immediately on GSAP's global timeline the
      // instant it's created, then reparents it into `tl` after the fact;
      // that desyncs the timeline's position bookkeeping for this child
      // and was silently stalling the whole timeline right here — the
      // entrance played, the float settled, and nothing after it (the
      // hold, the break-apart burst, onComplete/onDone) ever ran, so the
      // intro never handed off to the real site. tl.to() returns the same
      // kind of tween instance (still .kill()-able below), just correctly
      // owned by the timeline from the start.
      const floatTween = tl.to(
        titleWrapRef.current,
        {
          y: -8,
          rotateX: 2,
          duration: 2.1,
          ease: "sine.inOut",
          yoyo: true,
          repeat: 1,
        },
        "<+=0.2",
      );

      tl.to({}, { duration: 0.5 }); // hold

      // break apart
      tl.call(() => {
        floatTween.kill();
        const rect = titleRef.current?.getBoundingClientRect();
        if (!rect) return;
        const points = sampleTextPoints({
          text: TITLE,
          rect: { left: rect.left, top: rect.top, width: rect.width, height: rect.height },
          fontFamily: "Fredoka, Nunito, system-ui, sans-serif",
          fontWeight: 700,
          letterSpacing: 0,
          targetCount: window.innerWidth < 768 ? 180 : 460,
        });
        starFieldRef.current?.explode(points);
      });

      tl.to(
        validLetters,
        {
          opacity: 0,
          scale: 1.06,
          filter: "blur(3px)",
          duration: 0.55,
          ease: "power2.in",
          stagger: { each: 0.012, from: "random" },
        },
        "<",
      );
      tl.to(subRef.current, { opacity: 0, duration: 0.35 }, "<");

      // reveal the settling star field behind
      tl.to(
        overlayRef.current,
        {
          backgroundColor: "rgba(5,5,8,0)",
          duration: 1.1,
          ease: "power2.out",
        },
        "-=0.1",
      );
    }, overlayRef);

    return () => ctx.revert();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div ref={overlayRef} className="intro-overlay" style={{ backgroundColor: "var(--bg-void)" }}>
      <div className="intro-vignette" />
      <div ref={titleWrapRef} className="intro-title-wrap">
        <h1 ref={titleRef} className="intro-title" style={{ textShadow: extrusionShadow }}>
          {letters.map((ch, i) => (
            <span
              key={`${ch}-${i}`}
              ref={(el) => {
                letterRefs.current[i] = el;
              }}
              className={`intro-letter${ch === " " ? " is-space" : ""}`}
            >
              {ch === " " ? " " : ch}
            </span>
          ))}
        </h1>
        <div ref={subRef} className="intro-sub">
          Trust No One
        </div>
      </div>
    </div>
  );
}