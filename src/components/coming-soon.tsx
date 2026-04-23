import Link from "next/link";
import { Card, CardContent } from "./ui/card";
import { Sparkles, ArrowRight } from "lucide-react";

// Reusable "this feature is coming" placeholder so we don't ship a half-built
// flow. Keeps the nav entry available but makes it clear the real thing is WIP.
export function ComingSoon({
  title,
  description,
  next,
}: {
  title: string;
  description?: string;
  next?: { href: string; label: string }[];
}) {
  return (
    <div className="mx-auto flex max-w-2xl flex-col items-center text-center">
      <Card className="relative w-full overflow-hidden">
        <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[2px] stripe" />
        <div
          aria-hidden
          className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-brand/10 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-20 -left-20 h-72 w-72 rounded-full bg-brand-2/10 blur-3xl"
        />
        <CardContent className="relative flex flex-col items-center gap-5 p-10 md:p-14">
          <span className="chip border-brand/40 bg-brand/10 text-foreground">
            <Sparkles className="h-3 w-3 text-brand" /> Coming soon
          </span>
          <h1 className="font-display text-4xl md:text-5xl font-black tracking-tighter leading-tight">
            {title}
          </h1>
          {description && (
            <p className="max-w-xl text-muted-foreground leading-relaxed">{description}</p>
          )}
          {next && next.length > 0 && (
            <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
              {next.map((n) => (
                <Link
                  key={n.href}
                  href={n.href}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border/70 bg-muted/20 px-4 py-2 text-sm font-medium text-foreground/90 transition-colors hover:border-brand/40 hover:text-foreground"
                >
                  {n.label} <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
