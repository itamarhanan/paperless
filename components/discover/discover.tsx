"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowUpRight, BookOpen, ChevronLeft, ChevronRight, Loader2, Search, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Segmented } from "@/components/reader/segmented";
import { useIsDesktop } from "@/hooks/use-media-query";
import { importDocument, loadSettings } from "@/lib/storage";
import { readGutenberg } from "@/lib/import";
import { aiHeaders } from "@/lib/ai-key";
import { gutenbergPage, type DiscoverBook, type DiscoverDetails } from "@/lib/discover";
import { cn } from "@/lib/utils";

type Mode = "search" | "ask";

const SEARCH_IDEAS = ["Stoicism", "Philosophy", "Poetry", "Jane Austen", "Science fiction", "History of Rome"];
const ASK_IDEAS = [
  "Practical books on resilience I can apply day to day",
  "Short classics to read in a weekend",
  "Books that explain how the mind works, for a beginner",
  "Novels about starting over",
];

type Results =
  | { state: "idle" }
  | { state: "loading" }
  | { state: "error"; message: string }
  | { state: "done"; free: DiscoverBook[]; books: DiscoverBook[]; dropped?: number };

export function Discover() {
  const router = useRouter();
  const params = useSearchParams();
  const mode: Mode = params.get("mode") === "ask" ? "ask" : "search";
  const submitted = params.get("q") ?? "";
  const [input, setInput] = useState(submitted);
  // Keep the field in step with the URL (Back, a new link) without an effect
  const [shownQuery, setShownQuery] = useState(submitted);
  if (shownQuery !== submitted) {
    setShownQuery(submitted);
    setInput(submitted);
  }
  // Answers are tagged with the request they belong to; anything else is still loading
  const [answer, setAnswer] = useState<{ request: string; results: Results } | null>(null);
  const [selected, setSelected] = useState<DiscoverBook | null>(null);
  const [attempt, setAttempt] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // The query lives in the URL, so Back returns to these results
  const go = (next: { mode?: Mode; q?: string }) => {
    const q = (next.q ?? submitted).trim();
    const m = next.mode ?? mode;
    const search = new URLSearchParams();
    if (m === "ask") search.set("mode", "ask");
    if (q) search.set("q", q);
    router.replace(`/discover${search.size ? `?${search}` : ""}`, { scroll: false });
  };

  const requestKey = `${mode}\u0000${submitted}\u0000${attempt}`;
  const results: Results = !submitted
    ? { state: "idle" }
    : answer?.request === requestKey
      ? answer.results
      : { state: "loading" };

  useEffect(() => {
    if (!submitted) return;
    const controller = new AbortController();
    const setResults = (results: Results) => setAnswer({ request: requestKey, results });
    const request =
      mode === "search"
        ? fetch(`/api/discover/search?q=${encodeURIComponent(submitted)}`, { signal: controller.signal })
        : fetch("/api/discover/ask", {
            method: "POST",
            headers: { "Content-Type": "application/json", ...aiHeaders() },
            body: JSON.stringify({ prompt: submitted }),
            signal: controller.signal,
          });
    request
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data?.error ?? "Something went wrong. Try again.");
        if (mode === "search") setResults({ state: "done", free: data.free ?? [], books: data.books ?? [] });
        else {
          const books: DiscoverBook[] = data.books ?? [];
          setResults({
            state: "done",
            free: books.filter((b) => b.gutenbergId),
            books: books.filter((b) => !b.gutenbergId),
            dropped: data.dropped,
          });
        }
      })
      .catch((error: Error) => {
        if (error.name !== "AbortError") setResults({ state: "error", message: error.message });
      });
    return () => controller.abort();
  }, [mode, submitted, requestKey]);

  const ideas = mode === "search" ? SEARCH_IDEAS : ASK_IDEAS;

  return (
    <div className="min-h-dvh">
      <header className="pt-safe">
        <div className="px-safe mx-auto flex h-12 max-w-3xl items-center sm:px-6">
          <Button asChild variant="ghost" className="-ml-2 gap-0.5 px-2 has-[>svg]:px-2">
            <Link href="/">
              <ChevronLeft className="size-5" />
              Library
            </Link>
          </Button>
        </div>
      </header>

      <main className="px-safe mx-auto max-w-3xl pb-[calc(env(safe-area-inset-bottom)+3rem)] sm:px-6">
        <h1 className="mb-4 text-[2.125rem] font-bold leading-tight tracking-tight">Discover</h1>

        <Segmented
          label="How to find books"
          value={mode}
          onChange={(m) => go({ mode: m, q: "" })}
          options={[
            { value: "search", label: "Search" },
            { value: "ask", label: "Ask for ideas" },
          ]}
          className="mb-3"
        />

        <form
          role="search"
          className="flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            go({ q: input });
            inputRef.current?.blur();
          }}
        >
          <div className="relative flex-1">
            {mode === "search" ? (
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            ) : (
              <Sparkles className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            )}
            <input
              ref={inputRef}
              type="search"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={mode === "search" ? "Title, author or subject" : "What would you like to read about?"}
              aria-label={mode === "search" ? "Search books" : "Describe the books you’re looking for"}
              enterKeyHint={mode === "search" ? "search" : "go"}
              maxLength={mode === "search" ? 200 : 600}
              className="h-11 w-full rounded-lg bg-muted pl-9 pr-3 text-[1.0625rem] outline-none placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-ring pointer-fine:h-10 pointer-fine:text-[0.9375rem]"
            />
          </div>
          <Button type="submit" disabled={!input.trim() || results.state === "loading"}>
            {mode === "search" ? "Search" : "Ask"}
          </Button>
        </form>
        <p className="mt-2 text-[0.8125rem] text-muted-foreground">
          {mode === "search"
            ? "Free books come from Project Gutenberg; everything else from Open Library."
            : "AI suggests books, and each one is checked against Open Library. It can still miss the mark."}
        </p>

        <section className="mt-8" aria-live="polite" aria-busy={results.state === "loading"}>
          {results.state === "idle" && (
            <div>
              <h2 className="mb-3 text-[0.8125rem] font-medium text-muted-foreground">
                {mode === "search" ? "Try" : "For example"}
              </h2>
              <div className="flex flex-wrap gap-2">
                {ideas.map((idea) => (
                  <button
                    key={idea}
                    type="button"
                    onClick={() => go({ q: idea })}
                    className="min-h-11 rounded-full border px-4 py-2 text-left text-[0.9375rem] transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring pointer-fine:min-h-9 pointer-fine:py-1.5"
                  >
                    {idea}
                  </button>
                ))}
              </div>
            </div>
          )}

          {results.state === "loading" && <ResultsSkeleton label={mode === "search" ? "Searching…" : "Finding books that fit…"} />}

          {results.state === "error" && (
            <div className="rounded-xl bg-muted p-5">
              <p className="font-medium">{results.message}</p>
              <Button variant="outline" className="mt-3" onClick={() => setAttempt((n) => n + 1)}>
                Try again
              </Button>
            </div>
          )}

          {results.state === "done" && (
            <>
              {!results.free.length && !results.books.length && (
                <div className="py-10 text-center">
                  <p className="font-medium">No books found</p>
                  <p className="mt-1 text-[0.9375rem] text-muted-foreground">
                    {mode === "search" ? "Try a different title, author or subject." : "Try describing it another way."}
                  </p>
                </div>
              )}
              {results.free.length > 0 && (
                <BookSection title="Free to read now" books={results.free} onOpen={setSelected} />
              )}
              {results.books.length > 0 && (
                <BookSection
                  title={mode === "search" ? "More books" : results.free.length ? "Also worth a look" : "Suggestions"}
                  note="Not free to read here. Open one to borrow or buy it."
                  books={results.books}
                  onOpen={setSelected}
                />
              )}
            </>
          )}
        </section>
      </main>

      <BookSheet book={selected} onClose={() => setSelected(null)} />
    </div>
  );
}

