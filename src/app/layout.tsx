import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Suspense } from "react";
import { NavigationProgress } from "@/components/navigation-progress";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { Toaster } from "@/components/ui/sonner";
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
    // Dark only
    <html lang="tr" className={`dark ${geistSans.variable} ${geistMono.variable}`}>
      <body className="flex min-h-screen flex-col">
        {/* useSearchParams needs a Suspense boundary; it holds nothing else */}
        <Suspense>
          <NavigationProgress />
        </Suspense>
        <SiteHeader />
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 sm:py-12">{children}</main>
        <SiteFooter />
        <Toaster theme="dark" position="bottom-center" />
      </body>
    </html>
  );
}
