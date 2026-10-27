import { convertToModelMessages, streamText, type UIMessage } from "ai";
import { groq } from "@ai-sdk/groq";
import { aiAccess } from "@/lib/ai-access";

export const runtime = "nodejs";
export const maxDuration = 30;

const MAX_CONTEXT = 20000;
const MAX_MESSAGES = 30;
// Groq retires models regularly (llama-3.3-70b-versatile is gone); override with CHAT_MODEL
const MODEL = process.env.CHAT_MODEL || "openai/gpt-oss-120b";
// Used with a reader's own Gemini key, or when the site has no Groq key
const GEMINI_MODEL = process.env.CHAT_GEMINI_MODEL || "gemini-2.5-flash";

function error(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

export async function POST(req: Request) {
  let body: { messages?: UIMessage[]; context?: unknown; title?: unknown; page?: unknown };
  try {
    body = await req.json();
  } catch {
    return error("Invalid or empty JSON body", 400);
  }

  const { messages } = body;
  if (!Array.isArray(messages) || messages.length === 0) {
    return error("`messages` must be a non-empty array", 400);
  }

  const access = aiAccess(req, "chat");
  if (!access.ok) return access.response;
  const model =
    access.ownKey || !process.env.GROQ_API_KEY ? access.google(GEMINI_MODEL) : groq(MODEL);

  const context = typeof body.context === "string" ? body.context.slice(0, MAX_CONTEXT) : "";
  const title = typeof body.title === "string" ? body.title.slice(0, 200) : "this document";
  const page = typeof body.page === "number" ? body.page : null;

  // UI messages carry text in `parts`; keep only user/assistant turns, newest last
  const recent = messages
    .filter((m) => m && (m.role === "user" || m.role === "assistant") && Array.isArray(m.parts))
    .slice(-MAX_MESSAGES);

  const result = streamText({
    model,
    system: `You are a reading companion inside a document reader. The reader is reading "${title}"${
      page ? `, currently on page ${page}` : ""
    }.

Current page text:
"""
${context}
"""

Answer from the page text first. Be concise and plain-spoken; use short paragraphs or lists. Quote the page when it helps. If the page doesn't contain the answer, say so clearly before offering general knowledge, and label that knowledge as such.`,
    messages: await convertToModelMessages(recent),
    temperature: 0.4,
    maxOutputTokens: 1000,
  });

  return result.toUIMessageStreamResponse();
}
