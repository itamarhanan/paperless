import { searchGutenberg, searchOpenLibrary, type DiscoverBook } from "@/lib/discover";

export const runtime = "nodejs";

/**
 * Searches Project Gutenberg (free to read now) and Open Library (everything
 * else) at once. Either can fail without failing the search.
 */
export async function GET(req: Request) {
  const query = new URL(req.url).searchParams.get("q")?.trim().slice(0, 200);
  if (!query) return Response.json({ error: "Missing q" }, { status: 400 });

  const [gutenberg, openLibrary] = await Promise.allSettled([searchGutenberg(query), searchOpenLibrary(query)]);
  const books = openLibrary.status === "fulfilled" ? openLibrary.value : [];
  const byGutenbergId = new Map(books.filter((b) => b.gutenbergId).map((b) => [b.gutenbergId!, b]));

  // Free books: Gutenberg's results, with Open Library's cover, year and subjects when it knows them
  const free: DiscoverBook[] = (gutenberg.status === "fulfilled" ? gutenberg.value : []).slice(0, 12).map((book) => {
    const known = byGutenbergId.get(book.gutenbergId!);
    return known ? { ...known, id: book.id, title: book.title } : book;
  });
  const freeIds = new Set(free.map((b) => b.gutenbergId));
  const rest = books.filter((b) => !b.gutenbergId || !freeIds.has(b.gutenbergId));

  if (gutenberg.status === "rejected" && openLibrary.status === "rejected") {
    return Response.json({ error: "The book catalogues didn't respond. Try again." }, { status: 502 });
  }
  return Response.json({ free, books: rest });
}
