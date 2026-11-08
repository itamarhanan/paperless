/**
 * What the UI needs to know about supported formats, without touching any
 * parser code: this module stays light so every page can import it.
 */

export const MAX_FILE_BYTES = 50 * 1024 * 1024;

export type FormatId = "pdf" | "epub" | "docx";

interface SupportedFormat {
  id: FormatId;
  /** The full, distinctive name. */
  name: string;
  /** The short name used in sentences: "PDF, EPUB and Word files". */
  label: string;
  extensions: string[];
  mediaTypes: string[];
}

export const SUPPORTED: SupportedFormat[] = [
  {
    id: "pdf",
    name: "PDF",
    label: "PDF",
    extensions: [".pdf"],
    mediaTypes: ["application/pdf"],
  },
  {
    id: "epub",
    name: "EPUB",
    label: "EPUB",
    extensions: [".epub"],
    mediaTypes: ["application/epub+zip"],
  },
  {
    id: "docx",
    name: "Word document",
    label: "Word",
    extensions: [".docx"],
    mediaTypes: ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
  },
];

/** The accept attribute for a file input, extensions first so phones name them. */
export const ACCEPT = [
  SUPPORTED.flatMap((f) => f.extensions),
  SUPPORTED.flatMap((f) => f.mediaTypes),
].join(",");

/** A file the reader chose or dropped, filtered by name and type. */
export function isSupportedFile(file: { name: string; type: string }): boolean {
  const extension = /\.\w+$/.exec(file.name)?.[0]?.toLowerCase();
  if (extension && SUPPORTED.some((f) => f.extensions.includes(extension))) return true;
  const mime = file.type.toLowerCase();
  return mime !== "" && SUPPORTED.some((f) => f.mediaTypes.includes(mime));
}

/** "PDF, EPUB and Word" — for sentences about what Paperless opens. */
export const formatLabels = () => {
  const parts = SUPPORTED.map((f) => f.label);
  return parts.length > 1 ? `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}` : parts[0];
};

/** "garden.docx" → "garden". Loose with the extension: files come misnamed. */
export function titleFromFilename(name: string): string {
  return (
    name
      .replace(/\.\w{1,5}$/i, "")
      .replace(/[_]+/g, " ")
      .replace(/\s+/g, " ")
      .trim() || "Untitled"
  );
}
