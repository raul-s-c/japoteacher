#!/usr/bin/env python3
import argparse
import csv
import json
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CONTEXTUAL_VOCABULARY = ROOT / "data" / "reference" / "vocabulary-context-v1.csv"


def level_for(percentile):
    if percentile < 10:
        return "N5"
    if percentile < 30:
        return "N4"
    if percentile < 60:
        return "N3"
    if percentile < 90:
        return "N2"
    return "N1"


def read_reference(zip_path, filename, level):
    if filename == "vocabulary_10000_v2.csv" and CONTEXTUAL_VOCABULARY.exists():
        rows = list(csv.DictReader(CONTEXTUAL_VOCABULARY.open(encoding="utf-8-sig", newline="")))
        concepts = {}
        for row in rows:
            concepts.setdefault(row["Concept_ID"], row)
        return [row for row in concepts.values() if row["Composite_JLPT"] == level]
    with zipfile.ZipFile(zip_path) as archive:
        with archive.open(filename) as raw:
            text = raw.read().decode("utf-8-sig").splitlines()
    rows = list(csv.DictReader(text))
    rank_field = {"vocabulary_10000_v2.csv": "Study_Rank", "kanji_2000_v2.csv": "Usage_Rank", "grammar_750_v2.csv": "Usage_Proxy_Rank"}[filename]
    selected = []
    for index, row in enumerate(rows):
        try:
            rank = int(float(row.get(rank_field) or index + 1))
        except ValueError:
            rank = index + 1
        if level_for(100 * (rank - 1) / max(1, len(rows))) == level:
            selected.append(row)
    return selected


def japanese_text(row):
    direction = row.get("direction")
    if direction == "ja_es":
        return row.get("source_text", "")
    if direction == "es_ja":
        return row.get("reference_translation", "")
    return ""


def published_texts(level=None):
    path = ROOT / "data" / "exercises.full.csv"
    with path.open(encoding="utf-8-sig", newline="") as handle:
        rows = list(csv.DictReader(handle))
    seen = set()
    texts = []
    for row in rows:
        if str(row.get("active", "")).lower() != "true":
            continue
        text = japanese_text(row)
        if not text or text in seen:
            continue
        seen.add(text)
        texts.append(text)
    return texts


def vocab_form(row):
    return row.get("Japanese") or row.get("Word") or row.get("word") or ""


def vocab_forms(row):
    return [value for value in (row.get("Concept_Members") or vocab_form(row)).split("|") if value]


def vocab_reading(row):
    return row.get("Reading") or row.get("reading") or ""


def kanji_form(row):
    return row.get("Kanji") or row.get("kanji") or ""


def count_vocab(row, texts):
    forms = vocab_forms(row)
    reading = vocab_reading(row)
    return sum(1 for text in texts if any(form in text for form in forms) or (reading and reading in text))


def count_kanji(row, texts):
    kanji = kanji_form(row)
    return sum(1 for text in texts if kanji and kanji in text)


def bucket(counts):
    return {
        "gte2": sum(count >= 2 for count in counts),
        "once": sum(count == 1 for count in counts),
        "zero": sum(count == 0 for count in counts),
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--zip", required=True)
    parser.add_argument("--levels", default="N5,N4")
    args = parser.parse_args()

    for level in [item.strip() for item in args.levels.split(",") if item.strip()]:
        texts = published_texts(level)
        vocabulary = read_reference(args.zip, "vocabulary_10000_v2.csv", level)
        kanji = read_reference(args.zip, "kanji_2000_v2.csv", level)
        vocab_counts = [count_vocab(row, texts) for row in vocabulary]
        kanji_counts = [count_kanji(row, texts) for row in kanji]
        report = {
            "level": level,
            "published_unique_japanese": len(texts),
            "vocab_total": len(vocabulary),
            "vocab": bucket(vocab_counts),
            "kanji_total": len(kanji),
            "kanji": bucket(kanji_counts),
        }
        print(json.dumps(report, ensure_ascii=False))


if __name__ == "__main__":
    main()
