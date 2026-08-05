import argparse
import json
import os
import pathlib
import tempfile

import importlib.util

ROOT = pathlib.Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location("editorial_generate", ROOT / "scripts" / "editorial-generate.py")
EDITORIAL = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(EDITORIAL)

def write_items(path, items):
    with tempfile.NamedTemporaryFile("w", encoding="utf-8", dir=path.parent, delete=False) as output:
        for item in items:
            output.write(json.dumps(item, ensure_ascii=False) + "\n")
        temporary = pathlib.Path(output.name)
    os.replace(temporary, path)

def main(level):
    key = os.environ.get("JAPOTEACHER_EDITORIAL_KEY", "")
    if not key:
        raise SystemExit("Falta JAPOTEACHER_EDITORIAL_KEY.")
    path = ROOT / "data" / "editorial" / f"{level.lower()}-approved.jsonl"
    original = EDITORIAL.read_jsonl(path)
    if len(original) % 5:
        raise SystemExit("El archivo no contiene grupos completos de cinco.")
    revalidated = 0
    for start in range(0, len(original), 5):
        group = original[start:start + 5]
        if all(item.get("editorial_quality_version", 0) >= 3 for item in group):
            continue
        slots = [item["coverage_slot"] for item in group]
        if all(item.get("editorial_quality_version", 0) >= 2 for item in group):
            final = EDITORIAL.equivalence_check(group, level, key, slots)
            rounds = 1
        else:
            final, rounds = EDITORIAL.review_until_approved(group, level, key, slots)
            final = EDITORIAL.equivalence_check(final, level, key, slots)
            rounds += 1
        by_slot = {item.get("slot"): EDITORIAL.normalize_spacing(item) for item in final}
        if set(by_slot) != {item["slot"] for item in group}:
            raise RuntimeError(f"El grupo {start // 5 + 1} perdió identidades de slot.")
        for previous in group:
            item = by_slot[previous["slot"]]
            EDITORIAL.validate_slot(item, previous["coverage_slot"])
        corrected_group = [{
            **by_slot[previous["slot"]],
            "level": level,
            "coverage_slot": previous["coverage_slot"],
            "review_rounds": previous.get("review_rounds", 0) + rounds,
            "editorial_quality_version": 3,
        } for previous in group]
        original[start:start + 5] = corrected_group
        signatures = [EDITORIAL.normalize_japanese(item["japanese"]) for item in original]
        if len(signatures) != len(set(signatures)):
            raise RuntimeError("La revalidación produjo duplicados.")
        write_items(path, original)
        revalidated += 5
        print(json.dumps({"level": level, "revalidated_this_run": revalidated, "quality_v3_total": sum(item.get("editorial_quality_version", 0) >= 3 for item in original), "total": len(original)}, ensure_ascii=False), flush=True)
    signatures = [EDITORIAL.normalize_japanese(item["japanese"]) for item in original]
    if len(signatures) != len(set(signatures)):
        raise RuntimeError("La revalidación produjo duplicados.")
    print(f"Revalidación por checkpoints completada: {len(original)} pares.")

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("level", choices=["N5", "N4"])
    args = parser.parse_args()
    main(args.level)
