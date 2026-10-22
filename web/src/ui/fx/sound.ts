import { create } from "zustand";
import { loadSound, saveSound } from "../../persist/settings";

// Sounds, synthesized with Web Audio: no files to download. Browsers only allow audio after the
// visitor has clicked something, which every sound here follows.

export type Sound = "open" | "close" | "win" | "bigwin" | "loss" | "rekt" | "tick" | "warning" | "bailout";

interface SoundState {
  on: boolean;
  toggle(): void;
}

export const useSound = create<SoundState>((set, get) => ({
  on: loadSound(),
  toggle() {
    const on = !get().on;
    saveSound(on);
    set({ on });
    if (on) play("open");
  },
}));

let ctx: AudioContext | null = null;

function audio(): AudioContext | null {
  try {
    ctx ??= new AudioContext();
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

/** One note: a frequency (or a slide between two) with a quick attack and an exponential fade. */
function tone(a: AudioContext, at: number, from: number, to: number, duration: number, type: OscillatorType, volume: number): void {
  const osc = a.createOscillator();
  const gain = a.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(from, at);
  if (to !== from) osc.frequency.exponentialRampToValueAtTime(to, at + duration);
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(volume, at + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + duration);
  osc.connect(gain).connect(a.destination);
  osc.start(at);
  osc.stop(at + duration + 0.02);
}

/** A burst of filtered noise: the liquidation's explosion. */
function boom(a: AudioContext, at: number): void {
  const length = Math.floor(a.sampleRate * 0.9);
  const buffer = a.createBuffer(1, length, a.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length) ** 2;
  const source = a.createBufferSource();
  source.buffer = buffer;
  const filter = a.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(1200, at);
  filter.frequency.exponentialRampToValueAtTime(80, at + 0.9);
  const gain = a.createGain();
  gain.gain.value = 0.5;
  source.connect(filter).connect(gain).connect(a.destination);
  source.start(at);
}

export function play(sound: Sound): void {
  if (!useSound.getState().on) return;
  const a = audio();
  if (!a) return;
  const t = a.currentTime + 0.01;
  switch (sound) {
    case "open":
      tone(a, t, 520, 780, 0.12, "triangle", 0.15);
      break;
    case "close":
      tone(a, t, 660, 440, 0.12, "triangle", 0.12);
      break;
    case "tick":
      tone(a, t, 1400, 1400, 0.03, "square", 0.03);
      break;
    case "warning":
      tone(a, t, 880, 880, 0.1, "square", 0.06);
      tone(a, t + 0.15, 880, 880, 0.1, "square", 0.06);
      break;
    case "win":
      [523, 659, 784].forEach((f, i) => tone(a, t + i * 0.08, f, f, 0.18, "triangle", 0.15));
      break;
    case "bigwin":
      [523, 659, 784, 1047, 1319].forEach((f, i) => tone(a, t + i * 0.07, f, f, 0.25, "triangle", 0.15));
      tone(a, t + 0.4, 1047, 2093, 0.5, "sine", 0.08);
      break;
    case "loss":
      // The sad trombone: wah, wah, wah, waaah.
      [392, 370, 349].forEach((f, i) => tone(a, t + i * 0.3, f, f * 0.97, 0.28, "sawtooth", 0.06));
      tone(a, t + 0.9, 330, 290, 0.8, "sawtooth", 0.06);
      break;
    case "rekt":
      boom(a, t);
      tone(a, t, 220, 40, 1.2, "sawtooth", 0.12);
      break;
    case "bailout":
      [784, 659, 523, 784, 1047].forEach((f, i) => tone(a, t + i * 0.1, f, f, 0.2, "square", 0.05));
      break;
  }
}
