import { useEffect, type RefObject } from "react";

/** What stays live behind a modal: the toasts (so they're still announced) and the confetti. */
const KEEP = ".toasts, .confetti";

/**
 * Makes an element modal while mounted, for overlays that aren't a native <dialog>: everything else
 * on the page is inert (no focus, clicks or keys reach it, and screen readers skip it), and focus
 * goes back to where it was when the overlay closes.
 */
export function useModal(ref: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const before = document.activeElement;
    const made: HTMLElement[] = [];
    for (let node: HTMLElement = el; node.parentElement && node !== document.body; node = node.parentElement) {
      for (const sibling of node.parentElement.children) {
        if (sibling === node || !(sibling instanceof HTMLElement) || sibling.inert || sibling.matches(KEEP)) continue;
        sibling.inert = true;
        made.push(sibling);
      }
    }
    return () => {
      for (const sibling of made) sibling.inert = false;
      if (before instanceof HTMLElement && before.isConnected) before.focus({ preventScroll: true });
    };
  }, [ref]);
}
