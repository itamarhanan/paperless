"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { aiHeaders } from "@/lib/ai-key";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ArrowUp, RotateCcw, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useReaderStore } from "@/lib/store/reader-store";
import { cn } from "@/lib/utils";

// Example requests show what the feature is good at (generative-ai.md › Guide people)
const SUGGESTIONS = [
  "Summarize this page",
  "Explain this page in simpler terms",
  "What are the key terms here?",
  "What questions does this page raise?",
];

export function ChatPanel() {
  const docId = useReaderStore((s) => s.docId);
  const document = useReaderStore((s) => s.document);
  const currentPage = useReaderStore((s) => s.currentPage);

  const transport = useMemo(() => new DefaultChatTransport({ api: "/api/chat", headers: () => aiHeaders() }), []);
  const { messages, sendMessage, status, error, stop, regenerate, clearError } = useChat({
    id: docId ?? undefined,
    transport,
    experimental_throttle: 50,
  });

  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const busy = status === "submitted" || status === "streaming";

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, status]);

  const page = document?.pages[currentPage - 1];
  const context = page?.content ?? "";

  // Context is sent with each request, so it always matches the page on screen
  const send = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    if (error) clearError();
    void sendMessage(
      { text: trimmed },
      { body: { context, title: document?.title, page: currentPage } }
    );
    setInput("");
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4" aria-live="polite">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col justify-end gap-4 pb-2">
            <div>
              <p className="text-[0.9375rem] font-medium">Ask about page {currentPage}</p>
              <p className="mt-1 text-[0.8125rem] text-muted-foreground">
                Answers are based on the page you’re reading.
              </p>
            </div>
            <ul className="flex flex-col gap-2">
              {SUGGESTIONS.map((s) => (
                <li key={s}>
                  <button
                    type="button"
                    onClick={() => send(s)}
                    className="min-h-11 w-full rounded-lg border px-3 py-2 text-left text-[0.9375rem] transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring pointer-fine:min-h-9 pointer-fine:text-sm"
                  >
                    {s}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <ol className="space-y-5">
            {messages.map((message, index) => {
              const isLast = index === messages.length - 1;
              const text = message.parts
                .map((part) => (part.type === "text" ? part.text : ""))
                .join("");
              return (
                <li key={message.id} className={cn(message.role === "user" && "flex justify-end")}>
                  {message.role === "user" ? (
                    <p className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-primary px-3.5 py-2 text-[0.9375rem] text-primary-foreground">
                      {text}
                    </p>
                  ) : (
                    <div className="chat-prose">
                      {text ? (
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
                      ) : (
                        isLast && busy && <p className="text-muted-foreground">Reading page {currentPage}…</p>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
            {status === "submitted" && (
              <li className="text-[0.875rem] text-muted-foreground">Reading page {currentPage}…</li>
            )}
          </ol>
        )}

        {error && (
          <div role="alert" className="mt-4 flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-[0.875rem]">
            <span>{errorText(error)}</span>
            <Button size="sm" variant="outline" onClick={() => regenerate({ body: { context, title: document?.title, page: currentPage } })}>
              <RotateCcw /> Retry
            </Button>
          </div>
        )}
      </div>

      <form
        className="border-t px-3 pb-3 pt-2"
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
      >
        <div className="flex items-end gap-2 rounded-2xl border bg-surface-raised p-1.5 focus-within:border-foreground/40">
          <label htmlFor="chat-input" className="sr-only">
            Ask about this page
          </label>
          <textarea
            id="chat-input"
            ref={inputRef}
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                send(input);
              }
            }}
            placeholder="Ask about this page"
            enterKeyHint="send"
            // 17px keeps iOS Safari from zooming into the field
            className="field-sizing-content max-h-40 min-h-9 flex-1 resize-none bg-transparent px-2 py-1.5 text-[1.0625rem] outline-none placeholder:text-muted-foreground pointer-fine:text-[0.9375rem]"
          />
          {busy ? (
            <Button type="button" size="icon-sm" variant="secondary" className="rounded-full" aria-label="Stop answering" onClick={() => stop()}>
              <Square className="size-3.5 fill-current" />
            </Button>
          ) : (
            <Button type="submit" size="icon-sm" className="rounded-full" aria-label="Send" disabled={!input.trim()}>
              <ArrowUp />
            </Button>
          )}
        </div>
        <p className="mt-1.5 px-1 text-center text-[0.75rem] text-muted-foreground">
          AI answers can be wrong. Check them against the page.
        </p>
      </form>
    </div>
  );
}

/** The server's own explanation (a limit, a missing key) when there is one. */
function errorText(error: Error): string {
  try {
    const message = JSON.parse(error.message)?.error;
    if (typeof message === "string") return message;
  } catch {
    // Not a server message
  }
  return "Couldn’t get an answer. Check your connection and try again.";
}
