"use client";

import "./Footer.css";

export function Footer() {
  return (
    <footer className="footer">
      <div className="footer-inner">
        <div>
          <div className="footer-brand">
            <img src="/assets/among-us/crewmate-front.png" alt="" />
            NOTHING SUS
          </div>
          <p className="footer-tag">
            A live social deduction event. Tasks, trust, and one impostor in the room.
          </p>
        </div>
        <div className="footer-meta">
          <span>Season 01</span>
          <span>Crew Only</span>
          <span>Trust No One</span>
        </div>
      </div>
    </footer>
  );
}