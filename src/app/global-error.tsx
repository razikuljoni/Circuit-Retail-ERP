"use client";

// Global error boundary — last resort when the root layout itself fails.
// Renders its own <html>/<body> with inline styles because global CSS may
// not be available in this state.
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "system-ui, -apple-system, sans-serif",
          background: "#fafafa",
          color: "#0f172a",
        }}
      >
        <div style={{ textAlign: "center", padding: 32, maxWidth: 420 }}>
          <h1 style={{ fontSize: 20, fontWeight: 600, margin: "0 0 8px" }}>
            Application error
          </h1>
          <p style={{ fontSize: 14, color: "#64748b", margin: "0 0 24px" }}>
            A critical error occurred. Please reload the application.
          </p>
          <button
            onClick={reset}
            style={{
              padding: "10px 18px",
              borderRadius: 10,
              border: "none",
              background: "#0f172a",
              color: "#ffffff",
              fontSize: 14,
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Reload
          </button>
        </div>
      </body>
    </html>
  );
}
