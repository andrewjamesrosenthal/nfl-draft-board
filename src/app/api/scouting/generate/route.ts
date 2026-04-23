import { NextResponse } from "next/server";
import { z } from "zod";
import db from "@/lib/db";
import { isAdminAuthorized } from "@/lib/admin";
import { formatHeight, formatWeight, formatForty } from "@/lib/format";
import type { Player } from "@prisma/client";

export const dynamic = "force-dynamic";

const schema = z.object({
  playerId: z.number().int(),
  style: z.enum(["concise", "detailed"]).default("concise"),
});

// Scouting generation cascade (per CLAUDE.md data-sourcing instructions):
//   1) Anthropic Claude (preferred) — ESPN Scouts Inc.-style 150-word report
//   2) OpenAI fallback (if ANTHROPIC_API_KEY is missing but OPENAI_API_KEY is set)
//   3) Deterministic local generator — so the flow works without any keys
export async function POST(req: Request) {
  if (!isAdminAuthorized()) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { playerId, style } = parsed.data;

  const player = await db.player.findUnique({ where: { id: playerId } });
  if (!player) return NextResponse.json({ error: "not found" }, { status: 404 });

  const stats = await db.playerStat.findMany({
    where: { playerId: player.id },
    orderBy: { season: "desc" },
  });

  let generated: GeneratedReport;
  let provider: "anthropic" | "openai" | "local" = "local";
  if (process.env.ANTHROPIC_API_KEY) {
    try {
      generated = await generateWithAnthropic(player, stats, style);
      provider = "anthropic";
    } catch {
      generated = process.env.OPENAI_API_KEY
        ? await generateWithOpenAI(player, style).catch(() => generateLocally(player, style))
        : generateLocally(player, style);
      provider = process.env.OPENAI_API_KEY ? "openai" : "local";
    }
  } else if (process.env.OPENAI_API_KEY) {
    generated = await generateWithOpenAI(player, style).catch(() => generateLocally(player, style));
    provider = "openai";
  } else {
    generated = generateLocally(player, style);
  }

  const report = await db.scoutingReport.create({
    data: {
      playerId: player.id,
      source: "AI",
      summary: generated.summary,
      strengths: JSON.stringify(generated.strengths),
      weaknesses: JSON.stringify(generated.weaknesses),
      nflComp: generated.nflComp,
      grade: generated.grade,
    },
  });

  return NextResponse.json({ report, provider });
}

type GeneratedReport = {
  summary: string;
  strengths: string[];
  weaknesses: string[];
  nflComp?: string;
  grade?: number;
};

function generateLocally(p: Player, _style: "concise" | "detailed"): GeneratedReport {
  const ht = formatHeight(p.heightInches);
  const wt = formatWeight(p.weightLbs);
  const forty = p.fortyYard ? `a reported ${formatForty(p.fortyYard)} 40` : "an unverified 40 time";
  const frame =
    p.position === "QB" ? "field general" :
    p.position === "RB" ? "backfield piece" :
    p.position === "WR" ? "perimeter receiver" :
    p.position === "TE" ? "move tight end" :
    p.position === "OT" || p.position === "IOL" ? "offensive lineman" :
    p.position === "EDGE" || p.position === "DT" ? "front-seven disruptor" :
    "defender";

  const summary =
    `${p.fullName} is a ${ht}, ${wt} ${frame} from ${p.school} with ${forty}. ` +
    `Projects as a scheme-flex contributor with upside tied to continued development in ${p.position} technique.`;

  const strengths = [
    "Above-average production within scheme role",
    "Functional athletic profile for the position",
    "Plus competitive toughness on tape",
  ];
  const weaknesses = [
    "Needs additional reps against top-end competition",
    "Technique still being refined for NFL translation",
  ];
  return { summary, strengths, weaknesses };
}

