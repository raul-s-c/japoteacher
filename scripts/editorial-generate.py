import argparse
import csv
import datetime
import http.client
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

def record_usage(payload, response):
    path = ROOT / "data" / "editorial" / "usage.jsonl"
    path.parent.mkdir(parents=True, exist_ok=True)
    entry = {
        "recorded_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "operation": payload.get("operation"),
        "level": payload.get("level"),
        "model": response.get("model"),
        "response_id": response.get("response_id"),
        "usage": response.get("usage", {}),
    }
    with path.open("a", encoding="utf-8") as output:
        output.write(json.dumps(entry, ensure_ascii=False) + "\n")

def normalize_japanese(value):
    return re.sub(r"[\s。、！？「」『』（）・,.!?]", "", value)

def normalize_spacing(item):
    item = dict(item)
    item["japanese"] = re.sub(r"\s+", "", item["japanese"]).strip()
    if not re.search(r"[。！？]$", item["japanese"]):
        item["japanese"] += "？" if item.get("sentence_type") == "pregunta" else "。"
    item["spanish"] = re.sub(r"\s+", " ", item["spanish"]).strip()
    japanese_alternatives = [re.sub(r"\s+", "", value).strip() for value in item["accepted_alternatives_ja"]]
    spanish_alternatives = [re.sub(r"\s+", " ", value).strip() for value in item["accepted_alternatives_es"]]
    item["accepted_alternatives_ja"] = list(dict.fromkeys(value for value in japanese_alternatives if normalize_japanese(value) != normalize_japanese(item["japanese"])))
    item["accepted_alternatives_es"] = list(dict.fromkeys(value for value in spanish_alternatives if value.casefold().rstrip(".!?¿¡") != item["spanish"].casefold().rstrip(".!?¿¡")))
    for field in ["grammar_tags", "particle_tags", "vocabulary_tags"]:
        item[field] = [value for value in item[field] if value not in {"grammar_focus", "topic_primary", "required_distinction"}]
    return item

def grammar_focus_present(focus, tags, japanese):
    evidence_patterns = {
        "位置表現": r"(?:上|下|中|外|前|後ろ|隣|となり|近く|そば|右|左)に",
        "頻度表現": r"(?:いつも|よく|ときどき|時々|あまり|ぜんぜん|全然|毎日|毎週|毎月)",
        "疑問詞": r"(?:だれ|誰|なに|何|どこ|いつ|どう|どの|どれ|どちら|いくつ|いくら)",
        "数量・助数詞": r"(?:[一二三四五六七八九十百千何0-9]+(?:人|本|枚|台|匹|冊|個|つ|回|階|歳|時|分|日|月|年|駅|錠))",
    }
    if focus in evidence_patterns and re.search(evidence_patterns[focus], japanese):
        return True
    alternatives = [value.strip() for value in focus.split("・") if value.strip()]
    return any(alternative == tag or alternative in tag or tag in alternative for alternative in alternatives for tag in tags)

def is_kanji(character):
    return "\u3400" <= character <= "\u9fff" or "\uf900" <= character <= "\ufaff"

def validate_slot(item, slot):
    errors = []
    if item.get("slot") != slot["slot"]: errors.append("slot alterado")
    if item.get("topic_primary") != slot["topic_primary"]: errors.append("tema primario alterado")
    if not all(grammar_focus_present(focus, item.get("grammar_tags", []), item.get("japanese", "")) for focus in slot["grammar_focus"]): errors.append("foco gramatical ausente")
    jp_chars = len(normalize_japanese(item.get("japanese", "")))
    jp_min, jp_max = max(1, int(slot["jp_char_range"][0] * 0.8)), slot["jp_char_range"][1] + 4
    if not jp_min <= jp_chars <= jp_max: errors.append(f"longitud japonesa {jp_chars}")
    es_words = len(re.findall(r"\b[\wÁÉÍÓÚÜÑáéíóúüñ]+\b", item.get("spanish", "")))
    es_min, es_max = max(1, int(slot["es_word_range"][0] * 0.75)), slot["es_word_range"][1] + 2
    if not es_min <= es_words <= es_max: errors.append(f"longitud española {es_words}")
    if re.search(r"(?:です|ます|ません|ました)[。！？]?$", item.get("japanese", "")) and item.get("register") != "cortés": errors.append("registro cortés mal etiquetado")
    covered = "".join(reading.get("characters", "") for reading in item.get("kanji_readings", []))
    missing_kanji = sorted({character for character in item.get("japanese", "") if is_kanji(character) and character not in covered})
    if missing_kanji: errors.append(f"kanji sin lectura {''.join(missing_kanji)}")
    if errors:
        raise RuntimeError(f"Slot {slot['slot']} inválido: {', '.join(errors)}")

