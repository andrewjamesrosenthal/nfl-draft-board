"use client";
import * as React from "react";
import { cn } from "@/lib/utils";

// Lightweight native select styled to match the dark theme; avoids
// pulling the full Radix Select popover for the MVP filters.
export function Select({
  className,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "flex h-10 w-full items-center rounded-lg border border-border/70 bg-muted/30 px-3 py-2 text-sm text-foreground",
        "appearance-none transition-colors focus-visible:outline-none focus-visible:border-brand/50 focus-visible:ring-2 focus-visible:ring-brand/20 hover:border-border",
        className,
      )}
      {...props}
    />
  );
}
