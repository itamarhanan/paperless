"use client";

import { SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Slider } from "@/components/ui/slider";
import { useListenStore } from "@/lib/store/listen-store";
import { useReaderStore } from "@/lib/store/reader-store";
import { cn } from "@/lib/utils";
import { ListenSettings } from "./listen-settings";
import { listenAnnouncement, listenMessage, StopListeningButton, Transport } from "./listen-transport";

/** Off screen and past the bottom bar, so nobody sees it sneaking out. */
const HIDE_SHIFT = "translate-y-[calc(100%+7rem)]";

/**
 * Reading aloud lives in one quiet bar. The sentence being heard is
 * highlighted in the text; the bar carries play, skip and progress — no fake
 * timeline, because speech has none to model.
 */
export function ListenPlayer({ hidden }: { hidden: boolean }) {
  const status = useListenStore((s) => s.status);
  if (status === "idle") return null;
  return (
    <>
      <PhonePlayer hidden={hidden} />
      <DesktopPlayer hidden={hidden} />
    </>
  );
}

function PhonePlayer({ hidden }: { hidden: boolean }) {
  const status = useListenStore((s) => s.status);
  const reason = useListenStore((s) => s.reason);
  const paragraph = useListenStore((s) => s.paragraph);
  const total = useListenStore((s) => s.total);
  const setPanel = useReaderStore((s) => s.setPanel);

  const message = listenMessage(status, reason);
  // A page that hasn't handed over its text yet keeps the count vague
  const shown = total ? `${Math.min(Math.max(0, paragraph) + 1, total)} of ${total}` : null;

  return (
    <div
      data-listen-player="phone"
      className={cn(
        "lg:hidden fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+4.25rem)] z-30 px-2",
        "transition-transform duration-200 ease-out",
        hidden && HIDE_SHIFT
      )}
    >
      <div className="bar-glass mx-auto flex h-13 max-w-md items-center gap-0.5 rounded-full border pl-2 pr-1.5 shadow-[0_8px_30px_rgb(0_0_0/0.12)]">
        {message ? (
          <>
            <p className="min-w-0 flex-1 truncate pl-3 pr-1 text-[0.8125rem]">{message}</p>
            <StopListeningButton />
          </>
        ) : (
          <>
            <Transport compact />
            <p className="tabular min-w-0 flex-1 px-1 text-center text-[0.75rem] text-muted-foreground">
              {shown ?? "…"}
            </p>
            <button
              type="button"
              aria-label="Listening settings"
              onClick={() => setPanel("listen")}
              className="flex size-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
            >
              <SlidersHorizontal className="size-5" strokeWidth={1.75} />
            </button>
            <StopListeningButton />
          </>
        )}
      </div>
      <span className="sr-only" role="status">
        {listenAnnouncement(status, reason, message)}
      </span>
    </div>
  );
}

function DesktopPlayer({ hidden }: { hidden: boolean }) {
  const status = useListenStore((s) => s.status);
  const reason = useListenStore((s) => s.reason);
  const paragraph = useListenStore((s) => s.paragraph);
  const total = useListenStore((s) => s.total);
  const jump = useListenStore((s) => s.jump);
  const sidebarOpen = useReaderStore((s) => s.sidebarOpen);
  const chatOpen = useReaderStore((s) => s.chatOpen);

  const message = listenMessage(status, reason);
  const value = Math.min(Math.max(1, paragraph + 1), Math.max(1, total));

  return (
    <div
      data-listen-player="desktop"
      className={cn(
        "hidden lg:fixed lg:inset-x-0 lg:bottom-6 lg:z-30 lg:flex lg:justify-center",
        "transition-transform duration-200 ease-out",
        hidden && HIDE_SHIFT,
        sidebarOpen && "lg:pl-72",
        chatOpen && "lg:pr-96"
      )}
    >
      <div className="bar-glass flex h-12 items-center gap-1.5 rounded-full border px-2 shadow-[0_8px_30px_rgb(0_0_0/0.12)]">
        <Transport />
        {message ? (
          <p className="w-56 text-center text-[0.8125rem]">{message}</p>
        ) : (
          <>
            <Slider
              className="w-40"
              min={1}
              max={Math.max(1, total)}
              step={1}
              value={[value]}
              onValueCommit={([v]) => jump(v)}
              aria-label="Paragraph position"
            />
            <span className="tabular w-28 text-center text-[0.8125rem] text-muted-foreground">
              {total ? `Paragraph ${value} of ${total}` : "Opening…"}
            </span>
          </>
        )}
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="-mr-1 rounded-full text-muted-foreground"
              aria-label="Listening settings"
            >
              <SlidersHorizontal />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="center" className="max-h-[70vh] w-80 overflow-y-auto">
            <ListenSettings />
          </PopoverContent>
        </Popover>
        <StopListeningButton className="-mr-2 rounded-full" />
      </div>
      <span className="sr-only" role="status">
        {listenAnnouncement(status, reason, message)}
      </span>
    </div>
  );
}
