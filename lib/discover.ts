/** A book found through Discover, from Open Library or Project Gutenberg. */
export interface DiscoverBook {
  /** "ol:/works/OL123W" or "pg:2680" */
  id: string;
  title: string;
  authors: string[];
  year?: number;
  cover?: string;
  subjects?: string[];
  pages?: number;
  /** Project Gutenberg id: the book is free to read and can be added. */
  gutenbergId?: number;
  /** Open Library work key, for details and borrowing. */
  workKey?: string;
  /** Why the AI suggested it, when it came from Ask. */
  reason?: string;
}

export interface DiscoverDetails {
  description?: string;
  subjects?: string[];
  links: { label: string; url: string }[];
}

const OPEN_LIBRARY = "https://openlibrary.org";
const GUTENBERG = "https://www.gutenberg.org";
const HEADERS = { "User-Agent": "Paperless reader (personal use)", Accept: "application/json" };
const TIMEOUT_MS = 9000;

async function fetchWithTimeout(url: string, accept = "application/json") {
  return fetch(url, {
    headers: { ...HEADERS, Accept: accept },
    signal: AbortSignal.timeout(TIMEOUT_MS),
    next: { revalidate: 3600 },
  } as RequestInit);
}

export const openLibraryCover = (id: number, size: "S" | "M" | "L" = "M") =>
  `https://covers.openlibrary.org/b/id/${id}-${size}.jpg`;
export const gutenbergCover = (id: number) => `${GUTENBERG}/cache/epub/${id}/pg${id}.cover.medium.jpg`;

const OL_FIELDS =
  "key,title,author_name,first_publish_year,cover_i,subject,number_of_pages_median,id_project_gutenberg,ebook_access,edition_count";

type OpenLibraryDoc = {
  key: string;
  title: string;
  author_name?: string[];
  first_publish_year?: number;
  cover_i?: number;
  subject?: string[];
  number_of_pages_median?: number;
  id_project_gutenberg?: string[];
  edition_count?: number;
};

function fromOpenLibrary(doc: OpenLibraryDoc): DiscoverBook {
  const gutenbergId = Number(doc.id_project_gutenberg?.[0]) || undefined;
  return {
    id: `ol:${doc.key}`,
    title: doc.title,
    authors: doc.author_name?.slice(0, 3) ?? [],
    year: doc.first_publish_year,
    cover: doc.cover_i ? openLibraryCover(doc.cover_i) : gutenbergId ? gutenbergCover(gutenbergId) : undefined,
    subjects: doc.subject?.slice(0, 8),
    pages: doc.number_of_pages_median,
    gutenbergId,
    workKey: doc.key,
  };
}

/** Open Library search: any book, with free Gutenberg copies flagged. */
export async function searchOpenLibrary(query: string, limit = 20): Promise<DiscoverBook[]> {
  const url = `${OPEN_LIBRARY}/search.json?q=${encodeURIComponent(query)}&limit=${limit}&fields=${OL_FIELDS}`;
  const response = await fetchWithTimeout(url);
  if (!response.ok) throw new Error(`Open Library ${response.status}`);
  const data = (await response.json()) as { docs?: OpenLibraryDoc[] };
  return (data.docs ?? []).map(fromOpenLibrary);
}

/** Finds the one book a title and author refer to, or nothing. */
/** Books about a book rather than the book itself. */
const DERIVATIVE = /\b(summary|summaries|study guide|workbook|conversation starters|analysis of|adapted for|adaptation|young readers|cliffsnotes|sparknotes|quicklet|trivia)\b/i;

