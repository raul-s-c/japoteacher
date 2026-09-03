"""Export the existing contextual ranking for feedback lookup, without reranking."""
import csv
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
rows = []
with (ROOT / "data/reference/vocabulary-context-v1.csv").open(encoding="utf-8-sig", newline="") as source:
    for row in csv.DictReader(source):
        rows.append([row["Word"], row["Reading"], float(row["Composite_Percentile"]), row["Composite_JLPT"], row["Concept_ID"], row["Concept_Members"]])
target = ROOT / "src/feedback-usage-data.js"
target.write_text("window.JAPOTEACHER_FEEDBACK_USAGE=" + json.dumps(rows, ensure_ascii=False, separators=(",", ":")) + ";\n", encoding="utf-8")
print(f"Exported {len(rows)} ranked vocabulary entries")