function BookSection({
  title,
  note,
  books,
  onOpen,
}: {
  title: string;
  note?: string;
  books: DiscoverBook[];
  onOpen: (book: DiscoverBook) => void;
}) {
  return (
    <section className="mb-8">
      <h2 className="text-[1.25rem] font-semibold">{title}</h2>
      {note && <p className="mt-0.5 text-[0.8125rem] text-muted-foreground">{note}</p>}
      <ul className="mt-2 divide-y">
        {books.map((book) => (
          <li key={book.id}>
            <button
              type="button"
              onClick={() => onOpen(book)}
              className="group flex w-full items-center gap-3 py-3 text-left focus-visible:rounded-lg focus-visible:outline-2 focus-visible:outline-ring"
            >
              <Cover book={book} className="h-16 w-11" />
              <span className="min-w-0 flex-1">
                <span className="line-clamp-2 text-[1.0625rem] font-medium leading-snug">{book.title}</span>
                <span className="mt-0.5 block truncate text-[0.8125rem] text-muted-foreground">
                  {[book.authors.join(", "), book.year].filter(Boolean).join(" · ")}
                </span>
                {book.reason && (
                  <span className="mt-1 line-clamp-2 block text-[0.875rem] text-muted-foreground">
                    <Sparkles className="mr-1 inline size-3.5 align-[-2px]" aria-label="Why the AI suggests it:" />
                    {book.reason}
                  </span>
                )}
              </span>
              {book.gutenbergId && (
                <span className="shrink-0 rounded-full border border-foreground px-2 py-0.5 text-[0.75rem] font-medium">
                  Free
                </span>
              )}
              <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Cover({ book, className }: { book: DiscoverBook; className?: string }) {
  const [failed, setFailed] = useState(false);
  return (
    <span
      aria-hidden
      className={cn(
        "relative flex shrink-0 items-end overflow-hidden rounded-[0.3rem] border bg-surface-raised p-1.5 shadow-xs",
        className
      )}
    >
      {book.cover && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={book.cover}
          alt=""
          loading="lazy"
          onError={() => setFailed(true)}
          className="absolute inset-0 size-full object-cover"
        />
      ) : (
        <span className="line-clamp-3 font-serif text-[0.4375rem] leading-[1.25] text-muted-foreground">{book.title}</span>
      )}
    </span>
  );
}

/** One book: what it is, why it fits, and how to read it. */
function BookSheet({ book, onClose }: { book: DiscoverBook | null; onClose: () => void }) {
  const desktop = useIsDesktop();
  const open = !!book;
  const body = book ? <BookDetails book={book} /> : null;
  const authors = book?.authors.join(", ") || "Unknown author";

  if (desktop) {
    return (
      <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader className="sr-only">
            <DialogTitle>{book?.title}</DialogTitle>
            <DialogDescription>{authors}</DialogDescription>
          </DialogHeader>
          {body}
        </DialogContent>
      </Dialog>
    );
  }
  return (
    <Drawer open={open} onOpenChange={(o) => !o && onClose()}>
      <DrawerContent className="max-h-[90dvh]">
        <DrawerHeader className="sr-only">
          <DrawerTitle>{book?.title}</DrawerTitle>
          <DrawerDescription>{authors}</DrawerDescription>
        </DrawerHeader>
        <div className="pb-safe overflow-y-auto px-5 pb-6">{body}</div>
      </DrawerContent>
    </Drawer>
  );
}

function BookDetails({ book }: { book: DiscoverBook }) {
  const router = useRouter();
  const [details, setDetails] = useState<DiscoverDetails | null>(null);
  const [loading, setLoading] = useState(!!book.workKey);
  const [adding, setAdding] = useState<"idle" | "adding" | "failed">("idle");
  const [addError, setAddError] = useState("");

  useEffect(() => {
    if (!book.workKey) return;
    const controller = new AbortController();
    fetch(`/api/discover/work?key=${encodeURIComponent(book.workKey)}`, { signal: controller.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setDetails(d))
      .catch(() => {})
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [book.workKey]);

  const add = async () => {
    if (!book.gutenbergId) return;
    setAdding("adding");
    try {
      const doc = await readGutenberg(book.gutenbergId, book.title, await loadSettings());
      const id = await importDocument(doc, { kind: "gutenberg", id: book.gutenbergId });
      router.push(`/reader?id=${encodeURIComponent(id)}`);
    } catch (error) {
      setAddError((error as Error).message);
      setAdding("failed");
    }
  };

  const subjects = (details?.subjects ?? book.subjects ?? []).slice(0, 8);
  const openLibrary = book.workKey ? `https://openlibrary.org${book.workKey}` : null;

  return (
    <article>
      <div className="flex gap-4">
        <Cover book={book} className="h-36 w-24" />
        <div className="min-w-0 pt-1">
          <h2 className="text-[1.375rem] font-semibold leading-tight">{book.title}</h2>
          <p className="mt-1 text-[0.9375rem] text-muted-foreground">{book.authors.join(", ") || "Unknown author"}</p>
          <p className="tabular mt-1 text-[0.8125rem] text-muted-foreground">
            {[book.year && `First published ${book.year}`, book.pages && `${book.pages} pages`].filter(Boolean).join(" · ")}
          </p>
        </div>
      </div>

      {book.reason && (
        <p className="mt-5 rounded-xl bg-muted p-4 text-[0.9375rem]">
          <span className="mb-1 flex items-center gap-1.5 text-[0.8125rem] font-medium text-muted-foreground">
            <Sparkles className="size-3.5" aria-hidden /> Why the AI suggests it
          </span>
          {book.reason}
        </p>
      )}

      <div className="mt-5 flex flex-col gap-2">
        {book.gutenbergId ? (
          <>
            <Button size="lg" onClick={add} disabled={adding === "adding"}>
              {adding === "adding" ? (
                <>
                  <Loader2 className="animate-spin" /> Adding to library…
                </>
              ) : (
                <>
                  <BookOpen /> Add to library and read
                </>
              )}
            </Button>
            {adding === "failed" && (
              <p role="alert" className="text-[0.875rem] text-destructive">
                {addError}
              </p>
            )}
            <p className="text-[0.8125rem] text-muted-foreground">
              Free from Project Gutenberg, a library of books whose US copyright has expired.
            </p>
          </>
        ) : (
          openLibrary && (
            <Button size="lg" variant="outline" asChild>
              <a href={openLibrary} target="_blank" rel="noopener noreferrer">
                Borrow or buy on Open Library <ArrowUpRight />
              </a>
            </Button>
          )
        )}
      </div>

      <div className="mt-6">
        {loading ? (
          <div className="space-y-2" aria-label="Loading description">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-11/12" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        ) : details?.description ? (
          <p className="whitespace-pre-line text-[0.9375rem] leading-relaxed">{details.description}</p>
        ) : null}
      </div>

      {subjects.length > 0 && (
        <ul className="mt-5 flex flex-wrap gap-1.5" aria-label="Subjects">
          {subjects.map((s) => (
            <li key={s} className="rounded-full bg-muted px-2.5 py-1 text-[0.8125rem] text-muted-foreground">
              {s}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-6 flex flex-wrap gap-x-4 gap-y-1 text-[0.875rem]">
        {openLibrary && book.gutenbergId && (
          <a href={openLibrary} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">
            Open Library page
          </a>
        )}
        {book.gutenbergId && (
          <a
            href={gutenbergPage(book.gutenbergId)}
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-4"
          >
            Project Gutenberg page
          </a>
        )}
      </div>
    </article>
  );
}

function ResultsSkeleton({ label }: { label: string }) {
  return (
    <div>
      <p className="mb-3 flex items-center gap-2 text-[0.9375rem] text-muted-foreground" role="status">
        <Loader2 className="size-4 animate-spin" aria-hidden /> {label}
      </p>
      <ul className="divide-y" aria-hidden>
        {Array.from({ length: 5 }, (_, i) => (
          <li key={i} className="flex items-center gap-3 py-3">
            <Skeleton className="h-16 w-11" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-3 w-1/3" />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
