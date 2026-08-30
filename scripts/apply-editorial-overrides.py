import argparse
import json
import pathlib
import tempfile
import os

ROOT = pathlib.Path(__file__).resolve().parents[1]


def replace_strings(value, replacements):
    if isinstance(value, str):
        for old, new in replacements.items():
            value = value.replace(old, new)
        return value
    if isinstance(value, list):
        return [replace_strings(item, replacements) for item in value]
    if isinstance(value, dict):
        return {key: replace_strings(item, replacements) for key, item in value.items()}
    return value


def main(level):
    path = ROOT / "data" / "editorial" / f"{level.lower()}-approved.jsonl"
    overrides = json.loads((ROOT / "data" / "editorial" / "manual-overrides.json").read_text(encoding="utf-8")).get(level, {})
    rows = [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]
    applied = []
    for index, row in enumerate(rows):
        override = overrides.get(str(row["slot"]))
        if not override:
            continue
        row = replace_strings(row, override.get("replacements", {}))
        row.update(override.get("fields", {}))
        additions = override.get("kanji_readings_add", [])
        if additions:
            readings = row.get("kanji_readings", [])
            existing = {item.get("characters") for item in readings}
            readings.extend(item for item in additions if item.get("characters") not in existing)
            row["kanji_readings"] = sorted(
                readings,
                key=lambda item: row.get("japanese", "").find(item.get("characters", "")),
            )
        row["manual_editorial_override"] = override["reason"]
        rows[index] = row
        applied.append(row["slot"])
    with tempfile.NamedTemporaryFile("w", encoding="utf-8", dir=path.parent, delete=False) as output:
        for row in rows:
            output.write(json.dumps(row, ensure_ascii=False, separators=(",", ":")) + "\n")
        temporary = pathlib.Path(output.name)
    os.replace(temporary, path)
    print(json.dumps({"level": level, "applied_slots": applied}, ensure_ascii=False))


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("level", choices=["N5", "N4"])
    main(parser.parse_args().level)
