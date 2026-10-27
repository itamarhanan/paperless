"use client";

import { useEffect, useId, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { ArrowUpRight, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  deleteDocument,
  getDocument,
  loadBookmarks,
  loadReadingPosition,
  loadSettings,
  renameDocument,
  restoreDocument,
  saveSettings,
  updateDocument,
  type Bookmark,
  type BookSource,
  type Position,
  type SavedDocument,
} from "@/lib/storage";
import {
  paginationKey,
  renderAiPages,
  repaginateDocument,
  type ProcessedDocument,
  type ReaderSettings,
} from "@/lib/pdf-processor";
import {
  hiddenRanges,
  languageName,
  pageOfParagraph,
  readingTime,
  summarizeAi,
  wordsOnPages,
  WORDS_PER_MINUTE,
  type ChangeKind,
} from "@/lib/book-summary";
import { displayTitle } from "@/lib/text";
import { cn } from "@/lib/utils";

type LoadState = "loading" | "ready" | "missing";

const dateFormat = new Intl.DateTimeFormat("en", { day: "numeric", month: "long", year: "numeric" });
const numberFormat = new Intl.NumberFormat("en");

const relative = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
function timeAgo(iso: string) {
  const seconds = (new Date(iso).getTime() - Date.now()) / 1000;
  const steps: [Intl.RelativeTimeFormatUnit, number][] = [
    ["year", 31536000],
    ["month", 2592000],
    ["week", 604800],
    ["day", 86400],
    ["hour", 3600],
    ["minute", 60],
  ];
  for (const [unit, size] of steps) {
    if (Math.abs(seconds) >= size) return relative.format(Math.round(seconds / size), unit);
  }
  return "Just now";
}

const plural = (n: number, one: string, many = `${one}s`) => `${numberFormat.format(n)} ${n === 1 ? one : many}`;

const readerHref = (id: string, page?: number) =>
  `/reader?id=${encodeURIComponent(id)}${page ? `&page=${page}` : ""}`;

const CHANGE_LABELS: [ChangeKind, string][] = [
  ["heading", "Headings found"],
  ["quote", "Quotes set apart"],
  ["list", "List items"],
  ["caption", "Captions"],
  ["text", "Made plain text"],
  ["join", "Split paragraphs joined"],
  ["drop", "Lines hidden"],
];

const PREVIEW_ROWS = 8;

export function BookDetails() {
  const router = useRouter();
  const params = useSearchParams();
  const id = params.get("id");
  const fromReader = params.get("from") === "reader";

  const [state, setState] = useState<LoadState>("loading");
  const [saved, setSaved] = useState<SavedDocument | null>(null);
  const [settings, setSettings] = useState<ReaderSettings | null>(null);
  const [position, setPosition] = useState<Position | null>(null);
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [renaming, setRenaming] = useState(false);

  useEffect(() => {
    if (!id) {
      router.replace("/library");
      return;
    }
    let cancelled = false;
    void Promise.all([getDocument(id), loadSettings(), loadReadingPosition(id), loadBookmarks(id)]).then(
      ([doc, s, pos, marks]) => {
        if (cancelled) return;
        if (!doc) return setState("missing");
        setSaved(doc);
        setSettings(s);
        setPosition(pos);
        setBookmarks(marks);
        setState("ready");
      }
    );
    return () => {
      cancelled = true;
    };
  }, [id, router]);

  useEffect(() => {
    if (saved?.title) window.document.title = `${saved.title} · Book details · Paperless`;
  }, [saved?.title]);

  // Paged the way the reader will show it, so page numbers here match the reader's
  const doc = useMemo(() => {
    if (!saved || !settings) return null;
    const stored = saved.document;
    if (!stored.rawParagraphs?.length || stored.paginatedWith === paginationKey(settings)) return stored;
    return repaginateDocument(stored, settings);
  }, [saved, settings]);

  const back = fromReader && id
    ? { href: readerHref(id), label: "Back", aria: "Back to reading" }
    : { href: "/", label: "Library", aria: "Back to library" };

  const backLink = (
    <Link
      href={back.href}
      aria-label={back.aria}
      className="-ml-2 inline-flex h-11 items-center gap-0.5 rounded-md px-2 text-[0.9375rem] font-medium hover:bg-accent"
    >
      <ChevronLeft className="size-5" aria-hidden /> {back.label}
    </Link>
  );

  if (state === "missing") {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
        <h1 className="text-xl font-semibold">This book isn’t in your library</h1>
        <p className="max-w-sm text-muted-foreground">
          It may have been removed, or it was added on another device. Books are stored only in this browser.
        </p>
        <Button asChild>
          <Link href="/library">Go to library</Link>
        </Button>
      </main>
    );
  }

  if (state === "loading" || !saved || !doc || !settings || !id) {
    return <DetailsSkeleton backLink={backLink} />;
  }

  const removeBook = async () => {
    const deleted = await deleteDocument(id);
    router.push("/library");
    if (deleted) {
      toast(`Removed “${deleted.saved.title}”`, {
        action: { label: "Undo", onClick: () => void restoreDocument(deleted) },
      });
    }
  };

  const removeAi = async () => {
    const before = saved;
    const cleared: ProcessedDocument = renderAiPages({ ...before.document, ai: undefined });
    await updateDocument(id, cleared);
    setSaved({ ...before, document: cleared });
    toast("Removed AI changes", {
      action: {
        label: "Undo",
        onClick: async () => {
          await updateDocument(id, before.document);
          setSaved(before);
        },
      },
    });
  };

  const setShowExtras = (showExtras: boolean) => {
    const next = { ...settings, showExtras };
    setSettings(next);
    void saveSettings(next);
  };

  return (
    <div className="min-h-dvh">
      <main className="px-safe pt-safe mx-auto max-w-2xl pb-[calc(env(safe-area-inset-bottom)+4rem)] sm:px-6">
        <nav aria-label="Back" className="mt-3">
          {backLink}
        </nav>
        <Overview id={id} saved={saved} doc={doc} position={position} />
        <Contents id={id} doc={doc} />
        <HiddenPages doc={doc} shown={settings.showExtras} onShownChange={setShowExtras} />
        <AiSection id={id} doc={doc} autoCleanup={settings.autoCleanup} onRemove={removeAi} />
        <Bookmarks id={id} doc={doc} bookmarks={bookmarks} />

        <section aria-label="Manage" className="mt-10">
          <ul className="divide-y overflow-hidden rounded-xl border bg-card">
            <li>
              <button type="button" className={rowAction} onClick={() => setRenaming(true)}>
                Rename…
              </button>
            </li>
            <li>
              <button type="button" className={cn(rowAction, "text-destructive")} onClick={() => void removeBook()}>
                Remove from library
              </button>
            </li>
          </ul>
        </section>
      </main>

      <RenameDialog
        open={renaming}
        current={saved.title}
        onClose={() => setRenaming(false)}
        onSave={async (title) => {
          await renameDocument(id, title);
          setRenaming(false);
          const fresh = await getDocument(id);
          if (fresh) setSaved(fresh);
        }}
      />
    </div>
  );
}


