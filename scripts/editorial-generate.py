import argparse
import csv
import datetime
import http.client
import json
import os
import pathlib
import re
import sys
import time
import zipfile
import urllib.error
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parents[1]
POLICY = json.loads((ROOT / "data" / "jlpt-content-policy.json").read_text(encoding="utf-8"))
ENDPOINT = "https://japoteacher-ai.raul-nihongo.workers.dev/editorial/generate"
MAX_GENERATION_ATTEMPTS = 5
UNSUITABLE_N5_COVERAGE_WORDS = {"場合", "可能", "バック"}
N5_BRIDGE_PATTERN = re.compile(r"(?:ので|のに|たら|なら|(?:れ|け|え)ば|ように|そうだ|と思|と言|かもしれ|でしょう|つもり|予定|こと[がに]|なければ|なくても|てしま|てお[くき]|てみ[るま]|て(?:あげ|くれ|もら)|ために|しか.+ない|すぎ[るま]|はず|かどうか|について|によると|に見え|とともに|共に|として|場合|可能|学べ)")

# Windows PowerShell can default to cp1252, which cannot print Japanese
# rejection diagnostics and should never abort a resumable editorial run.
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="backslashreplace")

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

def recorded_total_usage():
    path = ROOT / "data" / "editorial" / "usage.jsonl"
    if not path.exists():
        return 0
    total = 0
    for line in path.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        usage = json.loads(line).get("usage", {})
        total += usage.get("total_tokens", usage.get("input_tokens", 0) + usage.get("output_tokens", 0))
    return total

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
        item[field] = [value for value in item[field] if value not in {"grammar_focus", "topic_primary", "required_distinction", "N5", "N4", "N3", "N2", "N1"}]
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

def mark_bridge_level(item, slot):
    item = dict(item)
    if slot.get("level") == "N5" and N5_BRIDGE_PATTERN.search(item.get("japanese", "")):
        bridge_tags = list(dict.fromkeys([*item.get("bridge_tags", []), "n5_to_n4_bridge"]))
        item["bridge_tags"] = bridge_tags
        item["difficulty_bridge"] = "N5_to_N4"
        note = "Elemento puente: vocabulario objetivo N5 con una construcción que puede acercarse a N4."
        item["difficulty_rationale"] = " ".join(part for part in [item.get("difficulty_rationale", ""), note] if part).strip()
    return item

def validate_slot(item, slot):
    errors = []
    if item.get("slot") != slot["slot"]: errors.append("slot alterado")
    if item.get("topic_primary") != slot["topic_primary"]: errors.append("tema primario alterado")
    if not all(grammar_focus_present(focus, item.get("grammar_tags", []), item.get("japanese", "")) for focus in slot["grammar_focus"]): errors.append("foco gramatical ausente")
    jp_chars = len(normalize_japanese(item.get("japanese", "")))
    jp_min, jp_max = max(1, int(slot["jp_char_range"][0] * 0.8)), slot["jp_char_range"][1] + 4
    if slot.get("target_vocabulary"):
        jp_min = min(jp_min, 5)
    if not jp_min <= jp_chars <= jp_max: errors.append(f"longitud japonesa {jp_chars}")
    es_words = len(re.findall(r"\b[\wÁÉÍÓÚÜÑáéíóúüñ]+\b", item.get("spanish", "")))
    es_min, es_max = max(1, int(slot["es_word_range"][0] * 0.75)), slot["es_word_range"][1] + 2
    if slot.get("target_vocabulary"):
        es_min = min(es_min, 2)
    if not es_min <= es_words <= es_max: errors.append(f"longitud española {es_words}")
    if re.search(r"(?:です|ます|ません|ました)[。！？]?$", item.get("japanese", "")) and item.get("register") != "cortés": errors.append("registro cortés mal etiquetado")
    covered = "".join(reading.get("characters", "") for reading in item.get("kanji_readings", []))
    missing_kanji = sorted({character for character in item.get("japanese", "") if is_kanji(character) and character not in covered})
    if missing_kanji: errors.append(f"kanji sin lectura {''.join(missing_kanji)}")
    for target in slot.get("target_vocabulary", []):
        word = target.get("word", "")
        reading = target.get("reading", "")
        if word and word not in item.get("japanese", "") and (not reading or reading not in item.get("japanese", "")):
            errors.append(f"vocabulario objetivo ausente {word}")
    for target in slot.get("target_kanji", []):
        kanji = target.get("kanji", "")
        if kanji and kanji not in item.get("japanese", ""):
            errors.append(f"kanji objetivo ausente {kanji}")
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
        final = mark_bridge_level(normalize_spacing({**item, "japanese": correction["japanese"], "spanish": correction["spanish"], "accepted_alternatives_es": correction["accepted_alternatives_es"], "accepted_alternatives_ja": correction["accepted_alternatives_ja"]}), by_slot[item["slot"]])
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
            transient_client_errors = {401, 403, 408, 409, 425, 429}
            if 400 <= error.code < 500 and error.code not in transient_client_errors:
                raise RuntimeError(f"El endpoint editorial respondió {error.code}: {detail}") from error
            if attempt == retries - 1:
                raise RuntimeError(f"El endpoint editorial respondió {error.code}: {detail}") from error
            time.sleep(2 ** attempt)
        except (urllib.error.URLError, http.client.RemoteDisconnected, ConnectionResetError, TimeoutError, RuntimeError) as error:
            if attempt == retries - 1:
                raise RuntimeError(f"La llamada editorial falló tras {retries} intentos: {error}") from error
            time.sleep(2 ** attempt)

