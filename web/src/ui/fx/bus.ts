// The reactions (design.md §8): anything can ask for one, the overlays in App draw them.

export type ToastKind = "win" | "loss" | "info" | "danger";

export type Fx =
  | { type: "toast"; kind: ToastKind; title: string; body?: string }
  | { type: "confetti"; amount: "some" | "lots" }
  | { type: "shake" }
  | { type: "rekt"; headline: string; detail: string; roast: string };

type Listener = (fx: Fx) => void;
const listeners = new Set<Listener>();

export function onFx(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function fx(effect: Fx): void {
  for (const listener of listeners) listener(effect);
}

export function toast(kind: ToastKind, title: string, body?: string): void {
  fx({ type: "toast", kind, title, body });
}

/** Whether the visitor asked for less motion: no shaking, confetti or count-ups. */
export function reducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
