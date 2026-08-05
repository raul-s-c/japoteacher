import argparse
import json
import pathlib
import re
from collections import Counter

ROOT = pathlib.Path(__file__).resolve().parents[1]
ALLOWED_LEVELS = {"N5", "N4"}
ALLOWED_TYPES = {
    "kanji_reading", "orthography", "context_expression", "paraphrase", "vocabulary_usage",
    "grammar_form", "sentence_composition", "text_grammar", "reading_short", "reading_medium",
    "information_retrieval", "listening_task", "listening_key_points", "listening_verbal_expression",
    "listening_quick_response"
}
READING_RANGES = {
    ("N5", "reading_short"): (60, 100), ("N5", "reading_medium"): (200, 300),
    ("N5", "information_retrieval"): (200, 300), ("N4", "reading_short"): (100, 200),
    ("N4", "reading_medium"): (380, 520), ("N4", "information_retrieval"): (330, 470)
}
LISTENING_TYPES = {item for item in ALLOWED_TYPES if item.startswith("listening_")}

def visible_chars(value):
    return len(re.sub(r"[\s。、！？「」『』（）・,.!?]", "", value))

def validate(item):
    errors = []
    required = ["item_id", "jlpt_level", "layer", "item_type", "stimulus_text_ja", "audio_script_ja", "audio_asset", "visual_context", "question_es", "options", "correct_option", "explanation_es", "topic_tags", "grammar_tags", "vocabulary_tags", "kanji_readings", "active", "dataset_version"]
    for field in required:
        if field not in item:
            errors.append(f"falta {field}")
    if errors:
        return errors
    if item["jlpt_level"] not in ALLOWED_LEVELS: errors.append("nivel inválido")
    if item["item_type"] not in ALLOWED_TYPES: errors.append("tipo inválido")
    if not re.fullmatch(r"JLPT-(N5|N4)-[A-Z_]+-\d{4}", item["item_id"]): errors.append("item_id inválido")
    if not 2 <= len(item["options"]) <= 4 or len(set(item["options"])) != len(item["options"]): errors.append("opciones inválidas o duplicadas")
    if not 0 <= item["correct_option"] < len(item["options"]): errors.append("respuesta fuera de opciones")
    if not 1 <= len(item["topic_tags"]) <= 3: errors.append("debe haber 1–3 temas")
    reading_range = READING_RANGES.get((item["jlpt_level"], item["item_type"]))
    if reading_range and not reading_range[0] <= visible_chars(item["stimulus_text_ja"]) <= reading_range[1]: errors.append(f"longitud de lectura fuera de {reading_range}")
    if item["item_type"] in LISTENING_TYPES and not item["audio_script_ja"]: errors.append("falta guion auditivo")
    if item["item_type"] not in LISTENING_TYPES and item["audio_script_ja"]: errors.append("audio_script_ja solo corresponde a escucha")
    for reading in item["kanji_readings"]:
        if not all(reading.get(field) for field in ["characters", "reading_hiragana", "meaning_es", "explanation_es"]): errors.append("lectura de kanji incompleta")
    return errors

def main(paths):
    items = []
    for path in paths:
        data = json.loads(pathlib.Path(path).read_text(encoding="utf-8"))
        items.extend(data if isinstance(data, list) else data["items"])
    issues = [(item.get("item_id", "sin_id"), error) for item in items for error in validate(item)]
    ids = Counter(item.get("item_id") for item in items)
    issues.extend((item_id, "identificador duplicado") for item_id, count in ids.items() if count > 1)
    report = {"items": len(items), "issues": len(issues), "status": "PASS" if not issues else "FAIL", "details": issues}
    print(json.dumps(report, ensure_ascii=False, indent=2))
    raise SystemExit(0 if not issues else 1)

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("paths", nargs="+")
    args = parser.parse_args()
    main(args.paths)
