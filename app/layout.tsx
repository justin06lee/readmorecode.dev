import type { Metadata } from "next";
import { Geist, Geist_Mono, Instrument_Serif } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/components/AuthProvider";
import { ThemeProvider } from "@/components/ThemeProvider";
import { ThemeScript } from "@/components/ThemeScript";
import { Header } from "@/components/Header";
import { Analytics } from "@vercel/analytics/next"
import { SpeedInsights } from "@vercel/speed-insights/next"

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const instrumentSerif = Instrument_Serif({
  variable: "--font-instrument-serif",
  weight: "400",
  subsets: ["latin"],
});

export const NAVBAR_HEIGHT = "3.5rem";

const appUrl = process.env.APP_URL || "https://readmorecode.dev";
const metadataBase = (() => {
  try {
    return new URL(appUrl);
  } catch {
    return new URL("https://readmorecode.dev");
  }
})();

export const metadata: Metadata = {
  metadataBase,
  title: "readmorecode.dev",
  description: "Reading code is the new skill. Practice with code comprehension puzzles.",
  openGraph: {
    title: "readmorecode.dev",
    description: "Reading code is the new skill. Practice with code comprehension puzzles.",
    url: "/",
    siteName: "readmorecode.dev",
    images: [
      {
        url: "/readmorecode-linkbanner.png",
      },
    ],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "readmorecode.dev",
    description: "Reading code is the new skill. Practice with code comprehension puzzles.",
    images: ["/readmorecode-linkbanner.png"],
  },
  icons: {
    icon: [
      { url: "/readmorecode.png" },
    ],
    apple: [
      { url: "/readmorecode.png" },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <ThemeScript />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${instrumentSerif.variable} antialiased`}
      >
        <ThemeProvider>
          <AuthProvider>
            <Header />
            <div style={{ paddingTop: NAVBAR_HEIGHT }}>{children}</div>
	  <SpeedInsights />
          </AuthProvider>
          <Analytics />
        </ThemeProvider>
      </body>
    </html>
  );
}
