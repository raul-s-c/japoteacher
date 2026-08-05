import csv
import pathlib
from collections import Counter, defaultdict

ROOT = pathlib.Path(__file__).resolve().parents[1]

with (ROOT / "data" / "exercises.full.csv").open(encoding="utf-8-sig", newline="") as source:
    rows = list(csv.DictReader(source))
with (ROOT / "data" / "exercises.curated-n5-50.csv").open(encoding="utf-8-sig", newline="") as source:
    curated = list(csv.DictReader(source))

assert len(rows) == 870
assert len(curated) == 50
assert len({row["exercise_id"] for row in rows}) == len(rows)
assert Counter(row["direction"] for row in curated) == {"ja_es": 25, "es_ja": 25}
assert all(row["active"].lower() == "true" and row["jlpt_level"] == "N5" for row in curated)
assert all(row["topic_tags"] and row["grammar_tags"] and row["communicative_function"] for row in curated)

pairs = defaultdict(list)
for row in curated:
    pairs[row["exercise_id"].split("-CURATED-")[1]].append(row)
assert len(pairs) == 25 and all(len(pair) == 2 for pair in pairs.values())
for pair in pairs.values():
    ja_es = next(row for row in pair if row["direction"] == "ja_es")
    es_ja = next(row for row in pair if row["direction"] == "es_ja")
    assert ja_es["source_text"] == es_ja["reference_translation"]
    assert ja_es["reference_translation"] == es_ja["source_text"]

mechanical = [row for row in rows if "-N5-MORE-" in row["exercise_id"]]
assert len(mechanical) == 500 and all(row["active"].lower() == "false" for row in mechanical)
active = [row for row in rows if row["active"].lower() == "true"]
assert len(active) == 370
assert not any("-N5-MORE-" in row["exercise_id"] for row in active)

print({"status": "PASS", "rows": len(rows), "active": len(active), "archived": len(rows) - len(active), "curated": len(curated), "semantic_pairs": len(pairs)})
