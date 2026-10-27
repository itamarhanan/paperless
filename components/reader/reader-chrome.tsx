"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ALargeSmall,
  Bookmark,
  BookmarkCheck,
  ChevronLeft,
  CircleHelp,
  Copy,
  Ellipsis,
  Info,
  ListTree,
  MessageCircle,
  PanelLeft,
  Search,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from "@/components/ui/drawer";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useReaderStore, type ReaderPanel } from "@/lib/store/reader-store";
import { useBookmarks } from "@/hooks/use-bookmarks";
import { deleteDocument, restoreDocument } from "@/lib/storage";
import { pageHasAiChanges, pagePassages } from "@/lib/pdf-processor";
import { AppearanceControls } from "./appearance-controls";
import { SearchControls } from "./search-controls";
import { BookmarksList, ContentsList } from "./contents-list";
import { ChatPanel } from "./chat-panel";
import { useTour } from "./reader-tour-store";
import { cn } from "@/lib/utils";

// ========== TOP BAR ==========

/** "The Obstacle Is the Way: The Timeless Art of…" → "The Obstacle Is the Way" */
function shortTitle(title: string) {
  const main = title.split(/:\s| — | – /)[0].trim();
  return main.length >= 3 ? main : title;
}

export function TopBar({
  desktop,
  hidden,
  onCleanNow,
}: {
  desktop: boolean;
  hidden: boolean;
  onCleanNow: (page: number) => void;
}) {
  const document = useReaderStore((s) => s.document)!;
  const currentPage = useReaderStore((s) => s.currentPage);
  const sidebarOpen = useReaderStore((s) => s.sidebarOpen);
  const setSidebarOpen = useReaderStore((s) => s.setSidebarOpen);
  const chatOpen = useReaderStore((s) => s.chatOpen);
  const setChatOpen = useReaderStore((s) => s.setChatOpen);
  const panel = useReaderStore((s) => s.panel);
  const setPanel = useReaderStore((s) => s.setPanel);
  const { items, toggle } = useBookmarks();
  const bookmarked = items.some((b) => b.page === currentPage);
  const progress = document.totalPages ? currentPage / document.totalPages : 0;

  const popover = (name: Exclude<ReaderPanel, null>) => ({
    open: panel === name,
    onOpenChange: (open: boolean) => setPanel(open ? name : null),
  });

  return (
    <header
      data-reader-bar="top"
      className={cn(
        "bar-glass pt-safe sticky top-0 z-40 border-b transition-transform duration-200 ease-out",
        hidden && "-translate-y-full"
      )}
    >
      <div className="px-safe flex h-12 items-center gap-1 lg:h-13">
        <Button asChild variant="ghost" className="-ml-2 gap-0.5 px-2 has-[>svg]:px-2">
          <Link href="/library" aria-label="Back to library" data-tour="library">
            <ChevronLeft className="size-5" />
            <span className="max-[359px]:sr-only">Library</span>
          </Link>
        </Button>

        {desktop && (
          <Button
            variant="ghost"
            size="icon"
            aria-label={sidebarOpen ? "Hide sidebar" : "Show sidebar"}
            aria-pressed={sidebarOpen}
            data-tour="contents"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            <PanelLeft />
          </Button>
        )}

        {/* The title without its subtitle; the full one is in the tooltip and the library */}
        <div className="min-w-0 flex-1 px-2 text-center">
          <h1 className="truncate text-[0.9375rem] font-semibold leading-tight" title={document.title}>
            {shortTitle(document.title)}
          </h1>
        </div>

        {desktop && (
          <>
            <Popover {...popover("search")}>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Search (/)">
                  <Search />
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="max-h-[70vh] w-96 overflow-y-auto">
                <SearchControls onNavigate={() => setPanel(null)} />
              </PopoverContent>
            </Popover>

            <Popover {...popover("appearance")}>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Appearance" data-tour="appearance">
                  <ALargeSmall />
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="max-h-[80vh] w-80 overflow-y-auto">
                <AppearanceControls />
              </PopoverContent>
            </Popover>

            <Button
              variant={chatOpen ? "secondary" : "ghost"}
              size="icon"
              aria-label="Ask about this page"
              aria-pressed={chatOpen}
              onClick={() => setChatOpen(!chatOpen)}
            >
              <MessageCircle />
            </Button>
          </>
        )}

        <Button
          variant="ghost"
          size="icon"
          aria-label={bookmarked ? `Remove bookmark on page ${currentPage}` : `Bookmark page ${currentPage}`}
          aria-pressed={bookmarked}
          onClick={() => toggle(currentPage)}
        >
          {bookmarked ? <BookmarkCheck className="fill-current" /> : <Bookmark />}
        </Button>

        <MoreMenu onCleanNow={onCleanNow} />
      </div>

      <div
        className="absolute inset-x-0 -bottom-px h-0.5"
        role="progressbar"
        aria-label="Reading progress"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progress * 100)}
      >
        <div
          className="h-full origin-left bg-foreground transition-transform duration-300 ease-out"
          style={{ transform: `scaleX(${progress})` }}
        />
      </div>
    </header>
  );
}

