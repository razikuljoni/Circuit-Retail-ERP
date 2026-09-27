import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "next-themes";
import { Toaster } from "sonner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"
  ),
  title: "Circuit Retail ERP",
  description:
    "Retail operations suite for small & medium shops — POS invoicing, inventory & stock ledger, expenses, and a live daily sales dashboard. Built for Dhaka-time retail.",
  applicationName: "Circuit Retail ERP",
  keywords: [
    "retail ERP",
    "POS",
    "inventory",
    "expenses",
    "sales dashboard",
    "Next.js",
  ],
  openGraph: {
    type: "website",
    siteName: "Circuit Retail ERP",
    title: "Circuit Retail ERP",
    description:
      "Retail operations suite — POS invoicing, inventory & stock ledger, expenses, and a live daily sales dashboard.",
  },
  twitter: {
    card: "summary",
    title: "Circuit Retail ERP",
    description:
      "Retail operations suite — POS invoicing, inventory & stock ledger, expenses, and a live daily sales dashboard.",
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0f172a" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} min-h-screen antialiased bg-background text-foreground`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <Toaster
            richColors
            position="top-right"
            toastOptions={{
              style: {
                borderRadius: "0.85rem",
              },
            }}
          />
        </ThemeProvider>
      </body>
    </html>
  );
}
