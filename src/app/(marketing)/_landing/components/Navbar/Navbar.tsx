"use client";

import { useEffect, useRef, useState } from "react";
import "./Navbar.css";

const LINKS = [
  { id: "story", label: "Game Story" },
  { id: "character", label: "How It Works" },
];

interface NavbarProps {
  onOpenGameConsole: () => void;
  onOpenAccountModal: () => void;
  userAccount: { name: string; collegeRegId: string } | null;
}

export function Navbar({ onOpenGameConsole, onOpenAccountModal, userAccount }: NavbarProps) {
  const navRef = useRef<HTMLElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      setVisible(window.scrollY > window.innerHeight * 0.4);
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
      <div className="flex items-center gap-3">
        <a
          className="navbar-brand font-display font-black text-yellow text-lg uppercase"
          href="#hero"
          onClick={(e) => {
            e.preventDefault();
            scrollTo("hero");
          }}
        >
          NOTHING SUS
        </a>
        <span className="hidden sm:inline font-mono text-[10px] text-cyan font-bold uppercase tracking-widest border-l border-cyan/30 pl-3">
          ISA MUJ CHAPTER
        </span>
      </div>
      <ul className="navbar-links flex items-center gap-4">
        {LINKS.map((link) => (
          <li key={link.id}>
            <button type="button" onClick={() => scrollTo(link.id)}>
              {link.label}
            </button>
          </li>
        ))}
        <li>
          <a
            href="https://www.instagram.com/isa_muj_chapter?stkn=MWFlMTNuMW10YmZ3Yg=="
            target="_blank"
            rel="noopener noreferrer"
            className="navbar-link text-xs text-pink-400 font-bold hover:text-pink-300"
          >
            ISA Instagram
          </a>
        </li>
        <li>
          <a
            href="/control"
            className="text-xs font-mono text-zinc-400 hover:text-zinc-200"
          >
            Host Portal
          </a>
        </li>
        <li>
          {userAccount ? (
            <a
              href="/player"
              className="font-mono text-xs font-bold text-yellow border border-yellow/30 bg-yellow/10 px-3 py-1 rounded-full hover:bg-yellow/20 transition-colors"
            >
              My Account ({userAccount.name.split(" ")[0]})
            </a>
          ) : (
            <div className="flex items-center gap-2">
              <a
                href="/login"
                className="font-mono text-xs font-bold text-zinc-300 hover:text-white px-2 py-1"
              >
                Login
              </a>
              <a
                href="/register"
                className="font-mono text-xs font-bold text-cyan border border-cyan/30 bg-cyan/10 px-3 py-1 rounded-full hover:bg-cyan/20 transition-colors"
              >
                Register
              </a>
            </div>
          )}
        </li>
        <li>
          <a
            href="/join"
            className="navbar-enter font-display font-bold uppercase inline-block text-center"
          >
            Join Game
          </a>
        </li>
      </ul>
    </nav>
  );
}