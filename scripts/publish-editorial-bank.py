import csv
import json
import pathlib

ROOT = pathlib.Path(__file__).resolve().parents[1]
CSV_PATH = ROOT / "data" / "exercises.full.csv"

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
            base_difficulty = 2 + (level == "N4") * 2 + (item["coverage_slot"]["length_band"] == "long")
            if item.get("difficulty_bridge") == "N5_to_N4":
                base_difficulty = max(base_difficulty, 82)
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
                if exercise_id in preserved_difficulty:
                    row["difficulty"] = str(preserved_difficulty[exercise_id])
                rows.append(row); added += 1
    with CSV_PATH.open("w", encoding="utf-8-sig", newline="") as output:
        writer = csv.DictWriter(output, fieldnames=fields)
        writer.writeheader(); writer.writerows(rows)
    print(json.dumps({"published_exercises": added, "total": len(rows)}, ensure_ascii=False))

if __name__ == "__main__": main()
