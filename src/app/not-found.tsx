import Link from "next/link";
import { Compass, Home } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-md rounded-2xl border bg-card p-8 text-center shadow-sm">
        <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Compass className="size-7" aria-hidden />
        </div>
        <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
          404
        </p>
        <h1 className="mt-1 text-xl font-semibold tracking-tight">
          Page not found
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you are looking for does not exist. The retail app itself
          lives at the root URL.
        </p>
        <Button asChild className="mt-6 gap-2">
          <Link href="/">
            <Home className="size-4" aria-hidden /> Back to the app
          </Link>
        </Button>
      </div>
    </main>
  );
}
