import "@fontsource/bungee/latin-400.css";
import "./theme.css";
import "./tokens.css";
import "./styles.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./ui/App";
import { startEngine } from "./ui/engine";

startEngine();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
