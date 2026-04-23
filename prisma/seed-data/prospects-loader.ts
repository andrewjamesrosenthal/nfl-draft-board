import fs from "node:fs";
import path from "node:path";
import type { PlayerSeed, Position, PositionGroup } from "./types";

// Consumes prisma/seed-nflverse/prospects-{year}.json (produced by
// scripts/ingest-prospects.ts). For the CURRENT (pre-draft) class this is the
// source of truth for the prospect roster — we ship ~700 real players with
// college-football ESPN IDs, not a 41-name hand-curated subset.
//
// Merge strategy mirrors the nflverse loader:
//   ENRICH — curated slug already exists → fill in espn_id + combine fields
//   AUGMENT — no curated match → append a minimal PlayerSeed

type ProspectRow = {
  draftId: string;
  espnId: string | null;
  espnIdSource: "college-football" | "nfl";
  fullName: string;
  firstName: string | null;
  lastName: string | null;
  position: string | null;
  college: string | null;
  heightInches: number | null;
  weightLbs: number | null;
  headshotUrl: string | null;
  fortyYard: number | null;
  verticalIn: number | null;
  broadJumpIn: number | null;
  benchReps: number | null;
  projectedRound: number | null;
  draftYear: number;
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
  QB: "QB", RB: "RB", FB: "RB", HB: "RB", ATH: "RB",
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
  return POSITION_MAP[raw.toUpperCase()] ?? null;
}

function loadProspectFile(year: number): ProspectRow[] {
  const p = path.join(process.cwd(), "prisma/seed-nflverse", `prospects-${year}.json`);
  if (!fs.existsSync(p)) return [];
  try {
    return JSON.parse(fs.readFileSync(p, "utf8")) as ProspectRow[];
  } catch (e) {
    console.warn(`[prospects] failed to parse ${p}:`, (e as Error).message);
    return [];
  }
}

export function mergeProspects(
  curated: PlayerSeed[],
  years: number[],
): PlayerSeed[] {
  for (const year of years) {
    const rows = loadProspectFile(year);
    if (rows.length === 0) continue;

    const bySlug = new Map(curated.map((p) => [p.slug, p]));
    let enriched = 0;
    let augmented = 0;

    for (const row of rows) {
      if (!row.fullName) continue;
      const slug = slugify(row.fullName);
      const existing = bySlug.get(slug);

      if (existing) {
        existing.espnId = existing.espnId ?? row.espnId ?? undefined;
        existing.espnIdSource = existing.espnIdSource ?? row.espnIdSource;
        existing.heightInches = existing.heightInches ?? row.heightInches ?? undefined;
        existing.weightLbs = existing.weightLbs ?? row.weightLbs ?? undefined;
        existing.fortyYard = existing.fortyYard ?? row.fortyYard ?? undefined;
        existing.verticalIn = existing.verticalIn ?? row.verticalIn ?? undefined;
        existing.broadJumpIn = existing.broadJumpIn ?? row.broadJumpIn ?? undefined;
        existing.benchReps = existing.benchReps ?? row.benchReps ?? undefined;
        existing.headshotUrl = existing.headshotUrl ?? row.headshotUrl ?? undefined;
        enriched += 1;
        continue;
      }

      const position = mapPosition(row.position);
      if (!position) continue;
      const firstName = row.firstName ?? row.fullName.split(" ")[0];
      const lastName = row.lastName ?? row.fullName.split(" ").slice(1).join(" ") ?? "";

      curated.push({
        slug,
        firstName,
        lastName,
        position,
        positionGroup: POSITION_GROUP[position],
        school: row.college ?? "Unknown",
        draftYear: year,
        heightInches: row.heightInches ?? undefined,
        weightLbs: row.weightLbs ?? undefined,
        fortyYard: row.fortyYard ?? undefined,
        verticalIn: row.verticalIn ?? undefined,
        broadJumpIn: row.broadJumpIn ?? undefined,
        benchReps: row.benchReps ?? undefined,
        espnId: row.espnId ?? undefined,
        espnIdSource: row.espnIdSource,
        headshotUrl: row.headshotUrl ?? undefined,
        summary:
          `${row.fullName} — ${position} from ${row.college ?? "unknown"}. ` +
          "Imported from ESPN's prospect list; scouting write-up pending.",
        strengths: [],
        weaknesses: [],
      });
      augmented += 1;
      bySlug.set(slug, curated[curated.length - 1]);
    }

    console.log(
      `[prospects] ${year}: enriched ${enriched} curated, augmented ${augmented} new (from ${rows.length} ESPN rows)`,
    );
  }
  return curated;
}
