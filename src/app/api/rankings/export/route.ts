import db from "@/lib/db";
import { getOrCreateUser } from "@/lib/user-session";
import { rankingEngine } from "@/lib/ranking";
import { confidenceLevel } from "@/lib/ranking/confidence";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// CSV export for personal + community boards.
//   GET /api/rankings/export?scope=personal&year=2026[&position=QB]
// Returns a CSV file keyed off the same logic as /api/rankings/{personal,community}.
// Personal export uses community rating as a default for any unranked player,
// matching what the board UI shows.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const scope = (url.searchParams.get("scope") ?? "personal") as "personal" | "community";
  const year = Number(url.searchParams.get("year") ?? "2026");
  const position = url.searchParams.get("position") ?? undefined;

  const rows = scope === "personal"
    ? await personalRows(year, position)
    : await communityRows(year, position);

  const csv = toCsv(rows);
  const filename = `draftboard-${scope}-${year}${position ? `-${position}` : ""}.csv`;
  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`,
      // Signal to Next that this is a fresh fetch every time.
      "cache-control": "no-store",
    },
  });
}

type Row = {
  rank: number;
  player: string;
  position: string;
  school: string;
  draftYear: number;
  rating: number;
  comparisons: number;
  confidence: string;
  source: string;
  manualRank: string;
  heightInches: number | null;
  weightLbs: number | null;
  fortyYard: number | null;
};

async function personalRows(year: number, position?: string): Promise<Row[]> {
  const { id: userId } = await getOrCreateUser();
  const [players, rankings, overrides] = await Promise.all([
    db.player.findMany({
      where: {
        draftYear: year,
        ...(position ? { position: position as any } : {}),
      },
      include: { communityRanking: true },
    }),
    db.userRanking.findMany({ where: { userId, draftYear: year } }),
    db.userRankingOverride.findMany({ where: { userId, draftYear: year } }),
  ]);
  const rByPid = new Map(rankings.map((r) => [r.playerId, r]));
  const oByPid = new Map(overrides.map((o) => [o.playerId, o.manualRank]));

  const items = players
    .map((p) => {
      const r = rByPid.get(p.id);
      const source = r ? "personal" : "default";
      const rating = r?.rating ?? p.communityRanking?.rating ?? rankingEngine.defaults.rating;
      const sigma = r?.sigma ?? rankingEngine.defaults.sigma;
      const comparisons = r?.comparisons ?? 0;
      return {
        player: p,
        rating, sigma, comparisons, source,
        manualRank: oByPid.get(p.id) ?? null,
      };
    })
    .sort((a, b) => b.rating - a.rating)
    .map((it, idx) => ({
      rank: idx + 1,
      player: it.player.fullName,
      position: it.player.position,
      school: it.player.school,
      draftYear: it.player.draftYear,
      rating: Math.round(it.rating),
      comparisons: it.comparisons,
      confidence: confidenceLevel(it.sigma, it.comparisons),
      source: it.source,
      manualRank: it.manualRank != null ? String(it.manualRank) : "",
      heightInches: it.player.heightInches,
      weightLbs: it.player.weightLbs,
      fortyYard: it.player.fortyYard,
    }));

  return items;
}

async function communityRows(year: number, position?: string): Promise<Row[]> {
  const rankings = await db.communityRanking.findMany({
    where: {
      draftYear: year,
      ...(position ? { player: { position: position as any } } : {}),
    },
    include: { player: true },
    orderBy: { rating: "desc" },
  });
  return rankings.map((c, idx) => ({
    rank: idx + 1,
    player: c.player.fullName,
    position: c.player.position,
    school: c.player.school,
    draftYear: c.player.draftYear,
    rating: Math.round(c.rating),
    comparisons: c.comparisons,
    confidence: confidenceLevel(c.sigma, c.comparisons),
    source: "community",
    manualRank: "",
    heightInches: c.player.heightInches,
    weightLbs: c.player.weightLbs,
    fortyYard: c.player.fortyYard,
  }));
}

const HEADERS: (keyof Row)[] = [
  "rank", "player", "position", "school", "draftYear",
  "rating", "comparisons", "confidence", "source", "manualRank",
  "heightInches", "weightLbs", "fortyYard",
];

function toCsv(rows: Row[]): string {
  const header = HEADERS.join(",");
  const body = rows.map((r) =>
    HEADERS.map((h) => csvCell(r[h])).join(","),
  ).join("\n");
  return header + "\n" + body + "\n";
}

// RFC 4180 quoting — wrap in quotes if the cell contains comma, quote, or newline.
function csvCell(v: unknown): string {
  if (v == null) return "";
  const s = String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}
