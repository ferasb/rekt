import { useEffect, useRef, useState } from "react";
import { onFx, reducedMotion, type Fx, type ToastKind } from "./bus";

interface ToastItem {
  id: number;
  kind: ToastKind;
  title: string;
  body?: string;
}

const TOAST_MS = 5000;
const MAX_TOASTS = 4;

function Toasts() {
  const [items, setItems] = useState<ToastItem[]>([]);
  useEffect(() => {
    let next = 0;
    return onFx((e) => {
      if (e.type !== "toast") return;
      const item = { id: next++, kind: e.kind, title: e.title, body: e.body };
      setItems((list) => [...list, item].slice(-MAX_TOASTS));
      setTimeout(() => setItems((list) => list.filter((t) => t.id !== item.id)), TOAST_MS);
    });
  }, []);
  return (
    <div className="toasts" role="status" aria-live="polite">
      {items.map((t) => (
        <div key={t.id} className={`toast ${t.kind}`}>
          <strong>{t.title}</strong>
          {t.body && <span>{t.body}</span>}
        </div>
      ))}
    </div>
  );
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rotation: number;
  spin: number;
  size: number;
  color: string;
  shape: "rect" | "coin";
}

/** Confetti and coins on a canvas over everything. Nothing with reduced motion. */
function Confetti() {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let particles: Particle[] = [];
    let frame = 0;
    const draw = () => {
      const c = canvas.current;
      const ctx = c?.getContext("2d");
      if (!c || !ctx) return;
      ctx.clearRect(0, 0, c.width, c.height);
      for (const p of particles) {
        p.vy += 0.25;
        p.vx *= 0.99;
        p.x += p.vx;
        p.y += p.vy;
        p.rotation += p.spin;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        ctx.fillStyle = p.color;
        if (p.shape === "coin") {
          ctx.beginPath();
          ctx.ellipse(0, 0, p.size, p.size * Math.abs(Math.cos(p.rotation)), 0, 0, 2 * Math.PI);
          ctx.fill();
        } else {
          ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        }
        ctx.restore();
      }
      particles = particles.filter((p) => p.y < c.height + 40);
      frame = particles.length ? requestAnimationFrame(draw) : 0;
    };
    return onFx((e: Fx) => {
      if (e.type !== "confetti" || reducedMotion()) return;
      const c = canvas.current;
      if (!c) return;
      const ratio = window.devicePixelRatio || 1;
      c.width = window.innerWidth * ratio;
      c.height = window.innerHeight * ratio;
      const style = getComputedStyle(document.documentElement);
      const colors = ["--accent-1", "--accent-2", "--accent-3", "--accent-4", "--accent-5"].map((v) => style.getPropertyValue(v).trim());
      // light-dark() isn't a canvas color: resolve each through a probe.
      const probe = document.createElement("span");
      document.body.appendChild(probe);
      const resolved = colors.map((v) => {
        probe.style.color = v;
        return getComputedStyle(probe).color;
      });
      probe.remove();
      const count = e.amount === "lots" ? 220 : 90;
      for (let i = 0; i < count; i++) {
        const fromLeft = i % 2 === 0;
        particles.push({
          x: (fromLeft ? 0.1 : 0.9) * c.width,
          y: c.height * 0.85,
          vx: (fromLeft ? 1 : -1) * (4 + Math.random() * 10) * ratio,
          vy: -(12 + Math.random() * 14) * ratio,
          rotation: Math.random() * Math.PI,
          spin: (Math.random() - 0.5) * 0.3,
          size: (6 + Math.random() * 8) * ratio,
          color: i % 7 === 0 ? resolved[2] : resolved[i % resolved.length], // coins in amber
          shape: i % 7 === 0 ? "coin" : "rect",
        });
      }
      if (!frame) frame = requestAnimationFrame(draw);
    });
  }, []);
  return <canvas ref={canvas} className="confetti" aria-hidden="true" />;
}

/** The liquidation: a full-screen REKT, a roast, and a button to get back to it. */
function Rekt() {
  const [shown, setShown] = useState<Extract<Fx, { type: "rekt" }> | null>(null);
  const button = useRef<HTMLButtonElement>(null);
  useEffect(
    () =>
      onFx((e) => {
        if (e.type === "rekt") setShown(e);
        if (e.type === "shake") {
          document.body.classList.remove("shake");
          void document.body.offsetWidth;
          document.body.classList.add("shake");
          setTimeout(() => document.body.classList.remove("shake"), 700);
        }
      }),
    [],
  );
  useEffect(() => {
    if (!shown) return;
    button.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setShown(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [shown]);
  if (!shown) return null;
  return (
    <div className="rekt-overlay" role="alertdialog" aria-modal="true" aria-labelledby="rekt-title" aria-describedby="rekt-detail" onClick={() => setShown(null)}>
      <div className="rekt-card" onClick={(e) => e.stopPropagation()}>
        <div className="rekt-skull" aria-hidden="true">
          💀
        </div>
        <h2 id="rekt-title" className="rekt-title" data-text={shown.headline}>
          {shown.headline}
        </h2>
        <p id="rekt-detail">{shown.detail}</p>
        <p className="roast">“{shown.roast}”</p>
        <button ref={button} type="button" className="go" onClick={() => setShown(null)}>
          I've learned nothing
        </button>
      </div>
    </div>
  );
}

export function Effects() {
  return (
    <>
      <Confetti />
      <Toasts />
      <Rekt />
    </>
  );
}
