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
  { href: "/grade",       label: "Grade",      icon: GraduationCap, lockedUntil: PICK_GRADE_UNLOCK },
  { href: "/about",       label: "About",      icon: Info },
];

export function SiteNav() {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/50 glass">
      <div className="container flex h-16 items-center gap-6">
        <Link href="/" className="group flex items-center gap-2.5">
          <span className="relative inline-flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-brand to-brand-2 text-brand-foreground font-black text-sm shadow-glow">
            DB
            <span className="absolute inset-0 rounded-lg ring-1 ring-inset ring-white/20" />
          </span>
          <span className="hidden font-display text-xl font-black tracking-tight sm:block">
            Draft<span className="gradient-text">Board</span>
          </span>
        </Link>
        <nav className="no-scrollbar flex flex-1 items-center justify-center gap-0.5 overflow-x-auto">
          {LINKS.map(({ href, label, icon: Icon, ...rest }) => {
            const lockedUntil = (rest as any).lockedUntil as Date | undefined;
            const isLocked = lockedUntil ? new Date() < lockedUntil : false;
            const active = pathname === href || pathname.startsWith(href + "/");
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "group relative inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  active
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className={cn("h-4 w-4 transition-colors", active && "text-brand")} />
                <span className="hidden lg:inline">{label}</span>
                {isLocked && (
                  <Lock className="h-2.5 w-2.5 text-amber-400 opacity-80" />
                )}
                {active && (
                  <span className="absolute -bottom-[17px] left-1/2 h-[2px] w-6 -translate-x-1/2 rounded-full bg-gradient-to-r from-brand to-brand-2" />
                )}
              </Link>
            );
          })}
        </nav>
        <ThemeToggle />
        <Link
          href="/me"
          className="inline-flex items-center gap-1.5 rounded-lg border border-border/60 bg-muted/30 px-2.5 py-1.5 text-sm text-muted-foreground transition-colors hover:border-brand/40 hover:text-foreground"
        >
          <User2 className="h-4 w-4" />
          <span className="hidden md:inline">You</span>
        </Link>
      </div>
    </header>
  );
}
