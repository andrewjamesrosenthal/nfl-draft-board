"use client";
import { useEffect, useState } from "react";
import { Input } from "./ui/input";
import Link from "next/link";
import { Search } from "lucide-react";
import { Badge } from "./ui/badge";
import { POSITION_COLOR } from "@/lib/positions";
import type { Player } from "@prisma/client";

export function PlayerSearch() {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Player[]>([]);
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!q.trim()) { setResults([]); return; }
    const t = setTimeout(async () => {
      const res = await fetch(`/api/players?q=${encodeURIComponent(q)}`);
      const json = await res.json();
      setResults(json.items ?? []);
    }, 150);
    return () => clearTimeout(t);
  }, [q]);

  return (
    <div className="relative">
      <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
      <Input
        placeholder="Search prospects or schools..."
        className="pl-8"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setTimeout(() => setFocused(false), 150)}
      />
      {focused && results.length > 0 && (
        <div className="absolute top-full mt-1 w-full rounded-md border border-border bg-card shadow-lg z-30 max-h-80 overflow-auto">
          {results.map((p) => (
            <Link
              key={p.id}
              href={`/player/${p.slug}`}
              className="flex items-center gap-2 p-2 hover:bg-muted/50"
            >
              <Badge variant="outline" className={POSITION_COLOR[p.position]}>{p.position}</Badge>
              <span className="flex-1 truncate">{p.fullName}</span>
              <span className="text-xs text-muted-foreground">{p.school}</span>
              <span className="text-xs text-muted-foreground">{p.draftYear}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