const rowBase = "flex min-h-11 w-full items-center gap-3 px-4 py-2.5 text-left text-[1.0625rem] pointer-fine:text-[0.9375rem]";
const rowInteractive =
  "transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring";
const rowAction = cn(rowBase, rowInteractive, "font-medium");

function Group({
  title,
  footer,
  children,
  className,
}: {
  title: string;
  footer?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} className={cn("mt-9", className)}>
      <h2 id={headingId} className="mb-2 px-1 text-[1.25rem] font-semibold leading-tight tracking-tight">
        {title}
      </h2>
      {children}
      {footer && <p className="mt-2 px-1 text-[0.8125rem] leading-snug text-muted-foreground">{footer}</p>}
    </section>
  );
}

function List({ children, label }: { children: React.ReactNode; label?: string }) {
  return (
    <ul aria-label={label} className="divide-y overflow-hidden rounded-xl border bg-card">
      {children}
    </ul>
  );
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <li className={rowBase}>
      <span className="shrink-0">{label}</span>
      <span className="tabular min-w-0 flex-1 truncate text-right text-muted-foreground">{value}</span>
    </li>
  );
}

function PageRow({
  href,
  page,
  children,
  className,
}: {
  href: string;
  page: number;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <li>
      <Link href={href} className={cn(rowBase, rowInteractive, className)}>
        <span className="min-w-0 flex-1">{children}</span>
        <span className="tabular shrink-0 text-[0.875rem] text-muted-foreground">
          <span className="sr-only">Page </span>
          {page}
        </span>
        <ChevronRight className="-mr-1 size-4 shrink-0 text-muted-foreground" aria-hidden />
      </Link>
    </li>
  );
}

