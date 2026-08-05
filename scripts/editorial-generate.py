import argparse
import csv
import json
import os
import pathlib
import re
import time
import urllib.error
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parents[1]
POLICY = json.loads((ROOT / "data" / "jlpt-content-policy.json").read_text(encoding="utf-8"))
ENDPOINT = "https://japoteacher-ai.raul-nihongo.workers.dev/editorial/generate"

def normalize_japanese(value):
    return re.sub(r"[\s。、！？「」『』（）・,.!?]", "", value)

def request_editorial(payload, key, retries=4):
    body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    for attempt in range(retries):
        request = urllib.request.Request(ENDPOINT, data=body, method="POST", headers={"Content-Type": "application/json", "X-Editorial-Key": key})
        try:
            with urllib.request.urlopen(request, timeout=180) as response:
                data = json.loads(response.read().decode("utf-8"))
            if "result" not in data:
                raise RuntimeError(data.get("error", "Respuesta editorial incompleta"))
            return data["result"]
        except (urllib.error.URLError, TimeoutError, RuntimeError) as error:
            if attempt == retries - 1:
                raise
            time.sleep(2 ** attempt)

def existing_pairs(level):
    rows = list(csv.DictReader((ROOT / "data" / "exercises.full.csv").open(encoding="utf-8-sig", newline="")))
    return [row for row in rows if row["active"].lower() == "true" and row["jlpt_level"] == level and row["direction"] == "ja_es"]

def make_slots(level, start, count):
    config = POLICY["levels"][level]
    topics = POLICY["topics"]
    grammars = config["grammar_inventory"]
    functions = ["statement", "statement", "question", "social_action", "negative_or_correction", "reason_contrast_condition"]
    bands = ["short", "standard", "standard", "long"]
    slots = []
    for index in range(start, start + count):
        topic = topics[index % len(topics)]
        secondary = topics[(index * 7 + 3) % len(topics)]
        if secondary == topic:
            secondary = topics[(topics.index(secondary) + 1) % len(topics)]
        slots.append({
            "slot": index + 1,
            "level": level,
            "topic_primary": topic,
            "topic_secondary_allowed": secondary if index % 3 == 0 else "",
            "grammar_focus": [grammars[index % len(grammars)]],
            "communicative_shape": functions[index % len(functions)],
            "length_band": bands[index % len(bands)],
            "jp_char_range": config["jp_chars"],
            "es_word_range": config["es_words"],
            "required_distinction": "La escena, el verbo principal y la intención deben ser distintos de los demás slots del grupo."
        })
    return slots

def read_jsonl(path):
    if not path.exists():
        return []
    return [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]

def append_jsonl(path, item):
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a", encoding="utf-8") as output:
        output.write(json.dumps(item, ensure_ascii=False) + "\n")

def review_until_approved(items, level, key):
    current = items
    for review_round in range(3):
        result = request_editorial({"operation": "review", "level": level, "round": review_round + 1, "items": current}, key)
        reviewed = sorted(result["items"], key=lambda item: item["index"])
        current = [item["corrected"] for item in reviewed]
        if all(item["approved"] for item in reviewed):
            return current, review_round + 1
    raise RuntimeError("El grupo no superó tres revisiones editoriales; se conserva fuera del banco.")

def run(level, limit=None):
    key = os.environ.get("JAPOTEACHER_EDITORIAL_KEY", "")
    if not key:
        raise SystemExit("Falta JAPOTEACHER_EDITORIAL_KEY en el entorno.")
    config = POLICY["levels"][level]
    existing = existing_pairs(level)
    output_path = ROOT / "data" / "editorial" / f"{level.lower()}-approved.jsonl"
    approved = read_jsonl(output_path)
    remaining = max(0, config["target_pairs"] - len(existing) - len(approved))
    if limit is not None:
        remaining = min(remaining, limit)
    known = {normalize_japanese(row["source_text"]) for row in existing} | {normalize_japanese(item["japanese"]) for item in approved}
    generated = 0
    while generated < remaining:
        group_size = min(5, remaining - generated)
        if group_size != 5:
            break
        offset = len(existing) + len(approved) + generated
        slots = make_slots(level, offset, 5)
        result = request_editorial({"operation": "generate", "level": level, "slots": slots, "avoid_japanese": list(known)[-200:]}, key)
        final, rounds = review_until_approved(result["items"], level, key)
        signatures = [normalize_japanese(item["japanese"]) for item in final]
        if len(set(signatures)) != 5 or any(signature in known for signature in signatures):
            raise RuntimeError("El grupo contiene una frase duplicada; se detiene para revisión.")
        for slot, item, signature in zip(slots, final, signatures):
            append_jsonl(output_path, {"level": level, "slot": slot, "review_rounds": rounds, **item})
            known.add(signature)
        generated += 5
        print(json.dumps({"level": level, "approved_total": len(approved) + generated, "remaining_this_run": remaining - generated}, ensure_ascii=False), flush=True)

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("level", choices=["N5", "N4"])
    parser.add_argument("--limit", type=int)
    args = parser.parse_args()
    run(args.level, args.limit)
