import type { ProcessedDocument, ReaderSettings } from "../pdf-processor";

/**
 * The contract every readable format implements. Paperless's formats describe
 * themselves fully — how to recognise them, which file names they come as, and
 * how to turn bytes into a ProcessedDocument — so adding one is a single new
 * file registered in the registry.
 */

/** Entries of a zip-format file, by path name. */
export type ZipFiles = Record<string, Uint8Array>;

/** What a format's sniff() sees. Unzipping is lazy: a wrong guess never pays for it. */
export interface SniffContext {
  /** The file's first bytes, at least 8 of them. */
  head: Uint8Array;
  /** The file's name, when a reader chose or dropped one; links often name it. */
  name?: string;
  unzip: () => ZipFiles | null;
}

export interface ParseContext {
  settings: ReaderSettings;
  fallbackTitle: string;
  onProgress?: (fraction: number) => void;
}

export type ParseInput = ArrayBuffer;

export interface FormatAdapter {
  id: string;
  /** A short, reader-facing name: "PDF", "EPUB", "Word". */
  label: string;
  extensions: string[];
  mediaTypes: string[];
  /** Confidence 0-1 that these bytes are of this format, judged by content. */
  sniff(ctx: SniffContext): number;
  parse(input: ParseInput, ctx: ParseContext): Promise<ProcessedDocument>;
}
