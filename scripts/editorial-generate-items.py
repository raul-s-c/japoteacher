import argparse
import importlib.util
import json
import os
import pathlib
import subprocess
import tempfile

ROOT = pathlib.Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location("editorial_generate", ROOT / "scripts" / "editorial-generate.py")
EDITORIAL = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(EDITORIAL)
POLICY = EDITORIAL.POLICY
read_jsonl = EDITORIAL.read_jsonl
request_editorial = EDITORIAL.request_editorial
append_jsonl = EDITORIAL.append_jsonl

LAYER_BY_TYPE = {
    "kanji_reading": "language_knowledge", "orthography": "language_knowledge",
    "context_expression": "language_knowledge", "paraphrase": "language_knowledge",
    "vocabulary_usage": "language_knowledge", "grammar_form": "grammar",
    "sentence_composition": "grammar", "text_grammar": "grammar",
    "reading_short": "reading", "reading_medium": "reading",
    "information_retrieval": "reading", "listening_task": "listening",
    "listening_key_points": "listening", "listening_verbal_expression": "listening",
    "listening_quick_response": "listening",
}

READING_RANGES = {
    ("N5", "reading_short"): [60, 100], ("N5", "reading_medium"): [200, 300],
    ("N5", "information_retrieval"): [200, 300], ("N4", "reading_short"): [100, 200],
    ("N4", "reading_medium"): [380, 520], ("N4", "information_retrieval"): [330, 470],
}

def item_id(level, item_type, number):
    return f"JLPT-{level}-{item_type.upper()}-{number:04d}"

def make_slots(level, item_type, start, count):
    topics = POLICY["topics"]
    grammar = POLICY["levels"][level]["grammar_inventory"]
    slots = []
    for offset in range(count):
        index = start + offset
        slots.append({
            "item_id": item_id(level, item_type, index + 1),
            "jlpt_level": level,
            "layer": LAYER_BY_TYPE[item_type],
            "item_type": item_type,
            "topic_primary": topics[index % len(topics)],
            "grammar_focus": grammar[index % len(grammar)],
            "visible_japanese_character_range": READING_RANGES.get((level, item_type), []),
            "required_options": 4,
            "dataset_version": "jlpt-complete-1.0",
            "required_distinction": "Escena, contenido, respuesta y patrón de distractores distintos del resto del lote.",
        })
    return slots

def validate_group(items):
    with tempfile.NamedTemporaryFile("w", suffix=".json", encoding="utf-8", delete=False) as output:
        json.dump({"items": [{key: value for key, value in item.items() if key not in {"editorial_rationale", "distractor_rationales"}} for item in items]}, output, ensure_ascii=False)
        path = output.name
    try:
        result = subprocess.run(
            [os.sys.executable, str(ROOT / "scripts" / "validate-jlpt-items.py"), path],
            capture_output=True, text=True, encoding="utf-8",
        )
        if result.returncode:
            raise RuntimeError(f"El lote no superó la validación local:\n{result.stdout}{result.stderr}")
    finally:
        pathlib.Path(path).unlink(missing_ok=True)

def review(items, level, item_type, key):
    current = items
    for round_number in range(1, 4):
        result = request_editorial({"operation": "review_items", "level": level, "item_type": item_type, "round": round_number, "items": current}, key)
        reviewed = sorted(result["items"], key=lambda value: value["index"])
        current = [value["corrected"] for value in reviewed]
        if all(value["approved"] for value in reviewed):
            validate_group(current)
            return current, round_number
    raise RuntimeError("El lote no superó tres revisiones editoriales.")

def run(level, item_type, limit=None):
    key = os.environ.get("JAPOTEACHER_EDITORIAL_KEY", "")
    if not key:
        raise SystemExit("Falta JAPOTEACHER_EDITORIAL_KEY en el entorno.")
    target = POLICY["levels"][level]["item_targets"].get(item_type, 0)
    if not target:
        raise SystemExit(f"{item_type} no forma parte del contrato de {level}.")
    output_path = ROOT / "data" / "editorial" / f"{level.lower()}-{item_type}-approved.jsonl"
    approved = read_jsonl(output_path)
    remaining = target - len(approved)
    if limit is not None:
        remaining = min(remaining, limit)
    if remaining % 5:
        raise SystemExit("Los lotes editoriales deben ser múltiplos de cinco.")
    for generated in range(0, remaining, 5):
        slots = make_slots(level, item_type, len(approved) + generated, 5)
        result = request_editorial({"operation": "generate_items", "level": level, "item_type": item_type, "slots": slots}, key)
        final, rounds = review(result["items"], level, item_type, key)
        if [item["item_id"] for item in final] != [slot["item_id"] for slot in slots]:
            raise RuntimeError("La revisión alteró identificadores del lote.")
        for item in final:
            append_jsonl(output_path, {"review_rounds": rounds, **item})
        print(json.dumps({"level": level, "item_type": item_type, "approved": len(approved) + generated + 5, "target": target}, ensure_ascii=False), flush=True)

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("level", choices=["N5", "N4"])
    parser.add_argument("item_type", choices=sorted(LAYER_BY_TYPE))
    parser.add_argument("--limit", type=int)
    arguments = parser.parse_args()
    run(arguments.level, arguments.item_type, arguments.limit)
