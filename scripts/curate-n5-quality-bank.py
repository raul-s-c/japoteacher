import csv
import json
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
ATTEMPTED = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else None
if not ATTEMPTED or not ATTEMPTED.exists():
    raise SystemExit("Uso: python scripts/curate-n5-quality-bank.py <export-intentos.csv>")

with ATTEMPTED.open(encoding="utf-8-sig", newline="") as source:
    protected_pairs = {row["pair_key"].strip() for row in csv.DictReader(source) if row.get("pair_key")}

sentences = [
    ("毎朝、駅まで歩きます。", "Cada mañana voy andando hasta la estación.", "rutina|transporte", "desplazamiento", "made|polite_present", "まで", "describir_rutina", "presente"),
    ("今日は雨ですから、傘を持って行きます。", "Como hoy llueve, llevaré un paraguas.", "clima|vida_diaria", "salir_de_casa", "kara_reason", "から|を", "explicar_motivo", "presente"),
    ("冷蔵庫に卵が三つあります。", "Hay tres huevos en la nevera.", "comida|contadores", "cocina", "existence_aru|counter", "に|が", "indicar_existencia", "presente"),
    ("日曜日に家族と昼ご飯を作りました。", "El domingo preparé el almuerzo con mi familia.", "familia|comida", "casa", "polite_past", "に|と|を", "relatar_accion", "pasado"),
    ("この電車は東京駅に止まりますか。", "¿Este tren para en la estación de Tokio?", "viaje|transporte", "estacion", "question_ka|particle_ni", "は|に", "pedir_informacion", "presente"),
    ("図書館では静かにしてください。", "En la biblioteca, guarde silencio, por favor.", "lugares|normas", "biblioteca", "te_kudasai|adverb_ni", "では", "pedir_accion", "presente"),
    ("母の誕生日に花を買いました。", "Compré flores por el cumpleaños de mi madre.", "familia|compras", "regalo", "polite_past|no_possession", "の|に|を", "relatar_compra", "pasado"),
    ("すみません、水を一杯ください。", "Disculpe, un vaso de agua, por favor.", "comida|contadores", "restaurante", "request_kudasai|counter", "を", "pedir_bebida", "presente"),
    ("田中さんは今、電話で話しています。", "Tanaka está hablando por teléfono ahora.", "comunicacion|acciones", "telefono", "progressive_teiru", "は|で", "describir_accion", "progresivo"),
    ("明日の午後、病院へ行きます。", "Mañana por la tarde iré al hospital.", "salud|tiempo", "cita_medica", "movement_particles", "へ", "expresar_plan", "futuro"),
    ("私の部屋は二階にあります。", "Mi habitación está en la segunda planta.", "casa|ubicacion", "hogar", "existence_aru|no_possession", "の|は|に", "ubicar_lugar", "presente"),
    ("駅の近くに新しいパン屋があります。", "Hay una panadería nueva cerca de la estación.", "lugares|compras", "ciudad", "existence_aru|i_adjective", "の|に|が", "describir_lugar", "presente"),
    ("兄は料理が上手です。", "Mi hermano mayor cocina bien.", "familia|habilidades", "casa", "jouzu", "は|が", "expresar_habilidad", "presente"),
    ("このかばんは軽くて便利です。", "Este bolso es ligero y práctico.", "compras|adjetivos", "tienda", "adjective_te_form", "は", "describir_objeto", "presente"),
    ("昨日は忙しかったですから、早く寝ました。", "Como ayer estuve ocupado, me acosté temprano.", "rutina|tiempo", "casa", "kara_reason|i_adjective_past", "は|から", "explicar_motivo", "pasado"),
    ("日本語の宿題はもう終わりました。", "Ya he terminado los deberes de japonés.", "estudio|rutina", "casa", "mou|polite_past", "の|は", "informar_finalizacion", "pasado"),
    ("週末に一緒に映画を見ませんか。", "¿Quieres ver una película conmigo el fin de semana?", "ocio|amistad", "invitacion", "invitation_masenka", "に|と|を", "invitar", "futuro"),
    ("バスが来ませんから、駅まで歩きましょう。", "Como no viene el autobús, vayamos andando hasta la estación.", "transporte|planes", "parada_bus", "kara_reason|mashou", "が|から|まで", "proponer_accion", "futuro"),
    ("その赤いシャツを見せてください。", "Enséñeme esa camisa roja, por favor.", "compras|colores", "tienda", "te_kudasai|demonstrative_sono", "を", "pedir_objeto", "presente"),
    ("ここで写真を撮ってもいいですか。", "¿Puedo hacer una foto aquí?", "permiso|comunicacion", "lugar_publico", "te_mo_ii", "で|を", "pedir_permiso", "presente"),
    ("猫はテーブルの下で寝ています。", "El gato está durmiendo debajo de la mesa.", "animales|ubicacion", "casa", "progressive_teiru|location_words", "は|の|で", "describir_ubicacion", "progresivo"),
    ("コーヒーよりお茶のほうが好きです。", "Me gusta más el té que el café.", "comida|comparacion", "preferencias", "yori_hou_ga", "より|のほうが", "comparar_preferencia", "presente"),
    ("一週間に三回、スーパーへ行きます。", "Voy al supermercado tres veces por semana.", "rutina|frecuencia", "compras", "frequency|counter", "に|へ", "expresar_frecuencia", "presente"),
    ("父は毎晩、新聞を読みます。", "Mi padre lee el periódico todas las noches.", "familia|rutina", "casa", "polite_present|frequency", "は|を", "describir_rutina", "presente"),
    ("朝ご飯を食べてから、学校へ行きます。", "Después de desayunar, voy a la escuela.", "rutina|estudio", "mañana", "te_kara|movement_particles", "を|から|へ", "explicar_secuencia", "presente"),
]

