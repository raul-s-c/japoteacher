#!/usr/bin/env python3
import argparse
import csv
import json
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def read_reference(zip_path, filename, level):
    with zipfile.ZipFile(zip_path) as archive:
        with archive.open(filename) as raw:
            text = raw.read().decode("utf-8-sig").splitlines()
    return [row for row in csv.DictReader(text) if row.get("Simulated_JLPT") == level]


def japanese_text(row):
    direction = row.get("direction")
    if direction == "ja_es":
        return row.get("source_text", "")
    if direction == "es_ja":
        return row.get("reference_translation", "")
    return ""


def published_texts(level):
    path = ROOT / "data" / "exercises.full.csv"
    with path.open(encoding="utf-8-sig", newline="") as handle:
        rows = list(csv.DictReader(handle))
    seen = set()
    texts = []
    for row in rows:
        if row.get("jlpt_level") != level or str(row.get("active", "")).lower() != "true":
            continue
        text = japanese_text(row)
        if not text or text in seen:
            continue
        seen.add(text)
        texts.append(text)
    return texts


def vocab_form(row):
    return row.get("Japanese") or row.get("Word") or row.get("word") or ""


def vocab_reading(row):
    return row.get("Reading") or row.get("reading") or ""


def kanji_form(row):
    return row.get("Kanji") or row.get("kanji") or ""


def count_vocab(row, texts):
    word = vocab_form(row)
    reading = vocab_reading(row)
    return sum(1 for text in texts if (word and word in text) or (reading and reading in text))


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