function MoreMenu({ onCleanNow }: { onCleanNow: (page: number) => void }) {
  const router = useRouter();
  const docId = useReaderStore((s) => s.docId);
  const document = useReaderStore((s) => s.document)!;
  const currentPage = useReaderStore((s) => s.currentPage);
  const showOriginal = useReaderStore((s) => !!s.showOriginal[s.currentPage]);
  const setShowOriginal = useReaderStore((s) => s.setShowOriginal);
  const page = document.pages[currentPage - 1];
  const startTour = useTour((s) => s.start);

  // The AI only lays text out, so the page's own text is always the one to copy
  const aiTouched = !!page?.isEnhanced && (pageHasAiChanges(document, page) || pagePassages(document, page).length > 0);

  const copyPage = async () => {
    try {
      await navigator.clipboard.writeText(page.content);
      toast("Copied page text");
    } catch {
      toast.error("Couldn’t copy. Select the text instead.");
    }
  };

  const remove = async () => {
    if (!docId) return;
    const deleted = await deleteDocument(docId);
    router.push("/library");
    if (deleted) {
      toast(`Removed “${deleted.saved.title}”`, {
        action: { label: "Undo", onClick: () => void restoreDocument(deleted) },
      });
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="-mr-2" aria-label="More">
          <Ellipsis />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="min-w-56"
        // Starting the tour moves focus to its card; don't pull it back to More
        onCloseAutoFocus={(e) => {
          if (useTour.getState().step !== null) e.preventDefault();
        }}
      >
        {aiTouched ? (
          <DropdownMenuItem onSelect={() => setShowOriginal(currentPage, !showOriginal)}>
            <Sparkles /> {showOriginal ? "Show AI layout" : "Show original layout"}
          </DropdownMenuItem>
        ) : !page?.isEnhanced ? (
          <DropdownMenuItem onSelect={() => onCleanNow(currentPage)}>
            <Sparkles /> Check this page with AI
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuItem onSelect={copyPage}>
          <Copy /> Copy page text
        </DropdownMenuItem>
        {docId && (
          <DropdownMenuItem asChild>
            <Link href={`/book?id=${encodeURIComponent(docId)}&from=reader`}>
              <Info /> Book details
            </Link>
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onSelect={startTour}>
          <CircleHelp /> Show the tour
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onSelect={remove}>
          <Trash2 /> Remove from library
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ========== BOTTOM TOOLBAR (compact width) ==========

export function BottomBar({ hidden }: { hidden: boolean }) {
  const panel = useReaderStore((s) => s.panel);
  const setPanel = useReaderStore((s) => s.setPanel);
  const setChatOpen = useReaderStore((s) => s.setChatOpen);

  const items = [
    { key: "contents", label: "Contents", icon: ListTree, onClick: () => setPanel("contents") },
    { key: "search", label: "Search", icon: Search, onClick: () => setPanel("search") },
    { key: "appearance", label: "Appearance", icon: ALargeSmall, onClick: () => setPanel("appearance") },
    { key: "chat", label: "Ask about this page", icon: MessageCircle, onClick: () => setChatOpen(true) },
  ] as const;

  return (
    <nav
      aria-label="Reader tools"
      data-reader-bar="bottom"
      className={cn(
        "bar-glass pb-safe fixed inset-x-0 bottom-0 z-40 border-t transition-transform duration-200 ease-out",
        hidden && "translate-y-full"
      )}
    >
      <div className="px-safe mx-auto grid h-14 max-w-md grid-cols-4 items-center">
        {items.map(({ key, label, icon: Icon, onClick }) => (
          <button
            key={key}
            type="button"
            aria-label={label}
            aria-expanded={panel === key}
            data-tour={key}
            onClick={onClick}
            className="mx-auto flex size-11 items-center justify-center rounded-full text-foreground transition-colors active:bg-accent focus-visible:outline-2 focus-visible:outline-ring"
          >
            <Icon className="size-[1.375rem]" strokeWidth={1.75} />
          </button>
        ))}
      </div>
    </nav>
  );
}

// ========== SHEETS (compact width) ==========

function SheetHeader({ title, description, onDone }: { title: string; description?: string; onDone: () => void }) {
  return (
    <div className="flex items-center justify-between gap-2 px-4 pb-2 pt-1">
      <div className="min-w-0">
        <DrawerTitle className="text-[1.0625rem]">{title}</DrawerTitle>
        <DrawerDescription className={description ? "text-[0.8125rem]" : "sr-only"}>
          {description ?? title}
        </DrawerDescription>
      </div>
      <Button variant="ghost" size="icon" className="-mr-2 rounded-full" aria-label="Close" onClick={onDone}>
        <X />
      </Button>
    </div>
  );
}

export function PhoneSheets() {
  const panel = useReaderStore((s) => s.panel);
  const setPanel = useReaderStore((s) => s.setPanel);
  const chatOpen = useReaderStore((s) => s.chatOpen);
  const setChatOpen = useReaderStore((s) => s.setChatOpen);
  const currentPage = useReaderStore((s) => s.currentPage);
  const close = () => setPanel(null);
  const sheet = (name: Exclude<ReaderPanel, null>) => ({
    open: panel === name,
    onOpenChange: (open: boolean) => setPanel(open ? name : null),
  });

  return (
    <>
      <Drawer {...sheet("contents")}>
        <DrawerContent className="h-[85dvh]">
          <Tabs defaultValue="contents" className="flex min-h-0 flex-1 flex-col gap-0">
            <div className="flex items-center gap-2 px-4 pb-3 pt-2">
              <DrawerTitle className="sr-only">Contents and bookmarks</DrawerTitle>
              <DrawerDescription className="sr-only">Jump to a section, page or bookmark</DrawerDescription>
              <TabsList className="h-10 flex-1">
                <TabsTrigger value="contents" className="text-[0.9375rem]">Contents</TabsTrigger>
                <TabsTrigger value="bookmarks" className="text-[0.9375rem]">Bookmarks</TabsTrigger>
              </TabsList>
              <Button variant="ghost" size="icon" className="-mr-2 rounded-full" aria-label="Close" onClick={close}>
                <X />
              </Button>
            </div>
            <TabsContent value="contents" className="pb-safe min-h-0 overflow-y-auto px-2">
              <ContentsList onNavigate={close} />
            </TabsContent>
            <TabsContent value="bookmarks" className="pb-safe min-h-0 overflow-y-auto px-2">
              <BookmarksList onNavigate={close} />
            </TabsContent>
          </Tabs>
        </DrawerContent>
      </Drawer>

      <Drawer {...sheet("search")}>
        <DrawerContent className="h-[85dvh]">
          <SheetHeader title="Search" onDone={close} />
          <div className="pb-safe min-h-0 flex-1 overflow-y-auto px-4">
            <SearchControls onNavigate={close} />
          </div>
        </DrawerContent>
      </Drawer>

      {/* Nonmodal and undimmed so changes preview on the page behind (sheets.md › Anatomy) */}
      <Drawer {...sheet("appearance")} modal={false}>
        <DrawerContent overlay={false} className="max-h-[70dvh] shadow-[0_-8px_30px_rgb(0_0_0/0.12)]">
          <SheetHeader title="Appearance" onDone={close} />
          <div className="pb-safe min-h-0 overflow-y-auto px-4 pb-4">
            <AppearanceControls />
          </div>
        </DrawerContent>
      </Drawer>

      <Drawer open={chatOpen} onOpenChange={setChatOpen} repositionInputs={false}>
        <DrawerContent className="h-[92dvh]">
          <SheetHeader title={`Ask about page ${currentPage}`} onDone={() => setChatOpen(false)} />
          <div className="pb-safe min-h-0 flex-1">
            <ChatPanel />
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}

// ========== DESKTOP SIDE PANELS ==========

export function Sidebar() {
  return (
    <aside
      aria-label="Contents and bookmarks"
      className="sticky top-[calc(3.25rem+1px)] h-[calc(100dvh-3.25rem-1px)] w-72 shrink-0 border-r bg-sidebar"
    >
      <Tabs defaultValue="contents" className="flex h-full flex-col gap-0">
        <div className="px-3 pb-2 pt-3">
          <TabsList className="w-full">
            <TabsTrigger value="contents">Contents</TabsTrigger>
            <TabsTrigger value="bookmarks">Bookmarks</TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="contents" className="min-h-0 overflow-y-auto px-2 pb-4">
          <ContentsList />
        </TabsContent>
        <TabsContent value="bookmarks" className="min-h-0 overflow-y-auto px-2 pb-4">
          <BookmarksList />
        </TabsContent>
      </Tabs>
    </aside>
  );
}

export function ChatAside() {
  const setChatOpen = useReaderStore((s) => s.setChatOpen);
  const currentPage = useReaderStore((s) => s.currentPage);
  return (
    <aside
      aria-label="Ask about this page"
      className="sticky top-[calc(3.25rem+1px)] flex h-[calc(100dvh-3.25rem-1px)] w-96 shrink-0 flex-col border-l bg-sidebar"
    >
      <div className="flex h-12 items-center justify-between border-b pl-4 pr-2">
        <h2 className="text-sm font-semibold">Ask about page {currentPage}</h2>
        <Button variant="ghost" size="icon-sm" aria-label="Close" onClick={() => setChatOpen(false)}>
          <X />
        </Button>
      </div>
      <div className="min-h-0 flex-1">
        <ChatPanel />
      </div>
    </aside>
  );
}
