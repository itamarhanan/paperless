import type React from "react";
import type { Metadata, Viewport } from "next";
import { Inter, Literata, JetBrains_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/providers/theme-provider";
import "./globals.css";

// Interface: Inter, bundled so it renders the same everywhere (system-ui resolves to
// Ubuntu, Cantarell, Segoe… and shifts metrics). Its optical-size axis mirrors SF Pro's
// Text/Display behaviour. Literata was drawn for long-form reading on screens.
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

export const metadata: Metadata = {
  title: { default: "Paperless", template: "%s · Paperless" },
  description: "Read PDFs and EPUBs as clean, comfortable text on your phone and desktop.",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Paperless",
  },
  icons: {
    icon: [
      { url: "/icon-light-32x32.png", media: "(prefers-color-scheme: light)" },
      { url: "/icon-dark-32x32.png", media: "(prefers-color-scheme: dark)" },
    ],
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
      </body>
    </html>
  );
}