function ShowAll({ count, noun, onClick }: { count: number; noun: string; onClick: () => void }) {
  return (
    <li>
      <button type="button" className={cn(rowAction, "font-normal text-muted-foreground")} onClick={onClick}>
        Show all {numberFormat.format(count)} {noun}
      </button>
    </li>
  );
}

function Quote({ text, clamp = 3 }: { text: string; clamp?: 2 | 3 }) {
  return (
    <q
      className={cn(
        "font-serif text-[1rem] leading-normal pointer-fine:text-[0.9375rem]",
        clamp === 2 ? "line-clamp-2" : "line-clamp-3"
      )}
    >
      {text}
    </q>
  );
}


function Overview({
  id,
  saved,
  doc,
  position,
}: {
  id: string;
  saved: SavedDocument;
  doc: ProcessedDocument;
  position: Position | null;
}) {
  const total = Math.max(1, doc.totalPages);
  const page = Math.min(position?.page ?? 0, total);
  const finished = page >= total && page > 0;
  const started = page > 0 && !finished;
  const words = useMemo(() => wordsOnPages(doc), [doc]);
  const wordsLeft = useMemo(() => (started ? wordsOnPages(doc, page) : 0), [doc, page, started]);
  const language = languageName(doc.language);

  return (
    <>
      <header className="mt-4 flex items-start gap-4">
        <div
          aria-hidden
          className="relative flex h-28 w-20 shrink-0 items-end overflow-hidden rounded-md border bg-surface-raised p-2 shadow-xs sm:h-32 sm:w-24"
        >
          <span className="line-clamp-4 font-serif text-[0.625rem] leading-tight text-muted-foreground">{saved.title}</span>
          {page > 0 && (
            <span className="absolute inset-x-0 bottom-0 h-0.5 bg-foreground" style={{ width: `${(page / total) * 100}%` }} />
          )}
        </div>
        <div className="min-w-0 flex-1 pt-1">
          <h1 className="text-[1.75rem] font-bold leading-tight tracking-tight text-balance break-words sm:text-[2.125rem]">
            {saved.title}
          </h1>
          <p className="tabular mt-1.5 text-[0.9375rem] text-muted-foreground">
            {finished ? "Finished" : started ? `Page ${page} of ${total} · ${Math.round((page / total) * 100)}%` : "Not started"}
          </p>
        </div>
      </header>

      <div className="mt-5">
        <Button asChild size="lg" className="w-full sm:w-auto sm:min-w-48">
          <Link href={finished ? readerHref(id, 1) : readerHref(id)}>
            {finished ? "Read again" : started ? "Continue reading" : "Start reading"}
          </Link>
        </Button>
      </div>

      <Group title="Overview" footer={`Reading times assume ${WORDS_PER_MINUTE} words a minute, a typical pace for reading silently.`}>
        <List>
          <InfoRow label="Pages" value={numberFormat.format(doc.totalPages)} />
          <InfoRow label="Words" value={numberFormat.format(words)} />
          <InfoRow label="Reading time" value={readingTime(words)} />
          {started && <InfoRow label="Time left" value={readingTime(wordsLeft)} />}
          {language && <InfoRow label="Language" value={language} />}
          <InfoRow label="Added" value={dateFormat.format(new Date(saved.savedAt))} />
          {saved.lastOpenedAt && <InfoRow label="Last opened" value={timeAgo(saved.lastOpenedAt)} />}
          {saved.source && <SourceRow source={saved.source} />}
        </List>
      </Group>
    </>
  );
}

