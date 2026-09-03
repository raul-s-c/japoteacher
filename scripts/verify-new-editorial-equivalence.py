"""Recheck a new, unpublished tail without modifying older editorial records."""
import argparse
import importlib.util
import json
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("level", choices=["N5", "N4"])
    parser.add_argument("--min-slot", type=int, required=True)
    parser.add_argument("--force", action="store_true")
    args = parser.parse_args()
    spec = importlib.util.spec_from_file_location("generator", ROOT / "scripts/editorial-generate.py")
    generator = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(generator)
    path = ROOT / "data/editorial" / f"{args.level.lower()}-approved.jsonl"
    lines = path.read_text(encoding="utf-8").splitlines()
    rows = generator.read_jsonl(path)
    key = os.environ["JAPOTEACHER_EDITORIAL_KEY"]
    for index, item in enumerate(rows):
        if item["slot"] < args.min_slot or (item.get("equivalence_verified") and not args.force):
            continue
        slot = item["coverage_slot"]
        checked = generator.equivalence_check([item], args.level, key, [slot])[0]
        rows[index] = {**item, **checked, "equivalence_verified": True}
        lines[index] = json.dumps(rows[index], ensure_ascii=False)
        path.write_text("\n".join(lines) + "\n", encoding="utf-8")
        print(json.dumps({"verified": item["slot"], "japanese": checked["japanese"], "spanish": checked["spanish"]}, ensure_ascii=False), flush=True)


if __name__ == "__main__":
    main()
