import argparse
import csv
import importlib.util
import json
import os
import pathlib
import tempfile

ROOT = pathlib.Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location("editorial_generate", ROOT / "scripts" / "editorial-generate.py")
EDITORIAL = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(EDITORIAL)
CSV_PATH = ROOT / "data" / "exercises.full.csv"


def unpack(value):
    return [item for item in str(value or "").split("|") if item]


def alternatives(row):
    try:
        return json.loads(row.get("accepted_alternatives_json") or "[]")
    except json.JSONDecodeError:
        return []


def read_jsonl(path):
    if not path.exists():
        return []
    return [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]


def write_jsonl(path, rows):
    with tempfile.NamedTemporaryFile("w", encoding="utf-8", dir=path.parent, delete=False) as output:
        for row in rows:
            output.write(json.dumps(row, ensure_ascii=False) + "\n")
        temporary = pathlib.Path(output.name)
    os.replace(temporary, path)


def write_csv(fields, rows):
    with tempfile.NamedTemporaryFile("w", encoding="utf-8-sig", newline="", dir=CSV_PATH.parent, delete=False) as output:
        writer = csv.DictWriter(output, fieldnames=fields)
        writer.writeheader()
        writer.writerows(rows)
        temporary = pathlib.Path(output.name)
    os.replace(temporary, CSV_PATH)


def pair_key(row):
    return row["exercise_id"].replace("JAES-", "").replace("ESJA-", "")


def legacy_pairs(rows, level):
    scoped = [row for row in rows if row.get("active", "").lower() == "true" and row.get("jlpt_level") == level and "-EDITORIAL-" not in row.get("exercise_id", "")]
    pairs = {}
    for row in scoped:
        pairs.setdefault(pair_key(row), {})[row["direction"]] = row
    return {key: pair for key, pair in pairs.items() if {"ja_es", "es_ja"} <= set(pair)}


def editorial_item(slot, pair):
    ja, es = pair["ja_es"], pair["es_ja"]
    return {
        "slot": slot,
        "japanese": ja["source_text"],
        "spanish": ja["reference_translation"],
        "scenario_es": "Revisión editorial de una frase existente de práctica.",
        "topic_primary": unpack(ja.get("topic_tags"))[0] if unpack(ja.get("topic_tags")) else "vida_diaria",
        "topic_secondary": unpack(ja.get("topic_tags"))[1:2],
        "situation_tag": unpack(ja.get("situation_tags"))[0] if unpack(ja.get("situation_tags")) else "situación_cotidiana",
        "grammar_tags": unpack(ja.get("grammar_tags")),
        "particle_tags": unpack(ja.get("particle_tags")),
        "vocabulary_tags": unpack(ja.get("vocabulary_tags")),
        "kanji_readings": [],
        "register": ja.get("register") or "neutro",
        "communicative_function": ja.get("communicative_function") or "práctica de traducción",
        "tense_aspect": ja.get("tense_aspect") or "no marcado",
        "polarity": ja.get("polarity") or "afirmativa",
        "sentence_type": ja.get("sentence_type") or "declarativa",
        "accepted_alternatives_es": alternatives(ja),
        "accepted_alternatives_ja": alternatives(es),
        "ambiguity_notes": ja.get("ambiguity_notes") or "",
        "critical_meaning_units": [],
        "difficulty_rationale": ja.get("pedagogical_notes") or "Revisión de dificultad pendiente.",
        "naturalness_rationale": "Revisión editorial pendiente.",
    }


def apply_item(rows_by_id, pair, item):
    for direction, source_id in (("ja_es", pair["ja_es"]["exercise_id"]), ("es_ja", pair["es_ja"]["exercise_id"])):
        row = rows_by_id[source_id]
        ja_es = direction == "ja_es"
        row.update({
            "source_language": "ja" if ja_es else "es",
            "target_language": "es" if ja_es else "ja",
            "direction": direction,
            "source_text": item["japanese"] if ja_es else item["spanish"],
            "reference_translation": item["spanish"] if ja_es else item["japanese"],
            "accepted_alternatives_json": json.dumps(item["accepted_alternatives_es" if ja_es else "accepted_alternatives_ja"], ensure_ascii=False),
            "topic_tags": "|".join([item["topic_primary"], *item.get("topic_secondary", [])]),
            "situation_tags": item["situation_tag"],
            "grammar_tags": "|".join(item["grammar_tags"]),
            "particle_tags": "|".join(item["particle_tags"]),
            "vocabulary_tags": "|".join(item["vocabulary_tags"]),
            "kanji_tags": "|".join(reading["characters"] for reading in item["kanji_readings"]),
            "register": item["register"],
            "communicative_function": item["communicative_function"],
            "tense_aspect": item["tense_aspect"],
            "polarity": item["polarity"],
            "sentence_type": item["sentence_type"],
            "pedagogical_notes": item["difficulty_rationale"],
            "ambiguity_notes": item["ambiguity_notes"],
            "dataset_version": "5.0",
        })


def main(level, usage_baseline=None, token_budget=None, limit=None):
    key = os.environ.get("JAPOTEACHER_EDITORIAL_KEY", "")
    if not key:
        raise SystemExit("Falta JAPOTEACHER_EDITORIAL_KEY.")
    with CSV_PATH.open(encoding="utf-8-sig", newline="") as source:
        reader = csv.DictReader(source)
        fields, rows = reader.fieldnames, list(reader)
    pairs = legacy_pairs(rows, level)
    record_path = ROOT / "data" / "editorial" / f"{level.lower()}-legacy-reviewed.jsonl"
    reviewed = {row["pair_key"] for row in read_jsonl(record_path)}
    rows_by_id = {row["exercise_id"]: row for row in rows}
    completed = 0
    for index, (key_id, pair) in enumerate(sorted(pairs.items())):
        if key_id in reviewed:
            continue
        if usage_baseline is not None and token_budget is not None and EDITORIAL.recorded_total_usage() - usage_baseline >= token_budget:
            print(json.dumps({"token_budget_reached": True, "completed": completed}, ensure_ascii=False), flush=True)
            break
        if limit is not None and completed >= limit:
            break
        original = editorial_item(index + 1, pair)
        try:
            final, rounds = EDITORIAL.review_until_approved([original], level, key)
            item = final[0]
        except RuntimeError as error:
            print(json.dumps({"level": level, "pair_key": key_id, "rejected": True, "reason": str(error)}, ensure_ascii=False), flush=True)
            continue
        apply_item(rows_by_id, pair, item)
        reviewed_row = {"pair_key": key_id, "source_ids": {direction: row["exercise_id"] for direction, row in pair.items()}, "review_rounds": rounds, "editorial_quality_version": 5, **item}
        write_csv(fields, rows)
        previous = read_jsonl(record_path)
        write_jsonl(record_path, [*previous, reviewed_row])
        reviewed.add(key_id)
        completed += 1
        print(json.dumps({"level": level, "revalidated_this_run": completed, "quality_v5_total": len(reviewed), "total": len(pairs)}, ensure_ascii=False), flush=True)
    print(json.dumps({"level": level, "legacy_reviewed": len(reviewed), "legacy_total": len(pairs)}, ensure_ascii=False))


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("level", choices=["N5", "N4"])
    parser.add_argument("--usage-baseline", type=int)
    parser.add_argument("--token-budget", type=int)
    parser.add_argument("--limit", type=int)
    args = parser.parse_args()
    main(args.level, args.usage_baseline, args.token_budget, args.limit)
