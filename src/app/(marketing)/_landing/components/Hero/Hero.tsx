"use client";

import { useEffect, useRef } from "react";
import { gsap } from "../../lib/gsap";
import "./Hero.css";

export function Hero() {
  const rootRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ delay: 0.15 });
      tl.to(".hero-eyebrow", { opacity: 1, duration: 0.6, ease: "power2.out" })
        .to(".hero-title", { opacity: 1, y: 0, duration: 0.9, ease: "power3.out" }, "-=0.3")
        .fromTo(
          ".hero-title span",
          { y: 26 },
          { y: 0, duration: 0.9, ease: "power3.out", stagger: 0.08 },
          "<",
        )
        .to(".hero-desc", { opacity: 1, y: 0, duration: 0.7, ease: "power2.out" }, "-=0.5")
        .to(".hero-actions", { opacity: 1, y: 0, duration: 0.6, ease: "power2.out" }, "-=0.45")
        .to(".hero-scroll-indicator", { opacity: 1, duration: 0.6 }, "-=0.3");

      gsap.set(".hero-title", { y: 14 });
    }, rootRef);

    return () => ctx.revert();
  }, []);

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <section id="hero" ref={rootRef} className="hero">
      <div className="hero-inner">
        <div className="hero-eyebrow">Season 01 · Live Now</div>
        <h1 className="hero-title">
          <span>Nothing</span>
          <span className="accent">Is Sus</span>
        </h1>
        <p className="hero-desc">
          A live game of tasks, trust, deception and deduction. Step into the ship —
          one of you isn't who they say they are.
        </p>
        <div className="hero-actions">
          <button type="button" className="hero-cta" onClick={() => scrollTo("enter")}>
            Enter The Game
          </button>
          <button type="button" className="hero-cta-ghost" onClick={() => scrollTo("story")}>
            Discover the game ↓
          </button>
        </div>
      </div>

      <div className="hero-scroll-indicator">
        <span>Scroll</span>
        <div className="hero-scroll-line" />
      </div>
    </section>
  );
}