def repair_kanji_readings(items, level, key):
    result = request_editorial({"operation": "repair_kanji", "level": level, "items": [{"slot": item["slot"], "japanese": item["japanese"]} for item in items]}, key)
    by_slot = {item["slot"]: item["kanji_readings"] for item in result["items"]}
    if set(by_slot) != {item["slot"] for item in items}:
        raise RuntimeError("La reparación de kanji perdió identidades de slot.")
    return [{**item, "kanji_readings": by_slot[item["slot"]]} for item in items]

def equivalence_check(items, level, key, slots):
    corrections = {}
    for source in items:
        editorial_item = {"slot": source["slot"], "japanese": source["japanese"], "spanish": source["spanish"], "accepted_alternatives_es": source["accepted_alternatives_es"], "accepted_alternatives_ja": source["accepted_alternatives_ja"], "critical_meaning_units": source["critical_meaning_units"]}
        for attempt in range(3):
            result = request_editorial({"operation": "equivalence_check", "level": level, "items": [editorial_item]}, key)
            correction = result["items"][0]
            if correction["approved"]:
                corrections[correction["slot"]] = correction
                break
            editorial_item = {
                **editorial_item,
                "japanese": correction["japanese"],
                "spanish": correction["spanish"],
                "accepted_alternatives_es": correction["accepted_alternatives_es"],
                "accepted_alternatives_ja": correction["accepted_alternatives_ja"],
            }
        else:
            raise RuntimeError(f"Equivalencia no aprobada en slot {source['slot']} tras tres correcciones: {'; '.join(correction['issues'])}")
    if set(corrections) != {item["slot"] for item in items}:
        raise RuntimeError("La comprobación de equivalencia perdió identidades de slot.")
    merged = []
    by_slot = {slot["slot"]: slot for slot in slots}
    for item in items:
        correction = corrections[item["slot"]]
        final = normalize_spacing({**item, "japanese": correction["japanese"], "spanish": correction["spanish"], "accepted_alternatives_es": correction["accepted_alternatives_es"], "accepted_alternatives_ja": correction["accepted_alternatives_ja"]})
        validate_slot(final, by_slot[item["slot"]])
        merged.append(final)
    return merged

def request_editorial(payload, key, retries=6):
    body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    for attempt in range(retries):
        request = urllib.request.Request(ENDPOINT, data=body, method="POST", headers={"Content-Type": "application/json", "Accept": "application/json", "Accept-Encoding": "identity", "Connection": "close", "X-Editorial-Key": key, "User-Agent": "JapoTeacher-Editorial/1.0"})
        try:
            with urllib.request.urlopen(request, timeout=180) as response:
                data = json.loads(response.read().decode("utf-8"))
            if "result" not in data:
                raise RuntimeError(data.get("error", "Respuesta editorial incompleta"))
            record_usage(payload, data)
            return data["result"]
        except urllib.error.HTTPError as error:
            try:
                detail = json.loads(error.read().decode("utf-8")).get("error", str(error))
            except (UnicodeDecodeError, json.JSONDecodeError):
                detail = str(error)
            if 400 <= error.code < 500:
                raise RuntimeError(f"El endpoint editorial respondió {error.code}: {detail}") from error
            if attempt == retries - 1:
                raise RuntimeError(f"El endpoint editorial respondió {error.code}: {detail}") from error
            time.sleep(2 ** attempt)
        except (urllib.error.URLError, http.client.RemoteDisconnected, ConnectionResetError, TimeoutError, RuntimeError):
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
            "jp_char_range": config["sentence_length_bands"][bands[index % len(bands)]]["jp_chars"],
            "es_word_range": config["sentence_length_bands"][bands[index % len(bands)]]["es_words"],
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

