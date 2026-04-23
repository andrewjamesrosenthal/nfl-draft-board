// Thin wrappers around the ESPN undocumented site.web.api endpoints that the
// product uses for draft order and prospect profiles. Per CLAUDE.md these
// endpoints require no auth. Keep TTLs short and cache in the DB so we're not
// hammering ESPN on every request.

const BASE = "https://site.web.api.espn.com/apis/site/v2/sports/football/nfl";

// ESPN's actual response (discovered empirically):
//   { year, rounds (int, total rounds), picks: [...], teams: [...] }
//   pick = { overall, pick, round, teamId, traded, status ("ON_THE_CLOCK" | "COMPLETED" | ...), selection?: { athlete: {...} } }
//   team = { id, abbreviation, displayName, logo, ... }
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
  selection?: {
    athlete?: { id?: string; displayName?: string };
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
    headers: { "user-agent": "DraftBoard/1.0 (+https://example.com)" },
    next: { revalidate: 60 },
  });
  if (!res.ok) {
    throw new Error(`ESPN draft order HTTP ${res.status}`);
  }
  return (await res.json()) as EspnDraftOrderResponse;
}

export async function fetchProspect(espnId: string, year: number): Promise<EspnAthleteResponse> {
  const url = `${BASE}/draft/athlete/${espnId}?season=${year}&region=us&lang=en`;
  const res = await fetch(url, {
    headers: { "user-agent": "DraftBoard/1.0" },
    next: { revalidate: 3600 },
  });
  if (!res.ok) {
    throw new Error(`ESPN prospect HTTP ${res.status}`);
  }
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
  espnAthleteId?: string;
  selectedAthlete?: string;
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
    flat.push({
      overallPick: overall,
      round: pick.round ?? 0,
      pickInRound: pick.pick ?? 0,
      teamAbbr: abbr,
      teamName: team?.displayName,
      teamLogoUrl: team?.logo,
      isOnTheClock: pick.status === "ON_THE_CLOCK",
      isCompleted: pick.status === "COMPLETED" || pick.status === "MADE",
      espnAthleteId: pick.selection?.athlete?.id,
      selectedAthlete: pick.selection?.athlete?.displayName,
      tradedFromAbbr: pick.traded ? originalTeam?.abbreviation : undefined,
    });
  }
  flat.sort((a, b) => a.overallPick - b.overallPick);
  return flat;
}
