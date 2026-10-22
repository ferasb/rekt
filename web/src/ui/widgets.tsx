import { useEffect, useRef, useState } from "react";
import { money, signedMoney, signedPercent } from "../game/format";
import { reducedMotion } from "./fx/bus";

/** A number that counts toward its value instead of jumping (design.md §8). */
export function useCountUp(value: number, duration = 600): number {
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  const shownRef = useRef(value);
  useEffect(() => {
    if (reducedMotion() || Math.abs(value - shownRef.current) < 0.005) {
      shownRef.current = value;
      setShown(value);
      return;
    }
    from.current = shownRef.current;
    const start = performance.now();
    let frame = 0;
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - (1 - t) ** 3;
      shownRef.current = from.current + (value - from.current) * eased;
      setShown(shownRef.current);
      if (t < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [value, duration]);
  return shown;
}

/** "up", "down" or "": which way a value last moved, for a flash that fades (styles.css). */
export function useFlash(value: number | undefined): string {
  const previous = useRef(value);
  const [flash, setFlash] = useState<{ dir: string; key: number }>({ dir: "", key: 0 });
  useEffect(() => {
    const was = previous.current;
    previous.current = value;
    if (was === undefined || value === undefined || was === value) return;
    setFlash((f) => ({ dir: value > was ? "flash-up" : "flash-down", key: f.key + 1 }));
    const timer = setTimeout(() => setFlash((f) => ({ ...f, dir: "" })), 700);
    return () => clearTimeout(timer);
  }, [value]);
  return flash.dir;
}

/** Profit or loss, in dollars (value) or as a fraction: ▲ or ▼ and the sign, colored, never color alone. */
export function Pnl({ value, fraction }: { value?: number; fraction?: number }) {
  const v = value ?? fraction ?? 0;
  // What still rounds to zero: half a cent, or half of 0.01%.
  const zero = value !== undefined ? 0.005 : 0.00005;
  const dir = v > zero ? "up" : v < -zero ? "down" : "flat";
  return (
    <span className={`pnl ${dir}`}>
      <span aria-hidden="true">{dir === "up" ? "▲ " : dir === "down" ? "▼ " : ""}</span>
      {value !== undefined ? signedMoney(value) : signedPercent(v)}
    </span>
  );
}

/** A dollar input with a $ in front, and quick picks below. */
export function MoneyInput({
  id,
  label,
  value,
  onChange,
  presets,
}: {
  id: string;
  label: string;
  value: string;
  onChange(value: string): void;
  presets: { label: string; value: number }[];
}) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div className="money-input">
        <span aria-hidden="true">$</span>
        <input id={id} inputMode="decimal" autoComplete="off" value={value} onChange={(e) => onChange(e.target.value.replace(/[^0-9.]/g, ""))} />
      </div>
      <div className="presets">
        {presets.map((p) => (
          <button key={p.label} type="button" className="chip" onClick={() => onChange(p.value > 0 ? (Math.floor(p.value * 100) / 100).toFixed(2) : "")}>
            {p.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function Money({ value }: { value: number }) {
  return <>{money(value)}</>;
}
