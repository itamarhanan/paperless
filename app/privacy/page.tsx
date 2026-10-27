import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

export const metadata: Metadata = { title: "Privacy" };

export default function PrivacyPage() {
  return (
    <main className="px-safe pt-safe mx-auto max-w-2xl pb-16 sm:px-6">
      <Link
        href="/"
        className="-ml-2 mt-3 inline-flex h-11 items-center gap-1 rounded-md px-2 text-[0.9375rem] font-medium hover:bg-muted"
      >
        <ChevronLeft className="size-5" aria-hidden /> Library
      </Link>
      <article className="reader-prose mt-4" style={{ fontFamily: "var(--font-inter)" }}>
        <h1>Privacy</h1>
        <p>Paperless has no accounts and keeps no copy of your books.</p>

        <h2>Your books stay on your device</h2>
        <p>
          Files you add are read in your browser and saved there, with your reading positions, bookmarks and settings.
          Clearing this site’s data removes them, so use <em>Back up library</em> in the library’s menu to keep a copy.
        </p>
        <p>
          When you add a book from a link or from Discover, the Paperless server downloads it for you, because most
          sites don’t let a browser fetch files from another site. The file is passed straight to your browser and not
          kept.
        </p>

        <h2>When AI is on</h2>
        <p>
          <strong>Check layout with AI</strong> sends the text of the page you’re reading to Google Gemini. Questions
          you ask about a page are sent, with that page’s text, to Groq or Google Gemini. Ideas in Discover send what
          you typed to Google Gemini. Each provider handles the text under its own terms; on Google’s free tier, Google
          may use it to improve its models. Turn AI off in <em>Appearance › Pages and AI</em> and no text leaves your
          device.
        </p>
        <p>
          If you add your own Gemini key, it’s saved in your browser and sent only with your AI requests, which pass it
          to Google. Paperless doesn’t store it.
        </p>

        <h2>Searching for books</h2>
        <p>
          Discover searches Open Library and Project Gutenberg with the words you type. Book covers load from their
          sites.
        </p>

        <h2>Usage statistics</h2>
        <p>
          Paperless counts page visits with Vercel Web Analytics, which uses no cookies and doesn’t identify you. It
          never sees what you read.
        </p>
      </article>
    </main>
  );
}
