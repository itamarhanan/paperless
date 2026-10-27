"use client";

import { useCallback } from "react";
import { useReaderStore } from "@/lib/store/reader-store";
import { saveSettings } from "@/lib/storage";
import { withDefaults, type ReaderSettings } from "@/lib/pdf-processor";

export function useUpdateSettings() {
  return useCallback((patch: Partial<ReaderSettings>) => {
    const next = { ...withDefaults(useReaderStore.getState().settings), ...patch };
    useReaderStore.getState().setSettings(next);
    void saveSettings(next);
  }, []);
}