// Anthropic path. Prompt follows the "150-word ESPN Scouts Inc. style" spec
// from CLAUDE.md. Output is strict JSON so we can persist the structured
// strengths/weaknesses/nflComp/grade alongside the prose summary.
async function generateWithAnthropic(
  p: Player,
  stats: { season: number; label: string; value: string }[],
  style: "concise" | "detailed",
): Promise<GeneratedReport> {
  const apiKey = process.env.ANTHROPIC_API_KEY!;
  const model = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-6";
  const prompt = buildScoutingPrompt(p, stats, style);
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 600,
      system:
        "You are a concise NFL Draft scout writing in the voice of ESPN Scouts Inc. " +
        "Produce ORIGINAL summaries — never copy sentences from ESPN or other outlets. " +
        "Always output strict JSON with keys: summary, strengths, weaknesses, nflComp, grade.",
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!res.ok) {
    throw new Error(`anthropic ${res.status}`);
  }
  const json = (await res.json()) as { content?: { type: string; text?: string }[] };
  const text = (json.content ?? []).map((b) => (b.type === "text" ? b.text ?? "" : "")).join("");
  const parsed = extractJson(text);
  return {
    summary: String(parsed.summary ?? "").trim() || generateLocally(p, style).summary,
    strengths: Array.isArray(parsed.strengths) ? parsed.strengths.map(String) : [],
    weaknesses: Array.isArray(parsed.weaknesses) ? parsed.weaknesses.map(String) : [],
    nflComp: parsed.nflComp ? String(parsed.nflComp) : undefined,
    grade: typeof parsed.grade === "number" ? parsed.grade : undefined,
  };
}

async function generateWithOpenAI(p: Player, style: "concise" | "detailed"): Promise<GeneratedReport> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: "You are a concise NFL Draft scout. Original summaries only. Strict JSON." },
        { role: "user", content: buildScoutingPrompt(p, [], style) },
      ],
    }),
  });
  if (!res.ok) throw new Error(`openai ${res.status}`);
  const json = (await res.json()) as { choices: { message: { content: string } }[] };
  const parsed = extractJson(json.choices[0].message.content);
  return {
    summary: String(parsed.summary ?? "").trim() || generateLocally(p, style).summary,
    strengths: Array.isArray(parsed.strengths) ? parsed.strengths.map(String) : [],
    weaknesses: Array.isArray(parsed.weaknesses) ? parsed.weaknesses.map(String) : [],
    nflComp: parsed.nflComp ? String(parsed.nflComp) : undefined,
    grade: typeof parsed.grade === "number" ? parsed.grade : undefined,
  };
}

function buildScoutingPrompt(
  p: Player,
  stats: { season: number; label: string; value: string }[],
  style: "concise" | "detailed",
): string {
  const measurables = [
    p.heightInches ? `height ${formatHeight(p.heightInches)}` : null,
    p.weightLbs ? `weight ${formatWeight(p.weightLbs)}` : null,
    p.fortyYard ? `40-yard ${formatForty(p.fortyYard)}` : null,
    p.tenYardSplit ? `10-split ${p.tenYardSplit.toFixed(2)}` : null,
    p.verticalIn ? `vertical ${p.verticalIn}"` : null,
    p.broadJumpIn ? `broad ${p.broadJumpIn}"` : null,
    p.threeConeSec ? `3-cone ${p.threeConeSec.toFixed(2)}` : null,
    p.shuttleSec ? `shuttle ${p.shuttleSec.toFixed(2)}` : null,
    p.benchReps ? `bench ${p.benchReps}` : null,
    p.armInches ? `arms ${p.armInches}"` : null,
    p.handInches ? `hands ${p.handInches}"` : null,
  ]
    .filter(Boolean)
    .join(", ");
  const statLines =
    stats.length > 0
      ? stats
          .slice(0, 20)
          .map((s) => `  ${s.season} ${s.label}: ${s.value}`)
          .join("\n")
      : "  (no structured stats available)";
  const target = style === "detailed" ? "~220 words" : "~150 words";
  return [
    `Write a ${target} NFL scouting report in the style of ESPN Scouts Inc. for ${p.fullName},`,
    `a ${p.position} from ${p.school}${p.conference ? ` (${p.conference})` : ""}, ${p.draftYear} draft class.`,
    measurables ? `Measurables: ${measurables}.` : "Measurables: limited.",
    "College production:",
    statLines,
    "",
    "Include strengths, weaknesses, and an NFL player comparison.",
    'Return JSON exactly of the form: {"summary": string, "strengths": string[3-4], "weaknesses": string[2-3], "nflComp": string, "grade": number 0-10}.',
    "Do not copy sentences from any third-party scouting source. Be specific to this player's tape and testing, not generic.",
  ].join("\n");
}

// Providers sometimes wrap JSON in fenced code blocks or surrounding prose.
// Pull out the first {...} block defensively.
function extractJson(text: string): Record<string, unknown> {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return {};
  try {
    return JSON.parse(text.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    return {};
  }
}
