"use client";

import { useSyncExternalStore } from "react";
import { listVoices, subscribeVoices } from "@/lib/speech/engine";

/** The device's speaking voices, ready whenever the platform decides to share them. */
export function useSpeechVoices(): SpeechSynthesisVoice[] {
  return useSyncExternalStore(subscribeVoices, listVoices, () => []);
}
