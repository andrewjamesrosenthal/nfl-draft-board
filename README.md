# DraftBoard

A production-ready MVP for an online NFL Draft prospect ranking product. Users build a personal big board through head-to-head pairwise comparisons, the system aggregates a community consensus, and a mock-draft engine ties everything together with team needs and positional value.

## Highlights

- **Pairwise arena** with keyboard shortcuts (A / D / Space), smart matchup selection, and occasional revisit of prior pairs.
- **Personal board** with tiers, confidence labels, position and team-needs filters, and drag-free manual overrides.
- **Community consensus** with live Elo-based aggregation, trends (rising/falling) driven by an hourly snapshot cron, controversy, and most-compared views.
- **Mock draft engine**: 1 / 2 / 7 round modes, control one team or every team or fully simulated, grade with steals and reaches.
- **Player profiles** with measurements, combine data, scouting, matchup history, watchlist toggle, and similar-prospect suggestions.
- **Historical classes 2018-2026** with redraft links and pre-draft vs actual comparisons, plus biggest steals and misses.
- **Accounts**: anonymous cookie sessions by default, upgradable to a public handle at `/me`, and public user profile pages at `/u/[handle]`.
- **Watchlist, badges, and a public profile page** for every claimed account.
- **Gated admin area** with diagnostics and an AI-sourced scouting report endpoint that falls back to a deterministic local generator when no LLM key is configured.
- **Swappable ranking engines**: Elo by default, Bradley-Terry alternative included.

## Tech

- Next.js 14 (App Router) + TypeScript
- React 18, Tailwind CSS, shadcn-style primitives, Framer Motion, lucide-react icons
- Prisma ORM against PostgreSQL (SQLite can be swapped in for local dev)
- Zod for API validation

## Getting started

```bash
# 1. Install
npm install

# 2. Copy the env example and set your database URL
cp .env.example .env
# edit .env to point at your Postgres instance

# 3. Push the schema (quick path; use `npm run db:migrate` for migrations)
npm run db:push

# 4. Seed with 8 classes, 32 teams, team needs, and ~100 prospects
npm run db:seed

# 5. Start dev
npm run dev
# open http://localhost:3000
```

### Using SQLite for local development

Change the datasource in `prisma/schema.prisma`:

```prisma
datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}
```

and set `DATABASE_URL="file:./dev.db"` in `.env`. Remove the `String[]` fields from `ScoutingReport` before running (or keep Postgres — scalar arrays need Postgres).

## Project layout

```
prisma/           Prisma schema, seed script, seed-data modules
src/app/          Next.js App Router pages + API routes
src/components/   UI primitives and product components
src/lib/          ranking engines, matchup selector, mock engine, utilities
```

Key reading order for onboarding:

1. `prisma/schema.prisma` — data model
2. `src/lib/ranking/` — the swappable rating model
3. `src/lib/matchup-selector.ts` — how pairs are chosen
4. `src/lib/mock-engine.ts` — how the CPU drafts
5. `src/app/api/*` — thin routes that glue the engine to the UI

## Product tour

- `/` — marketing / hero + top 10 community + draft-date countdown + feature links
- `/compare` — pairwise arena (main engagement loop)
- `/compare/vs` — side-by-side attribute compare
- `/board` — your personal big board with filters
- `/community` — live consensus board
- `/player/[slug]` — player profile with scouting, stats, matchup history, and watchlist toggle
- `/mock` — configure a mock draft
- `/mock/[id]` — the live mock runner and the recap / grade
- `/mocks` — list of your saved mocks
- `/watchlist` — prospects you're tracking
- `/trends` — rising, falling, controversial, most-compared, personal-vs-community
- `/historical` — every class 2018-2026 with redraft / actual comparisons
- `/me` — your activity, identity claim form, and badge progress
- `/u/[handle]` — public user profile
- `/about` — methodology
- `/admin` — gated diagnostics and content tools

### Background jobs

- `GET /api/cron/snapshot` records a `RankingSnapshot` row per player and refreshes `CommunityRanking.trend7d`. Scheduled hourly in `vercel.json`. Require `CRON_SECRET` in production.

### Admin + AI

- Sign in at `/admin` with the token from `ADMIN_TOKEN`. If the env var is missing, admin is locked entirely.
- `POST /api/scouting/generate` with `{ playerId, style? }` (admin cookie required) creates a new `ScoutingReport` with `source: "AI"`. If `OPENAI_API_KEY` is set, the endpoint calls OpenAI; otherwise it falls back to a deterministic local summary so the flow still works in dev.

### Accounts

- Every visitor gets an anonymous user ID in `draftboard_uid` cookie.
- `POST /api/user/identity` with `{ handle, displayName?, email? }` upgrades the anonymous user to a named account without losing any prior rankings or mocks. The `/me` page wraps that endpoint in a form.
- Public profile pages at `/u/[handle]` show top 10 board, badges, and recent completed mocks. Anonymous users are not indexed.

## Extending

### Add a new draft class

1. Create `prisma/seed-data/players-YYYY.ts` using the same shape as existing files.
2. Import it in `prisma/seed.ts` and include it in `ALL_PLAYERS`.
3. Add the year to the `CLASSES` array in `seed.ts`.
4. Optionally add team needs in `prisma/seed-data/team-needs.ts`.
5. Run `npm run db:seed`.

### Plug in real scouting text

The `ScoutingReport` table supports four sources (`INTERNAL`, `LICENSED`, `USER`, `AI`). Write an upsert script against the Prisma model or build an admin form that writes with a `source` tag. AI-generated reports would ingest a prospect's structured data and produce a summary via an LLM provider (see `.env.example` for an `OPENAI_API_KEY` placeholder).

### Swap the ranking engine

Replace the default export in `src/lib/ranking/index.ts`:

```ts
import { bradleyTerryEngine } from "./bradley-terry";
export const rankingEngine: RankingEngine = bradleyTerryEngine;
```

Any new engine just needs to implement the `RankingEngine` interface.

### Add real auth + persistence

Accounts are scaffolded (see `User` with `email` / `handle` / `isAnonymous`). Drop in NextAuth or Clerk, switch the `getOrCreateUser` helper to pull the session user, and migrate any anonymous `userId` rows into the authed user at login.

## TODOs for production

- Verify any best-effort combine numbers (arm length, 40 times on prospects who didn't work out, etc.) before public launch. The admin page surfaces recently edited players so discrepancies are easy to spot.
- Upgrade the admin gate from a shared token to real RBAC.
- Wire magic-link email verification for the identity claim so emails aren't just declarative.
- Point `DATABASE_URL` at a hosted Postgres (Supabase / Neon / Vercel Postgres).
- Optional: cache the community board with `fetch` + revalidation for high traffic.
- Optional: add WebSocket-style live updates during the actual draft weekend.

## Deploying to Vercel

1. Create a new Vercel project pointed at this repo.
2. Add environment variables from `.env.example`.
3. Set `npm run db:push` as a one-off build step the first time (or run `npx prisma migrate deploy` in CI once you commit migrations).
4. Vercel will run `npm run build`, which triggers `prisma generate` before `next build`.

## License

Player data and scouting text in this repo are original summaries for demonstration. Do not copy third-party scouting copy without a license; the data model is designed to hold licensed or AI content separately so you can layer it in later.
