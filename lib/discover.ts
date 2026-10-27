import { USER_AGENT } from "./site";

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
const HEADERS = { "User-Agent": USER_AGENT, Accept: "application/json" };
const TIMEOUT_MS = 9000;

/** Runs at most `size` tasks at once; the rest wait their turn. */
function pool(size: number) {
  let active = 0;
  const waiting: (() => void)[] = [];
  return async <T>(task: () => Promise<T>): Promise<T> => {
    if (active < size) active++;
    else await new Promise<void>((resolve) => waiting.push(resolve)); // the slot is handed over
    try {
      return await task();
    } finally {
      const next = waiting.shift();
      if (next) next();
      else active--;
    }
  };
}

// Open Library asks for modest request rates, and resets connections when an
// Ask fires eight searches at once. Per server instance, a handful at a time.
const openLibraryPool = pool(4);
const gutenbergPool = pool(4);

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** One retry after a short pause for dropped connections and busy servers, never for timeouts. */
async function request(url: string, accept = "application/json") {
  const limit = url.startsWith(OPEN_LIBRARY) ? openLibraryPool : gutenbergPool;
  for (let attempt = 0; ; attempt++) {
    try {
      const response = await limit(() =>
        fetch(url, {
          headers: { ...HEADERS, Accept: accept },
          signal: AbortSignal.timeout(TIMEOUT_MS),
          next: { revalidate: 3600 },
        } as RequestInit)
      );
      if (attempt === 0 && (response.status === 429 || response.status >= 500)) {
        await delay(600);
        continue;
      }
      return response;
    } catch (error) {
      if (attempt > 0 || (error as Error).name === "TimeoutError") throw error;
      await delay(400);
    }
  }
}

export const openLibraryCover = (id: number, size: "S" | "M" | "L" = "M") =>
  `https://covers.openlibrary.org/b/id/${id}-${size}.jpg`;
export const gutenbergCover = (id: number) => `${GUTENBERG}/cache/epub/${id}/pg${id}.cover.medium.jpg`;

// `editions` is the edition that best matches the query: its title is the one
// the reader searched for when the work is filed under the original ("Ὀδύσσεια")
const OL_FIELDS =
  "key,title,author_name,first_publish_year,cover_i,subject,number_of_pages_median,id_project_gutenberg,edition_count," +
  "editions,editions.title,editions.cover_i";

type OpenLibraryEdition = { title?: string; cover_i?: number };

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
  editions?: { docs?: OpenLibraryEdition[] };
};

export const normalize = (text: string) => text.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");

/** Lowercase words without accents: "Stoïcisme, or…" → ["stoicisme", "or"]. */
const words = (text: string) =>
  text
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);

const STOPWORDS = new Set(["a", "an", "and", "the", "of", "in", "on", "to", "for", "by", "or", "with", "at", "from", "de", "la", "le"]);

/** The words of a query that carry meaning. */
function queryTerms(query: string) {
  const all = words(query);
  const meaningful = all.filter((w) => !STOPWORDS.has(w));
  return meaningful.length ? meaningful : all;
}

/** One word, allowing a plural: "meditation" and "meditations". */
const sameWord = (a: string, b: string) =>
  a === b || a === `${b}s` || b === `${a}s` || a === `${b}es` || b === `${a}es`;
const contains = (haystack: string[], term: string) => haystack.some((w) => sameWord(w, term));
const overlap = (text: string, terms: string[]) => {
  const found = words(text);
  return terms.filter((t) => contains(found, t)).length;
};

const SUBJECT_NOISE =
  /^(accessible book|protected daisy|in library|lending library|large type books|open library staff picks|internet archive wishlist|overdrive|textbooks|fiction, general|general|new york times (reviewed|bestseller)|long now manual for civilization|reading level.*|ebooks?)$/i;

