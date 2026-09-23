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
import { IsaHeader } from "@/components/ui/IsaHeader";
import { StudentAuthModal } from "@/components/auth/StudentAuthModal";
import { IntegratedGameModal } from "@/components/game/IntegratedGameModal";
import "./landing-app.css";

const CharacterSection = dynamic(
  () => import("./components/CharacterSection/CharacterSection").then((m) => m.CharacterSection),
  { ssr: false, loading: () => <div className="character-section-fallback" /> },
);
const IntroAnimation = dynamic(
  () => import("./components/IntroAnimation/IntroAnimation").then((m) => m.IntroAnimation),
  { ssr: false },
);

const INTRO_SEEN_KEY = "nothingSusIntroSeen";

type Phase = "intro" | "site";

interface UserAccount {
  name: string;
  collegeRegId: string;
  code: string;
}

ensureGsapRegistered();

export function LandingApp() {
  const reducedMotion = usePrefersReducedMotion();
  const starFieldRef = useRef<StarFieldHandle | null>(null);
  const [siteVisible, setSiteVisible] = useState(false);
  const [userAccount, setUserAccount] = useState<UserAccount | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showGameModal, setShowGameModal] = useState(false);

  const [phase, setPhase] = useState<Phase>("site");

  useEffect(() => {
    try {
      const saved = localStorage.getItem("isa_student_account");
      if (saved) {
        setUserAccount(JSON.parse(saved));
      } else {
        // Student prompt to register / log in before entering match
        const timer = setTimeout(() => setShowAuthModal(true), 1200);
        return () => clearTimeout(timer);
      }
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

  const handleAccountCreated = (acc: UserAccount) => {
    setUserAccount(acc);
    try {
      localStorage.setItem("isa_student_account", JSON.stringify(acc));
    } catch {
      /* ignore */
    }
  };

  const handleOpenGameConsole = () => {
    if (!userAccount) {
      setShowAuthModal(true);
    } else {
      setShowGameModal(true);
    }
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
          <IsaHeader />
          <Navbar
            onOpenGameConsole={handleOpenGameConsole}
            onOpenAccountModal={() => setShowAuthModal(true)}
            userAccount={userAccount}
          />
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

          <FinalCTA participantUrl="/join" />

          <Footer />

          {/* Student Auth Modal */}
          <StudentAuthModal
            open={showAuthModal}
            onClose={() => setShowAuthModal(false)}
            onAccountCreated={handleAccountCreated}
            currentAccount={userAccount}
          />

          {/* Integrated Game Console Modal */}
          <IntegratedGameModal
            open={showGameModal}
            onClose={() => setShowGameModal(false)}
            userAccount={userAccount}
          />
        </div>
      )}
    </div>
  );
}
