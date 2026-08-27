import argparse
import datetime
import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def clean(value):
    return str(value or "").replace("|", "/").replace("\n", " ")


def target_label(slot):
    targets = []
    for item in slot.get("target_vocabulary", []):
        word = item.get("word", "")
        reading = item.get("reading", "")
        targets.append(f"{word} ({reading})" if reading else word)
    for item in slot.get("target_kanji", []):
        targets.append(f"kanji {item.get('kanji', '')}")
    return ", ".join(target for target in targets if target.strip()) or "-"


def tail(level, count):
    path = ROOT / "data" / "editorial" / f"{level.lower()}-approved.jsonl"
    rows = [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]
    return rows[-count:]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--n5", type=int, default=0)
    parser.add_argument("--n4", type=int, default=0)
    parser.add_argument("--output", required=True)
    args = parser.parse_args()

    today = datetime.date.today().isoformat()
    parts = [
        f"# Frases nuevas - tanda {today}",
        "",
        f"Generado: {datetime.datetime.now().isoformat(timespec='seconds')}",
        "",
        "Criterio: deuda de cobertura desde japanese_usage_progress_v2_csv.zip, priorizando vocabulario/kanji con 0 usos y revisión editorial adversarial.",
        "",
    ]
    total = 0
    for level, count in [("N5", args.n5), ("N4", args.n4)]:
        if count <= 0:
            continue
        rows = tail(level, count)
        total += len(rows)
        parts.extend([
            f"## {level} ({len(rows)} pares)",
            "",
            "| Slot | Japonés | Español | Objetivos de cobertura | Tema |",
            "| ---: | --- | --- | --- | --- |",
        ])
        for item in rows:
            slot = item.get("coverage_slot") or {}
            parts.append(
                f"| {item.get('slot')} | {clean(item.get('japanese'))} | {clean(item.get('spanish'))} | {clean(target_label(slot))} | {clean(item.get('topic_primary'))} |"
            )
        parts.append("")
    parts.append(f"Total nuevo listado: {total} pares / {total * 2} ejercicios direccionales.")

    output = ROOT / args.output
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text("\n".join(parts) + "\n", encoding="utf-8")
    print(output)


if __name__ == "__main__":
    main()
