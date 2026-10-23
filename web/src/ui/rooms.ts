import { useEffect, useState } from "react";
import { DEFAULT_ASSET, isAssetId } from "../market/assets";

// Which room is open, from the URL hash: #trade, #updown, #history (which takes ?amount=250000).

export type Room = "trade" | "updown" | "history";

function parse(hash: string): Room {
  const room = hash.replace(/^#/, "").split(/[/?]/)[0];
  return room === "updown" || room === "history" ? room : "trade";
}

/** A parameter after the room in the hash: #history?amount=250000. */
export function hashParam(name: string): string | null {
  const query = location.hash.split("?")[1];
  return query ? new URLSearchParams(query).get(name) : null;
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