/** Library shelving notes ("Protected DAISY", "nyt:…") aren't subjects a reader cares about. */
function cleanSubjects(subjects: string[] | undefined, max: number) {
  if (!subjects) return undefined;
  const seen = new Set<string>();
  const clean = subjects.filter((s) => {
    const key = s.trim().toLowerCase();
    if (!key || SUBJECT_NOISE.test(key) || /^[a-z_]+:\S/.test(s) || /^[a-z0-9]+(_[a-z0-9]+)+$/.test(s) || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return clean.length ? clean.slice(0, max) : undefined;
}

function fromOpenLibrary(doc: OpenLibraryDoc, query = ""): DiscoverBook {
  const gutenbergId = Number(doc.id_project_gutenberg?.[0]) || undefined;
  const edition = doc.editions?.docs?.[0];
  // Show the matching edition's title when it fits the query better than the
  // work's: "Man's Search for Meaning" rather than "… Trotzdem Ja zum Leben sagen"
  // Only words that name the book count: a search for "marcus aurelius"
  // shouldn't retitle Meditations after "The golden book of Marcus Aurelius"
  const authorWords = words((doc.author_name ?? []).join(" "));
  const terms = queryTerms(query).filter((t) => !contains(authorWords, t));
  const editionFits = !!edition?.title && overlap(edition.title, terms) > overlap(doc.title, terms);
  const coverId = (editionFits && edition?.cover_i) || doc.cover_i || edition?.cover_i;
  return {
    id: `ol:${doc.key}`,
    title: editionFits ? edition!.title! : doc.title,
    authors: doc.author_name?.slice(0, 3) ?? [],
    year: doc.first_publish_year,
    cover: coverId ? openLibraryCover(coverId) : gutenbergId ? gutenbergCover(gutenbergId) : undefined,
    subjects: cleanSubjects(doc.subject, 8),
    pages: doc.number_of_pages_median,
    gutenbergId,
    workKey: doc.key,
  };
}

/** Open Library search: any book, with free Gutenberg copies flagged. */
export async function searchOpenLibrary(query: string, limit = 20): Promise<DiscoverBook[]> {
  const params = new URLSearchParams({ q: query, limit: String(limit), fields: OL_FIELDS });
  const response = await request(`${OPEN_LIBRARY}/search.json?${params}`);
  if (!response.ok) throw new Error(`Open Library ${response.status}`);
  const data = (await response.json()) as { docs?: OpenLibraryDoc[] };
  return (data.docs ?? []).map((doc) => fromOpenLibrary(doc, query));
}

/** A cover from any edition of a work, for works whose record has none. */
async function editionCover(workKey: string): Promise<string | undefined> {
  try {
    const response = await request(`${OPEN_LIBRARY}${workKey}/editions.json?limit=50`);
    if (!response.ok) return undefined;
    const { entries } = (await response.json()) as { entries?: { covers?: number[] }[] };
    const id = entries?.flatMap((e) => e.covers ?? []).find((c) => c > 0);
    return id ? openLibraryCover(id) : undefined;
  } catch {
    return undefined;
  }
}

/** Books about a book rather than the book itself. */
const DERIVATIVE = /\b(summary|summaries|study guide|workbook|conversation starters|analysis of|adapted for|adaptation|young readers|cliffsnotes|sparknotes|quicklet|trivia)\b/i;

/** Finds the one book a title and author refer to, or nothing. */
export async function findOnOpenLibrary(title: string, author?: string): Promise<DiscoverBook | null> {
  const params = new URLSearchParams({
    q: `${title} ${author ?? ""}`.trim(),
    limit: "20",
    fields: `${OL_FIELDS},author_alternative_name`,
  });
  const response = await request(`${OPEN_LIBRARY}/search.json?${params}`);
  if (!response.ok) return null;
  type Doc = OpenLibraryDoc & { author_alternative_name?: string[] };
  const docs = ((await response.json()) as { docs?: Doc[] }).docs ?? [];
  // Main titles only: "Option B: Facing Adversity…" and "Option B" are one book
  const mainTitle = (t: string) => normalize(t.split(/\s*[:/]\s|\s+[-–—]\s+|\s*\(/)[0]);
  const wanted = mainTitle(title);
  // The author's surname must be among the book's authors: this rules out
  // summaries and companions by others ("Option B" by a summary writer)
  const surname = author ? normalize(author.split(/\s+/).pop() ?? "") : "";
  // Authors are filed under their own script ("Ὅμηρος"); other spellings count too
  const byAuthor = (d: Doc) =>
    !surname ||
    [...(d.author_name ?? []), ...(d.author_alternative_name ?? [])].some((name) => normalize(name).includes(surname));
  const score = (t: string | undefined) => {
    if (!t || DERIVATIVE.test(t)) return 0;
    const found = mainTitle(t);
    if (found === wanted) return 3;
    if (found.startsWith(wanted) && found.length <= wanted.length + 40) return 2; // with a subtitle
    if (wanted.startsWith(found) && found.length >= 6) return 1;
    return 0;
  };
  // A work is filed under one title, often the original language's; the
  // edition that matched the search may carry the title asked for
  const titleScore = (d: OpenLibraryDoc) =>
    DERIVATIVE.test(d.title) ? 0 : Math.max(score(d.title), score(d.editions?.docs?.[0]?.title));
  const hasCover = (d: OpenLibraryDoc) => !!(d.cover_i || d.editions?.docs?.[0]?.cover_i);
  // The book itself is the work with the most editions: adaptations and
  // study guides have few
  const best = docs
    .filter((d) => byAuthor(d) && titleScore(d) > 0)
    .sort(
      (a, b) =>
        titleScore(b) - titleScore(a) ||
        (b.edition_count ?? 0) - (a.edition_count ?? 0) ||
        Number(hasCover(b)) - Number(hasCover(a))
    )[0];
  if (!best) return null;
  const book = fromOpenLibrary(best, title);
  // "Homer" rather than "Ὅμηρος", when that spelling is on file
  const spelled = author && best.author_alternative_name?.find((name) => normalize(name) === normalize(author));
  if (spelled && !book.authors.some((name) => normalize(name).includes(surname))) book.authors = [spelled, ...book.authors.slice(1)];
  return book.cover ? book : { ...book, cover: await editionCover(best.key) };
}

/**
 * The book an AI suggestion refers to, with a free Gutenberg copy when there
 * is one, or nothing when Open Library doesn't know it. Both catalogues are
 * asked at once.
 */
export async function resolveSuggestion(s: { title: string; author: string; reason?: string }): Promise<DiscoverBook | null> {
  const surname = s.author.split(/\s+/).pop() ?? "";
  const [book, free] = await Promise.all([
    findOnOpenLibrary(s.title, s.author),
    searchGutenberg(`${s.title} ${surname}`).catch(() => [] as DiscoverBook[]),
  ]);
  if (!book) return null;
  // Classics are often free on Gutenberg even when the work Open Library
  // matched doesn't say so. Only the same title by the same author counts;
  // Gutenberg lists the most read copy first, where Open Library's first id
  // may be a translation
  const wanted = normalize(s.title);
  const gutenbergId =
    free.find(
      (f) =>
        normalize(f.title).startsWith(wanted) &&
        !TRANSLATION.test(f.title) &&
        f.authors.some((a) => normalize(a).includes(normalize(surname)))
    )?.gutenbergId ?? book.gutenbergId;
  return { ...book, gutenbergId, reason: s.reason };
}

/** Project Gutenberg's catalogue search, most downloaded first (its OPDS feed's default order). */
export async function searchGutenberg(query: string): Promise<DiscoverBook[]> {
  const response = await request(
    `${GUTENBERG}/ebooks/search.opds/?query=${encodeURIComponent(query)}&sort_order=downloads`,
    "application/atom+xml"
  );
  if (!response.ok) throw new Error(`Gutenberg ${response.status}`);
  const xml = await response.text();
  const books: DiscoverBook[] = [];
  for (const entry of xml.split("<entry>").slice(1)) {
    const id = Number(/<id>[^<]*\/ebooks\/(\d+)\.opds<\/id>/.exec(entry)?.[1]);
    const title = decodeXml(/<title>([^<]*)<\/title>/.exec(entry)?.[1] ?? "").replace(/\s+/g, " ");
    if (!id || !title) continue; // navigation entries ("Authors", "Subjects") have no book id
    const author = decodeXml(/<content type="text">([^<]*)<\/content>/.exec(entry)?.[1] ?? "");
    books.push({
      id: `pg:${id}`,
      title,
      // Books without an author show their download count in its place
      authors: author && !/^\d+ downloads?$/.test(author) ? [author] : [],
      cover: gutenbergCover(id),
      gutenbergId: id,
    });
  }
  return books;
}

/** "Danger signals : Remarkable… examples of… stoicism" → "Danger signals" */
const gutenbergMainTitle = (title: string) => title.split(/\s+:\s+/)[0];
/** Gutenberg marks books in other languages: "Selbstbetrachtungen (German)". */
const TRANSLATION = /\((?:[A-Z][a-z]+)(?: and [A-Z][a-z]+)?\)$/;

/**
 * Orders Gutenberg's results for a reader. Its search matches words anywhere
 * in the catalogue record, including long subtitles ("…the bravery, daring and
 * stoicism… of train dispatchers") and near spellings ("Mediterranean" for
 * "meditation"). Books whose title or author match come first, then books it
 * matched on subject, each most downloaded first; passing mentions deep in a
 * subtitle and near misses are left out, and duplicate editions collapse.
 */
export function rankGutenberg(query: string, books: DiscoverBook[]): DiscoverBook[] {
  const terms = queryTerms(query);
  if (!terms.length) return books;
  const seen = new Set<string>();
  const ranked: { book: DiscoverBook; tier: number; translation: boolean; index: number }[] = [];
  books.forEach((book, index) => {
    if (/^index of the project gutenberg works/i.test(book.title)) return; // a list of files, not a book
    const main = gutenbergMainTitle(book.title);
    const mainWords = words(main);
    const authorWords = words(book.authors.join(" "));
    const subtitleWords = words(book.title.slice(main.length));
    const titleWords = words(book.title);
    const inMain = (t: string) => contains(mainWords, t) || contains(authorWords, t);
    const elsewhere = terms.filter((t) => !inMain(t));
    // A word deep in a long subtitle is a passing mention, not the book's subject
    const passing = (t: string) => contains(subtitleWords.slice(6), t) && !contains(subtitleWords.slice(0, 6), t);
    // Gutenberg also matches near spellings: "Mediterranean" for "meditation"
    const nearMiss = (t: string) =>
      t.length >= 5 && !contains(titleWords, t) && titleWords.some((w) => w.slice(0, 5) === t.slice(0, 5) && !sameWord(w, t));
    if (elsewhere.some((t) => passing(t) || nearMiss(t))) return;
    // Title or author first; then early in the subtitle, or matched on a subject
    // or bookshelf, which the feed doesn't show
    const tier = elsewhere.length ? 1 : 2;

    const key = `${normalize(main.replace(TRANSLATION, ""))}|${normalize(book.authors[0] ?? "")}`;
    if (seen.has(key)) return; // another edition of a book already listed
    seen.add(key);
    ranked.push({ book, tier, translation: TRANSLATION.test(main), index });
  });
  return ranked
    .sort((a, b) => b.tier - a.tier || Number(a.translation) - Number(b.translation) || a.index - b.index)
    .map((r) => r.book);
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

/**
 * Open Library descriptions are Markdown pasted from many places: they end
 * with source notes ("- [Wikipedia][1]", "(Source: …)"), link lists ("Also
 * contained in:") and reference links, and use *emphasis* the sheet shows as
 * plain text.
 */
export function cleanDescription(raw: string): string | undefined {
  const text = raw
    .replace(/\r\n?/g, "\n")
    // Everything after a rule or an "Also contained in" list is about other books
    .split(/\n[ \t]*(?:-{3,}|\*{3,}|_{3,})|\n[ \t]*(?:also contained in|contains|see also)\s*:|\(\s*\[source\]/i)[0]
    // Reference definitions: "[1]: https://…"
    .replace(/^[ \t]*\[[^\]\n]+\]:[ \t]*\S+.*$/gm, "")
    // Links keep their words: [text](url) and [text][1]
    .replace(/\[([^\]\n]+)\]\([^)\n]*\)/g, "$1")
    .replace(/\[([^\]\n]+)\]\[[^\]\n]*\]/g, "$1")
    // Bare addresses
    .replace(/<?https?:\/\/[^\s>)]+>?/g, "")
    // HTML that slipped in
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/?[a-z][^>]*>/gi, "")
    // Markdown emphasis and headings
    .replace(/(\*\*|__)(\S(?:.*?\S)?)\1/g, "$2")
    .replace(/(^|[^\w*])\*(\S(?:[^*\n]*?\S)?)\*(?![\w*])/g, "$1$2")
    .replace(/(^|[^\w])_(\S(?:[^_\n]*?\S)?)_(?!\w)/g, "$1$2")
    .replace(/^#{1,6}[ \t]+/gm, "")
    .replace(/^[ \t]*[*+-][ \t]+/gm, "• ")
    .replace(/[ \t]+$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    // A closing credit: "- Wikipedia", "(Source: Wikipedia)", "Source: the publisher"
    .replace(/\s*(?:[-–—]\s*)?\(?\s*(?:source\s*:?\s*)?(?:from\s+)?(?:wikipedia|source)\s*\)?\.?$/i, "")
    .replace(/\s*\(?\s*source\s*:[^()\n]{0,60}\)?\.?$/i, "")
    .trim();
  return text || undefined;
}

export async function workDetails(workKey: string): Promise<DiscoverDetails> {
  const response = await request(`${OPEN_LIBRARY}${workKey}.json`);
  if (!response.ok) throw new Error(`Open Library ${response.status}`);
  const work = (await response.json()) as {
    description?: string | { value?: string };
    subjects?: string[];
  };
  const raw = typeof work.description === "string" ? work.description : work.description?.value;
  return {
    description: raw ? cleanDescription(raw) : undefined,
    subjects: cleanSubjects(work.subjects, 12),
    links: [{ label: "Open Library", url: `${OPEN_LIBRARY}${workKey}` }],
  };
}

export const gutenbergPage = (id: number) => `${GUTENBERG}/ebooks/${id}`;
export const gutenbergHtml = (id: number) => `${GUTENBERG}/cache/epub/${id}/pg${id}-images.html`;
