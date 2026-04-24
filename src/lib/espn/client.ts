// Thin wrappers around the ESPN undocumented site.web.api endpoints.
// Per CLAUDE.md these endpoints require no auth.
//
// Actual response shape discovered empirically (April 2026 draft):
//   pick = {
//     overall, pick, round, teamId, traded, tradeNote,
//     status: "ON_THE_CLOCK" | "SELECTION_MADE",
//     athlete?: {                     ← populated when status === "SELECTION_MADE"
//       id,                           ← internal ESPN draft ID (not the CDN ID)
//       alternativeId,                ← the CDN / player-profile ID we use for headshots
//       displayName,
//       headshot: { href },
//       ...
//     }
//   }

const BASE = "https://site.web.api.espn.com/apis/site/v2/sports/football/nfl";

export type EspnTeam = {
  id: string;
  abbreviation?: string;
  displayName?: string;
  logo?: string;
};

export type EspnPick = {
  overall?: number;
  pick?: number;
  round?: number;
  teamId?: string;
  traded?: boolean;
  tradeNote?: string;
  status?: string;
  originalTeamId?: string;
  // Pre-draft format (not used after draft starts):
  selection?: { athlete?: { id?: string; displayName?: string } };
  // Live / post-draft format:
  athlete?: {
    id?: string;
    alternativeId?: string;
    displayName?: string;
    headshot?: { href?: string };
  };
};

export type EspnDraftOrderResponse = {
  year?: number;
  picks?: EspnPick[];
  teams?: EspnTeam[];
};

export type EspnAthleteResponse = {
  athlete?: {
    id?: string;
    displayName?: string;
    firstName?: string;
    lastName?: string;
    headshot?: { href?: string };
    position?: { abbreviation?: string };
    college?: { name?: string };
    height?: number;
    weight?: number;
    experience?: { years?: number };
    bio?: string;
  };
};

export async function fetchDraftOrder(year: number): Promise<EspnDraftOrderResponse> {
  const url = `${BASE}/draft?season=${year}&region=us&lang=en`;
  const res = await fetch(url, {
    headers: { "user-agent": "DraftBoard/1.0 (+https://draftboard.app)" },
    // No Next.js cache — we want fresh data every time during the draft.
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`ESPN draft order HTTP ${res.status}`);
  return (await res.json()) as EspnDraftOrderResponse;
}

export async function fetchProspect(espnId: string, year: number): Promise<EspnAthleteResponse> {
  const url = `${BASE}/draft/athlete/${espnId}?season=${year}&region=us&lang=en`;
  const res = await fetch(url, {
    headers: { "user-agent": "DraftBoard/1.0" },
    next: { revalidate: 3600 },
  });
  if (!res.ok) throw new Error(`ESPN prospect HTTP ${res.status}`);
  return (await res.json()) as EspnAthleteResponse;
}

export type FlatPick = {
  overallPick: number;
  round: number;
  pickInRound: number;
  teamAbbr: string;
  teamName?: string;
  teamLogoUrl?: string;
  isOnTheClock: boolean;
  isCompleted: boolean;
  // The CDN-matched ESPN athlete ID (alternativeId in live data, id in pre-draft data)
  espnAthleteId?: string;
  selectedAthlete?: string;
  headshotUrl?: string;
  tradedFromAbbr?: string;
};

export function flattenDraftOrder(data: EspnDraftOrderResponse): FlatPick[] {
  const teamsById = new Map<string, EspnTeam>();
  for (const t of data.teams ?? []) {
    if (t.id) teamsById.set(String(t.id), t);
  }

  const flat: FlatPick[] = [];
  for (const pick of data.picks ?? []) {
    const overall = pick.overall ?? 0;
    if (!overall || !pick.teamId) continue;

    const team = teamsById.get(String(pick.teamId));
    const abbr = team?.abbreviation ?? `ID${pick.teamId}`;
    const originalTeam = pick.originalTeamId
      ? teamsById.get(String(pick.originalTeamId))
      : undefined;

    const isCompleted =
      pick.status === "SELECTION_MADE" ||
      pick.status === "COMPLETED" ||
      pick.status === "MADE";

    // Live draft: athlete is top-level. Pre-draft: under selection.athlete.
    const athleteLive = pick.athlete;
    const athletePre  = pick.selection?.athlete;

    // Use alternativeId for live picks — it matches our headshot CDN IDs.
    const espnAthleteId =
      athleteLive?.alternativeId ??
      athleteLive?.id ??
      athletePre?.id;

    const selectedAthlete =
      athleteLive?.displayName ?? athletePre?.displayName;

    const headshotUrl = athleteLive?.headshot?.href;

    flat.push({
      overallPick: overall,
      round: pick.round ?? 0,
      pickInRound: pick.pick ?? 0,
      teamAbbr: abbr,
      teamName: team?.displayName,
      teamLogoUrl: team?.logo,
      isOnTheClock: pick.status === "ON_THE_CLOCK",
      isCompleted,
      espnAthleteId,
      selectedAthlete,
      headshotUrl,
      tradedFromAbbr: pick.traded ? originalTeam?.abbreviation : undefined,
    });
  }
  flat.sort((a, b) => a.overallPick - b.overallPick);
  return flat;
}
