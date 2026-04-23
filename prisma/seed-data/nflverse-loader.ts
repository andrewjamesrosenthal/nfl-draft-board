import fs from "node:fs";
import path from "node:path";
import type { PlayerSeed, PositionGroup, Position } from "./types";

// Consumes prisma/seed-nflverse/nflverse.json (produced by pull_nflverse.py)
// and merges it into the curated PLAYERS_* seed arrays. Two modes:
//   • ENRICH — for a curated player whose slug already exists, we patch in the
//     ESPN ID + actual pick/team/combine fields from nflverse. Never overwrites
//     curated scouting text.
//   • AUGMENT — for nflverse rows whose slug has no curated match we append a
//     minimal PlayerSeed so the player still appears in historical views.

type NflverseRow = {
  year: number | null;
  round: number | null;
  pick: number | null;
  team: string | null;
  full_name: string;
  first_name: string | null;
  last_name: string | null;
  position: string | null;
  college: string | null;
  espn_id: string | null;
  espn_id_source: "nfl" | "college-football" | null;
  height_in: number | null;
  weight_lbs: number | null;
  forty: number | null;
  vertical: number | null;
  broad: number | null;
  three_cone: number | null;
  shuttle: number | null;
  bench: number | null;
  arm_in: number | null;
  hand_in: number | null;
};

const JSON_PATH = path.join(process.cwd(), "prisma/seed-nflverse/nflverse.json");

