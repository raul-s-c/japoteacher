import csv
import json
import pathlib

ROOT = pathlib.Path(__file__).resolve().parents[1]
CSV_PATH = ROOT / "data" / "exercises.full.csv"

def packed(values):
    return "|".join(dict.fromkeys(value for value in values if value))

def main():
    with CSV_PATH.open(encoding="utf-8-sig", newline="") as source:
        reader = csv.DictReader(source)
        fields, rows = reader.fieldnames, list(reader)
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
            common = {
                "jlpt_level": level,
                "difficulty": str(2 + (level == "N4") * 2 + (item["coverage_slot"]["length_band"] == "long")),
                "topic_tags": packed([item["topic_primary"], *item.get("topic_secondary", [])]),
                "situation_tags": item.get("situation_tag", ""),
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
                row = {field: "" for field in fields}
                row.update(common)
                row.update({
                    "exercise_id": f"{'JAES' if ja_es else 'ESJA'}-{level}-EDITORIAL-{slot:04d}",
                    "source_language": "ja" if ja_es else "es",
                    "target_language": "es" if ja_es else "ja",
                    "direction": direction,
                    "source_text": item["japanese"] if ja_es else item["spanish"],
                    "reference_translation": item["spanish"] if ja_es else item["japanese"],
                    "accepted_alternatives_json": json.dumps(item["accepted_alternatives_es" if ja_es else "accepted_alternatives_ja"], ensure_ascii=False),
                })
                rows.append(row); added += 1
    with CSV_PATH.open("w", encoding="utf-8-sig", newline="") as output:
        writer = csv.DictWriter(output, fieldnames=fields)
        writer.writeheader(); writer.writerows(rows)
    print(json.dumps({"published_exercises": added, "total": len(rows)}, ensure_ascii=False))

if __name__ == "__main__": main()
