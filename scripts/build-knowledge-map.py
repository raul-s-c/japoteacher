"""Reproducible, offline concept index. Requires Janome==0.5.0 (build only).

Frequency ranks are never JLPT levels. IDs, sentence text and learner records
are untouched. Ambiguous dictionary readings and unsupported grammar are omitted.
"""
import csv, hashlib, json, re, unicodedata
from collections import Counter
from pathlib import Path
from janome.tokenizer import Tokenizer

ROOT = Path(__file__).resolve().parents[1]
TOKENIZER = Tokenizer()
GRAMMAR = [
    ('te', 'Forma て', 'Conecta acciones y sirve de base para peticiones y permisos.', r'て|で', []),
    ('te-kudasai', '〜てください', 'Pedir que alguien haga algo.', r'[てで]ください', ['te']),
    ('te-mo-ii', '〜てもいい', 'Pedir o dar permiso.', r'[てで]もいい|[てで]もよい', ['te']),
    ('te-wa-ikenai', '〜てはいけない', 'Expresar una prohibición.', r'[てで]はいけ', ['te']),
    ('te-iru', '〜ている', 'Describir una acción en curso o un estado resultante.', r'[てで](いる|います|いた|いまし)', ['te']),
    ('tai', '〜たい', 'Expresar el deseo de realizar una acción.', r'たい', []),
    ('masu', 'Forma cortés', 'Hablar con la terminación verbal ます.', r'ます|ました|ません', []),
    ('kara', '〜から', 'Dar una razón: porque…', r'から', []),
    ('node', '〜ので', 'Presentar una causa o explicación.', r'ので', []),
    ('before', '〜前に', 'Indicar que una acción ocurre antes de otra.', r'前に', []),
    ('after', '〜あとで', 'Indicar que una acción ocurre después de otra.', r'後で|あとで', []),
    ('comparison', '〜より', 'Comparar dos elementos.', r'より', []),
    ('nara', '〜なら', 'Plantear una condición o retomar un tema.', r'なら', []),
    ('tari', '〜たり', 'Enumerar acciones como ejemplos.', r'たり|だり', []),
]

def norm(text): return unicodedata.normalize('NFKC', str(text or '')).strip()
def hira(text): return ''.join(chr(ord(c)-96) if 'ァ' <= c <= 'ヶ' else c for c in text)
def uid(kind, term): return kind + ':' + hashlib.sha256(term.encode()).hexdigest()[:16]
def ja(row): return row['source_text'] if row['direction']=='ja_es' else row['reference_translation']
def split(value): return value if isinstance(value,list) else str(value or '').split('|')

def analyze(text):
    tokens=list(TOKENIZER.tokenize(norm(text)))
    boundaries={0}; cursor=0
    for token in tokens:cursor+=len(token.surface);boundaries.add(cursor)
    words=[]; offset=0; spans=[]
    for t in tokens:
        surface=t.surface; start=norm(text).find(surface,offset); offset=start+len(surface)
        pos=t.part_of_speech.split(',')
        # Particles, auxiliaries, proper names and non-independent fragments
        # cannot become vocabulary simply because a substring matched a list.
        if pos[0] not in ('名詞','動詞','形容詞','副詞','連体詞','接続詞') or pos[1] in ('非自立','接尾','固有名詞','数'): continue
        lemma=norm(t.base_form if t.base_form!='*' else surface)
        if not re.search(r'[ぁ-ヶ一-龯]',lemma): continue
        words.append(lemma);spans.append({'term':lemma,'surface':surface,'start':start,'end':offset,'reading':hira(t.reading) if t.reading!='*' else ''})
    # Grammar uses token evidence, not arbitrary substring hits inside nouns.
    grams=[]
    for key,label,description,pattern,prereqs in GRAMMAR:
        if not any(m.start() in boundaries and m.end() in boundaries for m in re.finditer(pattern,norm(text))):continue
        if key=='te' and not any(t.surface in ('て','で') and '接続助詞' in t.part_of_speech for t in tokens):continue
        if key=='tai' and not any(t.base_form=='たい' and t.part_of_speech.startswith('助動詞') for t in tokens):continue
        if key=='kara' and not any(t.surface=='から' and '接続助詞' in t.part_of_speech for t in tokens):continue
        grams.append(key)
    return sorted(set(words)),spans,grams

