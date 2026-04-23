#!/usr/bin/env tsx
/**
 * Pull every draft prospect for a given year from ESPN's core API and write
 * the result to prisma/seed-nflverse/prospects-{year}.json. Per CLAUDE.md
 * "CURRENT YEAR PROSPECTS" spec: ESPN's draft endpoint returns $ref links, so
 * we follow each one to get the real athlete record. The college-football
 * ESPN ID (used for pre-draft headshots) lives in the playercard link path,
 * not in the top-level `id` field — the top-level `id` is a draft profile ID.
 *
 * Usage:
 *   npx tsx scripts/ingest-prospects.ts --year 2026
 *
 * Rate-limit: 150ms between requests (per ESPN's tolerance). Colleges are
 * looked up once and cached in-memory so the ~350 Ohio State / Alabama / etc.
 * duplicates don't hammer the college endpoint.
 */
import fs from "node:fs";
import path from "node:path";

const CORE_BASE = "https://sports.core.api.espn.com/v2/sports/football/leagues/nfl";
const RICH_BASE = "https://site.web.api.espn.com/apis/site/v2/sports/football/nfl";
const UA = "DraftBoard/1.0 (+https://example.com)";
const THROTTLE_MS = 150;

type ProspectOut = {
  draftId: string;            // ESPN draft-profile ID (e.g. "110756")
  espnId: string | null;      // college-football athlete ID (e.g. "4950400") — USE for headshots
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

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: { "user-agent": UA } });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return (await res.json()) as T;
}

// College endpoint is called once per unique college; results cached here.
const collegeCache = new Map<string, string>();
async function resolveCollege(ref: string | undefined): Promise<string | null> {
  if (!ref) return null;
  if (collegeCache.has(ref)) return collegeCache.get(ref)!;
  try {
    const c = await fetchJson<{ name?: string }>(ref);
    const name = c.name ?? null;
    if (name) collegeCache.set(ref, name);
    return name;
  } catch {
    return null;
  }
}

// The college-football athlete ID lives in the playercard link path:
// https://www.espn.com/college-football/player/_/id/{ID}/first-last
function extractCollegeFootballId(links: { rel?: string[]; href?: string }[] | undefined): string | null {
  if (!links) return null;
  for (const link of links) {
    if (!link.rel?.includes("playercard")) continue;
    const m = link.href?.match(/\/id\/(\d+)\//);
    if (m) return m[1];
  }
  return null;
}

async function fetchProspectList(year: number): Promise<string[]> {
  const refs: string[] = [];
  let page = 1;
  while (true) {
    const url = `${CORE_BASE}/seasons/${year}/draft/athletes?limit=500&page=${page}`;
    const data = await fetchJson<{
      items?: { $ref: string }[];
      pageCount?: number;
      count?: number;
    }>(url);
    const items = data.items ?? [];
    refs.push(...items.map((i) => i.$ref));
    console.error(`  page ${page}/${data.pageCount ?? "?"}: ${items.length} refs (total ${refs.length}/${data.count ?? "?"})`);
    if (!data.pageCount || page >= data.pageCount) break;
    page += 1;
    await wait(THROTTLE_MS);
  }
  return refs;
}

type AthleteRecord = {
  id?: string;
  firstName?: string;
  lastName?: string;
  fullName?: string;
  displayName?: string;
  height?: number;
  weight?: number;
  displayHeight?: string;
  displayWeight?: string;
  headshot?: { href?: string };
  position?: { abbreviation?: string };
  college?: { $ref?: string; name?: string };
  links?: { rel?: string[]; href?: string }[];
};

type RichAthlete = {
  athlete?: {
    id?: string;
    displayName?: string;
    headshot?: { href?: string };
    college?: { name?: string };
    combine?: {
      fortyYardDash?: number;
      verticalLeap?: number;
      broadJump?: number;
      benchPress?: number;
    };
    draftProjection?: { round?: number };
  };
};

async function fetchOneProspect(ref: string, year: number): Promise<ProspectOut | null> {
  let athlete: AthleteRecord;
  try {
    athlete = await fetchJson<AthleteRecord>(ref);
  } catch (e) {
    console.error(`  skip (athlete fetch failed): ${(e as Error).message}`);
    return null;
  }

  const draftId = athlete.id ?? "";
  const cfbId = extractCollegeFootballId(athlete.links);
  const college = athlete.college?.name ?? (await resolveCollege(athlete.college?.$ref));

  let rich: RichAthlete | null = null;
  if (cfbId) {
    try {
      rich = await fetchJson<RichAthlete>(
        `${RICH_BASE}/draft/athlete/${cfbId}?season=${year}&region=us&lang=en`,
      );
    } catch {
      rich = null;
    }
    await wait(THROTTLE_MS);
  }

  const combine = rich?.athlete?.combine ?? {};
  const headshot =
    athlete.headshot?.href ??
    rich?.athlete?.headshot?.href ??
    (cfbId ? `https://a.espncdn.com/i/headshots/college-football/players/full/${cfbId}.png` : null);

  return {
    draftId,
    espnId: cfbId,
    espnIdSource: "college-football",
    fullName: athlete.fullName ?? athlete.displayName ?? "",
    firstName: athlete.firstName ?? null,
    lastName: athlete.lastName ?? null,
    position: athlete.position?.abbreviation ?? null,
    college,
    heightInches: athlete.height ? Math.round(athlete.height) : null,
    weightLbs: athlete.weight ? Math.round(athlete.weight) : null,
    headshotUrl: headshot,
    fortyYard: combine.fortyYardDash ?? null,
    verticalIn: combine.verticalLeap ?? null,
    broadJumpIn: combine.broadJump ?? null,
    benchReps: combine.benchPress ?? null,
    projectedRound: rich?.athlete?.draftProjection?.round ?? null,
    draftYear: year,
  };
}

function parseArgs(): { year: number; limit?: number; skipRich?: boolean } {
  const args = process.argv.slice(2);
  let year = new Date().getFullYear();
  let limit: number | undefined;
  let skipRich = false;
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--year") year = Number(args[++i]);
    else if (a === "--limit") limit = Number(args[++i]);
    else if (a === "--skip-rich") skipRich = true;
  }
  return { year, limit, skipRich };
}

async function main(): Promise<void> {
  const { year, limit } = parseArgs();
  console.error(`Ingesting ${year} draft prospects from ESPN…`);

  const refs = await fetchProspectList(year);
  const targets = limit ? refs.slice(0, limit) : refs;
  console.error(`Fetching ${targets.length} athlete records (~${Math.round((targets.length * THROTTLE_MS * 2) / 1000)}s)…`);

  const out: ProspectOut[] = [];
  let i = 0;
  for (const ref of targets) {
    i += 1;
    try {
      const p = await fetchOneProspect(ref, year);
      if (p && p.fullName) {
        out.push(p);
        if (i % 25 === 0 || i === targets.length) {
          console.error(`  ${i}/${targets.length}: ${p.fullName} (${p.position ?? "?"}, ${p.college ?? "?"})`);
        }
      }
    } catch (e) {
      console.error(`  ${i}/${targets.length}: error ${(e as Error).message}`);
    }
    await wait(THROTTLE_MS);
  }

  const outPath = path.join(process.cwd(), "prisma/seed-nflverse", `prospects-${year}.json`);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2));
  console.error(`\nWrote ${out.length} prospects → ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
