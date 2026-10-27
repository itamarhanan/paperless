import { ImageResponse } from "next/og";

export const alt = "Paperless: read PDFs and EPUBs as real books";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** The link preview: a page of a book, in the reader's own black and white. */
export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          background: "#fcfcfc",
          color: "#111",
          padding: "72px 88px",
          fontFamily: "serif",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", flex: 1, justifyContent: "space-between" }}>
          <div style={{ display: "flex", fontFamily: "sans-serif", fontSize: 30, fontWeight: 700, letterSpacing: -0.5 }}>
            Paperless
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 76, lineHeight: 1.05, letterSpacing: -2, maxWidth: 820 }}>
              Read PDFs and EPUBs as real books.
            </div>
            <div style={{ marginTop: 28, fontSize: 32, color: "#555", fontFamily: "sans-serif", maxWidth: 820, lineHeight: 1.35 }}>
              AI tidies the layout. It never changes the words.
            </div>
          </div>
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            width: 300,
            marginLeft: 48,
            padding: "40px 32px",
            border: "2px solid #111",
            borderRadius: 16,
            fontSize: 22,
            lineHeight: 1.6,
            color: "#222",
          }}
        >
          <div style={{ fontSize: 15, fontFamily: "sans-serif", color: "#777", marginBottom: 18 }}>Book Two</div>
          <div style={{ fontSize: 30, marginBottom: 18 }}>Meditations</div>
          <div style={{ display: "flex" }}>
            Begin the morning by saying to thyself, I shall meet with the busy-body, the ungrateful, arrogant…
          </div>
          <div style={{ display: "flex", marginTop: "auto", height: 4, background: "#111", width: "38%" }} />
        </div>
      </div>
    ),
    size
  );
}