full_path = ROOT / "data" / "exercises.full.csv"
with full_path.open(encoding="utf-8-sig", newline="") as source:
    reader = csv.DictReader(source)
    headers = reader.fieldnames
    rows = list(reader)
with (ROOT / "data" / "exercises.expansion-n5-500.csv").open(encoding="utf-8-sig", newline="") as source:
    mechanical_rows = list(csv.DictReader(source))
known_ids = {row["exercise_id"] for row in rows}
rows.extend(row for row in mechanical_rows if row["exercise_id"] not in known_ids)

kept = []
archived = 0
archived_unattempted = 0
for row in rows:
    match = re.match(r"^(?:JAES|ESJA)-(N5-MORE-\d+)$", row["exercise_id"])
    if not match:
        if "-N5-CURATED-" not in row["exercise_id"]:
            kept.append(row)
        continue
    row["active"] = "false"
    row["pedagogical_notes"] = "Archivado para conservar el historial; no volver a programar."
    kept.append(row)
    if match.group(1) in protected_pairs:
        archived += 1
    else:
        archived_unattempted += 1

new_rows = []
for number, (ja, es, topics, situation, grammar, particles, function, tense) in enumerate(sentences, 1):
    suffix = f"{number:04d}"
    for direction in ("ja_es", "es_ja"):
        ja_es = direction == "ja_es"
        values = {
            "exercise_id": f"{'JAES' if ja_es else 'ESJA'}-N5-CURATED-{suffix}",
            "source_language": "ja" if ja_es else "es",
            "target_language": "es" if ja_es else "ja",
            "direction": direction,
            "source_text": ja if ja_es else es,
            "reference_translation": es if ja_es else ja,
            "accepted_alternatives_json": "[]",
            "jlpt_level": "N5",
            "difficulty": str(2 + (number % 3)),
            "topic_tags": topics,
            "situation_tags": situation,
            "grammar_tags": grammar,
            "particle_tags": particles,
            "vocabulary_tags": "",
            "kanji_tags": "",
            "verb_tags": "",
            "adjective_tags": "",
            "counter_tags": "",
            "register": "cortés",
            "communicative_function": function,
            "tense_aspect": tense,
            "polarity": "afirmativa",
            "sentence_type": "interrogativa" if ja.endswith("か。") or ja.endswith("ませんか。") else "declarativa",
            "pedagogical_notes": "Frase N5 redactada y revisada individualmente por coherencia y naturalidad.",
            "ambiguity_notes": "",
            "core_exercise": "true" if number <= 10 else "false",
            "active": "true",
            "dataset_version": "4.0",
        }
        new_rows.append({header: values.get(header, "") for header in headers})

final_rows = kept + new_rows
with full_path.open("w", encoding="utf-8", newline="") as target:
    writer = csv.DictWriter(target, fieldnames=headers, lineterminator="\n")
    writer.writeheader()
    writer.writerows(final_rows)

curated_path = ROOT / "data" / "exercises.curated-n5-50.csv"
with curated_path.open("w", encoding="utf-8", newline="") as target:
    writer = csv.DictWriter(target, fieldnames=headers, lineterminator="\n")
    writer.writeheader()
    writer.writerows(new_rows)

print(json.dumps({
    "protected_pair_keys": len(protected_pairs),
    "archived_exercises": archived,
    "archived_unattempted_mechanical_exercises": archived_unattempted,
    "new_curated_exercises": len(new_rows),
    "final_bank_rows": len(final_rows),
}, ensure_ascii=False))
