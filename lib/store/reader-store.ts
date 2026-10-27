import { create } from "zustand";
import type { AiLabel, ProcessedDocument, ReaderSettings } from "@/lib/pdf-processor";
import { renderAiPages } from "@/lib/pdf-processor";

export const SIDEBAR_KEY = "paperless:sidebar";

export type ReaderPanel = "contents" | "search" | "appearance" | null;

interface ReaderState {
  docId: string | null;
  document: ProcessedDocument | null;
  currentPage: number;
  settings: ReaderSettings | null;
  /** Panel open on top of the page (sheet on phone, side panel on desktop). */
  panel: ReaderPanel;
  /** Desktop sidebar with contents and bookmarks. Closed unless the reader opens it. */
  sidebarOpen: boolean;
  /** AI chat: side panel on desktop, sheet on phone. */
  chatOpen: boolean;
  /** Pages the reader chose to see as extracted, without AI cleanup. */
  showOriginal: Record<number, boolean>;
  searchQuery: string;

  load: (docId: string, doc: ProcessedDocument, page: number) => void;
  setDocument: (doc: ProcessedDocument) => void;
  setCurrentPage: (page: number) => void;
  setSettings: (settings: ReaderSettings) => void;
  setPanel: (panel: ReaderPanel) => void;
  togglePanel: (panel: Exclude<ReaderPanel, null>) => void;
  setSidebarOpen: (open: boolean) => void;
  setChatOpen: (open: boolean) => void;
  setShowOriginal: (page: number, show: boolean) => void;
  setSearchQuery: (query: string) => void;
  /** Records what the AI found for these paragraphs and re-lays out their pages. */
  applyAi: (indices: number[], labels: Record<number, AiLabel>, passages: Record<number, string[]>) => void;
}

export const useReaderStore = create<ReaderState>((set) => ({
  docId: null,
  document: null,
  currentPage: 1,
  settings: null,
  panel: null,
  sidebarOpen: false,
  chatOpen: false,
  showOriginal: {},
  searchQuery: "",

  load: (docId, document, page) =>
    set({
      docId,
      document,
      currentPage: Math.min(Math.max(1, page), Math.max(1, document.totalPages)),
      showOriginal: {},
      searchQuery: "",
      panel: null,
      chatOpen: false,
    }),
  setDocument: (document) =>
    set((state) => ({
      document,
      currentPage: Math.min(state.currentPage, Math.max(1, document.totalPages)),
    })),
  setCurrentPage: (page) =>
    set((state) => {
      const total = state.document?.totalPages ?? 1;
      return { currentPage: Math.min(Math.max(1, page), total) };
    }),
  setSettings: (settings) => set({ settings }),
  setPanel: (panel) => set({ panel }),
  togglePanel: (panel) => set((state) => ({ panel: state.panel === panel ? null : panel })),
  setSidebarOpen: (sidebarOpen) => {
    try {
      localStorage.setItem(SIDEBAR_KEY, sidebarOpen ? "1" : "0");
    } catch {
      // Private mode: the choice lasts for this visit only
    }
    set({ sidebarOpen });
  },
  setChatOpen: (chatOpen) => set({ chatOpen }),
  setShowOriginal: (page, show) =>
    set((state) => ({ showOriginal: { ...state.showOriginal, [page]: show } })),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  applyAi: (indices, labels, passages) =>
    set((state) => {
      if (!state.document) return state;
      const prev = state.document.ai ?? { labels: {}, passages: {}, checked: {} };
      const ai = { labels: { ...prev.labels }, passages: { ...prev.passages }, checked: { ...prev.checked } };
      for (const i of indices) {
        delete ai.labels[i];
        delete ai.passages[i];
        ai.checked[i] = 1;
      }
      Object.assign(ai.labels, labels);
      Object.assign(ai.passages, passages);
      return { document: renderAiPages({ ...state.document, ai }) };
    }),
}));
