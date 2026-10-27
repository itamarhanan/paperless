import type React from "react";
import type { Metadata, Viewport } from "next";
import { Inter, Literata, JetBrains_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { ServiceWorker } from "@/components/providers/service-worker";
import { SITE_URL } from "@/lib/site";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  axes: ["opsz"],
  variable: "--font-inter",
  display: "swap",
});

const literata = Literata({
  subsets: ["latin"],
  style: ["normal", "italic"],
  variable: "--font-reading",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-code",
  display: "swap",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fcfcfc" },
    { media: "(prefers-color-scheme: dark)", color: "#121212" },
  ],
};

const DESCRIPTION =
  "Read PDFs and EPUBs as pages sized for your screen. Paperless keeps the book's text and structure, and stores your library in your browser.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: "Paperless", template: "%s · Paperless" },
  description: DESCRIPTION,
  applicationName: "Paperless",
  authors: [{ name: "Itamar Hanan", url: "https://itamar-hanan.web.app" }],
  openGraph: {
    type: "website",
    siteName: "Paperless",
    title: "Paperless: read PDFs and EPUBs as real books",
    description: DESCRIPTION,
    url: "/",
  },
  twitter: {
    card: "summary_large_image",
    title: "Paperless: read PDFs and EPUBs as real books",
    description: DESCRIPTION,
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Paperless",
  },
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
    apple: "/apple-icon.png",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${inter.variable} ${literata.variable} ${jetbrainsMono.variable}`} suppressHydrationWarning>
      <body className="font-sans antialiased">
        <ThemeProvider>
          {children}
          <Toaster
            position="bottom-center"
            mobileOffset={{ bottom: "calc(env(safe-area-inset-bottom) + 4.5rem)" }}
          />
        </ThemeProvider>
        <Analytics />
        <ServiceWorker />
      </body>
    </html>
  );
}
