import argparse
import importlib.util
import json
import os
import pathlib
import tempfile

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


def main(level, requested_slot=None):
    key = os.environ.get("JAPOTEACHER_EDITORIAL_KEY", "")
    if not key:
        raise SystemExit("Falta JAPOTEACHER_EDITORIAL_KEY.")
    path = ROOT / "data" / "editorial" / f"{level.lower()}-approved.jsonl"
    rows = EDITORIAL.read_jsonl(path)
    repaired = []
    for index, item in enumerate(rows):
        if requested_slot is not None and item["slot"] != requested_slot:
            continue
        try:
            EDITORIAL.validate_slot(item, item["coverage_slot"])
            continue
        except RuntimeError as error:
            if "kanji sin lectura" not in str(error):
                continue
        rows[index] = EDITORIAL.repair_kanji_readings([item], level, key)[0]
        EDITORIAL.validate_slot(rows[index], rows[index]["coverage_slot"])
        write_items(path, rows)
        repaired.append(item["slot"])
    print(json.dumps({"level": level, "repaired_slots": repaired}, ensure_ascii=False))


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("level", choices=["N5", "N4"])
    parser.add_argument("--slot", type=int)
    args = parser.parse_args()
    main(args.level, args.slot)
