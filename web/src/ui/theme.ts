import { create } from "zustand";
import { loadTheme, onThemeChangedElsewhere, saveTheme, type Theme } from "../persist/settings";

interface ThemeState {
  /** The colors in use: the visitor's pick, or the system's until they pick one. */
  theme: Theme;
  /** Switch to the other theme, and remember it. */
  toggle(): void;
}

const systemDark = window.matchMedia("(prefers-color-scheme: dark)");
let picked = loadTheme();

function current(): Theme {
  return picked ?? (systemDark.matches ? "dark" : "light");
}

/** theme.css reads data-theme on <html>; without it, the system's theme applies. */
function apply(): void {
  if (picked) {
    document.documentElement.dataset.theme = picked;
  } else {
    delete document.documentElement.dataset.theme;
  }
}

apply();

/** The color theme. data-theme changes before the state, so readers of the new state see the new colors. */
export const useTheme = create<ThemeState>((set) => ({
  theme: current(),
  toggle() {
    picked = current() === "dark" ? "light" : "dark";
    saveTheme(picked);
    apply();
    set({ theme: picked });
  },
}));

systemDark.addEventListener("change", () => useTheme.setState({ theme: current() }));
onThemeChangedElsewhere((theme) => {
  picked = theme;
  apply();
  useTheme.setState({ theme: current() });
});

let ctx: CanvasRenderingContext2D | null = null;
let probe: HTMLElement | null = null;

/**
 * A color token from the stylesheets as rgb(), for the charts' canvas. Tokens are light-dark() pairs
 * of oklch colors: a hidden element resolves the token for the current theme, and painting it on a
 * 1×1 canvas converts it to sRGB (as Bloch Sphere's palette.ts does).
 */
export function cssColor(name: string, alpha = 1): string {
  probe ??= document.body.appendChild(document.createElement("span"));
  probe.hidden = true;
  probe.style.color = `var(${name})`;
  ctx ??= document.createElement("canvas").getContext("2d", { willReadFrequently: true })!;
  ctx.canvas.width = ctx.canvas.height = 1;
  ctx.clearRect(0, 0, 1, 1);
  ctx.fillStyle = getComputedStyle(probe).color;
  ctx.fillRect(0, 0, 1, 1);
  const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
