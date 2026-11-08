"use client";

/**
 * The machinery around window.speechSynthesis, kept free of React:
 * one utterance in flight at a time, a watchdog for Chrome's habit of
 * stopping mid-read, and voice bookkeeping that arrives late elsewhere.
 */

export const speechAvailable = (): boolean =>
  typeof window !== "undefined" && "speechSynthesis" in window;

const synth = (): SpeechSynthesis | null => (speechAvailable() ? window.speechSynthesis : null);

//
// Voice list
//

let voices: SpeechSynthesisVoice[] = [];
let version = "";
const listeners = new Set<() => void>();

function refresh(): void {
  const list = synth()?.getVoices() ?? [];
  const next = list.map((v) => v.voiceURI).join("\u0000");
  if (next === version) return;
  version = next;
  voices = list;
  listeners.forEach((l) => l());
}

export function listVoices(): SpeechSynthesisVoice[] {
  return voices;
}

export function hasVoices(): boolean {
  return voices.length > 0;
}

/** Voices can pop in late on iOS and Android; polls a for a moment. */
export async function voicesReady(timeoutMs = 800): Promise<boolean> {
  if (!speechAvailable()) return false;
  refresh();
  const start = performance.now();
  while (!voices.length && performance.now() - start < timeoutMs) {
    await new Promise((resolve) => setTimeout(resolve, 80));
    refresh();
  }
  return voices.length > 0;
}

export function subscribeVoices(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => void listeners.delete(onChange);
}

if (typeof window !== "undefined" && "speechSynthesis" in window) {
  refresh();
  window.speechSynthesis.addEventListener("voiceschanged", refresh);
  // A few platforms fill the list only after several calls
  for (const ms of [100, 300, 700, 1500, 2500]) setTimeout(refresh, ms);
}

function prefer(list: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  const ordered = [...list].sort(
    (a, b) => Number(b.localService) - Number(a.localService) || Number(!!b.default) - Number(!!a.default)
  );
  return ordered[0] ?? null;
}

/**
 * The chosen voice when it exists on this device, otherwise one that reads
 * the book's language. A saved voice from another device falls back quietly.
 */
export function matchVoice(uri: string, language: string | undefined): SpeechSynthesisVoice | null {
  const list = listVoices();
  if (!list.length) return null;
  if (uri) {
    const chosen = list.find((v) => v.voiceURI === uri);
    if (chosen) return chosen;
  }
  if (language) {
    const lang = language.toLowerCase().replace(/_/g, "-");
    const base = lang.split("-")[0];
    const same = list.filter((v) => v.lang.toLowerCase().replace(/_/g, "-") === lang);
    const family = list.filter((v) => !same.includes(v) && v.lang.toLowerCase().startsWith(base));
    return prefer([...same, ...family]) ?? prefer(list);
  }
  return prefer(list);
}

//
// Speaking
//

export interface SpeakRequest {
  text: string;
  voice: SpeechSynthesisVoice | null;
  /** The book's language, used when the voice falls back to a default. */
  lang?: string | null;
  rate: number;
}

/**
 * Speaks one piece. Resolves "end" when it finished and "error" on cancel,
 * failure, or a watchdog rescue — the caller decides what happens next.
 */
export function speak(request: SpeakRequest): Promise<"end" | "error"> {
  const s = synth();
  if (!s) return Promise.resolve("error");
  const utterance = new SpeechSynthesisUtterance(request.text);
  if (request.voice) utterance.voice = request.voice;
  else if (request.lang) utterance.lang = request.lang;
  utterance.rate = Math.min(10, Math.max(0.1, request.rate));

  return new Promise((resolve) => {
    let settled = false;
    const settle = (result: "end" | "error") => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(result);
    };
    // Chrome sometimes stops feeding utterances and never fires another
    // event; budget a generous speaking time and cancel to wake it up
    const budget = Math.max(15_000, (request.text.length / (8 * Math.max(1, request.rate))) * 1000 + 6000);
    const timer = setTimeout(() => {
      if (settled) return;
      s.cancel();
      // cancel() normally fires onerror on the spot; don't hang if it doesn't
      setTimeout(() => {
        if (!settled) {
          settled = true;
          resolve("error");
        }
      }, 1000);
    }, budget);
    utterance.onend = () => settle("end");
    utterance.onerror = () => settle("error");
    s.speak(utterance);
  });
}

/** Samples the chosen voice outside the queue; only when nothing is playing. */
export async function preview(uri: string, rate: number, language: string | undefined): Promise<void> {
  const s = synth();
  if (!s) return;
  s.cancel();
  const voice = matchVoice(uri, language);
  await speak({ text: "This is how the book will sound.", voice, lang: voice ? null : (language ?? null), rate });
}

//
// Wake lock
//

let wakeLock: { release: () => Promise<void> } | null = null;

/** Keeps the screen on while reading aloud, like an audiobook app does. */
export function acquireWakeLock(): void {
  const nav = navigator as Navigator & {
    wakeLock?: { request: (type: "screen") => Promise<{ release: () => Promise<void> }> };
  };
  if (document.visibilityState !== "visible") return;
  nav.wakeLock
    ?.request("screen")
    .then((lock) => {
      wakeLock = lock;
    })
    .catch(() => undefined);
}

export function releaseWakeLock(): void {
  void wakeLock?.release().catch(() => undefined);
  wakeLock = null;
}
