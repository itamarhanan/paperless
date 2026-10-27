"use client";

import { useCallback, useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowUpDown,
  BookOpen,
  Download,
  Share,
  Compass,
  Ellipsis,
  FileText,
  Info,
  Link2,
  Pencil,
  Plus,
  Search,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
  deleteDocument,
  exportLibrary,
  importDocument,
  importLibrary,
  LIBRARY_CHANGED,
  listDocuments,
  loadAllPositions,
  loadSettings,
  renameDocument,
  restoreDocument,
  type Position,
  type SavedDocument,
} from "@/lib/storage";
import { rememberLibrary } from "@/lib/home";
import { readFile, readGutenberg, readUrl } from "@/lib/import";
import { cn } from "@/lib/utils";
import { tourSeen } from "@/lib/tour";
import { useIsClient } from "@/hooks/use-is-client";

type Sort = "recent" | "title" | "added";

interface ImportJob {
  key: string;
  name: string;
  progress: number;
  error?: string;
  source: { file: File } | { url: string } | { gutenberg: number; title: string };
}

const ACCEPT = ".pdf,.epub,application/pdf,application/epub+zip";

const relative = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
function timeAgo(iso?: string) {
  if (!iso) return "";
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
    if (Math.abs(seconds) >= size)
      return relative.format(Math.round(seconds / size), unit);
  }
  return "just now";
}

function progressOf(doc: SavedDocument, position?: Position) {
  const total = doc.document.totalPages || 1;
  const page = Math.min(position?.page ?? 0, total);
  return { page, total, fraction: page / total };
}

