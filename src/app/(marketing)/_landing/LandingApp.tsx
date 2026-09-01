"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Lenis from "lenis";
import { ensureGsapRegistered, gsap, ScrollTrigger } from "./lib/gsap";
import { usePrefersReducedMotion } from "./hooks/usePrefersReducedMotion";
import { StarField, type StarFieldHandle } from "./components/StarField/StarField";
import { Navbar } from "./components/Navbar/Navbar";
import { Hero } from "./components/Hero/Hero";
import { TextMorphSection } from "./components/TextMorphSection/TextMorphSection";
import { TasksSection } from "./components/TasksSection/TasksSection";
import { MeetingSection } from "./components/MeetingSection/MeetingSection";
import { FinalCTA } from "./components/FinalCTA/FinalCTA";
import { Footer } from "./components/Footer/Footer";
import "./landing-app.css";

// WebGL + canvas — client only, and kept out of the initial bundle.
const CharacterSection = dynamic(
  () => import("./components/CharacterSection/CharacterSection").then((m) => m.CharacterSection),
  { ssr: false, loading: () => <div className="character-section-fallback" /> },
);
const IntroAnimation = dynamic(
  () => import("./components/IntroAnimation/IntroAnimation").then((m) => m.IntroAnimation),
  { ssr: false },
);

const INTRO_SEEN_KEY = "nothingSusIntroSeen";
// Relative link — the participant console lives in this same app now.
const PARTICIPANT_URL = "/play";

type Phase = "intro" | "site";

ensureGsapRegistered();

export function LandingApp() {
  const reducedMotion = usePrefersReducedMotion();
  const starFieldRef = useRef<StarFieldHandle | null>(null);
  const [siteVisible, setSiteVisible] = useState(false);

  // Start in "intro" always on the server; correct to "site" on mount if
  // the intro has already been seen this session (avoids a hydration
  // mismatch on sessionStorage).
  const [phase, setPhase] = useState<Phase>("intro");
  useEffect(() => {
    try {
      if (sessionStorage.getItem(INTRO_SEEN_KEY)) setPhase("site");
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (phase === "site") {
      const id = requestAnimationFrame(() => setSiteVisible(true));
      const onLoad = () => ScrollTrigger.refresh();
      window.addEventListener("load", onLoad);
      return () => {
        cancelAnimationFrame(id);
        window.removeEventListener("load", onLoad);
      };
    }
  }, [phase]);

  // smooth scroll, kept in sync with ScrollTrigger
  useEffect(() => {
    if (phase !== "site" || reducedMotion) return;

    const lenis = new Lenis({ duration: 1.05, smoothWheel: true });
    lenis.on("scroll", ScrollTrigger.update);

    const tick = (time: number) => lenis.raf(time * 1000);
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);

    return () => {
      gsap.ticker.remove(tick);
      lenis.destroy();
    };
  }, [phase, reducedMotion]);

  const handleIntroDone = () => {
    try {
      sessionStorage.setItem(INTRO_SEEN_KEY, "1");
    } catch {
      /* ignore */
    }
    setPhase("site");
  };

  return (
    <div className="app-root">
      <StarField ref={starFieldRef} reducedMotion={reducedMotion} />

      {phase === "intro" && (
        <IntroAnimation
          starFieldRef={starFieldRef}
          reducedMotion={reducedMotion}
          onDone={handleIntroDone}
        />
      )}

      {phase === "site" && (
        <div className={`main-site${siteVisible ? " is-visible" : ""}`}>
          <Navbar participantUrl={PARTICIPANT_URL} />
          <Hero />

          <TextMorphSection
            id="story"
            lines={[
              { heading: "Everyone has a role." },
              { heading: "But someone", sub: "is lying.", accent: "red" },
            ]}
          />

          <CharacterSection />

          <TextMorphSection
            id="engineer-imposter"
            lines={[
              {
                heading: "Engineer.",
                sub: "Complete the tasks. Find the truth. Survive.",
                accent: "cyan",
              },
              {
                heading: "Imposter.",
                sub: "Blend in. Deceive. Survive.",
                accent: "red",
              },
            ]}
          />

          <TasksSection />

          <MeetingSection />

          <TextMorphSection
            id="vote"
            lines={[
              { heading: "Discuss." },
              { heading: "Suspect." },
              { heading: "Vote.", accent: "yellow" },
              { heading: "Reveal.", accent: "red" },
            ]}
            distancePerLine={700}
          />

          <FinalCTA participantUrl={PARTICIPANT_URL} />

          <Footer />
        </div>
      )}
    </div>
  );
}