function SourceRow({ source }: { source: BookSource }) {
  if (source.kind === "file") return <InfoRow label="File" value={<span title={source.name}>{source.name}</span>} />;

  const [label, href, text] =
    source.kind === "gutenberg"
      ? ["Source", `https://www.gutenberg.org/ebooks/${source.id}`, `Project Gutenberg #${source.id}`]
      : ["Link", source.url, hostOf(source.url)];
  return (
    <li>
      <a href={href} target="_blank" rel="noreferrer" className={cn(rowBase, rowInteractive)}>
        <span className="shrink-0">{label}</span>
        <span className="min-w-0 flex-1 truncate text-right text-muted-foreground" title={href}>
          {text}
        </span>
        <ArrowUpRight className="-mr-1 size-4 shrink-0 text-muted-foreground" aria-hidden />
        <span className="sr-only">(opens in a new tab)</span>
      </a>
    </li>
  );
}

function hostOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}


function Contents({ id, doc }: { id: string; doc: ProcessedDocument }) {
  const [all, setAll] = useState(false);
  const toc = useMemo(() => (doc.tableOfContents ?? []).filter((t) => !t.hidden), [doc]);
  if (!toc.length) {
    return (
      <Group title="Contents">
        <p className="rounded-xl border bg-card px-4 py-3 text-[0.9375rem] text-muted-foreground">
          This book has no contents list. Pages follow the text from start to end.
        </p>
      </Group>
    );
  }
  const shown = all || toc.length <= PREVIEW_ROWS + 2 ? toc : toc.slice(0, PREVIEW_ROWS);
  const top = Math.min(...toc.map((t) => t.level));

  return (
    <Group title="Contents">
      <List label="Contents">
        {shown.map((item, i) => (
          <PageRow
            key={`${item.title}-${i}`}
            href={readerHref(id, item.page)}
            page={item.page}
            className={cn(item.level > top && "text-muted-foreground")}
          >
            <span className="block" style={{ paddingLeft: `${(item.level - top) * 1}rem` }}>
              {displayTitle(item.title)}
            </span>
          </PageRow>
        ))}
        {shown.length < toc.length && <ShowAll count={toc.length} noun="sections" onClick={() => setAll(true)} />}
      </List>
    </Group>
  );
}


function HiddenPages({
  doc,
  shown,
  onShownChange,
}: {
  doc: ProcessedDocument;
  shown: boolean;
  onShownChange: (shown: boolean) => void;
}) {
  const ranges = useMemo(() => hiddenRanges(doc), [doc]);
  if (!ranges.length) return null;

  return (
    <Group
      title="Front and back matter"
      footer="This setting applies to every book. You can also change it at the end of Contents in the reader."
    >
      <p className="mb-3 px-1 text-[0.9375rem] text-muted-foreground">
        {shown
          ? "Pages like praise, copyright and the index are part of the book’s pages."
          : "Paperless hides pages like praise, copyright and the index, so the book opens on its first chapter."}
      </p>
      <List>
        {ranges.map((range) => (
          <li key={range.where} className="space-y-1 px-4 py-3">
            <div className="flex items-baseline justify-between gap-3 text-[1.0625rem] pointer-fine:text-[0.9375rem]">
              <span>{range.where === "start" ? "Before the first chapter" : "After the last chapter"}</span>
              <span className="tabular shrink-0 text-muted-foreground">{plural(range.words, "word")}</span>
            </div>
            {range.entries.length > 0 && (
              <p className="text-[0.8125rem] text-muted-foreground">{range.entries.map(displayTitle).join(", ")}</p>
            )}
            {range.firstLine && (
              <div className="pt-1 text-muted-foreground">
                <span className="sr-only">Starts with </span>
                <Quote text={range.firstLine} clamp={2} />
              </div>
            )}
          </li>
        ))}
        <li>
          <label htmlFor="show-extras" className={cn(rowBase, "cursor-pointer justify-between")}>
            Show these pages
            <Switch id="show-extras" checked={shown} onCheckedChange={onShownChange} />
          </label>
        </li>
      </List>
    </Group>
  );
}


