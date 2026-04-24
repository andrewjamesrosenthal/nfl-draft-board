"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  Swords, Users, ClipboardList, LineChart, User2, History, Info,
  Eye, Radio, GraduationCap, Lock,
} from "lucide-react";
import { ThemeToggle } from "./theme-toggle";
import { PICK_GRADE_UNLOCK } from "@/lib/pick-grade";

const LINKS = [
  { href: "/compare",     label: "Compare",    icon: Swords },
  { href: "/board",       label: "Board",      icon: ClipboardList },
  { href: "/community",   label: "Community",  icon: Users },
  { href: "/draft-order", label: "Order",      icon: Radio },
  { href: "/trends",      label: "Trends",     icon: LineChart },
  { href: "/historical",  label: "History",    icon: History },
  { href: "/watchlist",   label: "Watchlist",  icon: Eye },
  { href: "/grade",       label: "Grade",      icon: GraduationCap },
  { href: "/about",       label: "About",      icon: Info },
];

// The 5 most important destinations for the mobile bottom tab bar.
const MOBILE_TABS = [
  { href: "/compare",     label: "Compare",  icon: Swords },
  { href: "/board",       label: "Board",    icon: ClipboardList },
  { href: "/draft-order", label: "Order",    icon: Radio },
  { href: "/grade",       label: "Grade",    icon: GraduationCap, lockedUntil: PICK_GRADE_UNLOCK },
  { href: "/me",          label: "You",      icon: User2 },
];

export function SiteNav() {
  const pathname = usePathname();
  return (
    <>
      {/* ── Desktop / tablet header ────────────────────────────────────── */}
      <header className="sticky top-0 z-40 w-full border-b border-border/50 glass">
        <div className="container flex h-14 items-center gap-4">
          <Link href="/" className="group flex shrink-0 items-center gap-2">
            <span className="relative inline-flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-brand to-brand-2 text-brand-foreground font-black text-xs shadow-glow">
              DB
              <span className="absolute inset-0 rounded-lg ring-1 ring-inset ring-white/20" />
            </span>
            <span className="hidden font-display text-lg font-black tracking-tight sm:block">
              Draft<span className="gradient-text">Board</span>
            </span>
          </Link>

          {/* Desktop nav links — hidden on mobile (bottom bar handles it) */}
          <nav className="no-scrollbar hidden md:flex flex-1 items-center justify-center gap-0.5 overflow-x-auto">
            {LINKS.map(({ href, label, icon: Icon, ...rest }) => {
              const lockedUntil = (rest as any).lockedUntil as Date | undefined;
              const isLocked = lockedUntil ? new Date() < lockedUntil : false;
              const active = pathname === href || pathname.startsWith(href + "/");
              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    "group relative inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors",
                    active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Icon className={cn("h-4 w-4 transition-colors", active && "text-brand")} />
                  <span className="hidden lg:inline">{label}</span>
                  {isLocked && <Lock className="h-2.5 w-2.5 text-amber-400 opacity-80" />}
                  {active && (
                    <span className="absolute -bottom-[15px] left-1/2 h-[2px] w-5 -translate-x-1/2 rounded-full bg-gradient-to-r from-brand to-brand-2" />
                  )}
                </Link>
              );
            })}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle />
            <Link
              href="/me"
              className="hidden md:inline-flex items-center gap-1.5 rounded-lg border border-border/60 bg-muted/30 px-2.5 py-1.5 text-sm text-muted-foreground transition-colors hover:border-brand/40 hover:text-foreground"
            >
              <User2 className="h-4 w-4" />
              <span className="hidden lg:inline">You</span>
            </Link>
          </div>
        </div>
      </header>

      {/* ── Mobile bottom tab bar ──────────────────────────────────────── */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-50 border-t border-border/60 glass">
        <div className="flex h-16 items-stretch">
          {MOBILE_TABS.map(({ href, label, icon: Icon, ...rest }) => {
            const lockedUntil = (rest as any).lockedUntil as Date | undefined;
            const isLocked = lockedUntil ? new Date() < lockedUntil : false;
            const active = pathname === href || pathname.startsWith(href + "/");
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "relative flex flex-1 flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors",
                  active ? "text-brand" : "text-muted-foreground",
                )}
              >
                <div className="relative">
                  <Icon className="h-5 w-5" />
                  {isLocked && (
                    <Lock className="absolute -top-1 -right-1 h-2.5 w-2.5 text-amber-400" />
                  )}
                </div>
                <span>{label}</span>
                {active && (
                  <span className="absolute top-0 left-1/2 h-[2px] w-8 -translate-x-1/2 rounded-full bg-gradient-to-r from-brand to-brand-2" />
                )}
              </Link>
            );
          })}
        </div>
        {/* Safe area for iPhone home indicator */}
        <div className="h-safe-area-inset-bottom bg-transparent" />
      </nav>

      {/* Spacer so content isn't hidden behind bottom nav on mobile */}
      <div className="md:hidden h-16" aria-hidden />
    </>
  );
}
