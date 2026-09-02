import csv
import json
import pathlib
import re
from collections import Counter, defaultdict

ROOT = pathlib.Path(__file__).resolve().parents[1]
ROWS = list(csv.DictReader((ROOT / "data" / "exercises.full.csv").open(encoding="utf-8-sig", newline="")))
ACTIVE = [row for row in ROWS if row.get("active", "").lower() == "true"]
LEVELS = ("N5", "N4", "N3", "N2", "N1")
CLASSIFICATION_VERSION = "usage_percentile_v2"

def split(value):
    return [part.strip() for part in str(value or "").split("|") if part.strip()]

def japanese(row):
    return row.get("source_text", "") if row.get("direction") == "ja_es" else row.get("reference_translation", "")

def signature(row):
    return re.sub(r"[\s。、！？「」『』（）・,.!?]", "", japanese(row))

def expected_level(percentile):
    if percentile < 10: return "N5"
    if percentile < 30: return "N4"
    if percentile < 60: return "N3"
    if percentile < 90: return "N2"
    return "N1"

issues = []
pairs = defaultdict(list)
for row in ACTIVE:
    pairs[signature(row)].append(row)
    exercise_id = row.get("exercise_id", "<missing>")
    if row.get("jlpt_level") not in LEVELS:
        issues.append((exercise_id, "invalid_level", row.get("jlpt_level")))
    try:
        percentile = float(row.get("usage_percentile", ""))
        difficulty = int(float(row.get("difficulty", "")))
    except ValueError:
        issues.append((exercise_id, "missing_usage_classification", row.get("usage_percentile", "")))
        continue
    if expected_level(percentile) != row.get("jlpt_level"):
        issues.append((exercise_id, "percentile_level_mismatch", percentile))
    if not 0 <= difficulty <= 100:
        issues.append((exercise_id, "invalid_difficulty", difficulty))
    if row.get("usage_classification_version") != CLASSIFICATION_VERSION:
        issues.append((exercise_id, "classification_version", row.get("usage_classification_version")))
    if not row.get("usage_hardest_component_json"):
        issues.append((exercise_id, "missing_hardest_component", ""))
    if not split(row.get("topic_tags")):
        issues.append((exercise_id, "missing_topic", ""))

invalid_pairs = []
for text, rows in pairs.items():
    directions = Counter(row.get("direction") for row in rows)
    levels = {row.get("jlpt_level") for row in rows}
    if directions != {"ja_es": 1, "es_ja": 1} or len(levels) != 1:
        invalid_pairs.append({"text": text, "directions": dict(directions), "levels": sorted(levels)})

report = {
    "classification_version": CLASSIFICATION_VERSION,
    "active_rows": len(ACTIVE),
    "semantic_pairs": len(pairs),
    "by_level_direction": {"/".join(key): value for key, value in sorted(Counter((row["jlpt_level"], row["direction"]) for row in ACTIVE).items())},
    "confidence": dict(Counter(row.get("usage_classification_confidence", "missing") for row in ACTIVE)),
    "issues": len(issues),
    "issues_by_type": dict(Counter(issue[1] for issue in issues)),
    "invalid_direction_pairs": len(invalid_pairs),
    "note": "El JLPT se deriva del percentil del componente más avanzado; no se fuerza una cuota de frases por nivel.",
}
(ROOT / "data" / "jlpt-bank-audit.json").write_text(json.dumps({**report, "issue_details": issues, "invalid_pairs": invalid_pairs}, ensure_ascii=False, indent=2), encoding="utf-8")
print(json.dumps(report, ensure_ascii=False, indent=2))
if issues or invalid_pairs:
    raise SystemExit(1)
