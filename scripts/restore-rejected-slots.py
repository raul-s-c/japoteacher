#!/usr/bin/env python3
import argparse
import json
import os
import tempfile
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def read_jsonl(path):
    if not path.exists():
        return []
    return [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]


def write_jsonl(path, rows):
    with tempfile.NamedTemporaryFile("w", encoding="utf-8", dir=path.parent, delete=False) as output:
        for row in rows:
            output.write(json.dumps(row, ensure_ascii=False, separators=(",", ":")) + "\n")
        temporary = Path(output.name)
    os.replace(temporary, path)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("level", choices=["N5", "N4"])
    parser.add_argument("--slots", required=True, help="Slots separados por comas que deben volver a revisión.")
    args = parser.parse_args()
    requested = {int(value) for value in args.slots.split(",") if value.strip()}

    approved_path = ROOT / "data" / "editorial" / f"{args.level.lower()}-approved.jsonl"
    rejected_path = ROOT / "data" / "editorial" / f"{args.level.lower()}-rejected-slots.jsonl"
    approved = read_jsonl(approved_path)
    rejected = read_jsonl(rejected_path)
    by_slot = {int(row.get("slot", 0)): row for row in approved}
    restored = []

    for rejection in reversed(rejected):
        slot = int(rejection.get("slot", 0) or 0)
        removed = rejection.get("removed_item")
        if slot in requested and slot not in by_slot and isinstance(removed, dict):
            by_slot[slot] = removed
            restored.append(slot)

    missing = sorted(requested - set(by_slot))
    if missing:
        raise SystemExit(f"No se encontraron checkpoints para los slots: {missing}")
    write_jsonl(approved_path, [by_slot[slot] for slot in sorted(by_slot)])
    print(json.dumps({"level": args.level, "restored_slots": sorted(restored)}, ensure_ascii=False))


if __name__ == "__main__":
    main()
