import csv
import html
import json
import os
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
if os.environ.get("PYKAKASI_PATH"):
    sys.path.insert(0, os.environ["PYKAKASI_PATH"])
from pykakasi import kakasi

converter = kakasi()
readings = {}
with (ROOT / "data" / "exercises.full.csv").open(encoding="utf-8-sig", newline="") as source:
    for exercise in csv.DictReader(source):
        if exercise["source_language"] != "ja":
            continue
        pieces = []
        for token in converter.convert(exercise["source_text"]):
            original = token["orig"]
            escaped = html.escape(original)
            if any("\u3400" <= char <= "\u9fff" for char in original):
                pieces.append(f'<ruby>{escaped}<rt>{html.escape(token["hira"])}</rt></ruby>')
            else:
                pieces.append(escaped)
        readings[exercise["exercise_id"]] = "".join(pieces)

target = ROOT / "src" / "furigana-generated.js"
target.write_text(
    "window.JAPOTEACHER_FURIGANA="
    + json.dumps(readings, ensure_ascii=False, separators=(",", ":"))
    + ";\n",
    encoding="utf-8",
)
print(json.dumps({"generated": len(readings), "target": str(target)}, ensure_ascii=False))
