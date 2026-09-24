"""Publish a conversation-authored batch with local checks; never calls an AI API.

Review provenance is explicitly a single conversational reviewer, not the paid
pipeline's independent equivalence review. Default is a read-only dry run.
"""
import argparse,collections,csv,difflib,html,importlib.util,json,pathlib,re,sys,tempfile,unicodedata
ROOT=pathlib.Path(__file__).resolve().parents[1]
STEM='conversation-2026-09-24'
VERSION='20260924-conversation'
def load(name):
 spec=importlib.util.spec_from_file_location(name.replace('-','_'),ROOT/'scripts'/f'{name}.py');mod=importlib.util.module_from_spec(spec);spec.loader.exec_module(mod);return mod
def read(path):
 with path.open(encoding='utf-8-sig',newline='') as f:
  r=csv.DictReader(f);return r.fieldnames,list(r)
def sig(s):return re.sub(r'[\W_]','',unicodedata.normalize('NFKC',s))
def main():
 p=argparse.ArgumentParser();p.add_argument('--write',action='store_true');p.add_argument('--stem',default=STEM);p.add_argument('--version',default=VERSION);p.add_argument('--batch-id',default='20260924');p.add_argument('--expected-count',type=int,default=50);args=p.parse_args()
 assert re.fullmatch(r'[a-z0-9-]+',args.stem) and re.fullmatch(r'[A-Za-z0-9-]+',args.batch_id)
 assert args.expected_count>0
 with (ROOT/'data/editorial'/f'{args.stem}.tsv').open(encoding='utf-8-sig',newline='') as f:items=list(csv.DictReader(f,delimiter='\t'))
 assert len(items)==args.expected_count
 fields,old=read(ROOT/'data/exercises.full.csv');existing={r['exercise_id'] for r in old}
 collection=json.loads((ROOT/'data/collections/sakamoto.json').read_text(encoding='utf-8'))
 known=[(r['exercise_id'],r['source_text'],sig(r['source_text'])) for r in old+collection['exercises'] if r['direction']=='ja_es']
 previous_known=list(known)
 prefix='window.JAPOTEACHER_FURIGANA='
 furi=json.loads((ROOT/'src/furigana-generated.js').read_text(encoding='utf-8').strip()[len(prefix):-1])
 validator=load('editorial-generate');new=[];audit=[]
 for i,item in enumerate(items,1):
  annotations=re.findall(r'\[([^|\]]+)\|([^\]]+)\]',item['ruby'])
  jp=re.sub(r'\[([^|\]]+)\|([^\]]+)\]',r'\1',item['ruby']);annotated=re.sub(r'\[([^|\]]+)\|([^\]]+)\]',lambda m:f'<ruby>{html.escape(m[1])}<rt>{html.escape(m[2])}</rt></ruby>',item['ruby'])
  assert not re.search(r'[\u3400-\u9fff]',re.sub(r'<ruby>.*?</ruby>','',annotated)),('Missing reading',i)
  assert all(re.fullmatch(r'[ぁ-ゖー]+',y) for x,y in annotations)
  key=sig(jp);assert all(key!=s for _,_,s in known),('Duplicate',i)
  nearest=max(known,key=lambda r:difflib.SequenceMatcher(None,key,r[2]).ratio())
  similarity=difflib.SequenceMatcher(None,key,nearest[2]).ratio()
  assert similarity<.9,('Too similar',i,nearest)
  slot={'slot':i,'topic_primary':'vida_diaria','grammar_focus':[],'jp_char_range':[5,100],'es_word_range':[2,60],'target_vocabulary':[{'word':item['target']}]}
  validator.validate_slot({'slot':i,'topic_primary':'vida_diaria','japanese':jp,'spanish':item['spanish'],'register':'cortés','vocabulary_tags':[item['target']],'kanji_readings':[{'characters':x,'reading_hiragana':y} for x,y in annotations]},slot)
  pair=f'{item["level"]}-CONVERSATION-{args.batch_id}-{i:03d}';jaid='JAES-'+pair
  assert jaid not in existing,('Batch already published',jaid)
  furi[jaid]=annotated
  topics={3:'trabajo',4:'vida_diaria',5:'compras',6:'vida_diaria',9:'trabajo',11:'comida',14:'transporte',15:'trabajo',16:'comida',17:'sociedad',18:'servicios',19:'compras',20:'tecnologia',21:'ocio',23:'trabajo',24:'sociedad',26:'comida',29:'cultura',30:'trabajo',32:'educacion',33:'tecnologia',34:'trabajo',38:'compras',39:'comida',40:'cultura',42:'sociedad',44:'ocio',46:'comida',47:'transporte',49:'ocio'}
  difficulty=str(min(75,25+len(jp)//2))
  for direction in ['ja_es','es_ja']:
   ja=direction=='ja_es';row=dict.fromkeys(fields,'');row.update(exercise_id=('JAES-' if ja else 'ESJA-')+pair,jlpt_level=item['level'],original_jlpt_level=item['level'],difficulty=difficulty,original_difficulty=difficulty,source_language='ja' if ja else 'es',target_language='es' if ja else 'ja',direction=direction,source_text=jp if ja else item['spanish'],reference_translation=item['spanish'] if ja else jp,accepted_alternatives_json='[]',topic_tags=item.get('topic') or topics.get(i,'vida_diaria'),vocabulary_tags=item['target'],kanji_tags='|'.join(x for x,y in annotations),register='cortés',pedagogical_notes=item['note'],ambiguity_notes=item['note'],core_exercise='false',active='true',dataset_version='4.0')
   new.append(row)
  audit.append({'id':jaid,'target':item['target'],'japanese':jp,'spanish':item['spanish'],'estimated_level':item['level'],'review_note':item['note'],'authored_ruby':item['ruby'],'nearest_id':nearest[0],'nearest_japanese':nearest[1],'character_similarity':round(similarity,4),'target_literal_previous_occurrences':sum(item['target'] in s for k,s,z in previous_known)})
  known.append((jaid,jp,key))
 report={'provenance':'Authored and linguistically reviewed in Codex conversation; local deterministic checks. No independent API review.','api_calls':0,'api_tokens':0,'pairs':len(items),'exercises':len(new),'levels':dict(collections.Counter(x['level'] for x in items)),'checks':['schema','explicit ordered kanji readings','exact and character similarity vs bank + Sakamoto + batch','morphology evidence for target','append-only previous rows and graph'],'items':audit}
 print(json.dumps({'pairs':len(items),'max_similarity':max(a['character_similarity'] for a in audit),'closest':sorted(audit,key=lambda a:-a['character_similarity'])[:5]},ensure_ascii=False))
 graph=json.loads((ROOT/'data/knowledge-map.json').read_text(encoding='utf-8'));nodes={n['id']:n for n in graph['nodes']};prior=dict(graph['sentences'])
 with tempfile.TemporaryDirectory(prefix='japo-conversation-') as folder:
  stage=pathlib.Path(folder);(stage/'data/collections').mkdir(parents=True);bank=stage/'data/exercises.full.csv'
  with bank.open('w',encoding='utf-8-sig',newline='') as f:w=csv.DictWriter(f,fieldnames=fields);w.writeheader();w.writerows(new)
  (stage/'data/collections/sakamoto.json').write_text('{"exercises":[]}',encoding='utf-8')
  load('usage-classification').classify_bank(bank,pathlib.Path.home()/'Downloads/japanese_usage_progress_v2_csv.zip',write=True)
  # Frequency metadata remains separate from the reviewed pedagogical level.
  _,classified=read(bank)
  for r in classified:
   authored=next(x for x in new if x['exercise_id']==r['exercise_id'])
   for field in ['jlpt_level','original_jlpt_level','difficulty','original_difficulty']:r[field]=authored[field]
  with bank.open('w',encoding='utf-8-sig',newline='') as f:w=csv.DictWriter(f,fieldnames=fields);w.writeheader();w.writerows(classified)
  builder=load('build-knowledge-map');builder.ROOT=stage;argv=sys.argv;sys.argv=['build-knowledge-map.py','--version',args.version]
  try:builder.main()
  finally:sys.argv=argv
  addition=json.loads((stage/'data/knowledge-map.json').read_text(encoding='utf-8'));_,updated=read(bank)
  for a in audit:
   evidence=addition['sentences'][a['id']]['evidence'];a['morphology_evidence']=evidence
   if not any(e['term']==a['target'] for e in evidence):
    # Curated full compounds have exact surface evidence and author-supplied
    # readings; keep these alongside their morphological components.
    start=a['japanese'].find(a['target']);assert start>=0,('Unproven target',a['id'])
    end=start+len(a['target']);cursor=0;reading=[];consumed=0
    for match in re.finditer(r'\[([^|\]]+)\|([^\]]+)\]|([^\[])',a['authored_ruby']):
     surface=match[1] or match[3];pronunciation=match[2] or builder.hira(surface)
     next_cursor=cursor+len(surface)
     if cursor<end and next_cursor>start:
      assert cursor>=start and next_cursor<=end,('Partial reading span',a['id'])
      reading.append(pronunciation);consumed+=len(surface)
     cursor=next_cursor
    assert consumed==len(a['target']) and reading,('Missing compound reading',a['id'])
    node_id=builder.uid('v',a['target'])
    if not any(n['id']==node_id for n in addition['nodes']):addition['nodes'].append({'id':node_id,'type':'v','label':a['target'],'description':'Palabra presente en los ejemplos; consulta su significado según el contexto.'})
    compound={'term':a['target'],'surface':a['target'],'start':start,'end':end,'reading':''.join(reading)}
    for identity in [a['id'],a['id'].replace('JAES-','ESJA-',1)]:
     sentence=addition['sentences'][identity]
     if node_id not in sentence['concepts']:sentence['concepts'].append(node_id)
     sentence['evidence'].append(dict(compound))
     row=next(r for r in updated if r['exercise_id']==identity)
     row['vocabulary_tags']='|'.join(dict.fromkeys(row['vocabulary_tags'].split('|')+[a['target']]))
    a['curated_compound']=compound
   assert any(e['term']==a['target'] for e in evidence),('Unproven target',a['id'])
 # Record lexical similarity to catch paraphrases sharing the same content words.
 for a in audit:
  words={e['term'] for e in a['morphology_evidence']}
  candidates=[]
  for key,sentence in graph['sentences'].items():
   if not key.startswith('JAES'):continue
   other={e['term'] for e in sentence.get('evidence',[])}
   similarity=len(words & other)/max(1,len(words | other))
   candidates.append((similarity,key,sentence['text']))
  best=max(candidates,default=(0,'',''))
  a['nearest_lexical_similarity'],a['nearest_lexical_id'],a['nearest_lexical_japanese']=best
 print(json.dumps({'lexical_neighbors':sorted([{'id':a['id'],'new':a['japanese'],'old':a['nearest_lexical_japanese'],'similarity':a['nearest_lexical_similarity']} for a in audit],key=lambda x:-x['similarity'])[:12]},ensure_ascii=False))
 if not args.write:return
 for n in addition['nodes']:nodes.setdefault(n['id'],n)
 graph['nodes']=list(nodes.values());graph['sentences'].update(addition['sentences']);graph['version']=args.version
 assert all(graph['sentences'][k]==v for k,v in prior.items())
 with (ROOT/'data/exercises.full.csv').open('w',encoding='utf-8-sig',newline='') as f:w=csv.DictWriter(f,fieldnames=fields);w.writeheader();w.writerows(old+updated)
 (ROOT/'src/furigana-generated.js').write_text(prefix+json.dumps(furi,ensure_ascii=False,separators=(',',':'))+';\n',encoding='utf-8')
 (ROOT/'data/knowledge-map.json').write_text(json.dumps(graph,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
 report.update(previous_rows_preserved=len(old),previous_graph_sentences_preserved=len(prior),total_rows=len(old+updated))
 (ROOT/'data/editorial'/f'{args.stem}-audit.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
 print(json.dumps({k:v for k,v in report.items() if k!='items'},ensure_ascii=False))
if __name__=='__main__':main()
