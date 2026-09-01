import csv
import json
import pathlib
import os
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
CSV_PATH = ROOT / "data" / "exercises.full.csv"
BRIDGE_MARKERS = (
    "ので", "のに", "たら", "なら", "ば", "ように", "そうだ", "と思", "と言",
    "かもしれ", "でしょう", "つもり", "予定", "こと", "なければ", "なくても",
    "てしま", "てお", "てみ", "てあげ", "てくれ", "てもら", "ために", "しか",
    "すぎ", "はず", "かどうか", "について", "によると", "に見え", "として", "以外",
)

def packed(values):
    if isinstance(values, str):
        values = [values]
    return "|".join(dict.fromkeys(str(value) for value in values if value))

def reviewed_difficulties(rows):
    values = {}
    for row in rows:
        exercise_id = row.get("exercise_id", "")
        if "-EDITORIAL-" not in exercise_id:
            continue
        try:
            difficulty = int(float(row.get("difficulty", "")))
        except ValueError:
            continue
        if 0 <= difficulty <= 100:
            values[exercise_id] = difficulty
    return values

def editorial_difficulty(level, item):
    slot = item.get("coverage_slot", {})
    band = slot.get("length_band", "standard")
    base = {
        "N5": {"short": 18, "standard": 34, "long": 48},
        "N4": {"short": 24, "standard": 42, "long": 58},
    }.get(level, {"short": 30, "standard": 50, "long": 70}).get(band, 42)
    grammar = "|".join(item.get("grammar_tags", []))
    text = item.get("japanese", "")
    vocab_count = len(item.get("vocabulary_tags", []))
    kanji_count = len(item.get("kanji_readings", []))
    base += min(24, max(0, vocab_count - 2) * 5 + max(0, kanji_count - 2) * 3)
    if level == "N5" and any(marker in text or marker in grammar for marker in BRIDGE_MARKERS):
        base = max(base, 78)
    if item.get("difficulty_bridge") == "N5_to_N4":
        base = max(base, 82)
    return max(0, min(100, round(base)))

def main():
    with CSV_PATH.open(encoding="utf-8-sig", newline="") as source:
        reader = csv.DictReader(source)
        fields, rows = reader.fieldnames, list(reader)
    preserved_difficulty = reviewed_difficulties(rows)
    rows = [row for row in rows if "-EDITORIAL-" not in row["exercise_id"]]
    added = 0
    for level in ("N5", "N4"):
        path = ROOT / "data" / "editorial" / f"{level.lower()}-approved.jsonl"
        if not path.exists():
            continue
        for line in path.read_text(encoding="utf-8").splitlines():
            if not line.strip(): continue
            item = json.loads(line)
            slot = int(item["slot"])
            base_difficulty = editorial_difficulty(level, item)
            common = {
                "jlpt_level": level,
                "difficulty": str(base_difficulty),
                "topic_tags": packed([item["topic_primary"], *item.get("topic_secondary", [])]),
                "situation_tags": packed([item.get("situation_tag", ""), *item.get("bridge_tags", [])]),
                "grammar_tags": packed(item.get("grammar_tags", [])),
                "particle_tags": packed(item.get("particle_tags", [])),
                "vocabulary_tags": packed(item.get("vocabulary_tags", [])),
                "kanji_tags": packed([r["characters"] for r in item.get("kanji_readings", [])]),
                "verb_tags": "", "adjective_tags": "", "counter_tags": "",
                "register": item["register"],
                "communicative_function": item["communicative_function"],
                "tense_aspect": item["tense_aspect"], "polarity": item["polarity"],
                "sentence_type": item["sentence_type"],
                "pedagogical_notes": item["difficulty_rationale"],
                "ambiguity_notes": item["ambiguity_notes"],
                "core_exercise": "false", "active": "true", "dataset_version": "4.0",
            }
            for direction in ("ja_es", "es_ja"):
                ja_es = direction == "ja_es"
                exercise_id = f"{'JAES' if ja_es else 'ESJA'}-{level}-EDITORIAL-{slot:04d}"
                row = {field: "" for field in fields}
                row.update(common)
                row.update({
                    "exercise_id": exercise_id,
                    "source_language": "ja" if ja_es else "es",
                    "target_language": "es" if ja_es else "ja",
                    "direction": direction,
                    "source_text": item["japanese"] if ja_es else item["spanish"],
                    "reference_translation": item["spanish"] if ja_es else item["japanese"],
                    "accepted_alternatives_json": json.dumps(item["accepted_alternatives_es" if ja_es else "accepted_alternatives_ja"], ensure_ascii=False),
                })
                if exercise_id in preserved_difficulty and preserved_difficulty[exercise_id] > 7:
                    row["difficulty"] = str(preserved_difficulty[exercise_id])
                rows.append(row); added += 1
    with CSV_PATH.open("w", encoding="utf-8-sig", newline="") as output:
        writer = csv.DictWriter(output, fieldnames=fields)
        writer.writeheader(); writer.writerows(rows)
    usage_zip = pathlib.Path(os.environ.get("JAPOTEACHER_USAGE_REFERENCE_ZIP", pathlib.Path.home() / "Downloads" / "japanese_usage_progress_v2_csv.zip"))
    if usage_zip.exists():
        subprocess.run([sys.executable, str(ROOT / "scripts" / "usage-classification.py"), "--zip", str(usage_zip), "--write"], cwd=ROOT, check=True)
    print(json.dumps({"published_exercises": added, "total": len(rows)}, ensure_ascii=False))

if __name__ == "__main__": main()
