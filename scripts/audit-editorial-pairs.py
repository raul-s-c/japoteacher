import argparse
import csv
import importlib.util
import json
import pathlib
import re
from collections import Counter

ROOT = pathlib.Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location("editorial_generate", ROOT / "scripts" / "editorial-generate.py")
EDITORIAL = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(EDITORIAL)
RESERVED = {"grammar_focus", "topic_primary", "required_distinction"}

def is_kanji(character):
    return "\u3400" <= character <= "\u9fff" or "\uf900" <= character <= "\ufaff"

def main(level):
    path = ROOT / "data" / "editorial" / f"{level.lower()}-approved.jsonl"
    items = EDITORIAL.read_jsonl(path)
    existing = list(csv.DictReader((ROOT / "data" / "exercises.full.csv").open(encoding="utf-8-sig", newline="")))
    known = {EDITORIAL.normalize_japanese(row["source_text"]) for row in existing if row["direction"] == "ja_es" and "-EDITORIAL-" not in row["exercise_id"]}
    signatures = []
    issues = []
    for index, item in enumerate(items, 1):
        label = f"línea {index} / slot {item.get('slot', '?')}"
        slot = item.get("coverage_slot")
        if not isinstance(slot, dict):
            issues.append([label, "falta coverage_slot"])
            continue
        try:
            EDITORIAL.validate_slot(item, slot)
        except RuntimeError as error:
            issues.append([label, str(error)])
        signature = EDITORIAL.normalize_japanese(item.get("japanese", ""))
        signatures.append(signature)
        if signature in known: issues.append([label, "duplica el banco existente"])
        if re.search(r"\s", item.get("japanese", "")): issues.append([label, "contiene espacios japoneses"])
        if not re.search(r"[。！？]$", item.get("japanese", "")): issues.append([label, "falta puntuación final"])
        tags = set(item.get("grammar_tags", [])) | set(item.get("particle_tags", [])) | set(item.get("vocabulary_tags", []))
        if tags & RESERVED: issues.append([label, f"tags internos: {sorted(tags & RESERVED)}"])
        covered = "".join(reading.get("characters", "") for reading in item.get("kanji_readings", []))
        missing_kanji = sorted({character for character in item.get("japanese", "") if is_kanji(character) and character not in covered})
        if missing_kanji: issues.append([label, f"kanji sin lectura: {''.join(missing_kanji)}"])
        if len(set(item.get("accepted_alternatives_es", []))) != len(item.get("accepted_alternatives_es", [])): issues.append([label, "alternativas españolas duplicadas"])
        if len(set(item.get("accepted_alternatives_ja", []))) != len(item.get("accepted_alternatives_ja", [])): issues.append([label, "alternativas japonesas duplicadas"])
    duplicate_signatures = [signature for signature, count in Counter(signatures).items() if count > 1]
    for signature in duplicate_signatures: issues.append([level, f"frase duplicada dentro del lote: {signature}"])
    report = {"level": level, "approved_pairs": len(items), "issues": len(issues), "status": "PASS" if not issues else "FAIL", "details": issues}
    print(json.dumps(report, ensure_ascii=False, indent=2))
    raise SystemExit(0 if not issues else 1)

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("level", choices=["N5", "N4"])
    args = parser.parse_args()
    main(args.level)