def review_until_approved(items, level, key, slots=None, operation="review"):
    current = items
    local_rejection = ""
    review_rejection = ""
    for review_round in range(3):
        result = request_editorial({"operation": operation, "level": level, "round": review_round + 1, "items": current, "mandatory_local_fixes": local_rejection}, key)
        reviewed = sorted(result["items"], key=lambda item: item["index"])
        current = [normalize_spacing(item["corrected"]) for item in reviewed]
        local_errors = []
        if slots:
            by_slot = {item.get("slot"): item for item in current}
            if set(by_slot) != {slot["slot"] for slot in slots}:
                local_errors.append("Se perdieron o duplicaron identidades de slot.")
            else:
                current = [by_slot[slot["slot"]] for slot in slots]
                for item, slot in zip(current, slots):
                    try:
                        validate_slot(item, slot)
                    except RuntimeError as error:
                        local_errors.append(str(error))
        if all(item["approved"] for item in reviewed) and not local_errors:
            return current, review_round + 1
        if any("kanji sin lectura" in error for error in local_errors):
            current = repair_kanji_readings(current, level, key)
            repaired_errors = []
            for item, slot in zip(current, slots):
                try:
                    validate_slot(item, slot)
                except RuntimeError as error:
                    repaired_errors.append(str(error))
            if all(item["approved"] for item in reviewed) and not repaired_errors:
                return current, review_round + 1
            local_errors = repaired_errors
        local_rejection = " | ".join(local_errors)
        review_rejection = " | ".join(issue for item in reviewed if not item["approved"] for issue in item.get("issues", []))
    reason = local_rejection or review_rejection or "el revisor no aprobó la versión corregida"
    raise RuntimeError(f"El grupo no superó tres revisiones: {reason}")

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
        last_rejection = ""
        for generation_attempt in range(1, 5):
            try:
                result = request_editorial({"operation": "generate", "level": level, "slots": slots, "avoid_japanese": list(known)[-200:], "previous_rejection": last_rejection}, key)
                final, rounds = review_until_approved(result["items"], level, key, slots)
                final = equivalence_check(final, level, key, slots)
                final_by_slot = {item.get("slot"): normalize_spacing(item) for item in final}
                if set(final_by_slot) != {slot["slot"] for slot in slots}:
                    raise RuntimeError("La revisión perdió o duplicó identidades de slot.")
                final = [final_by_slot[slot["slot"]] for slot in slots]
                for item, slot in zip(final, slots):
                    validate_slot(item, slot)
                signatures = [normalize_japanese(item["japanese"]) for item in final]
                if len(set(signatures)) != 5 or any(signature in known for signature in signatures):
                    raise RuntimeError("El grupo contiene una frase duplicada.")
                break
            except RuntimeError as error:
                last_rejection = str(error)
                if generation_attempt == 4:
                    raise RuntimeError(f"El lote se rechazó cuatro veces. Último motivo: {last_rejection}") from error
                print(json.dumps({"level": level, "group_offset": offset, "rejected_attempt": generation_attempt, "reason": last_rejection}, ensure_ascii=False), flush=True)
        for slot, item, signature in zip(slots, final, signatures):
            append_jsonl(output_path, {"level": level, "coverage_slot": slot, "review_rounds": rounds, "editorial_quality_version": 3, **item})
            known.add(signature)
        generated += 5
        print(json.dumps({"level": level, "approved_total": len(approved) + generated, "remaining_this_run": remaining - generated}, ensure_ascii=False), flush=True)

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("level", choices=["N5", "N4"])
    parser.add_argument("--limit", type=int)
    args = parser.parse_args()
    run(args.level, args.limit)
