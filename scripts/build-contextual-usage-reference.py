#!/usr/bin/env python3
"""Build a contextual vocabulary ranking from web, dialogue and bank breadth."""

import argparse
import csv
import hashlib
import json
import math
import os
import re
import zipfile
from collections import Counter, defaultdict
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_ZIP = Path.home() / "Downloads" / "japanese_usage_progress_v2_csv.zip"
DEFAULT_CONVERSATION = Path(os.environ.get("TEMP", ".")) / "japoteacher-opensubtitles-ja.txt"
DEFAULT_CONCEPTS = ROOT / "data" / "reference" / "semantic-concepts.json"
DEFAULT_OUTPUT = ROOT / "data" / "reference" / "vocabulary-context-v1.csv"
CSV_PATH = ROOT / "data" / "exercises.full.csv"
FAMILIES = (
    "Familia y amigos",
    "Trabajo y carrera",
    "Dinero y proyectos",
    "Ocio y vida diaria",
    "Conocimiento y consultas",
)
FAMILY_TERMS = (
    (FAMILIES[0], ("familia", "madre", "padre", "hijo", "hermano", "abuelo", "amigo", "pareja", "persona")),
    (FAMILIES[1], ("trabajo", "oficina", "carrera", "profesion", "salario", "entrevista", "reunion", "cliente", "empresa", "empleo", "estudio", "clase", "profesor")),
    (FAMILIES[2], ("dinero", "precio", "pago", "inversion", "ahorro", "banco", "billete", "moneda", "negocio", "comercio", "tienda")),
    (FAMILIES[3], ("ocio", "vida diaria", "casa", "hogar", "cocina", "comida", "viaje", "futbol", "deporte", "coche", "cine", "transporte", "ropa")),
)


def normalize(value):
    return re.sub(r"\s+", " ", str(value or "").strip().lower())


def level_for(percentile):
    if percentile < 10:
        return "N5"
    if percentile < 30:
        return "N4"
    if percentile < 60:
        return "N3"
    if percentile < 90:
        return "N2"
    return "N1"


def read_vocabulary(path):
    with zipfile.ZipFile(path) as archive:
        return list(csv.DictReader(archive.read("vocabulary_10000_v2.csv").decode("utf-8-sig").splitlines()))


def read_conversation(path):
    counts = {}
    with path.open(encoding="utf-8") as source:
        for line in source:
            parts = line.rstrip().rsplit(" ", 1)
            if len(parts) != 2:
                continue
            try:
                counts[parts[0]] = int(parts[1])
            except ValueError:
                continue
    return counts


def concept_index(vocabulary, path):
    payload = json.loads(path.read_text(encoding="utf-8"))
    configured = {}
    metadata = {}
    for concept in payload.get("concepts", []):
        metadata[concept["id"]] = concept
        for term in concept.get("terms", []):
            configured[term] = concept["id"]
    by_reading = defaultdict(list)
    for row in vocabulary:
        by_reading[(normalize(row.get("Reading")), normalize(row.get("Meaning_EN")))].append(row)
    automatic = {}
    for (reading, meaning), rows in by_reading.items():
        if reading and meaning and len(rows) > 1:
            concept_id = "form." + hashlib.sha1(f"{reading}|{meaning}".encode("utf-8")).hexdigest()[:12]
            metadata[concept_id] = {"id": concept_id, "label_es": rows[0].get("Meaning_EN", ""), "source": "same_reading_and_gloss"}
            for row in rows:
                automatic[row["Word"]] = concept_id
    output = {}
    for row in vocabulary:
        word_id, term = row["Word_ID"], row["Word"]
        output[word_id] = configured.get(term) or automatic.get(term) or f"lexeme.{word_id}"
        metadata.setdefault(output[word_id], {"id": output[word_id], "label_es": row.get("Meaning_EN", ""), "source": "single_lexeme"})
    return output, metadata


def family_for(row):
    topics = normalize(row.get("topic_tags", "")).replace("_", " ")
    for family, terms in FAMILY_TERMS:
        if any(term in topics for term in terms):
            return family
    return FAMILIES[-1]


def bank_contexts(vocabulary, concepts, csv_path):
    rows = list(csv.DictReader(csv_path.open(encoding="utf-8-sig", newline="")))
    unique = {}
    for row in rows:
        if normalize(row.get("active")) != "true":
            continue
        japanese = row.get("source_text", "") if row.get("direction") == "ja_es" else row.get("reference_translation", "")
        unique.setdefault(re.sub(r"[\s。、！？,.!?]", "", japanese), (japanese, family_for(row)))
    result = defaultdict(Counter)
    candidates = sorted(vocabulary, key=lambda row: len(row.get("Word", "")), reverse=True)
    for japanese, family in unique.values():
        occupied = set()
        for row in candidates:
            term = row.get("Word", "")
            if not term:
                continue
            start = japanese.find(term)
            if start < 0:
                continue
            positions = set(range(start, start + len(term)))
            if positions & occupied:
                continue
            occupied.update(positions)
            result[concepts[row["Word_ID"]]][family] += 1
    return result


