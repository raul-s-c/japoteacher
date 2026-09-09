"""Read-only verification of the published expansion against its git baseline."""
import argparse, csv, html, io, json, pathlib, re, subprocess, unicodedata
ROOT=pathlib.Path(__file__).resolve().parents[1]
def rows(text):return list(csv.DictReader(io.StringIO(text.lstrip('\ufeff'))))
def baseline(ref,path):return subprocess.check_output(['git','show',f'{ref}:{path}'],cwd=ROOT).decode('utf-8-sig')
def readings(text):return json.loads(text.strip().removeprefix('window.JAPOTEACHER_FURIGANA=')[:-1])
def signature(text):return re.sub(r'[\s。、！？「」『』（）・,.!?]','',unicodedata.normalize('NFKC',text))
def main():
    parser=argparse.ArgumentParser();parser.add_argument('--base',required=True);args=parser.parse_args()
    old=rows(baseline(args.base,'data/exercises.full.csv'))
    current=rows((ROOT/'data/exercises.full.csv').read_text(encoding='utf-8-sig'))
    previous={r['exercise_id']:r for r in old};now={r['exercise_id']:r for r in current}
    assert len(now)==len(current),'Duplicate exercise IDs'
    assert all(now.get(k)==v for k,v in previous.items()),'An existing exercise changed'
    fresh=[r for r in current if r['exercise_id'] not in previous]
    assert fresh and len(fresh)%2==0,'No complete new pairs'
    known={signature(r['source_text']) for r in old if r['direction']=='ja_es'}
    collection=json.loads((ROOT/'data/collections/sakamoto.json').read_text(encoding='utf-8'))
    known.update(signature(r['source_text']) for r in collection['exercises'] if r['direction']=='ja_es')
    furi=readings((ROOT/'src/furigana-generated.js').read_text(encoding='utf-8'))
    old_furi=readings(baseline(args.base,'src/furigana-generated.js'))
    assert all(furi.get(k)==v for k,v in old_furi.items()),'An existing reading changed'
    for r in fresh:
        assert r['jlpt_level'] in ['N5','N4','N3','N2','N1']
        assert 0<=float(r['difficulty'])<=100
        assert r['active']=='true'
        json.loads(r['accepted_alternatives_json'])
        if r['direction']!='ja_es':continue
        key=signature(r['source_text']);assert key not in known,('Duplicate Japanese',r['exercise_id']);known.add(key)
        other=now[r['exercise_id'].replace('JAES-','ESJA-',1)]
        assert other['source_text']==r['reference_translation'] and other['reference_translation']==r['source_text']
        annotated=furi[r['exercise_id']]
        plain=re.sub(r'<rt>.*?</rt>','',annotated)
        assert html.unescape(re.sub(r'<[^>]*>','',plain))==r['source_text'],('Furigana changed text',r['exercise_id'])
        outside=re.sub(r'<ruby>.*?</ruby>','',annotated)
        assert not re.search(r'[\u3400-\u9fff]',outside),('Missing furigana',r['exercise_id'])
    print(json.dumps({'pass':True,'previous_rows_preserved':len(old),'previous_readings_preserved':len(old_furi),'new_pairs':len(fresh)//2,'new_exercises':len(fresh),'total_rows':len(current)}))
if __name__=='__main__':main()