export async function findOnOpenLibrary(title: string, author?: string): Promise<DiscoverBook | null> {
  const params = new URLSearchParams({ q: `${title} ${author ?? ""}`.trim(), limit: "20", fields: OL_FIELDS });
  const response = await fetchWithTimeout(`${OPEN_LIBRARY}/search.json?${params}`);
  if (!response.ok) return null;
  const docs = ((await response.json()) as { docs?: OpenLibraryDoc[] }).docs ?? [];
  // Main titles only: "Option B: Facing Adversity…" and "Option B" are one book
  const mainTitle = (t: string) => normalize(t.split(/\s*[:/]\s|\s+[-–—]\s+|\s*\(/)[0]);
  const wanted = mainTitle(title);
  // The author's surname must be among the book's authors: this rules out
  // summaries and companions by others ("Option B" by a summary writer)
  const surname = author ? normalize(author.split(/\s+/).pop() ?? "") : "";
  const byAuthor = (d: OpenLibraryDoc) =>
    !surname || (d.author_name ?? []).some((name) => normalize(name).includes(surname));
  const titleScore = (d: OpenLibraryDoc) => {
    if (DERIVATIVE.test(d.title)) return 0;
    const found = mainTitle(d.title);
    if (found === wanted) return 3;
    if (found.startsWith(wanted) && found.length <= wanted.length + 40) return 2; // with a subtitle
    if (wanted.startsWith(found) && found.length >= 6) return 1;
    return 0;
  };
  // The book itself is the work with the most editions: adaptations and
  // study guides have few
  const best = docs
    .filter((d) => byAuthor(d) && titleScore(d) > 0)
    .sort(
      (a, b) =>
        titleScore(b) - titleScore(a) ||
        (b.edition_count ?? 0) - (a.edition_count ?? 0) ||
        Number(!!b.cover_i) - Number(!!a.cover_i)
    )[0];
  return best ? fromOpenLibrary(best) : null;
}

export const normalize = (text: string) => text.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");

/** Project Gutenberg's catalogue search (its OPDS feed answers in well under a second). */
export async function searchGutenberg(query: string): Promise<DiscoverBook[]> {
  const response = await fetchWithTimeout(
    `${GUTENBERG}/ebooks/search.opds/?query=${encodeURIComponent(query)}`,
    "application/atom+xml"
  );
  if (!response.ok) throw new Error(`Gutenberg ${response.status}`);
  const xml = await response.text();
  const books: DiscoverBook[] = [];
  for (const entry of xml.split("<entry>").slice(1)) {
    const id = Number(/<id>[^<]*\/ebooks\/(\d+)\.opds<\/id>/.exec(entry)?.[1]);
    const title = decodeXml(/<title>([^<]*)<\/title>/.exec(entry)?.[1] ?? "");
    if (!id || !title) continue; // navigation entries ("Sort by…") have no book id
    const author = decodeXml(/<content type="text">([^<]*)<\/content>/.exec(entry)?.[1] ?? "");
    books.push({
      id: `pg:${id}`,
      title,
      authors: author ? [author] : [],
      cover: gutenbergCover(id),
      gutenbergId: id,
    });
  }
  return books;
}

function decodeXml(text: string) {
  return text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .trim();
}

export async function workDetails(workKey: string): Promise<DiscoverDetails> {
  const response = await fetchWithTimeout(`${OPEN_LIBRARY}${workKey}.json`);
  if (!response.ok) throw new Error(`Open Library ${response.status}`);
  const work = (await response.json()) as {
    description?: string | { value?: string };
    subjects?: string[];
  };
  const raw = typeof work.description === "string" ? work.description : work.description?.value;
  // Descriptions often end with source notes and link lists
  const description = raw
    ?.split(/\n-{3,}|\n\(\[source\]|\n\*\*\*|\[source\]/)[0]
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .trim();
  return {
    description: description || undefined,
    subjects: work.subjects?.slice(0, 12),
    links: [{ label: "Open Library", url: `${OPEN_LIBRARY}${workKey}` }],
  };
}

export const gutenbergPage = (id: number) => `${GUTENBERG}/ebooks/${id}`;
export const gutenbergHtml = (id: number) => `${GUTENBERG}/cache/epub/${id}/pg${id}-images.html`;
