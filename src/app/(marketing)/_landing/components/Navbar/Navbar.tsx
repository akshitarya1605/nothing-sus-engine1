"use client";

import { useEffect, useRef, useState } from "react";
import "./Navbar.css";

const LINKS = [
  { id: "story", label: "Game" },
  { id: "character", label: "How It Works" },
];

interface NavbarProps {
  participantUrl: string;
}

export function Navbar({ participantUrl }: NavbarProps) {
  const navRef = useRef<HTMLElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      setVisible(window.scrollY > window.innerHeight * 0.6);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <nav ref={navRef} className={`navbar${visible ? " is-visible" : ""}`}>
      <a
        className="navbar-brand"
        href="#hero"
        onClick={(e) => {
          e.preventDefault();
          scrollTo("hero");
        }}
      >
        NOTHING SUS
      </a>
      <ul className="navbar-links">
        {LINKS.map((link) => (
          <li key={link.id}>
            <button type="button" onClick={() => scrollTo(link.id)}>
              {link.label}
            </button>
          </li>
        ))}
        <li>
          <a className="navbar-enter" href={participantUrl}>
            Enter
          </a>
        </li>
      </ul>
    </nav>
  );
}