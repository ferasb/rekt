import { useEffect, useState } from "react";
import { DEFAULT_ASSET, isAsset } from "../market/assets";

// Which room is open, and which coin, from the URL hash: #trade, #updown, #trade/ETH-USD.

export type Room = "trade" | "updown";

function parse(hash: string): { room: Room; asset: string | null } {
  const [room, asset] = hash.replace(/^#/, "").split("/");
  return { room: room === "updown" ? "updown" : "trade", asset: isAsset(asset) ? asset : null };
}

export function useRoom(): { room: Room; asset: string | null } {
  const [state, setState] = useState(() => parse(location.hash));
  useEffect(() => {
    const update = () => setState(parse(location.hash));
    window.addEventListener("hashchange", update);
    return () => window.removeEventListener("hashchange", update);
  }, []);
  return state;
}

// The coin picked last, shared by both rooms.
const ASSET_KEY = "rekt:asset";

export function loadAsset(): string {
  try {
    const value = localStorage.getItem(ASSET_KEY);
    return isAsset(value) ? value : DEFAULT_ASSET;
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
