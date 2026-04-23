# nflverse seed helper

Python + nfl_data_py is the source of truth for historical picks, combine data,
and ESPN IDs (see `/CLAUDE.md` data-sourcing rules). This folder owns the
export step that bridges that Python-only ecosystem into the TypeScript seed.

```bash
pip install nfl_data_py
python prisma/seed-nflverse/pull_nflverse.py \
  --years 2018 2019 2020 2021 2022 2023 2024 2025 \
  --out prisma/seed-nflverse/nflverse.json
```

Then run the TS seed — it auto-merges `nflverse.json` into `ALL_PLAYERS`:

```bash
npm run db:seed
```

## Why a JSON sidecar?

`nfl_data_py` only exists in Python. Rather than spawn Python from the Node
seed every time, we commit the derived JSON. Re-run the Python step whenever
you want to refresh (e.g. after the draft weekend fills in `actual_pick`s).
