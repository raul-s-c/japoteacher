import html
import json
import pathlib

ROOT = pathlib.Path(__file__).resolve().parents[1]
TARGET = ROOT / "src" / "furigana-generated.js"
PREFIX = "window.JAPOTEACHER_FURIGANA="

def ruby(item):
    source, cursor, pieces = item["japanese"], 0, []
    for reading in item.get("kanji_readings", []):
        chars = reading["characters"]
        position = source.find(chars, cursor)
        if position < 0: continue
        pieces.append(html.escape(source[cursor:position]))
        pieces.append(f'<ruby>{html.escape(chars)}<rt>{html.escape(reading["reading_hiragana"])}</rt></ruby>')
        cursor = position + len(chars)
    pieces.append(html.escape(source[cursor:]))
    return "".join(pieces)

text = TARGET.read_text(encoding="utf-8").strip()
readings = json.loads(text[len(PREFIX):-1]) if text.startswith(PREFIX) else {}
added = 0
for level in ("N5", "N4"):
    path = ROOT / "data" / "editorial" / f"{level.lower()}-approved.jsonl"
    for line in path.read_text(encoding="utf-8").splitlines():
        if not line.strip(): continue
        item = json.loads(line)
        readings[f"JAES-{level}-EDITORIAL-{int(item['slot']):04d}"] = ruby(item)
        added += 1
TARGET.write_text(PREFIX + json.dumps(readings, ensure_ascii=False, separators=(",", ":")) + ";\n", encoding="utf-8")
print(json.dumps({"editorial_furigana": added, "total": len(readings)}, ensure_ascii=False))