function AiSection({
  id,
  doc,
  autoCleanup,
  onRemove,
}: {
  id: string;
  doc: ProcessedDocument;
  autoCleanup: boolean;
  onRemove: () => void;
}) {
  const summary = useMemo(() => summarizeAi(doc), [doc]);
  const pageOf = useMemo(() => pageOfParagraph(doc), [doc]);
  const [allPassages, setAllPassages] = useState(false);
  const [allDropped, setAllDropped] = useState(false);

  const about =
    "The AI only labels paragraphs, as a heading, a quote or a list, and can hide stray lines such as leftover page numbers. It never changes the book’s words.";

  if (!summary) {
    return (
      <Group title="AI layout" footer={about}>
        <p className="rounded-xl border bg-card px-4 py-3 text-[0.9375rem] text-muted-foreground">
          {autoCleanup
            ? "The AI hasn’t checked any pages yet. It checks each page as you read it."
            : "The AI hasn’t checked any pages. Turn on “Check layout with AI” in Appearance to have it check pages as you read."}
        </p>
      </Group>
    );
  }

  const passages = allPassages ? summary.passages : summary.passages.slice(0, PREVIEW_ROWS);
  const dropped = allDropped ? summary.dropped : summary.dropped.slice(0, PREVIEW_ROWS);
  const changeRows = CHANGE_LABELS.filter(([kind]) => summary.changes[kind]);

  return (
    <>
      <Group title="AI layout" footer={about}>
        <List>
          <InfoRow label="Pages checked" value={`${summary.pagesChecked} of ${doc.totalPages}`} />
          {changeRows.map(([kind, label]) => (
            <InfoRow key={kind} label={label} value={numberFormat.format(summary.changes[kind]!)} />
          ))}
          {!changeRows.length && <InfoRow label="Layout changes" value="None so far" />}
        </List>
      </Group>

      {summary.dropped.length > 0 && (
        <Group title="Lines the AI hid" className="mt-7">
          <List label="Lines the AI hid">
            {dropped.map((i) => (
              <PassageRow key={i} id={id} page={pageOf.get(i)} text={doc.rawParagraphs[i] ?? ""} />
            ))}
            {dropped.length < summary.dropped.length && (
              <ShowAll count={summary.dropped.length} noun="lines" onClick={() => setAllDropped(true)} />
            )}
          </List>
        </Group>
      )}

      {summary.passages.length > 0 && (
        <Group
          title="Key passages"
          className="mt-7"
          footer="Exact lines from the book that the AI marked as worth remembering."
        >
          <List label="Key passages">
            {passages.map((p, k) => (
              <PassageRow key={`${p.paragraph}-${k}`} id={id} page={pageOf.get(p.paragraph)} text={p.text} />
            ))}
            {passages.length < summary.passages.length && (
              <ShowAll count={summary.passages.length} noun="passages" onClick={() => setAllPassages(true)} />
            )}
          </List>
        </Group>
      )}

      <section aria-label="Undo the AI’s layout" className="mt-7">
        <List>
          <li>
            <button type="button" className={cn(rowAction, "text-destructive")} onClick={onRemove}>
              Remove AI changes
            </button>
          </li>
        </List>
        <p className="mt-2 px-1 text-[0.8125rem] leading-snug text-muted-foreground">
          Shows this book in the layout Paperless found on import.
          {autoCleanup && " While “Check layout with AI” is on, pages are checked again as you read them."}
        </p>
      </section>
    </>
  );
}

