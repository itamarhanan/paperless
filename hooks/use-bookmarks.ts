"use client";

import { useCallback, useEffect } from "react";
import { create } from "zustand";
import { toast } from "sonner";
import { addBookmark, deleteBookmark, loadBookmarks, restoreBookmark, type Bookmark } from "@/lib/storage";
import { useReaderStore } from "@/lib/store/reader-store";

const useBookmarkStore = create<{ docId: string | null; items: Bookmark[] }>(() => ({
  docId: null,
  items: [],
}));

const sortByPage = (items: Bookmark[]) => [...items].sort((a, b) => a.page - b.page);

/** Loads the open document's bookmarks once; call from the reader shell. */
export function useLoadBookmarks() {
  const docId = useReaderStore((s) => s.docId);
  useEffect(() => {
    if (!docId) return;
    let cancelled = false;
    loadBookmarks(docId).then((items) => {
      if (!cancelled) useBookmarkStore.setState({ docId, items });
    });
    return () => {
      cancelled = true;
    };
  }, [docId]);
}

export function useBookmarks() {
  const items = useBookmarkStore((s) => s.items);
  const docId = useReaderStore((s) => s.docId);

  const remove = useCallback(async (bookmark: Bookmark) => {
    await deleteBookmark(bookmark.id);
    useBookmarkStore.setState((s) => ({ items: s.items.filter((b) => b.id !== bookmark.id) }));
    toast(`Removed bookmark on page ${bookmark.page}`, {
      action: {
        label: "Undo",
        onClick: async () => {
          await restoreBookmark(bookmark);
          useBookmarkStore.setState((s) => ({ items: sortByPage([...s.items, bookmark]) }));
        },
      },
    });
  }, []);

  const toggle = useCallback(
    async (page: number) => {
      if (!docId) return;
      const existing = useBookmarkStore.getState().items.find((b) => b.page === page);
      if (existing) {
        await remove(existing);
      } else {
        const bookmark = await addBookmark(docId, page);
        useBookmarkStore.setState((s) => ({ items: sortByPage([...s.items, bookmark]) }));
      }
    },
    [docId, remove]
  );

  return { items, toggle, remove };
}
