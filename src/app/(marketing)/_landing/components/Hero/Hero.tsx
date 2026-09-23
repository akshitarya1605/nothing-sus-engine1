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
        <div className="hero-eyebrow font-display text-xs font-bold uppercase tracking-widest text-cyan">
          ISA — INTERNATIONAL SOCIETY OF AUTOMATION | MANIPAL UNIVERSITY JAIPUR
        </div>
        <h1 className="hero-title">
          <span>Nothing</span>
          <span className="accent">Sus</span>
        </h1>
        <p className="hero-desc">
          Presented by the ISA Student Chapter at Manipal University Jaipur. A live campus event of real-world tasks, trust, deception and social deduction.
        </p>
        <div className="hero-actions flex flex-wrap items-center justify-center gap-3">
          <a href="/join" className="hero-cta font-bold">
            Enter Game Room
          </a>
          <a href="/register" className="hero-cta-ghost font-bold text-cyan border border-cyan/40">
            Register Account
          </a>
          <a href="/login" className="hero-cta-ghost font-bold text-zinc-300 border border-zinc-700 hover:text-white">
            Login
          </a>
          <a
            href="https://www.instagram.com/isa_muj_chapter?stkn=MWFlMTNuMW10YmZ3Yg=="
            target="_blank"
            rel="noopener noreferrer"
            className="hero-cta-ghost font-bold text-pink-400 border border-pink-500/30"
          >
            Instagram: @isa_muj_chapter
          </a>
        </div>
      </div>

      <div className="hero-scroll-indicator">
        <span>Scroll</span>
        <div className="hero-scroll-line" />
      </div>
    </section>
  );
}