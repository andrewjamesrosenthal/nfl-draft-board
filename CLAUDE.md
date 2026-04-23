# DraftBoard — Claude Project Instructions

## DATA SOURCING INSTRUCTIONS

### Seed Script Data Sources

1. HISTORICAL DRAFT PICKS + COMBINE DATA — use nfl_data_py:
   pip install nfl_data_py
   import nfl_data_py as nfl
   - nfl.import_draft_picks([2018..2025]) → all picks with round/pick/team/position
   - nfl.import_combine_data([2018..2025]) → all measurables
   - nfl.import_ids() → ESPN IDs for headshot URLs
   Join on player name + draft year. Store espn_id in the DB.

2. PLAYER HEADSHOTS — cascade fallback in this order:
   a) https://a.espncdn.com/i/headshots/nfl/players/full/{espn_id}.png
   b) https://a.espncdn.com/i/headshots/college-football/players/full/{espn_id}.png
   c) Position SVG silhouette (generate one SVG per position group)
   Use Next.js Image component with onError to cascade.

3. CURRENT/UPCOMING DRAFT ORDER — ESPN undocumented API (no auth):
   GET https://site.web.api.espn.com/apis/site/v2/sports/football/nfl/draft?season={YEAR}&region=us&lang=en
   Cache in DB. Refresh via daily cron (Next.js route handler with CRON_SECRET).

4. DRAFT PROSPECT PROFILES (current year prospects):
   GET https://site.web.api.espn.com/apis/site/v2/sports/football/nfl/draft/athlete/{espn_id}?season=2025&region=us&lang=en
   Pull headshot + bio from this response during seed.

5. SCOUTING REPORTS — generate via Anthropic API during seed:
   For each top-150 prospect, call Claude with their measurables + college stats and prompt:
   "Write a 150-word NFL scouting report in the style of ESPN Scouts Inc. for [NAME],
   a [POSITION] from [COLLEGE]. Measurables: [HEIGHT], [WEIGHT], [40_TIME]...
   Include strengths, weaknesses, and NFL comp."
   Store the result in the scouting_report field.

6. NEVER hardcode player data as static arrays. Always pull from nflverse at seed time
   so the data is accurate and up to date.
