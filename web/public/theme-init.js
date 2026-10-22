// Applies the theme picked in the app (light or dark) before the page first paints. Without a pick,
// the system's applies and theme.css needs no help. The key matches src/persist/settings.ts.
try {
  const theme = localStorage.getItem("rekt:theme");
  if (theme === "light" || theme === "dark") {
    document.documentElement.dataset.theme = theme;
  }
} catch {
  // Storage blocked: the system's theme.
}
