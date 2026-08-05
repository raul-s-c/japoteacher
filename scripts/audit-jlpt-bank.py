import csv
import json
import pathlib
import re
from collections import Counter, defaultdict

ROOT = pathlib.Path(__file__).resolve().parents[1]
ROWS = list(csv.DictReader((ROOT / "data" / "exercises.full.csv").open(encoding="utf-8-sig", newline="")))
ACTIVE = [row for row in ROWS if row["active"].lower() == "true" and row["jlpt_level"] in {"N5", "N4"}]

RANGES = {
    "N5": {"jp": (8, 22), "es": (4, 12), "tags": (6, 10)},
    "N4": {"jp": (12, 32), "es": (7, 18), "tags": (8, 13)},
}
TAG_FIELDS = ["topic_tags", "situation_tags", "grammar_tags", "particle_tags", "vocabulary_tags", "kanji_tags", "verb_tags", "adjective_tags", "counter_tags"]

def split(value):
    return [part.strip() for part in value.split("|") if part.strip()]

def jp_length(value):
    return len(re.sub(r"[\s。、！？「」『』（）・,.!?]", "", value))

def es_length(value):
    return len(re.findall(r"[\wÁÉÍÓÚÜÑáéíóúüñ]+", value))

def signature(row):
    japanese = row["source_text"] if row["source_language"] == "ja" else row["reference_translation"]
    return re.sub(r"[\s。、！？「」『』（）・,.!?]", "", japanese)

issues = []
pairs = defaultdict(list)
for row in ACTIVE:
    pair = re.sub(r"^(JAES|ESJA)-", "", row["exercise_id"])
    pairs[pair].append(row)
    japanese = row["source_text"] if row["source_language"] == "ja" else row["reference_translation"]
    spanish = row["source_text"] if row["source_language"] == "es" else row["reference_translation"]
    limits = RANGES[row["jlpt_level"]]
    tag_count = sum(len(split(row[field])) for field in TAG_FIELDS)
    if not limits["jp"][0] <= jp_length(japanese) <= limits["jp"][1]:
        issues.append((row["exercise_id"], "jp_length", jp_length(japanese)))
    if not limits["es"][0] <= es_length(spanish) <= limits["es"][1]:
        issues.append((row["exercise_id"], "es_length", es_length(spanish)))
    if not limits["tags"][0] <= tag_count <= limits["tags"][1]:
        issues.append((row["exercise_id"], "tag_count", tag_count))
    if not split(row["topic_tags"]):
        issues.append((row["exercise_id"], "missing_topic", 0))

signatures = Counter(signature(row) for row in ACTIVE if row["direction"] == "ja_es")
duplicate_signatures = {text: count for text, count in signatures.items() if count > 1}
invalid_pairs = [key for key, rows in pairs.items() if Counter(row["direction"] for row in rows) != {"ja_es": 1, "es_ja": 1}]
report = {
    "active_rows": len(ACTIVE),
    "semantic_pairs": len(pairs),
    "by_level_direction": {"/".join(key): value for key, value in sorted(Counter((row["jlpt_level"], row["direction"]) for row in ACTIVE).items())},
    "structural_issues": len(issues),
    "issues_by_type": dict(Counter(issue[1] for issue in issues)),
    "duplicate_signatures": len(duplicate_signatures),
    "invalid_direction_pairs": len(invalid_pairs),
    "note": "Esta auditoría es estructural. La naturalidad y adecuación JLPT requieren revisión lingüística individual.",
}
(ROOT / "data" / "jlpt-bank-audit.json").write_text(json.dumps({**report, "issues": issues, "duplicates": duplicate_signatures, "invalid_pairs": invalid_pairs}, ensure_ascii=False, indent=2), encoding="utf-8")
print(json.dumps(report, ensure_ascii=False, indent=2))
