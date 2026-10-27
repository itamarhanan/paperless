"use client";

import { useState } from "react";
import type { SavedDocument } from "@/lib/storage";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function LinkDialog({
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
        <DialogDescription>Paste a direct link to a PDF or EPUB file.</DialogDescription>
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
          <p id="doc-url-error" className="mt-2 text-[0.8125rem] text-destructive">
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

export function RenameDialog({
  doc,
  onClose,
  onSave,
}: {
  doc: SavedDocument;
  onClose: () => void;
  onSave: (title: string) => void;
}) {
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <RenameForm key={doc.id} current={doc.title} onClose={onClose} onSave={onSave} />
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
        <DialogDescription className="sr-only">Change the document’s title</DialogDescription>
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
        <Button type="submit" disabled={!title.trim() || title.trim() === current}>
          Save
        </Button>
      </DialogFooter>
    </form>
  );
}
