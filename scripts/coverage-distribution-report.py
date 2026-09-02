import argparse
import csv
import json
import statistics
import zipfile
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
CSV_PATH = ROOT / "data" / "exercises.full.csv"
CONTEXTUAL_VOCABULARY = ROOT / "data" / "reference" / "vocabulary-context-v1.csv"


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


def read_reference(zip_path, filename, level):
    if filename == "vocabulary_10000_v2.csv" and CONTEXTUAL_VOCABULARY.exists():
        rows = list(csv.DictReader(CONTEXTUAL_VOCABULARY.open(encoding="utf-8-sig", newline="")))
        concepts = {}
        for row in rows:
            concepts.setdefault(row["Concept_ID"], row)
        return [row for row in concepts.values() if row["Composite_JLPT"] == level]
    with zipfile.ZipFile(zip_path) as archive:
        text = archive.read(filename).decode("utf-8-sig").splitlines()
    rows = list(csv.DictReader(text))
    rank_field = {"vocabulary_10000_v2.csv": "Study_Rank", "kanji_2000_v2.csv": "Usage_Rank", "grammar_750_v2.csv": "Usage_Proxy_Rank"}[filename]
    selected = []
    for index, row in enumerate(rows):
        try:
            rank = int(float(row.get(rank_field) or index + 1))
        except ValueError:
            rank = index + 1
        if level_for(100 * (rank - 1) / max(1, len(rows))) == level:
            selected.append(row)
    return selected


def active_japanese_texts(level=None):
    rows = list(csv.DictReader(CSV_PATH.open(encoding="utf-8-sig", newline="")))
    texts = []
    seen = set()
    for row in rows:
        if row.get("active", "").lower() != "true":
            continue
        text = row.get("source_text", "") if row.get("direction") == "ja_es" else row.get("reference_translation", "")
        if text and text not in seen:
            seen.add(text)
            texts.append(text)
    return texts


def score(row):
    for key in ("Composite_Score", "Usage_Score_100", "Usage_Score", "usage_score"):
        try:
            return float(row.get(key) or 0)
        except ValueError:
            pass
    return 0.0


def count_vocab(row, text):
    words = [value for value in (row.get("Concept_Members") or row.get("Word", "")).split("|") if value]
    reading = row.get("Reading", "")
    values = [text.count(word) for word in words]
    if reading and reading not in words:
        values.append(text.count(reading))
    return max(values or [0])


def count_kanji(row, text):
    kanji = row.get("Kanji", "")
    return text.count(kanji) if kanji else 0


def count_grammar(row, text):
    form = row.get("Matched_Form") or row.get("Pattern") or ""
    if not form or len(form) > 10:
        return 0
    return text.count(form)


def gini(values):
    values = sorted(max(0, float(value)) for value in values)
    if not values or sum(values) == 0:
        return 0.0
    weighted = sum((index + 1) * value for index, value in enumerate(values))
    return (2 * weighted) / (len(values) * sum(values)) - (len(values) + 1) / len(values)


def distribution(rows, counts):
    total_observed = sum(counts)
    weighted_rows = sorted(zip(rows, counts), key=lambda item: score(item[0]), reverse=True)
    if not weighted_rows:
        return {"top25_delta": 0, "bottom50_delta": 0, "gini": 0, "zero": 0}
    n = len(weighted_rows)
    top = weighted_rows[: max(1, n // 4)]
    bottom = weighted_rows[n // 2 :]

    def share(items, observed=False):
        values = [item[1] if observed else score(item[0]) for item in items]
        base = total_observed if observed else sum(score(row) for row in rows)
        return 0 if not base else sum(values) / base

    return {
        "top25_delta": round((share(top, True) - share(top, False)) * 100),
        "bottom50_delta": round((share(bottom, True) - share(bottom, False)) * 100),
        "gini": round(gini(counts), 2),
        "zero": sum(value == 0 for value in counts),
        "median": statistics.median(counts) if counts else 0,
    }


def metric(level, kind, rows, counter):
    text = "\n".join(active_japanese_texts(level))
    counts = [counter(row, text) for row in rows]
    introduced = sum(value >= 1 for value in counts)

    def threshold(minimum):
        covered = sum(value >= minimum for value in counts)
        return {
            "covered": covered,
            "total": len(rows),
            "percent": round(covered / max(1, len(rows)) * 100),
        }

    return {
        "coverage": f"{introduced}/{len(rows)} ({round(introduced / max(1, len(rows)) * 100)}%)",
        "at_least_1": threshold(1),
        "at_least_2": threshold(2),
        "at_least_3": threshold(3),
        "distribution": distribution(rows, counts),
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--zip", required=True)
    parser.add_argument("--levels", default="N5,N4")
    args = parser.parse_args()

    output = {}
    for level in [item.strip() for item in args.levels.split(",") if item.strip()]:
        vocab = read_reference(args.zip, "vocabulary_10000_v2.csv", level)
        kanji = read_reference(args.zip, "kanji_2000_v2.csv", level)
        grammar = read_reference(args.zip, "grammar_750_v2.csv", level)
        output[level] = {
            "vocabulary": metric(level, "vocabulary", vocab, count_vocab),
            "kanji": metric(level, "kanji", kanji, count_kanji),
            "grammar": metric(level, "grammar", grammar, count_grammar),
        }
    print(json.dumps(output, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
