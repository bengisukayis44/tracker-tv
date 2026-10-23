"use client";

import { useEffect } from "react";

/**
 * Shown when even the site frame fails (e.g. the database is unreachable while the header checks who is
 * signed in). It replaces the root layout, so it brings its own <html> and plain styles.
 */
export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="tr">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          background: "#080b11",
          color: "#e5e7eb",
          fontFamily: "system-ui, sans-serif",
          textAlign: "center",
          padding: "1rem",
        }}
      >
        <main style={{ maxWidth: 420 }}>
          <h1 style={{ fontSize: "1.5rem" }}>Tracker.tv şu an açılamıyor</h1>
          <p style={{ color: "#9ca3af", lineHeight: 1.5 }}>
            Sunucuya ya da veritabanına ulaşılamıyor. Birkaç dakika sonra tekrar dene.
          </p>
          {/* A full page load: the app's own navigation is part of what failed */}
          <button
            type="button"
            onClick={() => window.location.assign("/")}
            style={{
              marginTop: "0.5rem",
              padding: "0.6rem 1.2rem",
              border: 0,
              borderRadius: 8,
              background: "#6d28d9",
              color: "#fff",
              font: "inherit",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Tekrar dene
          </button>
        </main>
      </body>
    </html>
  );
}
