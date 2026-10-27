"use client";

import { useState, useSyncExternalStore } from "react";
import { useTheme } from "next-themes";
import { ChevronDown, Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Segmented } from "./segmented";
import { useReaderStore } from "@/lib/store/reader-store";
import { useUpdateSettings } from "@/hooks/use-update-settings";
import { PAGE_LENGTHS, withDefaults } from "@/lib/pdf-processor";
import { cn } from "@/lib/utils";
import { AI_KEY_CHANGED, getAiKey, setAiKey } from "@/lib/ai-key";
import { useIsClient } from "@/hooks/use-is-client";

const MIN_SIZE = 14;
const MAX_SIZE = 30;

const SPACING = { tight: 1.4, normal: 1.6, loose: 1.85 } as const;
const WIDTHS = { narrow: 560, medium: 680, wide: 820 } as const;

function nearest<K extends string>(map: Record<K, number>, value: number): K {
  return (Object.keys(map) as K[]).reduce((best, key) =>
    Math.abs(map[key] - value) < Math.abs(map[best] - value) ? key : best
  );
}

const THEMES = [
  { value: "system", label: "Auto", swatch: "bg-[linear-gradient(135deg,#fcfcfc_50%,#121212_50%)]" },
  { value: "light", label: "Light", swatch: "bg-[#fcfcfc]" },
  { value: "sepia", label: "Sepia", swatch: "bg-[#f6eedf]" },
  { value: "dark", label: "Dark", swatch: "bg-[#121212]" },
] as const;

const FONTS = [
  { value: "serif", label: "Serif", className: "font-serif" },
  { value: "sans", label: "Sans", className: "font-sans" },
  { value: "mono", label: "Mono", className: "font-mono" },
] as const;

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <div className="text-[0.8125rem] font-medium text-muted-foreground">{label}</div>
      {children}
    </div>
  );
}

function SwitchRow({
  id,
  label,
  description,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  description?: React.ReactNode;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label htmlFor={id} className="flex min-h-11 cursor-pointer items-center justify-between gap-4 py-1">
      <span className="min-w-0">
        <span className="block text-[0.9375rem]">{label}</span>
        {description && <span className="block text-[0.8125rem] text-muted-foreground">{description}</span>}
      </span>
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
    </label>
  );
}