def active_pairs(level):
    rows = list(csv.DictReader((ROOT / "data" / "exercises.full.csv").open(encoding="utf-8-sig", newline="")))
    return [row for row in rows if row["active"].lower() == "true" and row["jlpt_level"] == level and row["direction"] == "ja_es"]

def existing_pairs(level):
    return [row for row in active_pairs(level) if "-EDITORIAL-" not in row["exercise_id"]]

def make_slots(level, start, count, topics_override=None):
    config = POLICY["levels"][level]
    topics = topics_override or POLICY["topics"]
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

def load_usage_rows(zip_path, name):
    with zipfile.ZipFile(zip_path) as archive:
        text = archive.read(name).decode("utf-8-sig")
    return list(csv.DictReader(text.splitlines()))

def usage_reference(zip_path, level):
    return {
        "vocabulary": [row for row in load_usage_rows(zip_path, "vocabulary_10000_v2.csv") if row.get("Simulated_JLPT") == level],
        "kanji": [row for row in load_usage_rows(zip_path, "kanji_2000_v2.csv") if row.get("Simulated_JLPT") == level],
        "grammar": [row for row in load_usage_rows(zip_path, "grammar_750_v2.csv") if row.get("Simulated_JLPT") == level],
    }

def all_japanese_texts(level, approved):
    texts = [row["source_text"] for row in active_pairs(level)]
    texts.extend(item.get("japanese", "") for item in approved)
    return "\n".join(texts)

def coverage_counts(reference, level, approved):
    text = all_japanese_texts(level, approved)
    vocabulary = {}
    for row in reference["vocabulary"]:
        word, reading = row.get("Word", ""), row.get("Reading", "")
        count = text.count(word)
        if reading and reading != word:
            count = max(count, text.count(reading))
        vocabulary[row["Word_ID"]] = count
    kanji = {row["Kanji_ID"]: text.count(row.get("Kanji", "")) for row in reference["kanji"]}
    grammar = {}
    for row in reference["grammar"]:
        form = row.get("Matched_Form") or row.get("Pattern") or ""
        grammar[row["Grammar_ID"]] = text.count(form) if form and len(form) <= 8 else 0
    return {"vocabulary": vocabulary, "kanji": kanji, "grammar": grammar}

def sorted_debt(rows, counts, id_field, min_uses):
    def rank(row):
        raw = row.get("Study_Rank") or row.get("Usage_Rank") or row.get("Usage_Proxy_Rank") or 999999
        try:
            order = float(raw)
        except ValueError:
            order = 999999
        return (counts.get(row[id_field], 0), order)
    return sorted([row for row in rows if counts.get(row[id_field], 0) < min_uses], key=rank)

