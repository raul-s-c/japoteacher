import argparse
import json
import pathlib
import subprocess
import tempfile
import os

ROOT = pathlib.Path(__file__).resolve().parents[1]


def decode_rows(text):
    return [json.loads(line) for line in text.splitlines() if line.strip()]


def main(level, commit):
    relative = f"data/editorial/{level.lower()}-approved.jsonl"
    path = ROOT / relative
    committed = decode_rows(subprocess.check_output(
        ["git", "-c", f"safe.directory={ROOT.as_posix()}", "show", f"{commit}:{relative}"],
        cwd=ROOT,
        text=True,
        encoding="utf-8",
    ))
    checkpoint = decode_rows(path.read_text(encoding="utf-8"))
    recovered = {item["slot"]: item for item in committed}
    recovered.update({item["slot"]: item for item in checkpoint})
    rows = [recovered[slot] for slot in sorted(recovered)]
    with tempfile.NamedTemporaryFile("w", encoding="utf-8", dir=path.parent, delete=False) as output:
        for row in rows:
            output.write(json.dumps(row, ensure_ascii=False) + "\n")
        temporary = pathlib.Path(output.name)
    os.replace(temporary, path)
    print(json.dumps({
        "level": level,
        "committed": len(committed),
        "checkpoint": len(checkpoint),
        "recovered": len(rows),
        "first_slot": rows[0]["slot"],
        "last_slot": rows[-1]["slot"],
    }, ensure_ascii=False))


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("level", choices=["N5", "N4"])
    parser.add_argument("--commit", required=True)
    args = parser.parse_args()
    main(args.level, args.commit)