export function AppearanceControls() {
  const settings = withDefaults(useReaderStore((s) => s.settings));
  const update = useUpdateSettings();
  const { theme, setTheme } = useTheme();
  const mounted = useIsClient();

  const pageLength = nearest(PAGE_LENGTHS, settings.charsPerPage);

  return (
    <div className="space-y-6">
      <fieldset>
        <legend className="mb-2 text-[0.8125rem] font-medium text-muted-foreground">Theme</legend>
        <div className="grid grid-cols-4 gap-2">
          {THEMES.map((t) => (
            <label key={t.value} className="group flex cursor-pointer flex-col items-center gap-1.5">
              <input
                type="radio"
                name="reader-theme"
                value={t.value}
                checked={mounted && theme === t.value}
                onChange={() => setTheme(t.value)}
                className="peer sr-only"
              />
              <span
                aria-hidden
                className={cn(
                  "size-11 rounded-full border border-control/60 ring-offset-2 ring-offset-background transition-shadow",
                  "peer-checked:ring-2 peer-checked:ring-foreground peer-focus-visible:outline-2 peer-focus-visible:outline-offset-4 peer-focus-visible:outline-ring",
                  t.swatch
                )}
              />
              <span className="text-[0.8125rem] text-muted-foreground peer-checked:font-medium peer-checked:text-foreground">
                {t.label}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-2 text-[0.8125rem] font-medium text-muted-foreground">Font</legend>
        <div className="grid grid-cols-3 gap-2">
          {FONTS.map((f) => (
            <label
              key={f.value}
              className={cn(
                "flex h-16 cursor-pointer flex-col items-center justify-center rounded-lg border text-muted-foreground transition-colors",
                "has-[:checked]:border-foreground has-[:checked]:text-foreground",
                "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring"
              )}
            >
              <input
                type="radio"
                name="reader-font"
                value={f.value}
                checked={settings.fontFamily === f.value}
                onChange={() => update({ fontFamily: f.value })}
                className="sr-only"
              />
              <span aria-hidden className={cn("text-2xl leading-none", f.className)}>
                Aa
              </span>
              <span className="mt-1 text-xs">{f.label}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <Row label="Text size">
        <div className="flex items-center gap-2 rounded-lg bg-muted p-1">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Smaller text"
            disabled={settings.fontSize <= MIN_SIZE}
            onClick={() => update({ fontSize: Math.max(MIN_SIZE, settings.fontSize - 1) })}
          >
            <Minus />
          </Button>
          <output aria-live="polite" className="tabular flex-1 text-center text-[0.9375rem] font-medium">
            {settings.fontSize} px
          </output>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Larger text"
            disabled={settings.fontSize >= MAX_SIZE}
            onClick={() => update({ fontSize: Math.min(MAX_SIZE, settings.fontSize + 1) })}
          >
            <Plus />
          </Button>
        </div>
      </Row>

      <Row label="Line spacing">
        <Segmented
          label="Line spacing"
          value={nearest(SPACING, settings.lineHeight)}
          onChange={(v) => update({ lineHeight: SPACING[v] })}
          options={[
            { value: "tight", label: "Tight" },
            { value: "normal", label: "Normal" },
            { value: "loose", label: "Loose" },
          ]}
        />
      </Row>

      <Row label="Width">
        <Segmented
          label="Text width"
          value={nearest(WIDTHS, settings.maxWidth)}
          onChange={(v) => update({ maxWidth: WIDTHS[v] })}
          options={[
            { value: "narrow", label: "Narrow" },
            { value: "medium", label: "Medium" },
            { value: "wide", label: "Wide" },
          ]}
        />
      </Row>

      <SwitchRow
        id="justify"
        label="Justify text"
        checked={settings.textAlign === "justify"}
        onChange={(on) => update({ textAlign: on ? "justify" : "left" })}
      />

      <Collapsible className="border-t pt-2">
        <CollapsibleTrigger className="group flex min-h-11 w-full items-center justify-between rounded-md text-[0.9375rem] font-medium">
          Pages and AI
          <ChevronDown className="size-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-4 pt-2">
          <Row label="Page length">
            <Segmented
              label="Page length"
              value={pageLength}
              onChange={(v) => update({ charsPerPage: PAGE_LENGTHS[v] })}
              options={[
                { value: "short", label: "Short" },
                { value: "medium", label: "Medium" },
                { value: "long", label: "Long" },
              ]}
            />
          </Row>
          <SwitchRow
            id="smart-breaks"
            label="Start chapters on a new page"
            description="Pages break at chapters and sentence ends."
            checked={settings.enableSmartBreaks}
            onChange={(on) => update({ enableSmartBreaks: on })}
          />
          <SwitchRow
            id="auto-cleanup"
            label="Check layout with AI"
            description={
              <>
                Finds missed headings, quotes and lists and hides stray symbols as you read. It never changes the
                book’s words. Pages are sent to Google Gemini ·{" "}
                <a href="/privacy" target="_blank" className="underline underline-offset-4 hover:text-foreground">
                  Privacy
                </a>
              </>
            }
            checked={settings.autoCleanup}
            onChange={(on) => update({ autoCleanup: on })}
          />
          <SwitchRow
            id="key-passages"
            label="Underline key passages"
            description="The AI picks up to two lines per page worth remembering."
            checked={settings.keyPassages}
            onChange={(on) => update({ keyPassages: on })}
          />
          <AiKeyField />
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

function subscribeToKey(onChange: () => void) {
  window.addEventListener(AI_KEY_CHANGED, onChange);
  window.addEventListener("storage", onChange); // changed in another tab
  return () => {
    window.removeEventListener(AI_KEY_CHANGED, onChange);
    window.removeEventListener("storage", onChange);
  };
}

/** Optional: the reader's own Gemini key, for AI use beyond the shared limits. */
function AiKeyField() {
  const saved = useSyncExternalStore(subscribeToKey, getAiKey, () => "");
  const [draft, setDraft] = useState("");

  if (saved) {
    return (
      <div className="flex min-h-11 items-center justify-between gap-4 py-1">
        <span className="min-w-0">
          <span className="block text-[0.9375rem]">Your Gemini key</span>
          <span className="block text-[0.8125rem] text-muted-foreground">
            In use, ending in {saved.slice(-4)}. It stays in this browser.
          </span>
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setAiKey("")}
        >
          Remove
        </Button>
      </div>
    );
  }

  return (
    <form
      className="space-y-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (!draft.trim()) return;
        setAiKey(draft);
        setDraft("");
      }}
    >
      <label htmlFor="gemini-key" className="block">
        <span className="block text-[0.9375rem]">Your own Gemini key</span>
        <span className="block text-[0.8125rem] text-muted-foreground">
          Optional. AI here is shared and limited; with a free key from{" "}
          <a
            href="https://aistudio.google.com/apikey"
            target="_blank"
            rel="noreferrer"
            className="underline underline-offset-4 hover:text-foreground"
          >
            Google AI Studio
          </a>{" "}
          it isn’t. The key stays in this browser.
        </span>
      </label>
      <div className="flex gap-2">
        <input
          id="gemini-key"
          type="password"
          autoComplete="off"
          spellCheck={false}
          placeholder="AIza…"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          className="h-11 min-w-0 flex-1 rounded-lg border bg-background px-3 text-[1.0625rem] outline-none focus-visible:outline-2 focus-visible:outline-ring pointer-fine:h-9 pointer-fine:text-[0.9375rem]"
        />
        <Button type="submit" variant="outline" disabled={!draft.trim()}>
          Save
        </Button>
      </div>
    </form>
  );
}