export function Library() {
  const router = useRouter();
  const [docs, setDocs] = useState<SavedDocument[] | null>(null);
  const [positions, setPositions] = useState<Map<string, Position>>(new Map());
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<Sort>("recent");
  const [jobs, setJobs] = useState<ImportJob[]>([]);
  const [linkOpen, setLinkOpen] = useState(false);
  const [renaming, setRenaming] = useState<SavedDocument | null>(null);
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const importChain = useRef(Promise.resolve());

  const refresh = useCallback(
    () =>
      Promise.all([listDocuments(), loadAllPositions()]).then(([list, pos]) => {
        setDocs(list);
        setPositions(pos);
        rememberLibrary(list.length > 0);
        return list;
      }),
    [],
  );


  // ----- Import -----
  const updateJob = (key: string, patch: Partial<ImportJob>) =>
    setJobs((all) => all.map((j) => (j.key === key ? { ...j, ...patch } : j)));

  const runJob = useCallback(
    (job: ImportJob, openWhenDone: boolean) => {
      // One at a time: parsing is CPU-heavy and runs on the main thread's worker
      importChain.current = importChain.current.then(async () => {
        try {
          const settings = await loadSettings();
          const onProgress = (p: number) => updateJob(job.key, { progress: p });
          const { source } = job;
          const doc =
            "file" in source
              ? await readFile(source.file, settings, onProgress)
              : "url" in source
                ? await readUrl(source.url, settings, onProgress)
                : await readGutenberg(source.gutenberg, source.title, settings);
          if (!doc.pages.length)
            throw new Error(
              "No readable text found. Scanned PDFs aren’t supported yet.",
            );
          const id = await importDocument(
            doc,
            "file" in source
              ? { kind: "file", name: source.file.name }
              : "url" in source
                ? { kind: "link", url: source.url }
                : { kind: "gutenberg", id: source.gutenberg },
          );
          setJobs((all) => all.filter((j) => j.key !== job.key));
          // The sample opens with the guided tour, until it has been seen
          const tour = "gutenberg" in source && source.gutenberg === SAMPLE.id && !tourSeen() ? "&tour=1" : "";
          if (openWhenDone) router.push(`/reader?id=${encodeURIComponent(id)}${tour}`);
          else {
            await refresh();
            toast(`Added “${doc.title}”`);
          }
        } catch (error) {
          updateJob(job.key, {
            error: (error as Error).message || "Couldn’t open this file.",
          });
        }
      });
    },
    [refresh, router],
  );

  const importFiles = useCallback(
    (files: FileList | File[]) => {
      const list = [...files].filter(
        (f) => /\.(pdf|epub)$/i.test(f.name) || /pdf|epub/.test(f.type),
      );
      if (!list.length) {
        toast.error("Paperless opens PDF and EPUB files.");
        return;
      }
      const newJobs = list.map((file) => ({
        key: crypto.randomUUID(),
        name: file.name,
        progress: 0,
        source: { file },
      }));
      setJobs((all) => [...newJobs, ...all]);
      newJobs.forEach((job) => runJob(job, list.length === 1));
    },
    [runJob],
  );

  const importUrl = (url: string) => {
    const job: ImportJob = {
      key: crypto.randomUUID(),
      name: url,
      progress: 0,
      source: { url },
    };
    setJobs((all) => [job, ...all]);
    runJob(job, true);
  };

  // A first book in one tap: Meditations, free on Project Gutenberg
  const addSample = () => {
    const job: ImportJob = {
      key: crypto.randomUUID(),
      name: SAMPLE.title,
      progress: 0.5,
      source: { gutenberg: SAMPLE.id, title: SAMPLE.title },
    };
    setJobs((all) => [job, ...all]);
    runJob(job, true);
  };

  const startSample = useEffectEvent((list: SavedDocument[]) => {
    const existing = list.find((d) => d.source?.kind === "gutenberg" && d.source.id === SAMPLE.id);
    if (existing) router.push(`/reader?id=${encodeURIComponent(existing.id)}`);
    else addSample();
  });

  useEffect(() => {
    void refresh().then((list) => {
      // The front page's "Start with Meditations" arrives as /library?sample
      if (!new URLSearchParams(window.location.search).has("sample")) return;
      window.history.replaceState(null, "", "/library");
      startSample(list);
    });
    const onChange = () => void refresh();
    window.addEventListener(LIBRARY_CHANGED, onChange);
    return () => window.removeEventListener(LIBRARY_CHANGED, onChange);
  }, [refresh]);

  // ----- Backup -----
  const backupInput = useRef<HTMLInputElement>(null);
  const backUp = async () => {
    const blob = await exportLibrary();
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement("a"), {
      href: url,
      download: `Paperless library ${new Date().toISOString().slice(0, 10)}.json`,
    });
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const restore = async (file: File) => {
    try {
      const count = await importLibrary(file);
      toast(count === 1 ? "Restored 1 book" : `Restored ${count} books`);
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  // ----- Drop anywhere (desktop) -----
  useEffect(() => {
    let depth = 0;
    const hasFiles = (e: DragEvent) => e.dataTransfer?.types.includes("Files");
    const enter = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      depth++;
      setDragging(true);
    };
    const leave = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      depth = Math.max(0, depth - 1);
      if (!depth) setDragging(false);
    };
    const over = (e: DragEvent) => {
      if (hasFiles(e)) e.preventDefault();
    };
    const drop = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth = 0;
      setDragging(false);
      if (e.dataTransfer?.files.length) importFiles(e.dataTransfer.files);
    };
    window.addEventListener("dragenter", enter);
    window.addEventListener("dragleave", leave);
    window.addEventListener("dragover", over);
    window.addEventListener("drop", drop);
    return () => {
      window.removeEventListener("dragenter", enter);
      window.removeEventListener("dragleave", leave);
      window.removeEventListener("dragover", over);
      window.removeEventListener("drop", drop);
    };
  }, [importFiles]);

  // ----- Delete with undo (feedback.md: no warning when deleting is the expected result) -----
  const remove = async (doc: SavedDocument) => {
    const deleted = await deleteDocument(doc.id);
    setDocs((all) => all?.filter((d) => d.id !== doc.id) ?? null);
    if (deleted) {
      toast(`Removed “${doc.title}”`, {
        action: { label: "Undo", onClick: () => void restoreDocument(deleted) },
      });
    }
  };

  const visible = useMemo(() => {
    if (!docs) return [];
    const q = query.trim().toLowerCase();
    const filtered = q
      ? docs.filter((d) => d.title.toLowerCase().includes(q))
      : docs;
    const sorted = [...filtered];
    if (sort === "title") sorted.sort((a, b) => a.title.localeCompare(b.title));
    if (sort === "added")
      sorted.sort((a, b) => b.savedAt.localeCompare(a.savedAt));
    return sorted;
  }, [docs, query, sort]);

  const resume = useMemo(() => {
    const last = docs?.find((d) => d.lastOpenedAt && positions.has(d.id));
    if (!last) return null;
    const p = progressOf(last, positions.get(last.id));
    return p.page >= 1 && p.page < p.total ? { doc: last, ...p } : null;
  }, [docs, positions]);

  const openPicker = () => fileInput.current?.click();
  const empty = docs !== null && docs.length === 0 && jobs.length === 0;

  return (
    <div className="min-h-dvh">
      <input
        ref={fileInput}
        type="file"
        accept={ACCEPT}
        multiple
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => {
          if (e.target.files?.length) importFiles(e.target.files);
          e.target.value = "";
        }}
      />

      <input
        ref={backupInput}
        type="file"
        accept=".json,application/json"
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void restore(file);
          e.target.value = "";
        }}
      />

      <header className="pt-safe">
        <div className="h-4 sm:h-8" />
      </header>

      <main className="px-safe mx-auto max-w-3xl pb-[calc(env(safe-area-inset-bottom)+3rem)] sm:px-6">
        {/* Large title (typography.md: Large Title 34pt bold) */}
        <div className="mb-4 flex items-center justify-between gap-2">
          <h1 className="text-[2.125rem] font-bold leading-tight tracking-tight">
            Library
          </h1>
          <div className="flex items-center">
            <Button asChild variant="ghost" className="gap-1.5 font-semibold">
              <Link href="/discover">
                <Compass /> Discover
              </Link>
            </Button>
            {!empty && (
              <AddMenu onFile={openPicker} onLink={() => setLinkOpen(true)} />
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="-mr-2" aria-label="Library options">
                  <Ellipsis />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-56">
                <DropdownMenuItem onSelect={() => void backUp()} disabled={!docs?.length}>
                  <Download /> Back up library
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => backupInput.current?.click()}>
                  <Upload /> Restore from backup…
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {!!docs?.length && <HomeScreenHint />}

        {docs === null ? (
          <LibrarySkeleton />
        ) : empty ? (
          <EmptyLibrary onFile={openPicker} onLink={() => setLinkOpen(true)} onSample={addSample} />
        ) : (
          <>
            {resume && !query && (
              <Link
                href={`/reader?id=${encodeURIComponent(resume.doc.id)}`}
                className="group mb-6 block rounded-2xl bg-primary p-5 text-primary-foreground transition-opacity hover:opacity-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                <span className="text-[0.8125rem] opacity-70">
                  Continue reading
                </span>
                <span className="mt-0.5 line-clamp-2 block text-[1.25rem] font-semibold leading-snug">
                  {resume.doc.title}
                </span>
                <span className="mt-4 flex items-center gap-3">
                  <span className="h-1 flex-1 overflow-hidden rounded-full bg-primary-foreground/25">
                    <span
                      className="block h-full rounded-full bg-primary-foreground"
                      style={{
                        width: `${Math.max(2, resume.fraction * 100)}%`,
                      }}
                    />
                  </span>
                  <span className="tabular text-[0.8125rem] opacity-80">
                    Page {resume.page} of {resume.total}
                  </span>
                </span>
              </Link>
            )}

            <div className="mb-2 flex items-center gap-2">
              <div className="relative flex-1">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden
                />
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search library"
                  aria-label="Search library"
                  enterKeyHint="search"
                  className="h-11 w-full rounded-lg bg-muted pl-9 pr-3 text-[1.0625rem] outline-none placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-ring pointer-fine:h-9 pointer-fine:text-[0.9375rem]"
                />
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" aria-label="Sort">
                    <ArrowUpDown />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>Sort by</DropdownMenuLabel>
                  <DropdownMenuRadioGroup
                    value={sort}
                    onValueChange={(v) => setSort(v as Sort)}
                  >
                    <DropdownMenuRadioItem value="recent">
                      Recently opened
                    </DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="added">
                      Recently added
                    </DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="title">
                      Title
                    </DropdownMenuRadioItem>
                  </DropdownMenuRadioGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <ul className="divide-y" aria-label="Documents">
              {jobs.map((job) => (
                <ImportRow
                  key={job.key}
                  job={job}
                  onRetry={() => {
                    updateJob(job.key, { error: undefined, progress: 0 });
                    runJob(job, true);
                  }}
                  onDismiss={() =>
                    setJobs((all) => all.filter((j) => j.key !== job.key))
                  }
                />
              ))}
              {visible.map((doc) => (
                <DocumentRow
                  key={doc.id}
                  doc={doc}
                  position={positions.get(doc.id)}
                  onRename={() => setRenaming(doc)}
                  onRemove={() => remove(doc)}
                />
              ))}
            </ul>

            {query && !visible.length && (
              <p className="py-10 text-center text-muted-foreground">
                No documents match “{query.trim()}”.
              </p>
            )}

            <p className="mt-8 hidden text-center text-[0.8125rem] text-muted-foreground pointer-fine:block">
              Drop PDF or EPUB files anywhere to add them.
            </p>
          </>
        )}
        <footer className="mt-10 flex justify-center gap-5 text-[0.8125rem] text-muted-foreground">
          {[
            ["/about", "About"],
            ["/how-it-works", "How it works"],
            ["/privacy", "Privacy"],
          ].map(([href, label]) => (
            <Link key={href} href={href} className="rounded-sm underline-offset-4 hover:text-foreground hover:underline">
              {label}
            </Link>
          ))}
        </footer>
      </main>

      <LinkDialog
        open={linkOpen}
        onOpenChange={setLinkOpen}
        onSubmit={importUrl}
      />
      <RenameDialog
        doc={renaming}
        onClose={() => setRenaming(null)}
        onSave={async (title) => {
          if (!renaming) return;
          await renameDocument(renaming.id, title);
          setRenaming(null);
          void refresh();
        }}
      />

      {dragging && (
        <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-background/85 p-6 animate-in fade-in-0">
          <div className="flex w-full max-w-md flex-col items-center rounded-3xl border-2 border-dashed border-foreground px-6 py-14 text-center">
            <Upload className="mb-3 size-8" aria-hidden />
            <p className="text-lg font-semibold">Drop to add to your library</p>
            <p className="text-[0.875rem] text-muted-foreground">
              PDF or EPUB, up to 50 MB
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function AddMenu({
  onFile,
  onLink,
}: {
  onFile: () => void;
  onLink: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="gap-1.5 font-semibold"
          aria-label="Add a document"
        >
          <Plus className="size-5" />
          <span className="max-sm:sr-only">Add</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-52">
        <DropdownMenuItem onSelect={onFile}>
          <FileText /> Choose PDF or EPUB…
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={onLink}>
          <Link2 /> Add from link…
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function DocumentRow({
  doc,
  position,
  onRename,
  onRemove,
}: {
  doc: SavedDocument;
  position?: Position;
  onRename: () => void;
  onRemove: () => void;
}) {
  const { page, total, fraction } = progressOf(doc, position);
  const status =
    page >= total && page > 0
      ? "Finished"
      : page > 0
        ? `${Math.round(fraction * 100)}%`
        : "New";
  const cleaned = doc.document.pages.filter((p) => p.isEnhanced).length;

  return (
    <li className="group relative flex items-center gap-3 py-3">
      <div
        aria-hidden
        className="relative flex h-14 w-11 shrink-0 items-end overflow-hidden rounded-[0.3rem] border bg-surface-raised p-1.5 shadow-xs"
      >
        <span className="line-clamp-3 font-serif text-[0.4375rem] leading-[1.25] text-muted-foreground">
          {doc.title}
        </span>
        {fraction > 0 && (
          <span
            className="absolute inset-x-0 bottom-0 h-0.5 bg-foreground"
            style={{ width: `${fraction * 100}%` }}
          />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <Link
          href={`/reader?id=${encodeURIComponent(doc.id)}`}
          className="line-clamp-2 text-[1.0625rem] font-medium leading-snug after:absolute after:inset-0 focus-visible:outline-none after:focus-visible:rounded-lg after:focus-visible:outline-2 after:focus-visible:outline-ring"
        >
          {doc.title}
        </Link>
        <p className="tabular mt-0.5 truncate text-[0.8125rem] text-muted-foreground">
          {total} {total === 1 ? "page" : "pages"} · {status}
          {doc.lastOpenedAt && ` · ${timeAgo(doc.lastOpenedAt)}`}
          {cleaned > 0 && (
            <span className="sr-only">, {cleaned} pages checked by AI</span>
          )}
        </p>
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="relative z-10 -mr-2 shrink-0 text-muted-foreground"
            aria-label={`Options for ${doc.title}`}
          >
            <Ellipsis />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem asChild>
            <Link href={`/book?id=${encodeURIComponent(doc.id)}`}>
              <Info /> Book details
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={onRename}>
            <Pencil /> Rename
          </DropdownMenuItem>
          <DropdownMenuItem variant="destructive" onSelect={onRemove}>
            <Trash2 /> Remove
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </li>
  );
}

function ImportRow({
  job,
  onRetry,
  onDismiss,
}: {
  job: ImportJob;
  onRetry: () => void;
  onDismiss: () => void;
}) {
  const percent = Math.round(job.progress * 100);
  return (
    <li className="flex items-center gap-3 py-3" aria-live="polite">
      <div
        aria-hidden
        className="flex h-14 w-11 shrink-0 items-center justify-center rounded-[0.3rem] border border-dashed"
      >
        <FileText className="size-4 text-muted-foreground" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[1.0625rem] font-medium">{job.name}</p>
        {job.error ? (
          <p className="text-[0.8125rem] text-destructive">{job.error}</p>
        ) : (
          <div className="mt-1.5 flex items-center gap-3">
            <div
              className="h-1 flex-1 overflow-hidden rounded-full bg-muted"
              role="progressbar"
              aria-label={`Adding ${job.name}`}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={percent}
            >
              <div
                className="h-full bg-foreground transition-[width] duration-200"
                style={{ width: `${percent}%` }}
              />
            </div>
            <span className="tabular w-16 text-right text-[0.8125rem] text-muted-foreground">
              {percent < 100 ? `Reading ${percent}%` : "Saving"}
            </span>
          </div>
        )}
      </div>
      {job.error && (
        <div className="flex shrink-0 items-center">
          <Button variant="ghost" size="sm" onClick={onRetry}>
            Try again
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Dismiss"
            onClick={onDismiss}
          >
            <X />
          </Button>
        </div>
      )}
    </li>
  );
}

function EmptyLibrary({
  onFile,
  onLink,
  onSample,
}: {
  onFile: () => void;
  onLink: () => void;
  onSample: () => void;
}) {
  return (
    <section className="flex flex-col items-center px-4 pb-10 pt-16 text-center">
      <BookOpen
        className="mb-5 size-10 text-muted-foreground"
        strokeWidth={1.5}
        aria-hidden
      />
      <h2 className="text-xl font-semibold">Your library is empty</h2>
      <p className="mt-2 max-w-sm text-muted-foreground">
        Add a PDF or EPUB and read it as clean, comfortable text. Documents stay
        in this browser.
      </p>
      <div className="mt-8 flex w-full max-w-xs flex-col gap-2">
        <Button size="lg" onClick={onFile}>
          <FileText /> Choose a file
        </Button>
        <Button size="lg" variant="outline" onClick={onSample}>
          <BookOpen /> Try it with Meditations
        </Button>
        <Button size="lg" variant="ghost" onClick={onLink}>
          <Link2 /> Add from link
        </Button>
        <Button size="lg" variant="ghost" asChild>
          <Link href="/discover">
            <Compass /> Find a free book
          </Link>
        </Button>
      </div>
      <p className="mt-6 hidden text-[0.8125rem] text-muted-foreground pointer-fine:block">
        Or drop a file anywhere on this page.
      </p>
      <p className="mt-6 text-[0.9375rem] text-muted-foreground">
        New here?{" "}
        <Link href="/" className="font-medium text-foreground underline underline-offset-4">
          What Paperless does
        </Link>
      </p>
    </section>
  );
}

const SAMPLE = { id: 2680, title: "Meditations" };

const HINT_KEY = "paperless:home-screen-hint";

/** iPhone or iPad Safari, not yet on the Home Screen, and the hint not yet dismissed. */
function needsHomeScreen(): boolean {
  const ios =
    /iPhone|iPad|iPod/.test(navigator.userAgent) ||
    (navigator.maxTouchPoints > 1 && /Macintosh/.test(navigator.userAgent)); // iPadOS reports as a Mac
  const installed =
    window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone;
  try {
    return ios && !installed && !localStorage.getItem(HINT_KEY);
  } catch {
    return false;
  }
}

/**
 * Safari may clear a website's data after weeks without a visit, but keeps it
 * for sites added to the Home Screen. Said once, on iPhone and iPad only.
 */
function HomeScreenHint() {
  const client = useIsClient();
  const [dismissed, setDismissed] = useState(false);
  if (!client || dismissed || !needsHomeScreen()) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(HINT_KEY, "1");
    } catch {
      // Private mode
    }
    setDismissed(true);
  };

  return (
    <aside className="mb-6 flex items-start gap-3 rounded-2xl border p-4 text-[0.9375rem]">
      <Share className="mt-0.5 size-5 shrink-0" aria-hidden />
      <p className="flex-1">
        <span className="font-medium">Keep your books on this iPhone.</span>{" "}
        <span className="text-muted-foreground">
          Books are saved in Safari, which can clear them after a few weeks away. Tap Share, then “Add to Home Screen” to keep them.
        </span>
      </p>
      <Button variant="ghost" size="icon" className="-m-2 shrink-0" aria-label="Dismiss" onClick={dismiss}>
        <X />
      </Button>
    </aside>
  );
}

function LinkDialog({
  open,
  onOpenChange,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (url: string) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {/* Mounted afresh each time the dialog opens, so it starts empty */}
        <LinkForm
          onSubmit={(url) => {
            onSubmit(url);
            onOpenChange(false);
          }}
          onCancel={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

function LinkForm({ onSubmit, onCancel }: { onSubmit: (url: string) => void; onCancel: () => void }) {
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        try {
          const parsed = new URL(url.trim());
          if (!/^https?:$/.test(parsed.protocol)) throw new Error();
        } catch {
          setError("Enter a full link that starts with https://");
          return;
        }
        onSubmit(url.trim());
      }}
    >
      <DialogHeader>
        <DialogTitle>Add from link</DialogTitle>
        <DialogDescription>
          Paste a direct link to a PDF or EPUB file.
        </DialogDescription>
      </DialogHeader>
      <div className="mt-4">
        <label htmlFor="doc-url" className="sr-only">
          Link
        </label>
        <input
          id="doc-url"
          type="url"
          inputMode="url"
          autoComplete="url"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          autoFocus
          placeholder="https://example.com/paper.pdf"
          value={url}
          onChange={(e) => {
            setUrl(e.target.value);
            setError(null);
          }}
          aria-invalid={!!error}
          aria-describedby={error ? "doc-url-error" : undefined}
          className="h-11 w-full rounded-lg border bg-background px-3 text-[1.0625rem] outline-none focus-visible:outline-2 focus-visible:outline-ring aria-invalid:border-destructive pointer-fine:h-10 pointer-fine:text-[0.9375rem]"
        />
        {error && (
          <p
            id="doc-url-error"
            className="mt-2 text-[0.8125rem] text-destructive"
          >
            {error}
          </p>
        )}
      </div>
      <DialogFooter className="mt-6">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={!url.trim()}>
          Add
        </Button>
      </DialogFooter>
    </form>
  );
}

function RenameDialog({
  doc,
  onClose,
  onSave,
}: {
  doc: SavedDocument | null;
  onClose: () => void;
  onSave: (title: string) => void;
}) {
  return (
    <Dialog open={!!doc} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        {doc && <RenameForm key={doc.id} current={doc.title} onClose={onClose} onSave={onSave} />}
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
        <DialogDescription className="sr-only">
          Change the document’s title
        </DialogDescription>
      </DialogHeader>
      <label htmlFor="doc-title" className="sr-only">
        Title
      </label>
      <input
        id="doc-title"
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
        <Button
          type="submit"
          disabled={!title.trim() || title.trim() === current}
        >
          Save
        </Button>
      </DialogFooter>
    </form>
  );
}

function LibrarySkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading library" className="space-y-1">
      <Skeleton className="mb-4 h-11 w-full rounded-lg" />
      {Array.from({ length: 4 }, (_, i) => (
        <div key={i} className={cn("flex items-center gap-3 py-3")}>
          <Skeleton className="h-14 w-11" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-3 w-1/3" />
          </div>
        </div>
      ))}
    </div>
  );
}