def main():
    bank=ROOT/'data/exercises.full.csv'
    with bank.open(encoding='utf-8-sig',newline='') as f:
        reader=csv.DictReader(f);fields=reader.fieldnames;rows=list(reader)
    collection_path=ROOT/'data/collections/sakamoto.json';collection=json.loads(collection_path.read_text(encoding='utf-8'))
    graph={'version':'20260912-concepts-1','nodes':{},'sentences':{},'prerequisites':[['g:'+p,'g:'+k] for k,_,_,_,ps in GRAMMAR for p in ps]}
    audit=Counter(); cache={}
    for row in rows+collection['exercises']:
        text=ja(row); words,spans,grams=cache.setdefault(text,analyze(text)) if text not in cache else cache[text]
        old=split(row.get('vocabulary_tags'));audit['removed_tag_associations']+=len(set(old)-set(words))
        if row.get('original_jlpt_level') in ('N5','N4','N3','N2','N1'):
            audit['restored_editorial_levels']+=row['jlpt_level']!=row['original_jlpt_level'];row['jlpt_level']=row['original_jlpt_level']
            if row.get('original_difficulty'):row['difficulty']=row['original_difficulty']
        old_components=row.get('usage_components') if isinstance(row.get('usage_components'),list) else json.loads(row.get('usage_components_json') or '[]')
        components=[c for c in old_components if norm(c.get('t')) in words]
        audit['removed_usage_associations']+=len(old_components)-len(components)
        # Never use old semantic clusters/aliases as proof of word occurrence.
        for c in components:c['c']=uid('v',norm(c['t']));c.pop('cl',None)
        hardest=max(components,key=lambda c:c.get('p',0),default=None)
        if 'usage_components_json' in row:
            row['usage_components_json']=json.dumps(components,ensure_ascii=False,separators=(',',':'))
            row['usage_hardest_component_json']=json.dumps(hardest,ensure_ascii=False) if hardest else ''
            row['usage_percentile']=str(hardest['p']) if hardest else ''
            row['vocabulary_tags']='|'.join(words)
            row['kanji_tags']='|'.join(sorted(set(re.findall(r'[一-龯]',text))))
            for f in ('verb_tags','adjective_tags','counter_tags'):row[f]='|'.join(t for t in split(row.get(f)) if t in words)
        else:
            row['usage_components']=components;row['usage_hardest_component']=hardest;row['usage_percentile']=hardest['p'] if hardest else None;row['vocabulary_tags']=words
        row['usage_classification_version']='morphology_v1';row['usage_classification_confidence']='frequency_only'
        if str(row.get('active')).lower() in ('false','0'):continue
        ids=[]
        for word in words:
            id=uid('v',word);graph['nodes'].setdefault(id,{'id':id,'type':'v','label':word,'description':'Palabra presente en los ejemplos; consulta su significado según el contexto.'});ids.append(id)
        for c in sorted(set(re.findall(r'[一-龯]',text))):
            id=uid('k',c);graph['nodes'].setdefault(id,{'id':id,'type':'k','label':c,'description':'Kanji presente en estas palabras y frases. Sus lecturas dependen de la palabra.'});ids.append(id)
        for key,label,description,_,_ in GRAMMAR:
            if key in grams:
                id='g:'+key;graph['nodes'].setdefault(id,{'id':id,'type':'g','label':label,'description':description});ids.append(id)
        graph['sentences'][row['exercise_id']]={'text':text,'concepts':ids,'evidence':spans}
    graph['nodes']=list(graph['nodes'].values())
    (ROOT/'data/knowledge-map.json').write_text(json.dumps(graph,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
    with bank.open('w',encoding='utf-8-sig',newline='') as f:
        writer=csv.DictWriter(f,fieldnames=fields);writer.writeheader();writer.writerows(rows)
    collection_path.write_text(json.dumps(collection,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
    audit.update(nodes=len(graph['nodes']),exercises=len(graph['sentences']))
    (ROOT/'data/knowledge-map-audit.json').write_text(json.dumps(dict(audit),indent=2),encoding='utf-8')
    print(json.dumps(dict(audit)))

if __name__=='__main__':main()
