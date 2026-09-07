"""Validate final Spanish corrections under the same cumulative token ledger."""
import importlib.util,json,pathlib,sys
ROOT=pathlib.Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('collection_import',ROOT/'scripts/import-study-collection.py');review=importlib.util.module_from_spec(spec);spec.loader.exec_module(review)
work=pathlib.Path(sys.argv[1])
read=lambda p:json.loads(p.read_text(encoding='utf-8'))
sources={r['id']:r for r in read(work/'source.json')};annotations={r['id']:r for r in read(work/'annotated.json')}
corrections=read(ROOT/'data/collections/sakamoto-final-review.json')['spanish'];items=[]
for id,spanish in corrections.items():
    original=annotations[id]
    items.append({'id':id,'japanese':sources[id]['japanese'],'spanish':spanish,'reading':original['reading'],'kanji_readings':original['kanji_readings']})
result=review.run_stage('verify',items,20,work,workers=1)
review.write(ROOT/'data/collections/sakamoto-final-validation.json',{'version':'20260907-1','items':result})
used=sum(read(p).get('usage',{}).get('total_tokens',0) for p in work.glob('*-*.json'))
print(json.dumps({'final_corrections':len(items),'accepted':sum(r['approved'] for r in result),'recorded_total_tokens':used}))
