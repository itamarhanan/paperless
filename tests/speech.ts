import type { Page } from "@playwright/test";

/**
 * Speech is faked: every utterance starts right away and ends a moment
 * later, so a whole book plays out in a few seconds. Set noVoices to leave
 * the device apparently voiceless.
 */
export const FAKE_SPEECH = `
  (() => {
    let current = null;
    const synth = {
      speaking: false,
      pending: false,
      paused: false,
      getVoices() {
        return window.__noFakeVoices ? [] : [
          { name: "Test Voice", lang: "en-US", voiceURI: "test-voice", default: true, localService: true },
        ];
      },
      addEventListener() {},
      removeEventListener() {},
      cancel() {
        const u = current;
        current = null;
        synth.speaking = false;
        if (u) setTimeout(() => { if (!u.__done) u.onerror?.({ error: "canceled" }); }, 0);
      },
      speak(u) {
        synth.speaking = true;
        current = u;
        setTimeout(() => {
          if (current !== u) return;
          u.onstart?.();
          setTimeout(() => {
            if (current !== u) return;
            current = null;
            synth.speaking = false;
            u.__done = true;
            u.onend?.();
          }, 120);
        }, 5);
      },
    };
    Object.defineProperty(window, "speechSynthesis", { value: synth, configurable: true });
    Object.defineProperty(window, "SpeechSynthesisUtterance", {
      value: class { constructor(text) { this.text = text; } },
      configurable: true,
    });
  })();
`;

/** Installs the fake and opens the reader on the Meditations sample. */
export async function openReaderWithFakeSpeech(page: Page, options?: { noVoices?: boolean }) {
  if (options?.noVoices) await page.addInitScript("window.__noFakeVoices = true;");
  await page.addInitScript(FAKE_SPEECH);
  // Init scripts belong to future loads, so opening the reader happens here
  await page.goto("/library");
  await page.getByRole("button", { name: "Try it with Meditations" }).click();
  await page.locator(".reader-prose").waitFor();
}
