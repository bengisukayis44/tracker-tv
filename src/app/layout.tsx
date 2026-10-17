import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { SiteHeader } from "@/components/site-header";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin", "latin-ext"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: { default: "Tracker.tv", template: "%s · Tracker.tv" },
  description: "İzlediğin dizi ve filmleri takip et, bölümleri puanla, yorumları oku.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // Dark only for now; the theme switch comes in Faz 6
    <html lang="tr" className={`dark ${geistSans.variable} ${geistMono.variable}`}>
      <body className="min-h-screen">
        <SiteHeader />
        <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 sm:py-12">{children}</main>
      </body>
    </html>
  );
}
