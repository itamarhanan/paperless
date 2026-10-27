import { workDetails } from "@/lib/discover";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const key = new URL(req.url).searchParams.get("key") ?? "";
  if (!/^\/works\/OL\d+W$/.test(key)) return Response.json({ error: "Invalid work key" }, { status: 400 });
  try {
    return Response.json(await workDetails(key));
  } catch {
    return Response.json({ error: "Couldn't load details" }, { status: 502 });
  }
}
