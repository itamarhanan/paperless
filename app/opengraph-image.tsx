import { ImageResponse } from "next/og";
import { MARK_CORNER, MARK_PAGE } from "@/components/brand/logo";

export const alt = "Paperless: a reader for the books you already have";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const TITLE = "Paperless";
const SUBTITLE = "A reader for the books you already have.";
const LEDE = "Open a PDF or EPUB and read it as pages that fit your screen.";
const IMPRINT = "FREE · NO ACCOUNT · YOUR BOOKS STAY ON YOUR DEVICE";

/**
 * A Google font as a static TTF (the image renderer can't read WOFF2 or
 * variable fonts), cut down to the characters drawn here. Without the network
 * the image still renders, in the default face.
 */
async function googleFont(family: string, axis: string, text: string) {
  try {
    const css = await fetch(
      `https://fonts.googleapis.com/css2?family=${family}:${axis}&text=${encodeURIComponent(text)}`
    ).then((r) => r.text());
    const url = css.match(/src: url\((.+?)\) format\('(?:opentype|truetype)'\)/)?.[1];
    return url ? await fetch(url).then((r) => r.arrayBuffer()) : null;
  } catch {
    return null;
  }
}

/** The link preview: the front page's title page, in the reader's black and white. */
export default async function OpenGraphImage() {
  const [roman, italic, sans] = await Promise.all([
    googleFont("Literata", "wght@500", TITLE),
    googleFont("Literata", "ital,wght@1,400", SUBTITLE),
    googleFont("Inter", "wght@400", LEDE + IMPRINT),
  ]);
  const fonts = [
    ...(sans ? [{ name: "Inter", data: sans, weight: 400 as const, style: "normal" as const }] : []),
    ...(roman ? [{ name: "Literata", data: roman, weight: 500 as const, style: "normal" as const }] : []),
    ...(italic ? [{ name: "Literata", data: italic, weight: 400 as const, style: "italic" as const }] : []),
  ];

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          background: "#fcfcfc",
          color: "#141414",
          padding: "0 96px 56px",
          fontFamily: "Inter, sans-serif",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flex: 1 }}>
          <div style={{ fontFamily: "Literata, serif", fontWeight: 500, fontSize: 136, lineHeight: 1, letterSpacing: -3 }}>
            {TITLE}
          </div>
          <div style={{ marginTop: 26, fontFamily: "Literata, serif", fontStyle: "italic", fontSize: 46, color: "#5c5c5c" }}>
            {SUBTITLE}
          </div>
          <div style={{ marginTop: 40, width: 64, height: 2, background: "#c8c8c8" }} />
          <div style={{ marginTop: 36, fontSize: 28, color: "#5c5c5c" }}>{LEDE}</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
          <svg width="40" height="40" viewBox="0 0 32 32" fill="#141414">
            <path fillRule="evenodd" d={MARK_PAGE} />
            <path d={MARK_CORNER} />
          </svg>
          <div style={{ marginTop: 14, fontSize: 17, letterSpacing: 3, color: "#5c5c5c" }}>{IMPRINT}</div>
        </div>
      </div>
    ),
    { ...size, fonts }
  );
}
