#!/usr/bin/env tsx
// Parse prisma/seed-nflverse/declared-2026.txt (tab-separated user paste) into
// prisma/seed-nflverse/declared-2026.json. One row per declared prospect.
import fs from "node:fs";
import path from "node:path";

type DeclaredRow = {
  rank: number;
  fullName: string;
  school: string;
  classYear: string;   // "Jr" | "Sr" | "Soph" | "-"
  position: string;    // raw ESPN-ish (QB, EDGE, IOL, OL, DL, ...)
  positionRank: number;
  heightInches: number;
  weightLbs: number;
};

function parseHeight(raw: string): number | null {
  const m = raw.match(/^(\d+)-(\d+)$/);
  if (!m) return null;
  return Number(m[1]) * 12 + Number(m[2]);
}

const src = fs.readFileSync(
  path.join(process.cwd(), "prisma/seed-nflverse/declared-2026.txt"),
  "utf8",
);
const rows: DeclaredRow[] = [];
for (const line of src.split("\n")) {
  const cols = line.split("\t").map((s) => s.trim()).filter(Boolean);
  if (cols.length < 8) continue;
  const [rk, name, school, classYear, pos, posRk, ht, wt] = cols;
  if (!/^\d+$/.test(rk)) continue;
  const heightInches = parseHeight(ht);
  if (heightInches == null) continue;
  rows.push({
    rank: Number(rk),
    fullName: name,
    school,
    classYear,
    position: pos.toUpperCase(),
    positionRank: Number(posRk),
    heightInches,
    weightLbs: Number(wt),
  });
}

const outPath = path.join(process.cwd(), "prisma/seed-nflverse/declared-2026.json");
fs.writeFileSync(outPath, JSON.stringify(rows, null, 2));
console.log(`Parsed ${rows.length} declared prospects → ${outPath}`);
