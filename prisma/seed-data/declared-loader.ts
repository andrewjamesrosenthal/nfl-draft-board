import fs from "node:fs";
import path from "node:path";
import type { PlayerSeed, Position, PositionGroup } from "./types";

// Authoritative declared-2026 roster (user-provided table). When present,
// this is the SOURCE OF TRUTH for who belongs in the 2026 class. Players not
// on this list are dropped from the 2026 class entirely — this is how we
// ensure players who haven't declared (e.g. Colin Simmons), players already
// in the NFL (e.g. Malachi Moore), and stale ESPN-prospect-list entries don't
// leak into the board.
//
// For players that ARE on the list, we override position / school / height /
// weight from the declared data. Scouting text, ESPN IDs, and combine numbers
// already attached by other loaders survive.

type DeclaredRow = {
  rank: number;
  fullName: string;
  school: string;
  classYear: string;
  position: string;
  positionRank: number;
  heightInches: number;
  weightLbs: number;
};

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

const POSITION_MAP: Record<string, Position> = {
  QB: "QB", RB: "RB", FB: "RB",
  WR: "WR", TE: "TE",
  OT: "OT", LT: "OT", RT: "OT",
  // Guards, centers, and generic "IOL"/"OL" all collapse to IOL.
  IOL: "IOL", OL: "IOL",
  OG: "IOL", LG: "IOL", RG: "IOL", G: "IOL",
  OC: "IOL", C: "IOL",
  EDGE: "EDGE", DE: "EDGE",
  DT: "DT", NT: "DT",
  // The declared list uses "DL" as a bucket — map to DT by default.
  DL: "DT",
  LB: "LB", ILB: "LB", OLB: "EDGE", MLB: "LB",
  CB: "CB", NB: "CB", DB: "CB",
  S: "S", FS: "S", SS: "S", SAF: "S",
  K: "K", PK: "K", P: "P", LS: "LS",
};

const POSITION_GROUP: Record<Position, PositionGroup> = {
  QB: "OFFENSE_SKILL", RB: "OFFENSE_SKILL", WR: "OFFENSE_SKILL", TE: "OFFENSE_SKILL",
  OT: "OFFENSIVE_LINE", IOL: "OFFENSIVE_LINE",
  EDGE: "DEFENSIVE_LINE", DT: "DEFENSIVE_LINE",
  LB: "LINEBACKER",
  CB: "SECONDARY", S: "SECONDARY",
  K: "SPECIAL_TEAMS", P: "SPECIAL_TEAMS", LS: "SPECIAL_TEAMS",
};

function mapPosition(raw: string): Position | null {
  return POSITION_MAP[raw.toUpperCase()] ?? null;
}

function loadRows(): DeclaredRow[] {
  const p = path.join(process.cwd(), "prisma/seed-nflverse/declared-2026.json");
  if (!fs.existsSync(p)) return [];
  try {
    return JSON.parse(fs.readFileSync(p, "utf8")) as DeclaredRow[];
  } catch (e) {
    console.warn("[declared] failed to parse:", (e as Error).message);
    return [];
  }
}

export function applyDeclaredRoster(players: PlayerSeed[]): PlayerSeed[] {
  const rows = loadRows();
  if (rows.length === 0) {
    console.warn("[declared] no declared-2026.json — skipping roster filter");
    return players;
  }

  const declaredBySlug = new Map(rows.map((r) => [slugify(r.fullName), r]));

  // Tally what we're about to do so we can report it.
  const non2026 = players.filter((p) => p.draftYear !== 2026);
  const curated2026 = players.filter((p) => p.draftYear === 2026);
  const kept2026: PlayerSeed[] = [];
  const dropped: string[] = [];

  for (const p of curated2026) {
    const row = declaredBySlug.get(p.slug);
    if (!row) {
      dropped.push(`${p.firstName} ${p.lastName}`);
      continue;
    }
    // Keep & override with declared data. Height/weight from the declared list
    // are authoritative — they reflect current college listings, which are
    // fresher than the scraped ESPN values in most cases.
    const position = mapPosition(row.position);
    if (position) {
      p.position = position;
      p.positionGroup = POSITION_GROUP[position];
    }
    p.school = row.school;
    p.heightInches = row.heightInches;
    p.weightLbs = row.weightLbs;
    kept2026.push(p);
    declaredBySlug.delete(p.slug);
  }

  // Anyone still in the declared map doesn't exist in our DB yet. Create a
  // minimal PlayerSeed so they appear on the board (they'll get enriched by
  // the ESPN prospects loader on the next ingest run).
  let added = 0;
  for (const [slug, row] of declaredBySlug) {
    const position = mapPosition(row.position);
    if (!position) continue;
    const [first, ...rest] = row.fullName.split(" ");
    kept2026.push({
      slug,
      firstName: first,
      lastName: rest.join(" "),
      position,
      positionGroup: POSITION_GROUP[position],
      school: row.school,
      draftYear: 2026,
      heightInches: row.heightInches,
      weightLbs: row.weightLbs,
      summary: `${row.fullName} — ${position} from ${row.school}. Declared for the 2026 draft. Scouting write-up pending.`,
      strengths: [],
      weaknesses: [],
    });
    added += 1;
  }

  console.log(
    `[declared] 2026 roster locked to ${kept2026.length} declared players ` +
      `(kept ${kept2026.length - added}, added ${added}, dropped ${dropped.length} non-declared).`,
  );
  if (dropped.length > 0) {
    const preview = dropped.slice(0, 5).join(", ");
    console.log(`  dropped examples: ${preview}${dropped.length > 5 ? ` (+${dropped.length - 5} more)` : ""}`);
  }
  return [...non2026, ...kept2026];
}

// Export the set of declared slugs so the seed can also purge DB rows for
// non-declared 2026 players (covers cases where a prior seed added them).
export function declaredSlugs2026(): Set<string> {
  const rows = loadRows();
  return new Set(rows.map((r) => slugify(r.fullName)));
}