def inferred_topic(target_vocab, fallback):
    if not target_vocab:
        return fallback
    haystack = " ".join((item.get("word", "") + " " + item.get("meaning_en", "")).lower() for item in target_vocab)
    rules = [
        ("tecnologia", ["link", "page", "technology", "site", "internet", "投稿", "リンク", "ページ", "技術"]),
        ("trabajo", ["work", "job", "enterprise", "business", "company", "office", "企業", "仕事", "業"]),
        ("sociedad", ["government", "society", "country", "china", "economics", "politics", "social", "organization", "policy", "responsibility", "duty", "judgement", "judgment", "effect", "政府", "社会", "中国", "経済", "個人", "組織", "政策", "責任", "判断", "効果"]),
        ("compras", ["money", "price", "buy", "shop", "sale", "お金", "価格", "買"]),
        ("familia", ["family", "child", "human", "person", "子供", "家族", "人間"]),
        ("estudio", ["study", "training", "education", "article", "subject", "教育", "記事", "内容"]),
        ("viajes", ["travel", "station", "country", "世界", "駅"]),
        ("vida_diaria", ["life", "living", "activity", "use", "生活", "活動", "利用"]),
    ]
    for topic, needles in rules:
        if any(needle.lower() in haystack for needle in needles):
            return topic
    return fallback if fallback in POLICY["topics"] else "vida_diaria"

def make_usage_coverage_slots(level, start, count, topics_override, reference, counts, min_uses, vocab_per_slot=1, require_grammar=False):
    slots = make_slots(level, start, count, topics_override)
    vocab_debt = sorted_debt(reference["vocabulary"], counts["vocabulary"], "Word_ID", min_uses)
    kanji_debt = sorted_debt(reference["kanji"], counts["kanji"], "Kanji_ID", min_uses)
    grammar_debt = sorted_debt(reference["grammar"], counts["grammar"], "Grammar_ID", min_uses)
    vocab_index = kanji_index = grammar_index = 0
    for slot in slots:
        target_vocab = []
        while vocab_index < len(vocab_debt) and len(target_vocab) < vocab_per_slot:
            row = vocab_debt[vocab_index]
            vocab_index += 1
            word = row.get("Word", "")
            if row.get("Script_Type") not in {"kanji", "katakana"}:
                continue
            if level == "N5" and word in UNSUITABLE_N5_COVERAGE_WORDS:
                continue
            if len(word) < 2:
                continue
            target_vocab.append({
                "id": row["Word_ID"],
                "word": word,
                "reading": row.get("Reading", ""),
                "meaning_en": row.get("Meaning_EN", ""),
                "usage_score": row.get("Usage_Score_100", ""),
                "current_uses": counts["vocabulary"].get(row["Word_ID"], 0),
            })
        target_kanji = []
        wanted = "".join(item.get("word", "") + item.get("reading", "") for item in target_vocab)
        while kanji_index < len(kanji_debt) and len(target_kanji) < 1:
            row = kanji_debt[kanji_index]
            kanji_index += 1
            kanji = row.get("Kanji", "")
            if not kanji:
                continue
            if target_vocab and kanji not in wanted:
                continue
            target_kanji.append({
                "id": row["Kanji_ID"],
                "kanji": kanji,
                "meaning_en": row.get("Meaning_EN", ""),
                "readings_romaji": row.get("Readings_Romaji", ""),
                "current_uses": counts["kanji"].get(row["Kanji_ID"], 0),
            })
        target_grammar = []
        if require_grammar and not target_vocab and grammar_index < len(grammar_debt):
            row = grammar_debt[grammar_index]
            grammar_index += 1
            target_grammar.append({
                "id": row["Grammar_ID"],
                "pattern": row.get("Pattern", ""),
                "matched_form": row.get("Matched_Form", ""),
                "meaning_en": row.get("Meaning_EN", ""),
                "current_uses": counts["grammar"].get(row["Grammar_ID"], 0),
            })
        slot["target_vocabulary"] = target_vocab
        slot["target_kanji"] = target_kanji
        slot["target_grammar"] = target_grammar
        if target_vocab:
            slot["grammar_focus"] = []
            slot["topic_primary"] = inferred_topic(target_vocab, slot.get("topic_primary", "vida_diaria"))
            slot["topic_secondary_allowed"] = ""
        slot["required_distinction"] = "Cubre target_vocabulary y target_kanji de forma natural. Si hay target_grammar, cubre también ese patrón. En ES-JP, el español debe obligar a producir esos elementos japoneses. Evita hospitales, colegios y profesores salvo que el objetivo lo exija."
    return slots

def read_jsonl(path):
    if not path.exists():
        return []
    return [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]

def read_json(path):
    if not path.exists():
        return None
    return json.loads(path.read_text(encoding="utf-8"))

