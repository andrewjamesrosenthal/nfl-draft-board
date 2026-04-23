import type { Metadata } from "next";
import { Inter, Space_Grotesk, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { SiteNav } from "@/components/site-nav";
import { Analytics } from '@vercel/analytics/next';

// Body: Inter — neutral, readable at 14px. Headings: Space Grotesk — editorial
// feel with tight tracking. Mono: JetBrains Mono for ratings/ranks/codes.
const sans = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});
const display = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});
const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "DraftBoard — NFL Draft prospect rankings",
  description:
    "Build your personal NFL Draft big board through head-to-head comparisons. Compare to the community consensus and explore prospects from 2018 through the current class.",
  openGraph: {
    title: "DraftBoard — NFL Draft prospect rankings",
    description:
      "Head-to-head pairwise rankings, community consensus, and live draft order.",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

// Blocking inline script: reads the user's theme preference and applies the
// class to <html> BEFORE React hydrates. Without this the page flashes dark
// on first paint before a client effect could flip it to light.
// Default is DARK. We only honor the saved preference if the user has
// explicitly toggled — we don't follow the OS theme, because this app is
// designed dark-first and unexpected light mode on first load looks broken.
const themeBootstrap = `
(function () {
  try {
    var saved = localStorage.getItem("draftboard-theme");
    var theme = saved === "light" ? "light" : "dark";
    document.documentElement.classList.toggle("light", theme === "light");
    document.documentElement.classList.toggle("dark",  theme === "dark");
  } catch (_) {
    document.documentElement.classList.add("dark");
  }
})();
`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${sans.variable} ${display.variable} ${mono.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrap }} />
      </head>
      <body className="min-h-screen font-sans">
        <SiteNav />
        {/* pb-20 on mobile leaves room above the fixed bottom tab bar */}
        <main className="container py-6 pb-20 md:py-12 md:pb-12">{children}</main>
        <footer className="mt-16 border-t border-border/60 py-8">
          <div className="container flex flex-col gap-3 md:flex-row md:items-center md:justify-between text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <span className="inline-flex h-5 w-5 items-center justify-center rounded bg-gradient-to-br from-brand to-brand-2 text-[9px] font-black text-brand-foreground">
                DB
              </span>
              <span>
                DraftBoard · independent prospect rankings. All player data is for research and illustrative use only.
              </span>
            </div>
            <div className="flex gap-4">
              <a href="/about" className="hover:text-foreground transition-colors">Methodology</a>
              <a href="/admin" className="hover:text-foreground transition-colors">Admin</a>
            </div>
          </div>
        </footer>
        <Analytics />
      </body>
    </html>
  );
}
