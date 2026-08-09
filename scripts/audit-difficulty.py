#!/usr/bin/env python3
"""Summarize editorial difficulty coverage and flag invalid exercise metadata."""

import csv
from collections import defaultdict
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
CSV_PATH = ROOT / "data" / "exercises.full.csv"
LEVELS = ("N5", "N4", "N3", "N2", "N1")


def number(value):
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def main():
    groups = defaultdict(lambda: {"count": 0, "difficulty": [], "length": [], "grammar": [], "kanji": [], "tags": []})
    invalid = []
    with CSV_PATH.open(encoding="utf-8", newline="") as source:
        for row in csv.DictReader(source):
            if str(row.get("active", "")).lower() in {"false", "0", "no"}:
                continue
            difficulty = number(row.get("difficulty"))
            level = row.get("jlpt_level", "")
            if level not in LEVELS or difficulty is None or not 1 <= difficulty <= 7:
                invalid.append(row.get("exercise_id", "<missing>"))
                continue
            key = (level, row.get("direction", ""))
            group = groups[key]
            text = row.get("source_text", "")
            group["count"] += 1
            group["difficulty"].append(difficulty)
            group["length"].append(len(text))
            group["grammar"].append(len([x for x in row.get("grammar_tags", "").split("|") if x]))
            group["kanji"].append(sum("\u3400" <= char <= "\u9fff" for char in text))
            group["tags"].append(sum(len([x for x in row.get(field, "").split("|") if x]) for field in ("topic_tags", "grammar_tags", "vocabulary_tags")))

    print("level,direction,count,avg_difficulty,avg_length,avg_grammar_tags,avg_kanji,avg_total_tags")
    for key in sorted(groups):
        group = groups[key]
        averages = [sum(group[name]) / group["count"] for name in ("difficulty", "length", "grammar", "kanji", "tags")]
        print(f"{key[0]},{key[1]},{group['count']}," + ",".join(f"{value:.2f}" for value in averages))
    if invalid:
        raise SystemExit(f"Invalid JLPT or difficulty metadata: {', '.join(invalid[:20])}")


if __name__ == "__main__":
    main()