def entropy_score(counts):
    total = sum(counts.values())
    if total < 3:
        return 0.5
    values = [count / total for count in counts.values() if count]
    entropy = -sum(value * math.log(value) for value in values) / math.log(len(FAMILIES))
    breadth = min(1, len(values) / 3)
    return 0.7 * entropy + 0.3 * breadth


def build(zip_path, conversation_path, concepts_path, bank_path, output_path):
    vocabulary = read_vocabulary(zip_path)
    conversation = read_conversation(conversation_path)
    concepts, metadata = concept_index(vocabulary, concepts_path)
    members = defaultdict(list)
    for row in vocabulary:
        members[concepts[row["Word_ID"]]].append(row)
    contexts = bank_contexts(vocabulary, concepts, bank_path)
    concept_rows = []
    for concept_id, rows in members.items():
        web_frequency = sum(float(row.get("Frequency") or 0) for row in rows)
        dialogue_count = sum(conversation.get(row.get("Word", ""), 0) for row in rows)
        concept_rows.append({"id": concept_id, "web_frequency": web_frequency, "dialogue_count": dialogue_count, "context_score": entropy_score(contexts[concept_id])})
    max_web = max(item["web_frequency"] for item in concept_rows)
    max_dialogue = max(item["dialogue_count"] for item in concept_rows)
    for item in concept_rows:
        web = math.log1p(item["web_frequency"]) / math.log1p(max_web)
        direct_dialogue = item["dialogue_count"] > 0
        # OpenSubtitles is tokenized by surface form and misses some extremely
        # common lemmas (for example 私). Absence is not evidence of zero use.
        # Use a conservative web prior and expose that it was inferred.
        dialogue = math.log1p(item["dialogue_count"]) / math.log1p(max_dialogue) if direct_dialogue else web * 0.85
        dispersion = math.sqrt(web * dialogue)
        item.update(web_score=web, dialogue_score=dialogue, dialogue_evidence="direct" if direct_dialogue else "web_prior", register_dispersion=dispersion)
        item["composite_score"] = 0.30 * web + 0.45 * dialogue + 0.15 * dispersion + 0.10 * item["context_score"]
    ranked = sorted(concept_rows, key=lambda item: (-item["composite_score"], item["id"]))
    total = len(ranked)
    by_id = {}
    for rank, item in enumerate(ranked, 1):
        item["rank"] = rank
        item["percentile"] = round(100 * (rank - 1) / max(1, total), 2)
        by_id[item["id"]] = item
    fields = ["Word_ID", "Word", "Reading", "Meaning_EN", "Concept_ID", "Concept_Label", "Concept_Members", "Web_Rank", "Web_Percentile", "Dialogue_Count", "Dialogue_Score", "Dialogue_Evidence", "Context_Families", "Context_Dispersion", "Register_Dispersion", "Composite_Score", "Composite_Rank", "Composite_Percentile", "Composite_JLPT"]
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("w", encoding="utf-8-sig", newline="") as target:
        writer = csv.DictWriter(target, fieldnames=fields)
        writer.writeheader()
        for row in vocabulary:
            concept_id = concepts[row["Word_ID"]]
            item = by_id[concept_id]
            concept_members = [member["Word"] for member in members[concept_id]]
            web_rank = int(float(row.get("Study_Rank") or 0))
            writer.writerow({
                "Word_ID": row["Word_ID"], "Word": row["Word"], "Reading": row["Reading"], "Meaning_EN": row["Meaning_EN"],
                "Concept_ID": concept_id, "Concept_Label": metadata[concept_id].get("label_es", row["Meaning_EN"]), "Concept_Members": "|".join(concept_members),
                "Web_Rank": web_rank, "Web_Percentile": round(100 * (web_rank - 1) / len(vocabulary), 2), "Dialogue_Count": item["dialogue_count"],
                "Dialogue_Score": round(item["dialogue_score"] * 100, 2), "Dialogue_Evidence": item["dialogue_evidence"], "Context_Families": "|".join(contexts[concept_id].keys()),
                "Context_Dispersion": round(item["context_score"] * 100, 2), "Register_Dispersion": round(item["register_dispersion"] * 100, 2),
                "Composite_Score": round(item["composite_score"] * 100, 4), "Composite_Rank": item["rank"], "Composite_Percentile": item["percentile"], "Composite_JLPT": level_for(item["percentile"]),
            })
    return {"words": len(vocabulary), "concepts": total, "output": str(output_path), "grouped_words": sum(len(rows) for rows in members.values() if len(rows) > 1), "grouped_concepts": sum(len(rows) > 1 for rows in members.values())}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--zip", default=str(DEFAULT_ZIP))
    parser.add_argument("--conversation", default=str(DEFAULT_CONVERSATION))
    parser.add_argument("--concepts", default=str(DEFAULT_CONCEPTS))
    parser.add_argument("--bank", default=str(CSV_PATH))
    parser.add_argument("--output", default=str(DEFAULT_OUTPUT))
    args = parser.parse_args()
    print(json.dumps(build(Path(args.zip), Path(args.conversation), Path(args.concepts), Path(args.bank), Path(args.output)), ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