function PassageRow({ id, page, text }: { id: string; page: number | undefined; text: string }) {
  // Passages in hidden front or back matter have no page to open
  if (!page) {
    return (
      <li className={cn(rowBase, "text-muted-foreground")}>
        <span className="min-w-0 flex-1">
          <Quote text={text} />
        </span>
        <span className="shrink-0 text-[0.8125rem]">Hidden</span>
      </li>
    );
  }
  return (
    <PageRow href={readerHref(id, page)} page={page} className="py-3">
      <Quote text={text} />
    </PageRow>
  );
}


function Bookmarks({ id, doc, bookmarks }: { id: string; doc: ProcessedDocument; bookmarks: Bookmark[] }) {
  if (!bookmarks.length) return null;
  return (
    <Group title="Bookmarks">
      <List label="Bookmarks">
        {bookmarks.map((b) => {
          const page = Math.min(b.page, doc.totalPages);
          const content = doc.pages[page - 1]?.content.replace(/\s+/g, " ").trim();
          return (
            <PageRow key={b.id} href={readerHref(id, page)} page={page} className="py-3">
              <span className="line-clamp-2 text-[0.9375rem] text-muted-foreground pointer-fine:text-[0.875rem]">
                {b.note || content}
              </span>
            </PageRow>
          );
        })}
      </List>
    </Group>
  );
}


function RenameDialog({
  open,
  current,
  onClose,
  onSave,
}: {
  open: boolean;
  current: string;
  onClose: () => void;
  onSave: (title: string) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        {open && <RenameForm current={current} onClose={onClose} onSave={onSave} />}
      </DialogContent>
    </Dialog>
  );
}

function RenameForm({
  current,
  onClose,
  onSave,
}: {
  current: string;
  onClose: () => void;
  onSave: (title: string) => void;
}) {
  const [title, setTitle] = useState(current);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (title.trim()) onSave(title.trim());
      }}
    >
      <DialogHeader>
        <DialogTitle>Rename</DialogTitle>
        <DialogDescription className="sr-only">Change the book’s title</DialogDescription>
      </DialogHeader>
      <label htmlFor="book-title" className="sr-only">
        Title
      </label>
      <input
        id="book-title"
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onFocus={(e) => e.target.select()}
        className="mt-4 h-11 w-full rounded-lg border bg-background px-3 text-[1.0625rem] outline-none focus-visible:outline-2 focus-visible:outline-ring pointer-fine:h-10 pointer-fine:text-[0.9375rem]"
      />
      <DialogFooter className="mt-6">
        <Button type="button" variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" disabled={!title.trim() || title.trim() === current}>
          Save
        </Button>
      </DialogFooter>
    </form>
  );
}


function DetailsSkeleton({ backLink }: { backLink: React.ReactNode }) {
  return (
    <main
      aria-busy="true"
      aria-label="Loading book details"
      className="px-safe pt-safe mx-auto max-w-2xl sm:px-6"
    >
      <div className="mt-3">{backLink}</div>
      <div className="mt-4 flex items-start gap-4">
        <Skeleton className="h-28 w-20 sm:h-32 sm:w-24" />
        <div className="flex-1 space-y-3 pt-2">
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-4 w-1/3" />
        </div>
      </div>
      <Skeleton className="mt-5 h-12 w-full rounded-md sm:w-48" />
      <Skeleton className="mt-10 h-6 w-28" />
      <Skeleton className="mt-3 h-64 w-full rounded-xl" />
    </main>
  );
}
