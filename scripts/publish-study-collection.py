"""Publish only unchanged source phrases approved by both editorial passes."""
import argparse, collections, csv, hashlib, importlib.util, json, pathlib, re

ROOT=pathlib.Path(__file__).resolve().parents[1]
FUNCTION_WORDS=set('が の は に を で と も へ から まで より や か ね よ ぞ ぜ な さ わ って て た だ です ます ん のだ んだ んです なの なん てる てた でしょ じゃ とか ので けど だけど のに なら たら ば れば あれば ず すら さえ でも だけ しか ほど くらい ぐらい ちゃ じゃん なあ え あ あっ お う うん ううん ああ おお ほら おい でして かな かしら っす っ つ まし ませ でし だっ し たり'.split())
spec=importlib.util.spec_from_file_location('usage',ROOT/'scripts/usage-classification.py')
usage=importlib.util.module_from_spec(spec);spec.loader.exec_module(usage)
def read(path):return json.loads(path.read_text(encoding='utf-8'))
def main():
    parser=argparse.ArgumentParser();parser.add_argument('workdir');parser.add_argument('reference_zip');args=parser.parse_args()
    work=pathlib.Path(args.workdir);sources={r['id']:r for r in read(work/'source.json')}
    verified={r['id'] for r in read(work/'verified.json') if r['approved']}
    classifier=usage.UsageClassifier(args.reference_zip)
    # These sentences have a complete, reviewed lexical inventory. Substring
    # scanning would invent words across token boundaries, e.g. 時に in 七時に.
    classifier.text_vocabulary=lambda text:[]
    final_review=read(ROOT/'data/collections/sakamoto-final-review.json')
    final_rejected={item:reason for reason,items in final_review['reject_groups'].items() for item in items}
    final_validation=read(ROOT/'data/collections/sakamoto-final-validation.json')
    final_validated={item['id'] for item in final_validation['items'] if item['approved']}
    rows=[];rejected=[];approved=[];seen=set();seen_spanish=set()
    def norm(s):return re.sub(r'[\s。、！？!?.,「」『』…]', '',s)
    for row in csv.DictReader((ROOT/'data/exercises.full.csv').open(encoding='utf-8-sig',newline='')):
        seen.add(norm(row['source_text'] if row['direction']=='ja_es' else row['reference_translation']))
        seen_spanish.add(re.sub(r'[^\w]', '', (row['reference_translation'] if row['direction']=='ja_es' else row['source_text']).casefold()))
    for item in read(work/'annotated.json'):
        if not item['approved'] or item['id'] not in verified:continue
        if item['id'] in final_rejected:rejected.append({'id':item['id'],'reason':final_rejected[item['id']]});continue
        if item['id'] in final_review['spanish']:
            if item['id'] not in final_validated:rejected.append({'id':item['id'],'reason':'corrección final no validada'});continue
            item=dict(item,spanish=final_review['spanish'][item['id']])
        source=sources[item['id']];japanese=source['japanese'].strip();spanish=item['spanish'].strip()
        vocabulary_tags=list(dict.fromkeys(t for t in item['vocabulary_tags'] if t not in FUNCTION_WORDS and not re.fullmatch('[ぁ-ん]',t)))
        covered=set();problem=''
        for reading in item['kanji_readings']:
            if not reading['characters'] or reading['characters'] not in japanese or not re.fullmatch(r'[ぁ-ゖー\s・]+',reading['reading_hiragana']):problem='anotación de lectura inválida'
            covered.update(usage.KANJI_RE.findall(reading['characters']))
        if set(usage.KANJI_RE.findall(japanese))-covered:problem='kanji sin lectura revisada'
        spanish_signature=re.sub(r'[^\w]', '',spanish.casefold())
        if norm(japanese) in seen or spanish_signature in seen_spanish:problem='duplicado con el banco o el bloque'
        if re.search(r'[…]|\.\.\.',japanese):problem='fragmento con omisión explícita'
        if re.search(r'(けど|けれど|けれども|のに|ので|でして|たら|なら)[。！？!?]*$',japanese):problem='proposición sin conclusión autónoma'
        if re.search(r'坂本|サカモト|シン|葵|南雲|平助|ルー|殺連|カクン|闇市城|もともとも',japanese):problem='referencia a personajes o transcripción dudosa'
        if source['episode']==2 and 'カニ' in japanese:problem='transcripción confunde llave con cangrejo en la escena'
        if not spanish or not vocabulary_tags or not item['topic_tags']:problem='faltan anotaciones'
        if problem:rejected.append({'id':item['id'],'reason':problem});continue
        classification,unresolved=classifier.classify({'direction':'ja_es','source_text':japanese,'vocabulary_tags':'|'.join(vocabulary_tags),'grammar_tags':'|'.join(item['grammar_tags'])})
        if not classification:rejected.append({'id':item['id'],'reason':'sin referencia para clasificar'});continue
        risky=[term for term in unresolved if len(term)>1 and re.search(r'[一-龯ァ-ヶ]',term)]
        if risky:rejected.append({'id':item['id'],'reason':'léxico sin referencia suficiente para nivelar con confianza','terms':risky});continue
        seen.add(norm(japanese));seen_spanish.add(spanish_signature)
        if japanese[-1] not in '。！？!?':japanese+='。'
        pair_id='SAKAMOTO-'+hashlib.sha256(norm(japanese).encode()).hexdigest()[:16]
        common={'pair_id':pair_id,'source_collection':'sakamoto','source_collection_name':'Sakamoto','source_episode':source['episode'],'source_segment':source['segment'],'source_start_ms':source['startMillis'],'source_end_ms':source['endMillis'],'source_file':source['source_file'],'review_status':'approved','editorial_quality_version':'collection-v1-two-pass','sync_scope':'editorial','active':True,'core_exercise':True,'dataset_version':4,'collection_version':'20260907-1','jlpt_level':classification['level'],'difficulty':classification['difficulty'],'usage_classification_version':usage.VERSION+'-reviewed-tags','usage_percentile':classification['percentile'],'usage_hardest_component':classification['hardest'],'usage_components':classification['components'],'usage_classification_confidence':classification['confidence'],'usage_unresolved_terms':unresolved,'accepted_alternatives':[],'kanji_readings':item['kanji_readings'],'japanese_reading':item['reading'],'vocabulary_tags':vocabulary_tags,'grammar_tags':item['grammar_tags'],'topic_tags':item['topic_tags'],'kanji_tags':sorted(set(usage.KANJI_RE.findall(japanese))),'verb_tags':[],'adjective_tags':[],'particle_tags':[],'counter_tags':[],'situation_tags':[],'register':item['register'],'pedagogical_notes':item['pedagogical_notes']}
        for direction in ['ja_es','es_ja']:
            rows.append(dict(common,exercise_id=pair_id+'-'+direction.upper(),direction=direction,source_language='ja' if direction=='ja_es' else 'es',target_language='es' if direction=='ja_es' else 'ja',source_text=japanese if direction=='ja_es' else spanish,reference_translation=spanish if direction=='ja_es' else japanese))
        approved.append({'id':item['id'],'pair_id':pair_id,'level':classification['level'],'episode':source['episode']})
    output=ROOT/'data/collections';output.mkdir(exist_ok=True)
    if not rows:raise RuntimeError('No hay frases publicables')
    (output/'sakamoto.json').write_text(json.dumps({'collection_id':'sakamoto','name':'Sakamoto','version':'20260907-1','exercises':rows},ensure_ascii=False,separators=(',',':')),encoding='utf-8')
    audit={'source_archive':read(work/'source-manifest.json'),'source_segments':len(sources),'prefilter_rejected':len(read(work/'prefilter.json')),'screen_rejected':sum(not r['approved'] for r in read(work/'screened.json')),'annotation_rejected':sum(not r['approved'] for r in read(work/'annotated.json')),'verification_rejected':sum(not r['approved'] for r in read(work/'verified.json')),'publication_rejected':rejected,'approved_pairs':len(approved),'directional_exercises':len(rows),'levels':dict(collections.Counter(r['level'] for r in approved)),'episodes':dict(collections.Counter(r['episode'] for r in approved)),'approved':approved}
    (output/'sakamoto-audit.json').write_text(json.dumps(audit,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps({k:v for k,v in audit.items() if k not in ['approved','publication_rejected']},ensure_ascii=False))
if __name__=='__main__':main()
