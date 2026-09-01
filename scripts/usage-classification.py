#!/usr/bin/env python3
"""Classify exercises from ranked real-usage vocabulary, kanji and grammar."""

import argparse
import csv
import json
import os
import re
import statistics
import zipfile
from collections import Counter
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
CSV_PATH = ROOT / "data" / "exercises.full.csv"
LEVELS = ("N5", "N4", "N3", "N2", "N1")
VERSION = "usage_percentile_v1"
KANJI_RE = re.compile(r"[\u3400-\u9fff]")
KATAKANA_RE = re.compile(r"[\u30a0-\u30ff]")


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


def difficulty_for(percentile, component_count, grammar_count, japanese_length):
    starts = {"N5": 0, "N4": 10, "N3": 30, "N2": 60, "N1": 90}
    widths = {"N5": 10, "N4": 20, "N3": 30, "N2": 30, "N1": 10}
    level = level_for(percentile)
    within = 100 * (percentile - starts[level]) / widths[level]
    load = min(12, max(0, component_count - 4) * 0.8 + max(0, grammar_count - 1) * 1.8 + max(0, japanese_length - 18) * 0.18)
    return max(0, min(100, round(within * 0.88 + load)))


def read_reference(zip_path, filename, kind):
    with zipfile.ZipFile(zip_path) as archive:
        rows = list(csv.DictReader(archive.read(filename).decode("utf-8-sig").splitlines()))
    total = len(rows)
    output = []
    for index, row in enumerate(rows):
        rank_field = {"vocabulary": "Study_Rank", "kanji": "Usage_Rank", "grammar": "Usage_Proxy_Rank"}[kind]
        try:
            rank = int(float(row.get(rank_field) or index + 1))
        except ValueError:
            rank = index + 1
        percentile = round(100 * (rank - 1) / max(1, total), 2)
        if kind == "vocabulary":
            term, reading, meaning = row.get("Word", ""), row.get("Reading", ""), row.get("Meaning_EN", "")
            item_id = row.get("Word_ID", "")
        elif kind == "kanji":
            term, reading, meaning = row.get("Kanji", ""), row.get("Readings_Romaji", ""), row.get("Meaning_EN", "")
            item_id = row.get("Kanji_ID", "")
        else:
            term = row.get("Matched_Form") or row.get("Pattern") or ""
            reading, meaning, item_id = "", row.get("Meaning_EN", ""), row.get("Grammar_ID", "")
        if term:
            output.append({"id": item_id, "kind": kind, "term": term, "reading": reading, "meaning": meaning, "rank": rank, "percentile": percentile, "level": level_for(percentile)})
    return output


def tags(value):
    return [item.strip() for item in str(value or "").split("|") if item.strip()]


def japanese(row):
    return row.get("source_text", "") if row.get("direction") == "ja_es" else row.get("reference_translation", "")


def compact(item):
    return {"k": item["kind"][0], "t": item["term"], "p": item["percentile"], "l": item["level"]}


class UsageClassifier:
    def __init__(self, zip_path):
        self.vocabulary = read_reference(zip_path, "vocabulary_10000_v2.csv", "vocabulary")
        self.kanji = read_reference(zip_path, "kanji_2000_v2.csv", "kanji")
        self.grammar = read_reference(zip_path, "grammar_750_v2.csv", "grammar")
        self.vocab_exact = {}
        for item in self.vocabulary:
            for key in (item["term"], item["reading"] if item["term"] == item["reading"] else ""):
                if key:
                    self.vocab_exact.setdefault(key, item)
        self.grammar_exact = {}
        for item in self.grammar:
            for key in {item["term"], re.sub(r"\s*→.*$", "", item["term"]).strip()}:
                if key:
                    self.grammar_exact.setdefault(key, item)
        self.kanji_exact = {item["term"]: item for item in self.kanji}
        self.tag_cache = {}
        # Kana-only substring matching creates severe false positives (e.g. まり
        # inside 始まります). Kana items are resolved from editorial tags; text
        # scanning is limited to visible kanji/katakana and uses longest matches.
        self.scan_vocab = [item for item in self.vocabulary if len(item["term"]) >= 2 and (KANJI_RE.search(item["term"]) or KATAKANA_RE.search(item["term"]))]
        self.scan_grammar = [item for item in self.grammar if 2 <= len(item["term"]) <= 12 and "→" not in item["term"]]

    def resolve_vocab_tag(self, value):
        if value in self.tag_cache:
            return self.tag_cache[value]
        item = self.vocab_exact.get(value)
        variants = [value]
        for suffix in ("する", "します", "しました", "しません", "ます", "ました", "ません", "ている", "ています"):
            if value.endswith(suffix) and len(value) > len(suffix):
                variants.append(value[:-len(suffix)])
        if item is None:
            related = [candidate for candidate in self.vocabulary if any(len(variant) >= 2 and (candidate["term"] in variant or variant in candidate["term"]) for variant in variants)]
            if related:
                item = sorted(related, key=lambda candidate: (abs(len(candidate["term"]) - len(value)), candidate["rank"]))[0]
        self.tag_cache[value] = item
        return item

    @staticmethod
    def best(matches):
        unique = {}
        for item in matches:
            previous = unique.get((item["kind"], item["id"]))
            if previous is None or item["percentile"] > previous["percentile"]:
                unique[(item["kind"], item["id"])] = item
        return sorted(unique.values(), key=lambda item: (item["percentile"], item["kind"], item["term"]))

    def text_vocabulary(self, text):
        candidates = []
        for item in self.scan_vocab:
            start = text.find(item["term"])
            while start >= 0:
                candidates.append((start, start + len(item["term"]), item))
                start = text.find(item["term"], start + 1)
        selected, occupied = [], set()
        for start, end, item in sorted(candidates, key=lambda match: (-(match[1] - match[0]), match[0], match[2]["rank"])):
            positions = set(range(start, end))
            if positions & occupied:
                continue
            selected.append(item)
            occupied.update(positions)
        return selected

    def classify(self, row):
        text = japanese(row)
        found, unresolved = [], []
        for value in tags(row.get("vocabulary_tags")) + tags(row.get("verb_tags")) + tags(row.get("adjective_tags")) + tags(row.get("counter_tags")):
            item = self.resolve_vocab_tag(value)
            if item:
                found.append(item)
            else:
                unresolved.append(value)
        found.extend(self.text_vocabulary(text))
        for value in tags(row.get("grammar_tags")):
            item = self.grammar_exact.get(value)
            if item:
                found.append(item)
        for item in self.scan_grammar:
            if item["term"] in text:
                found.append(item)
        visible_kanji = set(KANJI_RE.findall(text))
        for character in visible_kanji:
            item = self.kanji_exact.get(character)
            if item:
                found.append(item)
            else:
                unresolved.append(character)
        found = self.best(found)
        hardest = max(found, key=lambda item: item["percentile"], default=None)
        if hardest is None:
            return None, sorted(set(unresolved))
        grammar_count = sum(item["kind"] == "grammar" for item in found)
        return {
            "level": hardest["level"],
            "difficulty": difficulty_for(hardest["percentile"], len(found), grammar_count, len(text)),
            "percentile": hardest["percentile"],
            "hardest": compact(hardest),
            "components": [compact(item) for item in found],
            "display_components": [compact(item) for item in found if item["kind"] == "vocabulary"],
            "confidence": "review" if unresolved else "ranked",
        }, sorted(set(unresolved))