export function loadNflverseRows(): NflverseRow[] {
  if (!fs.existsSync(JSON_PATH)) return [];
  try {
    const raw = fs.readFileSync(JSON_PATH, "utf8");
    return JSON.parse(raw) as NflverseRow[];
  } catch (e) {
    console.warn("[nflverse] failed to parse JSON:", (e as Error).message);
    return [];
  }
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

const POSITION_MAP: Record<string, Position> = {
  QB: "QB", RB: "RB", FB: "RB", HB: "RB",
  WR: "WR", TE: "TE",
  T: "OT", OT: "OT", LT: "OT", RT: "OT",
  // Guards, centers, and generic "IOL"/"OL" all collapse to IOL.
  G: "IOL", OG: "IOL", LG: "IOL", RG: "IOL",
  C: "IOL", OC: "IOL",
  IOL: "IOL", OL: "IOL",
  DE: "EDGE", EDGE: "EDGE", OLB: "EDGE",
  DT: "DT", NT: "DT", DL: "DT",
  ILB: "LB", LB: "LB", MLB: "LB",
  CB: "CB", DB: "CB", NB: "CB",
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

function mapPosition(raw: string | null): Position | null {
  if (!raw) return null;
  const key = raw.toUpperCase();
  return POSITION_MAP[key] ?? null;
}

// ENRICH existing curated seeds + AUGMENT with nflverse-only players.
export function mergeNflverse(curated: PlayerSeed[]): PlayerSeed[] {
  const rows = loadNflverseRows();
  if (rows.length === 0) return curated;

  // Pre-pass: deduplicate within the same year (nflverse occasionally lists
  // the same player twice, e.g. as both a G and a C in the same class).
  // Keep the row with the lowest pick number.
  const deduped: NflverseRow[] = [];
  const seenYearSlug = new Map<string, NflverseRow>();
  for (const row of rows) {
    if (!row.full_name || !row.year) continue;
    const key = `${row.year}:${slugify(row.full_name)}`;
    const prev = seenYearSlug.get(key);
    if (!prev) {
      seenYearSlug.set(key, row);
      deduped.push(row);
    } else {
      // Keep whichever has the lower pick (more specific info), or the first.
      const prevPick = prev.pick ?? 999;
      const thisPick = row.pick ?? 999;
      if (thisPick < prevPick) {
        seenYearSlug.set(key, row);
        // Replace in deduped array
        const idx = deduped.indexOf(prev);
        if (idx !== -1) deduped[idx] = row;
      }
    }
  }

  // Detect cross-year name collisions so we can suffix slugs with the year.
  // e.g. "Byron Murphy" 2019 CB + "Byron Murphy" 2024 WR → two distinct players.
  const baseSlugYears = new Map<string, Set<number>>();
  for (const row of deduped) {
    const base = slugify(row.full_name);
    if (!baseSlugYears.has(base)) baseSlugYears.set(base, new Set());
    baseSlugYears.get(base)!.add(row.year!);
  }
  const ambiguous = new Set<string>(
    [...baseSlugYears.entries()]
      .filter(([, yrs]) => yrs.size > 1)
      .map(([s]) => s),
  );

  const bySlug = new Map(curated.map((p) => [p.slug, p]));
  const touched = new Set<string>();

  for (const row of deduped) {
    const base = slugify(row.full_name);
    // If multiple draft classes share this name, use slug-year to distinguish.
    const slug = ambiguous.has(base) ? `${base}-${row.year}` : base;
    const existing = bySlug.get(slug) ?? bySlug.get(base);

    if (existing) {
      touched.add(existing.slug);
      // Reconcile draftYear first. nflverse is the authoritative source for
      // when a player was actually drafted — if a curated file misfiled them
      // (e.g. a 2024 pick left in the 2026 class), move them to the correct
      // class. Only done when nflverse has a real pick (round + pick set),
      // which is the signal that the player has actually been drafted.
      if (row.round && row.pick && row.year && existing.draftYear !== row.year) {
        console.log(
          `[nflverse] moving ${existing.firstName} ${existing.lastName} ` +
            `from ${existing.draftYear} → ${row.year} (actual pick ${row.round}.${row.pick} ${row.team})`,
        );
        existing.draftYear = row.year;
      }

      // Patch only fields that aren't already curated.
      existing.espnId = existing.espnId ?? row.espn_id ?? undefined;
      existing.espnIdSource =
        existing.espnIdSource ?? (row.espn_id_source ?? (row.espn_id ? "nfl" : undefined));
      existing.actualPick = existing.actualPick ?? row.pick ?? undefined;
      existing.actualRound = existing.actualRound ?? row.round ?? undefined;
      existing.actualTeamAbbr = existing.actualTeamAbbr ?? row.team ?? undefined;
      existing.heightInches = existing.heightInches ?? row.height_in ?? undefined;
      existing.weightLbs = existing.weightLbs ?? row.weight_lbs ?? undefined;
      existing.fortyYard = existing.fortyYard ?? row.forty ?? undefined;
      existing.verticalIn = existing.verticalIn ?? row.vertical ?? undefined;
      existing.broadJumpIn = existing.broadJumpIn ?? row.broad ?? undefined;
      existing.threeConeSec = existing.threeConeSec ?? row.three_cone ?? undefined;
      existing.shuttleSec = existing.shuttleSec ?? row.shuttle ?? undefined;
      existing.benchReps = existing.benchReps ?? row.bench ?? undefined;
      existing.armInches = existing.armInches ?? row.arm_in ?? undefined;
      existing.handInches = existing.handInches ?? row.hand_in ?? undefined;
      continue;
    }

    const position = mapPosition(row.position);
    if (!position) continue;
    const seed: PlayerSeed = {
      slug,
      firstName: row.first_name ?? row.full_name.split(" ")[0],
      lastName: row.last_name ?? row.full_name.split(" ").slice(1).join(" "),
      position,
      positionGroup: POSITION_GROUP[position],
      school: row.college ?? "Unknown",
      draftYear: row.year!,
      heightInches: row.height_in ?? undefined,
      weightLbs: row.weight_lbs ?? undefined,
      fortyYard: row.forty ?? undefined,
      verticalIn: row.vertical ?? undefined,
      broadJumpIn: row.broad ?? undefined,
      threeConeSec: row.three_cone ?? undefined,
      shuttleSec: row.shuttle ?? undefined,
      benchReps: row.bench ?? undefined,
      armInches: row.arm_in ?? undefined,
      handInches: row.hand_in ?? undefined,
      actualPick: row.pick ?? undefined,
      actualRound: row.round ?? undefined,
      actualTeamAbbr: row.team ?? undefined,
      espnId: row.espn_id ?? undefined,
      espnIdSource: row.espn_id_source ?? (row.espn_id ? "nfl" : undefined),
      summary:
        `${row.full_name} — ${position} from ${row.college ?? "unknown"}.` +
        " Auto-imported from nflverse.",
      strengths: [],
      weaknesses: [],
    };
    bySlug.set(slug, seed);
    curated.push(seed);
  }

  if (touched.size > 0) {
    console.log(`[nflverse] enriched ${touched.size} curated players with ESPN IDs + combine data`);
  }
  return curated;
}
