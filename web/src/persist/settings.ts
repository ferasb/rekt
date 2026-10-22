// The visitor's settings: the theme and the sound, in localStorage so they hold in every tab.
// public/theme-init.js reads the theme key before the first paint.

export type Theme = "light" | "dark";

const THEME_KEY = "rekt:theme";
const SOUND_KEY = "rekt:sound";

/** The theme the visitor picked, or null if they haven't: then the system's applies. */
export function loadTheme(): Theme | null {
  try {
    const value = localStorage.getItem(THEME_KEY);
    return value === "light" || value === "dark" ? value : null;
  } catch {
    return null;
  }
}

export function saveTheme(theme: Theme): void {
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    // Storage full or blocked: the pick lasts until the tab closes.
  }
}

/** Calls back when another tab picks a theme. */
export function onThemeChangedElsewhere(callback: (theme: Theme | null) => void): void {
  window.addEventListener("storage", (e) => {
    if (e.key === THEME_KEY) {
      callback(loadTheme());
    }
  });
}

/** Sound is on unless the visitor muted it. */
export function loadSound(): boolean {
  try {
    return localStorage.getItem(SOUND_KEY) !== "off";
  } catch {
    return true;
  }
}

export function saveSound(on: boolean): void {
  try {
    localStorage.setItem(SOUND_KEY, on ? "on" : "off");
  } catch {
    // Storage blocked: the choice lasts until the tab closes.
  }
}
