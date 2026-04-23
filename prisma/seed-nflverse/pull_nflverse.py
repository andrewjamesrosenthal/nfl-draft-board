#!/usr/bin/env python3
"""
Pull historical draft picks + combine measurables + ESPN IDs from nflverse via
nfl_data_py and emit JSON that prisma/seed.ts can consume. Per CLAUDE.md data-
sourcing instructions, this is the source of truth for historical player data.

Usage:
  pip install nfl_data_py
  python prisma/seed-nflverse/pull_nflverse.py \
    --years 2018 2019 2020 2021 2022 2023 2024 2025 \
    --out prisma/seed-nflverse/nflverse.json

Output shape (array of player rows):
  [
    {
      "year": 2024,
      "round": 1, "pick": 1,
      "team": "CHI",
      "full_name": "Caleb Williams",
      "first_name": "Caleb", "last_name": "Williams",
      "position": "QB",
      "college": "USC",
      "espn_id": "4431611", "espn_id_source": "nfl",
      "height_in": 73, "weight_lbs": 214,
      "forty": 4.52, "vertical": 32.5, "broad": 117,
      "three_cone": null, "shuttle": null, "bench": null,
      "hand_in": 9.875, "arm_in": 32.5
    },
    ...
  ]

The JSON output is written once and checked in so the TS seed can import it
directly; re-run the script whenever you want fresher data.
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

try:
    import nfl_data_py as nfl
    import pandas as pd
except ImportError:
    sys.stderr.write(
        "This script requires nfl_data_py + pandas.\n"
        "  pip install nfl_data_py\n"
    )
    sys.exit(1)


def pick(row: "pd.Series", *keys: str):
    for k in keys:
        if k in row and pd.notna(row[k]):
            return row[k]
    return None


def to_int(val) -> int | None:
    if val is None or pd.isna(val):
        return None
    try:
        return int(val)
    except (TypeError, ValueError):
        return None


def to_float(val) -> float | None:
    if val is None or pd.isna(val):
        return None
    try:
        return float(val)
    except (TypeError, ValueError):
        return None


def to_str(val) -> str | None:
    if val is None or pd.isna(val):
        return None
    s = str(val).strip()
    return s or None


def parse_height(raw) -> int | None:
    """Height comes in as either total inches (74) or feet-inches ('6-2' / '6\\'2\"')."""
    if raw is None or pd.isna(raw):
        return None
    try:
        n = float(raw)
        if n > 24:  # already inches
            return int(n)
    except (TypeError, ValueError):
        pass
    s = str(raw).strip().replace("’", "'").replace("\"", "")
    for sep in ("-", "'", " "):
        if sep in s:
            parts = [p for p in s.split(sep) if p]
            if len(parts) >= 2:
                try:
                    return int(parts[0]) * 12 + int(parts[1])
                except ValueError:
                    return None
    return None


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--years", nargs="+", type=int, required=True)
    ap.add_argument("--out", default="prisma/seed-nflverse/nflverse.json")
    args = ap.parse_args()

    years = sorted(set(args.years))
    print(f"Pulling nfl_data_py for years {years}...", file=sys.stderr)

    picks = nfl.import_draft_picks(years)
    combine = nfl.import_combine_data(years)
    ids = nfl.import_ids()

    ids_slim = ids[["name", "espn_id", "position"]].dropna(subset=["espn_id"])
    ids_slim = ids_slim.drop_duplicates(subset=["name"], keep="first")

    merged = picks.merge(ids_slim[["name", "espn_id"]], how="left",
                         left_on="pfr_player_name", right_on="name")
    merged = merged.merge(combine, how="left",
                          left_on=["pfr_player_name", "season"],
                          right_on=["player_name", "season"],
                          suffixes=("", "_combine"))

    out: list[dict] = []
    for _, row in merged.iterrows():
        full_name = to_str(pick(row, "pfr_player_name", "player_name")) or ""
        first, _, last = full_name.partition(" ")
        record = {
            "year": to_int(row.get("season")),
            "round": to_int(row.get("round")),
            "pick": to_int(row.get("pick")),
            "team": to_str(row.get("team")),
            "full_name": full_name,
            "first_name": first or None,
            "last_name": last or None,
            "position": to_str(pick(row, "position", "position_combine")),
            "college": to_str(pick(row, "college", "school")),
            "espn_id": to_str(row.get("espn_id")),
            "espn_id_source": "nfl",  # historical picks ⇒ NFL bucket
            "height_in": parse_height(pick(row, "height", "ht")),
            "weight_lbs": to_int(pick(row, "weight", "wt")),
            "forty": to_float(pick(row, "forty")),
            "vertical": to_float(pick(row, "vertical")),
            "broad": to_float(pick(row, "broad_jump", "broad")),
            "three_cone": to_float(pick(row, "cone", "three_cone")),
            "shuttle": to_float(pick(row, "shuttle")),
            "bench": to_int(pick(row, "bench")),
            "arm_in": to_float(pick(row, "arm", "arm_length")),
            "hand_in": to_float(pick(row, "hand", "hand_size")),
        }
        if record["full_name"] and record["year"]:
            out.append(record)

    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(out, indent=2))
    print(f"Wrote {len(out)} rows → {out_path}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
