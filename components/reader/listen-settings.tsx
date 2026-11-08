"use client";

import { useEffect, useState } from "react";
import { Check, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { useUpdateSettings } from "@/hooks/use-update-settings";
import { useSpeechVoices } from "@/hooks/use-speech-voices";
import { withDefaults } from "@/lib/pdf-processor";
import { matchVoice, preview, speechAvailable } from "@/lib/speech/engine";
import { useListenStore } from "@/lib/store/listen-store";
import { useReaderStore } from "@/lib/store/reader-store";
import { cn } from "@/lib/utils";

/**
 * How Paperless reads aloud: speed, the voice, and a way out. Lives inside the
 * player's popover on desktop and inside a drawer on phones.
 */
export function ListenSettings() {
  const settings = withDefaults(useReaderStore((s) => s.settings));
  const update = useUpdateSettings();
  const language = useReaderStore((s) => s.document?.language);
  const voices = useSpeechVoices();
  const status = useListenStore((s) => s.status);
  const stop = useListenStore((s) => s.stop);
  const [rate, setRate] = useState(settings.speakRate);

  // A half-spoken preview has no session of its own; stop it when the sheet closes
  useEffect(() => {
    return () => {
      if (useListenStore.getState().status !== "playing") window.speechSynthesis?.cancel();
    };
  }, []);

  if (!speechAvailable()) {
    return (
      <p className="pb-2 text-[0.8125rem] text-muted-foreground">
        This browser can’t speak text. Listening needs a browser with speech built in, such as Chrome or Safari.
      </p>
    );
  }

  if (!voices.length) {
    return (
      <div className="space-y-2 pb-2">
        <p className="text-[0.9375rem]">No speaking voices are installed on this device.</p>
        <p className="text-[0.8125rem] text-muted-foreground">
          On iPhone, turn on Spoken Content in Settings › Accessibility › Spoken Content. On Android, look for
          text-to-speech in the device’s accessibility settings. Nothing is missing from Paperless; once voices
          appear, listening works.
        </p>
      </div>
    );
  }

  // Voices that read the book's language lead the list so the right choice is near the top
  const lang = (language ?? "").toLowerCase().replace(/_/g, "-");
  const base = lang.split("-")[0];
  const inOrder = [...voices].sort((a, b) => score(b) - score(a));
  function score(voice: SpeechSynthesisVoice) {
    const vLang = voice.lang.toLowerCase().replace(/_/g, "-");
    let points = 0;
    if (lang && vLang === lang) points += 4;
    else if (base && vLang.startsWith(base)) points += 3;
    if (voice.voiceURI === settings.speakVoiceURI) points += 2;
    if (voice.localService) points += 1;
    return points;
  }
  const automatic = matchVoice("", language);

  const choose = (uri: string) => {
    update({ speakVoiceURI: uri });
    // Playing voices take the next sentence from the queue on their own
    if (useListenStore.getState().status !== "playing") void preview(uri, rate, language);
  };

  return (
    <div className="space-y-6 pb-2 pt-1">
      {status !== "idle" && (
        <div className="flex items-center justify-between gap-2">
          <span className="text-[0.9375rem]">Paperless is reading aloud.</span>
          <Button variant="destructive" size="sm" onClick={stop}>
            Stop
          </Button>
        </div>
      )}

      <fieldset>
        <legend className="mb-2 text-[0.8125rem] font-medium text-muted-foreground">Speed</legend>
        <div className="flex items-center gap-3 rounded-lg bg-muted p-1 pr-3">
          <Slider
            className="pl-2"
            min={0.5}
            max={2}
            step={0.05}
            value={[rate]}
            onValueChange={([v]) => setRate(v)}
            onValueCommit={([v]) => {
              setRate(v);
              update({ speakRate: v });
            }}
            aria-label="Reading speed"
          />
          <output className="tabular w-12 text-center text-[0.9375rem] font-medium">{rate.toFixed(2)}×</output>
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-2 text-[0.8125rem] font-medium text-muted-foreground">Voice</legend>
        <div role="radiogroup" aria-label="Voice" className="max-h-56 space-y-0.5 overflow-y-auto pr-1">
          <VoiceRow
            voice={automatic}
            meta={lang ? "for this book" : undefined}
            checked={!settings.speakVoiceURI}
            onChange={() => choose("")}
          />
          {inOrder.map((voice) => (
            <VoiceRow
              key={voice.voiceURI}
              voice={voice}
              checked={settings.speakVoiceURI === voice.voiceURI}
              onChange={() => choose(voice.voiceURI)}
            />
          ))}
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-3 gap-2"
          disabled={status === "playing"}
          onClick={() => void preview(settings.speakVoiceURI, rate, language)}
        >
          <Volume2 /> Preview voice
        </Button>
      </fieldset>
    </div>
  );
}

function VoiceRow({
  voice,
  checked,
  onChange,
  meta,
}: {
  voice: SpeechSynthesisVoice | null;
  checked: boolean;
  onChange: () => void;
  meta?: string;
}) {
  if (!voice) return null;
  const detail =
    meta ?? (voice.localService ? voice.lang : `${voice.lang} · downloads when needed`);
  return (
    <label
      className={cn(
        "flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-lg px-3 transition-colors",
        "hover:bg-accent/60 has-[:checked]:bg-surface-raised has-[:checked]:shadow-sm"
      )}
    >
      <span className="min-w-0">
        <span className="block truncate text-[0.9375rem]" title={voice.name}>
          {voice.name}
        </span>
        <span className="block text-[0.75rem] text-muted-foreground">{detail}</span>
      </span>
      <input
        type="radio"
        name="listen-voice"
        value={voice.voiceURI}
        checked={checked}
        onChange={onChange}
        className="sr-only"
      />
      <Check className={cn("size-4 shrink-0", checked ? "text-foreground" : "opacity-0")} aria-hidden />
    </label>
  );
}
