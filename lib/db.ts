import Dexie, { Table } from "dexie";
import type { ProcessedDocument } from "./pdf-processor";
import type { ReaderSettings } from "./pdf-processor";

export interface Bookmark {
  id: string;
  /** Document the bookmark belongs to. Older rows may lack it. */
  docId?: string;
  page: number;
  position: number;
  note?: string;
  createdAt: string;
}

export interface SavedDocument {
  id: string;
  title: string;
  savedAt: string;
  lastOpenedAt?: string;
  document: ProcessedDocument;
}

export interface ReadingPosition {
  /** Document id ("default" rows come from v1 and are ignored). */
  id: string;
  page: number;
  scrollPosition: number;
  timestamp: string;
}

export interface DocumentSettings {
  id: string;
  settings: ReaderSettings;
  updatedAt: string;
}

export interface Collection {
  id: string;
  name: string;
  createdAt: string;
  documentIds: string[];
}

export class PaperlessDatabase extends Dexie {
  bookmarks!: Table<Bookmark>;
  savedDocuments!: Table<SavedDocument>;
  readingPosition!: Table<ReadingPosition>;
  documentSettings!: Table<DocumentSettings>;
  collections!: Table<Collection>;

  constructor() {
    super("PaperlessDB");
    this.version(1).stores({
      bookmarks: "id",
      savedDocuments: "id, savedAt",
      readingPosition: "id",
      documentSettings: "id",
      collections: "id",
    });
    // v2: bookmarks and reading positions are scoped per document
    this.version(2).stores({
      bookmarks: "id, docId",
      savedDocuments: "id, savedAt, lastOpenedAt",
      readingPosition: "id",
      documentSettings: "id",
      collections: "id",
    });
  }
}

export const db = new PaperlessDatabase();
