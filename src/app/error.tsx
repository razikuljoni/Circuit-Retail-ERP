"use client";

// Route-level error boundary for the app shell. Keeps the user oriented,
// offers recovery, and surfaces a digest reference for log correlation.
import { useEffect } from "react";
import { AlertTriangle, LayoutDashboard, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ErrorPage({
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
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-md rounded-2xl border bg-card p-8 text-center shadow-sm">
        <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
          <AlertTriangle className="size-7" aria-hidden />
        </div>
        <h1 className="text-xl font-semibold tracking-tight">
          Something went wrong
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          The app hit an unexpected error. Your data is safe — try again, or
          reload the application.
        </p>
        {error.digest ? (
          <p className="mt-3 inline-block rounded-md bg-muted px-2 py-1 font-mono text-[11px] text-muted-foreground">
            ref: {error.digest}
          </p>
        ) : null}
        <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
          <Button onClick={reset} className="gap-2">
            <RotateCcw className="size-4" aria-hidden /> Try again
          </Button>
          <Button
            variant="outline"
            className="gap-2"
            onClick={() => {
              window.location.hash = "#/dashboard";
              window.location.reload();
            }}
          >
            <LayoutDashboard className="size-4" aria-hidden /> Go to dashboard
          </Button>
        </div>
      </div>
    </main>
  );
}
