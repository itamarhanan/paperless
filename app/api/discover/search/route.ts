import { rankGutenberg, searchGutenberg, searchOpenLibrary, type DiscoverBook } from "@/lib/discover";

export const runtime = "nodejs";

const MAX_FREE = 12;

/**
 * Searches Project Gutenberg (free to read now) and Open Library (everything
 * else) at once. Either can fail without failing the search.
 */
export async function GET(req: Request) {
  const query = new URL(req.url).searchParams.get("q")?.trim().slice(0, 200);
  if (!query) return Response.json({ error: "Missing q" }, { status: 400 });

  const [gutenberg, openLibrary] = await Promise.allSettled([searchGutenberg(query), searchOpenLibrary(query)]);
  if (gutenberg.status === "rejected" && openLibrary.status === "rejected") {
    return Response.json({ error: "The book catalogues didn't respond. Try again." }, { status: 502 });
  }
  const books = openLibrary.status === "fulfilled" ? openLibrary.value : [];
  const byGutenbergId = new Map(books.filter((b) => b.gutenbergId).map((b) => [b.gutenbergId!, b]));

  // Free books: Gutenberg's results, best match first, with Open Library's
  // cover, year and subjects when it knows them
  const ranked = rankGutenberg(query, gutenberg.status === "fulfilled" ? gutenberg.value : []);
  const free: DiscoverBook[] = ranked.slice(0, MAX_FREE).map((book) => {
    const known = byGutenbergId.get(book.gutenbergId!);
    return known ? { ...known, id: book.id, title: book.title } : book;
  });
  // Open Library matches that Gutenberg has too, when its own search missed them
  const freeIds = new Set(free.map((b) => b.gutenbergId));
  for (const book of books) {
    if (free.length >= MAX_FREE) break;
    if (book.gutenbergId && !freeIds.has(book.gutenbergId)) {
      free.push(book);
      freeIds.add(book.gutenbergId);
    }
  }
  const rest = books.filter((b) => !b.gutenbergId || !freeIds.has(b.gutenbergId));

  return Response.json({ free, books: rest });
}