def classify_bank(csv_path, zip_path, write=False, emit_js=None):
    with csv_path.open(encoding="utf-8-sig", newline="") as source:
        reader = csv.DictReader(source)
        fields, rows = list(reader.fieldnames or []), list(reader)
    extra_fields = ["original_jlpt_level", "original_difficulty", "usage_classification_version", "usage_percentile", "usage_hardest_component_json", "usage_components_json", "usage_classification_confidence"]
    for field in extra_fields:
        if field not in fields:
            fields.append(field)
    classifier = UsageClassifier(zip_path)
    changes, unresolved, levels, difficulties = Counter(), Counter(), Counter(), []
    phrase_profiles = {}
    for row in rows:
        profile, missing = classifier.classify(row)
        unresolved.update(missing)
        if not profile:
            row["usage_classification_confidence"] = "unclassified"
            continue
        old_level, old_difficulty = row.get("jlpt_level", ""), row.get("difficulty", "")
        row["original_jlpt_level"] = row.get("original_jlpt_level") or old_level
        row["original_difficulty"] = row.get("original_difficulty") or old_difficulty
        row["jlpt_level"] = profile["level"]
        row["difficulty"] = str(profile["difficulty"])
        row["usage_classification_version"] = VERSION
        row["usage_percentile"] = str(profile["percentile"])
        row["usage_hardest_component_json"] = json.dumps(profile["hardest"], ensure_ascii=False, separators=(",", ":"))
        row["usage_components_json"] = json.dumps(profile["display_components"], ensure_ascii=False, separators=(",", ":"))
        row["usage_classification_confidence"] = profile["confidence"]
        phrase_profiles[row["exercise_id"]] = profile["components"]
        changes[(old_level, profile["level"])] += 1
        levels[profile["level"]] += 1
        difficulties.append(profile["difficulty"])
    result = {"version": VERSION, "rows": len(rows), "classified": sum(levels.values()), "levels": dict(levels), "changes": {f"{a}->{b}": count for (a, b), count in sorted(changes.items())}, "unresolved_unique": len(unresolved), "unresolved_top": unresolved.most_common(30), "difficulty_median": statistics.median(difficulties) if difficulties else None}
    if write:
        with csv_path.open("w", encoding="utf-8-sig", newline="") as output:
            writer = csv.DictWriter(output, fieldnames=fields)
            writer.writeheader()
            writer.writerows(rows)
    if emit_js:
        payload = json.dumps(phrase_profiles, ensure_ascii=False, separators=(",", ":"))
        emit_js.write_text(f"window.JAPOTEACHER_USAGE_PROFILES={payload};\n", encoding="utf-8")
    return result


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--zip", default=os.environ.get("JAPOTEACHER_USAGE_REFERENCE_ZIP", str(Path.home() / "Downloads" / "japanese_usage_progress_v2_csv.zip")))
    parser.add_argument("--csv", default=str(CSV_PATH))
    parser.add_argument("--write", action="store_true")
    parser.add_argument("--emit-js", default="")
    args = parser.parse_args()
    result = classify_bank(Path(args.csv), Path(args.zip), args.write, Path(args.emit_js) if args.write and args.emit_js else None)
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
