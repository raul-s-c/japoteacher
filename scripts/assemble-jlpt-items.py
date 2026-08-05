import argparse
import json
import os
import pathlib
import subprocess
import tempfile
from collections import Counter

ROOT = pathlib.Path(__file__).resolve().parents[1]
POLICY = json.loads((ROOT / "data" / "jlpt-content-policy.json").read_text(encoding="utf-8"))
OUTPUT = ROOT / "data" / "jlpt-items.full.json"

def read_jsonl(path):
    if not path.exists():
        return []
    return [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]

def clean(item):
    return {key: value for key, value in item.items() if key not in {"review_rounds", "editorial_rationale", "distractor_rationales"}}

def collect():
    items = []
    missing = []
    for level, level_policy in POLICY["levels"].items():
        for item_type, target in level_policy["item_targets"].items():
            path = ROOT / "data" / "editorial" / f"{level.lower()}-{item_type}-approved.jsonl"
            rows = read_jsonl(path)
            if len(rows) != target:
                missing.append({"level": level, "item_type": item_type, "expected": target, "found": len(rows)})
            items.extend(clean(row) for row in rows)
    return items, missing

def validate(items):
    ids = Counter(item.get("item_id") for item in items)
    duplicates = [identifier for identifier, count in ids.items() if count > 1]
    if duplicates:
        raise RuntimeError(f"IDs duplicados: {', '.join(duplicates[:10])}")
    with tempfile.NamedTemporaryFile("w", suffix=".json", encoding="utf-8", delete=False) as output:
        json.dump({"items": items}, output, ensure_ascii=False)
        temporary = pathlib.Path(output.name)
    try:
        result = subprocess.run(
            [os.sys.executable, str(ROOT / "scripts" / "validate-jlpt-items.py"), str(temporary)],
            capture_output=True, text=True, encoding="utf-8",
        )
        if result.returncode:
            raise RuntimeError(f"Validación JLPT fallida:\n{result.stdout}{result.stderr}")
    finally:
        temporary.unlink(missing_ok=True)

def report(items, missing):
    counts = Counter((item.get("jlpt_level"), item.get("item_type")) for item in items)
    return {
        "status": "READY" if not missing else "INCOMPLETE",
        "items_found": len(items),
        "missing_quotas": missing,
        "counts": {f"{level}:{item_type}": count for (level, item_type), count in sorted(counts.items())},
    }

def main(write):
    items, missing = collect()
    summary = report(items, missing)
    print(json.dumps(summary, ensure_ascii=False, indent=2))
    if missing:
        raise SystemExit(2)
    validate(items)
    if not write:
        return
    payload = {"dataset_version": "jlpt-complete-1.0", "items": sorted(items, key=lambda item: item["item_id"])}
    for item in payload["items"]:
        item["active"] = True
        item["dataset_version"] = payload["dataset_version"]
    with tempfile.NamedTemporaryFile("w", suffix=".json", encoding="utf-8", dir=OUTPUT.parent, delete=False) as output:
        json.dump(payload, output, ensure_ascii=False, indent=2)
        output.write("\n")
        temporary = pathlib.Path(output.name)
    os.replace(temporary, OUTPUT)
    print(f"Banco publicado atómicamente: {len(items)} ítems en {OUTPUT}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Ensambla el banco JLPT solo cuando todas las cuotas están completas.")
    parser.add_argument("--write", action="store_true", help="Reemplaza el manifiesto únicamente después de superar todas las puertas.")
    arguments = parser.parse_args()
    main(arguments.write)
