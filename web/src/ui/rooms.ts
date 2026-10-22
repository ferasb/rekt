import { useEffect, useState } from "react";
import { DEFAULT_ASSET, isAssetId } from "../market/assets";

// Which room is open, from the URL hash: #trade, #updown.

export type Room = "trade" | "updown";

function parse(hash: string): Room {
  return hash.replace(/^#/, "").split("/")[0] === "updown" ? "updown" : "trade";
}

export function useRoom(): Room {
  const [state, setState] = useState(() => parse(location.hash));
  useEffect(() => {
    const update = () => setState(parse(location.hash));
    window.addEventListener("hashchange", update);
    return () => window.removeEventListener("hashchange", update);
  }, []);
  return state;
}

// The coin or stock picked last, shared by both rooms.
const ASSET_KEY = "rekt:asset";

export function loadAsset(): string {
  try {
    const value = localStorage.getItem(ASSET_KEY);
    return isAssetId(value) ? value : DEFAULT_ASSET;
  } catch {
    return DEFAULT_ASSET;
  }
}

export function saveAsset(asset: string): void {
  try {
    localStorage.setItem(ASSET_KEY, asset);
  } catch {
    // Storage blocked: the pick lasts until the tab closes.
  }
}
