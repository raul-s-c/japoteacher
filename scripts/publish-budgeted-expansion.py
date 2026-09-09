"""Publish only this run's approved pairs; preserve every previous bank row."""
import csv, html, importlib.util, json, os, pathlib, sys, tempfile, time, unicodedata

ROOT=pathlib.Path(__file__).resolve().parents[1]
def load(name,file):
    spec=importlib.util.spec_from_file_location(name,ROOT/'scripts'/file)
    module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module);return module

def main():
    prior=json.loads((ROOT/'data/editorial/run-2026-09-08-2.3m.json').read_text())
    ledger=json.loads((ROOT/'data/editorial/run-2026-09-09-2m.json').read_text())
    if not ledger.get('closed') or ledger.get('paused_by_user'):raise SystemExit('Complete the generation and final review before publishing')
    generator=load('generator','editorial-generate.py')
    normalize=lambda value:generator.normalize_japanese(unicodedata.normalize('NFKC',value))
    publisher=load('publisher','publish-editorial-bank.py')
    classifier=load('classifier','usage-classification.py')
    bank=ROOT/'data/exercises.full.csv'
    with bank.open(encoding='utf-8-sig',newline='') as stream:
        reader=csv.DictReader(stream);fields=reader.fieldnames;old=list(reader)
    known={normalize(r['source_text']) for r in old if r['direction']=='ja_es'}
    collection=json.loads((ROOT/'data/collections/sakamoto.json').read_text(encoding='utf-8'))
    known.update(normalize(r['source_text']) for r in collection['exercises'] if r['direction']=='ja_es')
    existing_ids={r['exercise_id'] for r in old}
    review_cursor=json.loads((ROOT/'data/editorial/review-cursor-2026-09-09.json').read_text(encoding='utf-8-sig'))
    accepted={};excluded=[]
    manual={
        ('N5',1408):'El contraste con lo peor carece de referente y contexto suficiente.',
        ('N5',1400):'家庭で resulta poco natural para expresar estudiar en casa en este ejemplo.',
        ('N5',1095):'Pregunta poco natural sobre disponibilidad de medicamentos.',
        ('N5',1098):'La traducción omite la relación causal explícita de から.',
        ('N5',1100):'Registro arcaico でござる sin contexto que lo justifique.',
        ('N5',1103):'Frase y traducción poco naturales sin una situación de referencia.',
        ('N5',1107):'Pregunta excesivamente genérica, sin un referente claro para practicar.',
        ('N5',1111):'Fragmento demasiado genérico sin contexto de responsabilidad.',
        ('N4',1255):'Traducción española artificial: tener insatisfacción con la salud.',
        ('N4',1258):'議会 no identifica necesariamente la Dieta japonesa.',
        ('N4',1265):'Referencia impersonal ambigua para representante en la traducción.',
        ('N4',1272):'Construcción poco natural: apresurar el contenido no expresa bien la acción de estudiar.',
        ('N4',1278):'Comparación ilógica: un gigante no constituye una dificultad para sostener algo ligero.',
        ('N4',1277):'Negación sin referente suficiente para una práctica autónoma.',
        ('N5',1129):'Calco no natural en español: un trabajo está ocupado.',
        ('N4',1283):'Contraste absurdo entre un general y pescado sin contexto de broma.',
        ('N4',1284):'Relación causal poco coherente entre devoluciones y pagar primero.',
        ('N5',1145):'Negación genérica sobre una organización sin contexto suficiente.',
        ('N4',1299):'地上 no equivale necesariamente a comer sentado en el suelo.',
        ('N5',1163):'Contraste sin contexto entre juego y trato comercial.',
        ('N4',1302):'Viajar al imperio exige un contexto o destino concreto que no se aporta.',
        ('N5',1169):'現場 y el referente espacial requieren contexto para esa traducción.',
        ('N5',1174):'La traducción añade un recinto no especificado en el enunciado.',
        ('N4',1312):'Traducción española poco natural y sentido eufemístico de ご不幸 insuficientemente aclarado.',
        ('N5',1182):'Doctor resulta ambiguo y la relación con conocimientos tecnológicos carece de contexto.',
        ('N5',1188):'Referencia al juicio forzada en una compra de ropa sin contexto suficiente.',
        ('N4',1325):'お話 carece de contexto para elegir charla frente a relato o conversación.',
        ('N4',1333):'La idea de un recuerdo que cruza la mente no queda expresada con naturalidad en japonés.',
        ('N5',1194):'La traducción añade con nadie, alcance no especificado en japonés.',
        ('N4',1334):'La traducción omite la estación, presente explícitamente en japonés.',
        ('N4',1341):'Pregunta de uso sin objeto ni contexto suficiente.',
        ('N4',1349):'武装 significa armado, no necesariamente blindado.',
        ('N5',1211):'通信 y la negación no tienen contexto suficiente para esa traducción genérica.',
        ('N4',1356):'La lluvia dentro de lo normal no explica por sí sola el retraso de la floración.',
        ('N4',1358):'Ladrón no conserva el matiz de robo con violencia o amenaza de 強盗.',
        ('N4',1372):'Presentar mi implicación no traduce naturalmente una solicitud de participación.',
        ('N5',1236):'Se omite el niño y se pierde el matiz comparativo de 大きめ.',
        ('N5',1237):'自己用 resulta poco natural para una bicicleta de uso personal.',
        ('N5',1241):'新人 no equivale sin contexto a principiantes en una materia.',
        ('N5',1242):'Relación causal ambigua entre tener sentimientos y no poder salir con alguien.',
        ('N5',1243):'機関 no equivale sin contexto a un mecanismo genérico de juguete.',
        ('N4',1386):'車両 no especifica necesariamente un vagón y falta contexto ferroviario.',
        ('N5',1247):'Detective no conserva la pertenencia a la policía de 刑事.',
        ('N4',1392):'La función de supervivencia de las artes escénicas necesita contexto no aportado.',
        ('N4',1400):'Querer tener una tienda poco a poco es una formulación poco natural.',
        ('N4',1401):'Presidente sin contexto no identifica el cargo de 議長.',
        ('N5',1260):'Personificación poco natural de un bosque que responde a la lluvia.',
        ('N5',1261):'業者 no especifica proveedor ni el objeto analizado; falta contexto.',
        ('N5',1274):'Conocí introduce un primer encuentro que 会いました no exige.',
        ('N5',1275):'Pregunta tautológica sobre una ubicación sin referencia útil.',
        ('N4',1402):'La referencia española queda como infinitivo aislado y no como frase completa.',
        ('N4',1415):'Excluir la fiebre de los síntomas carece de un contexto que justifique la instrucción.',
        ('N5',1289):'La referencia española queda incompleta y el tema no tiene contexto.',
        ('N4',1424):'Explicación tautológica y poco coherente sobre instrucciones de primeros auxilios.',
        ('N4',1426):'連合 resulta poco natural para colaborar en ordenar una habitación familiar.',
        ('N4',1428):'そう y me lo parece carecen de un referente suficiente.',
        ('N4',1429):'Un viaje de medio año a Kioto necesita un contexto no aportado.',
        ('N4',1435):'Tienda de aficiones no es una referencia española natural y precisa.',
        ('N4',1443):'味殺し es una construcción forzada sin contexto culinario suficiente.',
        ('N4',1451):'El contraste entre presumir y esfuerzo no es natural sin contexto adicional.',
        ('N4',1458):'Pista omite la especificidad ecuestre de 馬場 y deja ambigua la traducción inversa.',
        ('N5',1337):'Asegurar sin objeto no aporta contexto suficiente para practicar 確保.',
        ('N5',1350):'旅行の設計 resulta forzado para una reserva de viaje cotidiana.',
        ('N5',1357):'La traducción española termina en una cópula sin complemento.',
        ('N5',1367):'La duración de un siglo para un síntoma es un ejemplo forzado sin contexto.',
        ('N4',1500):'初期 carece de una fase o periodo de referencia claro en la descripción del bosque.',
    }
    for level in ['N5','N4']:
        rows=generator.read_jsonl(ROOT/f'data/editorial/{level.lower()}-approved.jsonl')[prior['before'][level]:]
        accepted[level]=[]
        for item in rows:
            if item['slot']>review_cursor[level]:raise SystemExit(f'Pending direct review: {level} slot {item["slot"]}')
            reason=manual.get((level,item['slot']))
            if any(f"{prefix}-{level}-EDITORIAL-{int(item['slot']):04d}" in existing_ids for prefix in ['JAES','ESJA']):reason='Exercise ID already exists'
            try:generator.validate_slot(item,item['coverage_slot'])
            except RuntimeError as error:reason=str(error)
            signature=normalize(item['japanese'])
            if signature in known:reason='Duplicate Japanese sentence in bank or collection'
            if not item.get('equivalence_verified'):reason='Equivalence review missing'
            # Each kanji must have a reading that can actually be placed in order.
            cursor=0;covered='';uncovered=''
            for reading in item['kanji_readings']:
                position=item['japanese'].find(reading['characters'],cursor)
                if position>=0:
                    uncovered+=item['japanese'][cursor:position];covered+=reading['characters'];cursor=position+len(reading['characters'])
            uncovered+=item['japanese'][cursor:]
            if any(generator.is_kanji(c) for c in uncovered):reason='Unplaceable or incomplete furigana'
            if reason:excluded.append({'level':level,'slot':item['slot'],'japanese':item['japanese'],'reason':reason});continue
            accepted[level].append(item);known.add(signature)
    if not any(accepted.values()):raise SystemExit('No new approved pairs; preserve the existing publication report')
    with tempfile.TemporaryDirectory(prefix='japoteacher-publish-') as directory:
        stage=pathlib.Path(directory);(stage/'data/editorial').mkdir(parents=True)
        for level,items in accepted.items():
            (stage/f'data/editorial/{level.lower()}-approved.jsonl').write_text(''.join(json.dumps(i,ensure_ascii=False)+'\n' for i in items),encoding='utf-8')
        new_bank=stage/'data/exercises.full.csv'
        with new_bank.open('w',encoding='utf-8-sig',newline='') as stream:csv.DictWriter(stream,fieldnames=fields).writeheader()
        publisher.ROOT=stage;publisher.CSV_PATH=new_bank
        original_env=os.environ.get('JAPOTEACHER_USAGE_REFERENCE_ZIP')
        os.environ['JAPOTEACHER_USAGE_REFERENCE_ZIP']=str(stage/'unused.zip')
        sys.argv=['publish-editorial-bank.py','--append-only']
        try:publisher.main()
        finally:
            if original_env is None:os.environ.pop('JAPOTEACHER_USAGE_REFERENCE_ZIP',None)
            else:os.environ['JAPOTEACHER_USAGE_REFERENCE_ZIP']=original_env
        result=classifier.classify_bank(new_bank,pathlib.Path.home()/'Downloads/japanese_usage_progress_v2_csv.zip',write=True)
        with new_bank.open(encoding='utf-8-sig',newline='') as stream:new=list(csv.DictReader(stream))
    prefix='window.JAPOTEACHER_FURIGANA='
    furi_path=ROOT/'src/furigana-generated.js'
    furi=json.loads(furi_path.read_text(encoding='utf-8').strip()[len(prefix):-1])
    for level,items in accepted.items():
        for item in items:
            cursor=0;parts=[]
            for reading in item['kanji_readings']:
                chars=reading['characters'];pos=item['japanese'].find(chars,cursor)
                if pos<0:continue
                parts.extend([html.escape(item['japanese'][cursor:pos]),f'<ruby>{html.escape(chars)}<rt>{html.escape(reading["reading_hiragana"])}</rt></ruby>']);cursor=pos+len(chars)
            parts.append(html.escape(item['japanese'][cursor:]));furi[f"JAES-{level}-EDITORIAL-{int(item['slot']):04d}"]=''.join(parts)
    staged_bank=bank.with_suffix('.expansion-20260909.tmp')
    with staged_bank.open('w',encoding='utf-8-sig',newline='') as stream:
        writer=csv.DictWriter(stream,fieldnames=fields);writer.writeheader();writer.writerows(old+new)
    staged_furi=furi_path.with_suffix('.expansion-20260909.tmp')
    staged_furi.write_text(prefix+json.dumps(furi,ensure_ascii=False,separators=(',',':'))+';\n',encoding='utf-8')
    # Install readings first: unused extra readings are harmless if the CSV
    # rename fails. Existing bank rows never point at missing new readings.
    for temporary,target in [(staged_furi,furi_path),(staged_bank,bank)]:
        for retry in range(20):
            try:os.replace(temporary,target);break
            except PermissionError:
                if retry==19:raise
                time.sleep(.25)
    report={'tokens_confirmed':ledger['used'],'tokens_conservative':ledger['used']+sum(ledger['reservations'].values()),'limit':ledger['limit'],'new_pairs':len(new)//2,'prior_day_confirmed':prior['used'],'prior_day_conservative':prior['used']+sum(prior['reservations'].values()),'previous_rows_preserved':len(old),'classification':result,'excluded':excluded}
    (ROOT/'data/editorial/summary-2026-09-09-expansion.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps(report,ensure_ascii=False),flush=True)

if __name__=='__main__':main()
