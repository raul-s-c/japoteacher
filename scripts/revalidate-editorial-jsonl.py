#!/usr/bin/env python3
import argparse
import importlib.util
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
GENERATOR_PATH = ROOT / "scripts" / "editorial-generate.py"


def load_generator():
    spec = importlib.util.spec_from_file_location("editorial_generate", GENERATOR_PATH)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def read_jsonl(path):
    if not path.exists():
        return []
    return [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]


def write_jsonl(path, rows):
    path.write_text("".join(json.dumps(row, ensure_ascii=False) + "\n" for row in rows), encoding="utf-8")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("level", choices=["N5", "N4"])
    parser.add_argument("--min-slot", type=int, default=1)
    parser.add_argument("--reject-slots", default="", help="Slots separados por comas que la revisión humana retira del lote.")
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()
    manually_rejected = {int(value) for value in args.reject_slots.split(",") if value.strip()}

    generator = load_generator()
    approved_path = ROOT / "data" / "editorial" / f"{args.level.lower()}-approved.jsonl"
    rejected_path = ROOT / "data" / "editorial" / f"{args.level.lower()}-rejected-slots.jsonl"
    approved = read_jsonl(approved_path)
    kept = []
    rejected = read_jsonl(rejected_path)
    invalid = []
    seen_japanese = set()

    for item in approved:
        slot = item.get("coverage_slot") or {}
        normalized_japanese = generator.normalize_japanese(item.get("japanese", ""))
        if int(item.get("slot", 0) or 0) in manually_rejected:
            invalid.append({"level": args.level, "slot": item.get("slot"), "coverage_slot": slot, "reason": "Retirada por revisión humana.", "removed_item": item})
            continue
        if int(item.get("slot", 0) or 0) < args.min_slot:
            kept.append(item)
            seen_japanese.add(normalized_japanese)
            continue
        try:
            normalized = generator.normalize_spacing(item)
            generator.validate_slot(normalized, slot)
            normalized_japanese = generator.normalize_japanese(normalized.get("japanese", ""))
            if normalized_japanese in seen_japanese:
                raise ValueError(f"frase duplicada dentro del lote: {normalized.get('japanese', '')}")
            kept.append({**item, **normalized})
            seen_japanese.add(normalized_japanese)
        except Exception as error:
            invalid.append({"level": args.level, "slot": item.get("slot"), "coverage_slot": slot, "reason": f"Revalidación local: {error}", "removed_item": item})
    print(json.dumps({"level": args.level, "checked_from_slot": args.min_slot, "invalid": len(invalid), "kept": len(kept), "apply": args.apply}, ensure_ascii=False))
    for row in invalid:
        print(json.dumps({"slot": row["slot"], "reason": row["reason"]}, ensure_ascii=False))
    if args.apply and invalid:
        write_jsonl(approved_path, kept)
        write_jsonl(rejected_path, rejected + invalid)


if __name__ == "__main__":
    main()
