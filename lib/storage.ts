import { withDefaults, type ProcessedDocument, type ReaderSettings } from "./pdf-processor";
import { db } from "./db";
import type { Bookmark, ReadingPosition, SavedDocument } from "./db";

export type { Bookmark, SavedDocument } from "./db";

const LAST_DOC_KEY = "paperless:lastDocId";
const isBrowser = () => typeof window !== "undefined";

// ========== DOCUMENTS ==========

/** Stores a freshly imported document and returns its id. */
export async function importDocument(document: ProcessedDocument): Promise<string> {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await db.savedDocuments.put({ id, title: document.title, savedAt: now, lastOpenedAt: now, document });
  return id;
}

export async function getDocument(id: string): Promise<SavedDocument | undefined> {
  if (!isBrowser()) return undefined;
  return db.savedDocuments.get(id);
}

/** Library order: most recently opened first. */
export async function listDocuments(): Promise<SavedDocument[]> {
  if (!isBrowser()) return [];
  const docs = await db.savedDocuments.toArray();
  return docs.sort((a, b) =>
    (b.lastOpenedAt ?? b.savedAt).localeCompare(a.lastOpenedAt ?? a.savedAt)
  );
}

export async function touchDocument(id: string): Promise<void> {
  await db.savedDocuments.update(id, { lastOpenedAt: new Date().toISOString() });
  setLastDocumentId(id);
}

export async function updateDocument(id: string, document: ProcessedDocument): Promise<void> {
  await db.savedDocuments.update(id, { document, title: document.title });
}

export async function renameDocument(id: string, title: string): Promise<void> {
  const saved = await db.savedDocuments.get(id);
  if (!saved) return;
  await db.savedDocuments.put({ ...saved, title, document: { ...saved.document, title } });
}

export interface DeletedDocument {
  saved: SavedDocument;
  bookmarks: Bookmark[];
  position?: ReadingPosition;
}

/** Deletes a document with its bookmarks and position. Returns what's needed to undo. */
export async function deleteDocument(id: string): Promise<DeletedDocument | null> {
  return db.transaction("rw", db.savedDocuments, db.bookmarks, db.readingPosition, async () => {
    const saved = await db.savedDocuments.get(id);
    if (!saved) return null;
    const bookmarks = await db.bookmarks.where("docId").equals(id).toArray();
    const position = await db.readingPosition.get(id);
    await db.savedDocuments.delete(id);
    await db.bookmarks.where("docId").equals(id).delete();
    await db.readingPosition.delete(id);
    if (getLastDocumentId() === id) clearLastDocumentId();
    return { saved, bookmarks, position };
  });
}

export async function restoreDocument(deleted: DeletedDocument): Promise<void> {
  await db.transaction("rw", db.savedDocuments, db.bookmarks, db.readingPosition, async () => {
    await db.savedDocuments.put(deleted.saved);
    if (deleted.bookmarks.length) await db.bookmarks.bulkPut(deleted.bookmarks);
    if (deleted.position) await db.readingPosition.put(deleted.position);
  });
  window.dispatchEvent(new Event(LIBRARY_CHANGED));
}

/** Fired when the library changes outside the library screen (e.g. undo after leaving the reader). */
export const LIBRARY_CHANGED = "paperless:library-changed";

export function getLastDocumentId(): string | null {
  if (!isBrowser()) return null;
  try {
    return localStorage.getItem(LAST_DOC_KEY);
  } catch {
    return null;
  }
}

function setLastDocumentId(id: string) {
  try {
    localStorage.setItem(LAST_DOC_KEY, id);
  } catch {
    // Private mode: nothing to remember
  }
}

function clearLastDocumentId() {
  try {
    localStorage.removeItem(LAST_DOC_KEY);
  } catch {
    // Ignore
  }
}

// ========== SETTINGS (shared across documents) ==========

export async function saveSettings(settings: ReaderSettings): Promise<void> {
  if (!isBrowser()) return;
  await db.documentSettings.put({ id: "default", settings, updatedAt: new Date().toISOString() });
}

export async function loadSettings(): Promise<ReaderSettings> {
  if (!isBrowser()) return withDefaults(null);
  try {
    const stored = await db.documentSettings.get("default");
    return withDefaults(stored?.settings);
  } catch {
    return withDefaults(null);
  }
}

// ========== READING POSITION (per document) ==========

export interface Position {
  page: number;
  /** Fraction of the page scrolled, 0–1. */
  scrollPosition: number;
}

export async function saveReadingPosition(docId: string, position: Position): Promise<void> {
  await db.readingPosition.put({ id: docId, ...position, timestamp: new Date().toISOString() });
}

export async function loadReadingPosition(docId: string): Promise<Position | null> {
  const stored = await db.readingPosition.get(docId);
  return stored ? { page: stored.page, scrollPosition: stored.scrollPosition } : null;
}

export async function loadAllPositions(): Promise<Map<string, Position>> {
  const rows = await db.readingPosition.toArray();
  return new Map(rows.map((r) => [r.id, { page: r.page, scrollPosition: r.scrollPosition }]));
}

// ========== BOOKMARKS (per document) ==========

export async function loadBookmarks(docId: string): Promise<Bookmark[]> {
  const rows = await db.bookmarks.where("docId").equals(docId).toArray();
  return rows.sort((a, b) => a.page - b.page);
}

export async function addBookmark(docId: string, page: number, note?: string): Promise<Bookmark> {
  const bookmark: Bookmark = {
    id: crypto.randomUUID(),
    docId,
    page,
    position: 0,
    note,
    createdAt: new Date().toISOString(),
  };
  await db.bookmarks.put(bookmark);
  return bookmark;
}

export async function deleteBookmark(id: string): Promise<void> {
  await db.bookmarks.delete(id);
}

export async function restoreBookmark(bookmark: Bookmark): Promise<void> {
  await db.bookmarks.put(bookmark);
}