def write_json(path, payload):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

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
        if slots:
            # The slot taxonomy is selected by the bank planner. Models sometimes
            # rename an equivalent subtopic (for example, ahorro/inversiones),
            # which must not break family coverage or retry the same pair forever.
            by_slot = {slot["slot"]: slot for slot in slots}
            current = [{**item, "topic_primary": by_slot.get(item.get("slot"), {}).get("topic_primary", item.get("topic_primary", ""))} for item in current]
        local_errors = []
        if slots:
            by_slot = {item.get("slot"): item for item in current}
            if set(by_slot) != {slot["slot"] for slot in slots}:
                local_errors.append("Se perdieron o duplicaron identidades de slot.")
            else:
                current = [mark_bridge_level(by_slot[slot["slot"]], slot) for slot in slots]
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

def run(level, limit=None, usage_baseline=None, token_budget=None, append=None, topics_override=None, usage_reference_zip=None, coverage_min=2, group_size=1, quality_mode="balanced", vocab_per_slot=1, require_grammar=False):
    key = os.environ.get("JAPOTEACHER_EDITORIAL_KEY", "")
    if not key:
        raise SystemExit("Falta JAPOTEACHER_EDITORIAL_KEY en el entorno.")
    config = POLICY["levels"][level]
    existing = existing_pairs(level)
    output_path = ROOT / "data" / "editorial" / f"{level.lower()}-approved.jsonl"
    rejected_path = ROOT / "data" / "editorial" / f"{level.lower()}-rejected-slots.jsonl"
    state_path = ROOT / "data" / "editorial" / f"{level.lower()}-generation-state.json"
    approved = read_jsonl(output_path)
    reference = usage_reference(usage_reference_zip, level) if usage_reference_zip else None
    counts = coverage_counts(reference, level, approved) if reference else None
    remaining = append if append is not None else max(0, config["target_pairs"] - len(existing) - len(approved))
    if limit is not None:
        remaining = min(remaining, limit)
    known = {normalize_japanese(row["source_text"]) for row in active_pairs(level)} | {normalize_japanese(item["japanese"]) for item in approved}
    rejected_slots = {item["slot"] for item in read_jsonl(rejected_path)}
    used_slots = {item["slot"] for item in approved} | rejected_slots
    state = read_json(state_path) or {}
    state_slot = state.get("slot")
    state_attempts = int(state.get("attempts", 0) or 0)
    if state_slot is not None and state_attempts >= MAX_GENERATION_ATTEMPTS and state_slot not in rejected_slots:
        slot = make_slots(level, state_slot - 1, 1, topics_override)[0]
        append_jsonl(rejected_path, {"level": level, "slot": state_slot, "coverage_slot": slot, "reason": state.get("last_reason", "Slot agotado por reintentos acumulados.")})
        rejected_slots.add(state_slot)
        used_slots.add(state_slot)
        state = {}
        if state_path.exists():
            state_path.unlink()
    generated = 0
    while generated < remaining:
        if usage_baseline is not None and token_budget is not None:
            spent = recorded_total_usage() - usage_baseline
            if spent >= token_budget:
                print(json.dumps({"token_budget_reached": True, "usage_baseline": usage_baseline, "spent": spent, "budget": token_budget}, ensure_ascii=False), flush=True)
                break
        group_size = max(1, min(4, group_size, remaining - generated))
        next_slot = max([len(existing), *used_slots], default=0) + 1
        if state.get("slot") and 0 < int(state.get("attempts", 0) or 0) < MAX_GENERATION_ATTEMPTS:
            next_slot = max(next_slot, int(state["slot"]))
        offset = next_slot - 1
        slots = make_usage_coverage_slots(level, offset, group_size, topics_override, reference, counts, coverage_min, vocab_per_slot, require_grammar) if reference else make_slots(level, offset, group_size, topics_override)
        current_attempts = int(state.get("attempts", 0) or 0) if state.get("slot") == slots[0]["slot"] else 0
        last_rejection = state.get("last_reason", "") if current_attempts else ""
        # Difficult coverage slots may need constrained rewrites to meet both
        # grammar and uniqueness gates without accepting a weak fallback.
        final = None
        for generation_attempt in range(current_attempts + 1, MAX_GENERATION_ATTEMPTS + 1):
            try:
                result = request_editorial({"operation": "generate", "level": level, "slots": slots, "avoid_japanese": list(known)[-200:], "previous_rejection": last_rejection}, key)
                final, rounds = review_until_approved(result["items"], level, key, slots)
                if quality_mode == "strict":
                    final = equivalence_check(final, level, key, slots)
                final_by_slot = {item.get("slot"): normalize_spacing(item) for item in final}
                if set(final_by_slot) != {slot["slot"] for slot in slots}:
                    raise RuntimeError("La revisión perdió o duplicó identidades de slot.")
                final = [mark_bridge_level(final_by_slot[slot["slot"]], slot) for slot in slots]
                for item, slot in zip(final, slots):
                    validate_slot(item, slot)
                signatures = [normalize_japanese(item["japanese"]) for item in final]
                duplicates = [item["japanese"] for item, signature in zip(final, signatures) if signature in known]
                if len(set(signatures)) != group_size:
                    raise RuntimeError("El grupo contiene frases duplicadas entre sí.")
                if duplicates:
                    raise RuntimeError(f"La frase propuesta ya existe en el banco y debe reescribirse: {duplicates[0]}")
                state = {}
                if state_path.exists():
                    state_path.unlink()
                break
            except RuntimeError as error:
                last_rejection = str(error)
                state = {"slot": slots[0]["slot"], "attempts": generation_attempt, "last_reason": last_rejection, "updated_at": datetime.datetime.now(datetime.timezone.utc).isoformat()}
                write_json(state_path, state)
                if generation_attempt == MAX_GENERATION_ATTEMPTS:
                    append_jsonl(rejected_path, {"level": level, "slot": slots[0]["slot"], "coverage_slot": slots[0], "reason": last_rejection})
                    used_slots.add(slots[0]["slot"])
                    state = {}
                    if state_path.exists():
                        state_path.unlink()
                    print(json.dumps({"level": level, "skipped_slot": slots[0]["slot"], "reason": last_rejection}, ensure_ascii=False), flush=True)
                    break
                print(json.dumps({"level": level, "group_offset": offset, "rejected_attempt": generation_attempt, "reason": last_rejection}, ensure_ascii=False), flush=True)
        if final is None:
            continue
        for slot, item, signature in zip(slots, final, signatures):
            append_jsonl(output_path, {"level": level, "coverage_slot": slot, "review_rounds": rounds, "editorial_quality_version": 4, **item})
            known.add(signature)
            used_slots.add(item["slot"])
            if reference:
                for target in slot.get("target_vocabulary", []):
                    counts["vocabulary"][target["id"]] = counts["vocabulary"].get(target["id"], 0) + 1
                for target in slot.get("target_kanji", []):
                    counts["kanji"][target["id"]] = counts["kanji"].get(target["id"], 0) + 1
                for target in slot.get("target_grammar", []):
                    counts["grammar"][target["id"]] = counts["grammar"].get(target["id"], 0) + 1
        generated += group_size
        print(json.dumps({"level": level, "approved_total": len(approved) + generated, "remaining_this_run": remaining - generated, "coverage_targets": slots[0] if reference else None}, ensure_ascii=False), flush=True)

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("level", choices=["N5", "N4"])
    parser.add_argument("--limit", type=int)
    parser.add_argument("--usage-baseline", type=int)
    parser.add_argument("--token-budget", type=int)
    parser.add_argument("--append", type=int, help="Añade pares aunque se haya alcanzado el objetivo base del nivel.")
    parser.add_argument("--topics", help="Temas primarios separados por comas para cubrir un hueco editorial concreto.")
    parser.add_argument("--usage-reference-zip", help="ZIP con vocabulary_10000_v2.csv, kanji_2000_v2.csv y grammar_750_v2.csv para generar por deuda de cobertura.")
    parser.add_argument("--coverage-min", type=int, default=2, help="Usos mínimos por vocabulario/kanji antes de considerar cubierta la referencia.")
    parser.add_argument("--group-size", type=int, default=1, help="Slots por llamada editorial. 2-4 reduce coste por frase, pero puede aumentar rechazos si los objetivos son difíciles.")
    parser.add_argument("--quality-mode", choices=["balanced", "strict"], default="balanced", help="balanced omite equivalencia final IA tras revisión aprobada; strict la conserva.")
    parser.add_argument("--vocab-per-slot", type=int, default=1, help="Número de vocabularios objetivo por slot.")
    parser.add_argument("--require-grammar", action="store_true", help="Fuerza cobertura gramatical además de vocabulario solo cuando no hay objetivo léxico.")
    args = parser.parse_args()
    topics = [topic.strip() for topic in (args.topics or "").split(",") if topic.strip()]
    run(args.level, args.limit, args.usage_baseline, args.token_budget, args.append, topics or None, args.usage_reference_zip, args.coverage_min, args.group_size, args.quality_mode, args.vocab_per_slot, args.require_grammar)
