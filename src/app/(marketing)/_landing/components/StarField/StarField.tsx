"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
} from "react";
import { gsap } from "../../lib/gsap";

type ParticleMode = "burst" | "settling" | "ambient";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  baseAlpha: number;
  alpha: number;
  twinkleSpeed: number;
  twinklePhase: number;
  mode: ParticleMode;
  delay: number;
  hue: number; // 0 = white/blue-white, 1 = warm red accent
}

export interface StarFieldHandle {
  /** Fade in a light ambient star field immediately (used when intro is skipped). */
  seedAmbient: (count?: number) => void;
  /** Burst particles outward from the given viewport-space points. */
  explode: (points: { x: number; y: number }[]) => void;
}

interface StarFieldProps {
  reducedMotion?: boolean;
}

const isMobileViewport = () => window.innerWidth < 768;

function makeSprite(): HTMLCanvasElement {
  const size = 24;
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const ctx = c.getContext("2d")!;
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.12, "rgba(255,255,255,0.95)");
  g.addColorStop(0.3, "rgba(255,255,255,0.28)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return c;
}

export const StarField = forwardRef<StarFieldHandle, StarFieldProps>(function StarField(
  { reducedMotion = false },
  ref,
) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const particlesRef = useRef<Particle[]>([]);
  const spriteRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number>(0);
  const sizeRef = useRef({ w: 0, h: 0, dpr: 1 });

  useImperativeHandle(ref, () => ({
    seedAmbient(count) {
      const target = count ?? (isMobileViewport() ? 45 : 100);
      spawnAmbient(target);
    },
    explode(points) {
      spawnBurst(points);
    },
  }));

  function spawnAmbient(count: number) {
    const { w, h } = sizeRef.current;
    const list = particlesRef.current;
    for (let i = 0; i < count; i++) {
      list.push({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.03,
        vy: (Math.random() - 0.5) * 0.03,
        r: Math.random() * 1.1 + 0.35,
        baseAlpha: Math.random() * 0.45 + 0.15,
        alpha: 0,
        twinkleSpeed: Math.random() * 0.02 + 0.005,
        twinklePhase: Math.random() * Math.PI * 2,
        mode: "ambient",
        delay: 0,
        hue: Math.random() < 0.08 ? 1 : 0,
      });
    }
  }

  function spawnBurst(points: { x: number; y: number }[]) {
    const list = particlesRef.current;
    const mobile = isMobileViewport();
    const perPoint = reducedMotion ? 0 : mobile ? 0.6 : 0.9;

    points.forEach((p, i) => {
      const n = Math.random() < (perPoint % 1) ? Math.ceil(perPoint) : Math.floor(perPoint);
      for (let k = 0; k < Math.max(n, reducedMotion ? 1 : 0); k++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = gsap.utils.random(0.8, 5.2);
        const settleDelay = gsap.utils.random(0, 0.9);
        list.push({
          x: p.x,
          y: p.y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - speed * 0.15,
          r: gsap.utils.random(0.35, 1.3),
          baseAlpha: gsap.utils.random(0.4, 0.85),
          alpha: 1,
          twinkleSpeed: Math.random() * 0.02 + 0.006,
          twinklePhase: Math.random() * Math.PI * 2,
          mode: "burst",
          delay: settleDelay + i * 0.00025,
          hue: Math.random() < 0.12 ? 1 : 0,
        });
      }
    });

    // cap total particle count for perf
    const cap = mobile ? 320 : 750;
    if (list.length > cap) {
      particlesRef.current = list.slice(list.length - cap);
    }
  }

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    spriteRef.current = makeSprite();

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = window.innerWidth;
      const h = window.innerHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      sizeRef.current = { w, h, dpr };
    };
    resize();
    window.addEventListener("resize", resize);

    let last = performance.now();
    const damping = 0.965;

    const tick = (now: number) => {
      rafRef.current = requestAnimationFrame(tick);
      const dt = Math.min(now - last, 48);
      last = now;
      const { w, h, dpr } = sizeRef.current;
      const sprite = spriteRef.current;
      if (!sprite) return;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      const list = particlesRef.current;
      const step = dt / 16.6667;

      for (let i = 0; i < list.length; i++) {
        const p = list[i];

        if (p.delay > 0) {
          p.delay -= dt / 1000;
        } else if (p.mode === "burst") {
          p.x += p.vx * step;
          p.y += p.vy * step;
          p.vx *= Math.pow(damping, step);
          p.vy *= Math.pow(damping, step);
          p.vy += 0.006 * step; // slight gravity settle
          const speed = Math.hypot(p.vx, p.vy);
          if (speed < 0.06) {
            p.mode = "ambient";
            p.vx = (Math.random() - 0.5) * 0.03;
            p.vy = (Math.random() - 0.5) * 0.03;
          }
        } else {
          p.x += p.vx * step;
          p.y += p.vy * step;
        }

        p.twinklePhase += p.twinkleSpeed * step;
        const twinkle = reducedMotion ? 1 : 0.55 + Math.sin(p.twinklePhase) * 0.45;
        const targetAlpha = p.baseAlpha * twinkle;
        p.alpha += (targetAlpha - p.alpha) * Math.min(1, 0.08 * step);

        if (p.x < -50 || p.x > w + 50 || p.y < -50 || p.y > h + 50) {
          if (p.mode !== "burst") {
            p.x = Math.random() * w;
            p.y = Math.random() * h;
          }
        }

        const size = sprite.width * (p.r / 5.5);
        ctx.globalAlpha = Math.max(0, Math.min(1, p.alpha));
        if (p.hue === 1) {
          ctx.globalCompositeOperation = "lighter";
          ctx.filter = "hue-rotate(-30deg) saturate(3)";
        } else {
          ctx.filter = "none";
        }
        ctx.drawImage(sprite, p.x - size / 2, p.y - size / 2, size, size);
        ctx.filter = "none";
        ctx.globalCompositeOperation = "source-over";
      }
      ctx.globalAlpha = 1;
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize", resize);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reducedMotion]);

  return (
    <canvas
      ref={canvasRef}
      className="star-field-canvas"
      aria-hidden="true"
    />
  );
});