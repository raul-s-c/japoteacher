"""Review supplied lrpack archives with resumable, authenticated editorial calls.

Raw source and checkpoints stay in the requested private work directory. No video
is read. Publishing is a separate step, after both editorial passes and QA.
"""
import argparse, collections, concurrent.futures, csv, hashlib, io, json, os, pathlib, re, subprocess, threading, time, unicodedata, urllib.request, urllib.error, zipfile

ROOT=pathlib.Path(__file__).resolve().parents[1]
ENDPOINT='https://japoteacher-ai.raul-nihongo.workers.dev/editorial/generate'
TOKEN_LIMIT=2_000_000
budget_lock=threading.Lock()
budget_stopped=threading.Event()
def reserve(directory,digest,payload):
    # UTF-8 byte count bounds input tokens. Additional 16k covers the fixed
    # editorial instructions, schema and request framing (well below 16k bytes).
    maximum=len(json.dumps(payload,ensure_ascii=False).encode())+16_000+(14_000 if payload['stage']=='annotate' else 9_000)
    with budget_lock:
        path=directory/'budget.json'
        ledger=json.loads(path.read_text(encoding='utf-8')) if path.exists() else {'limit':TOKEN_LIMIT,'uncertain_prior':200_000,'reservations':{}}
        used=sum(json.loads(p.read_text(encoding='utf-8')).get('usage',{}).get('total_tokens',0) for p in directory.glob('*-*.json'))
        charged=used+ledger['uncertain_prior']+sum(ledger['reservations'].values())
        if ledger.get('closed') or budget_stopped.is_set() or charged+maximum>TOKEN_LIMIT:
            budget_stopped.set();raise RuntimeError(f'Límite de tokens: usados {used}, reserva conservadora {charged-used}, siguiente máximo {maximum}. No se envía la petición.')
        reservation=digest+'-'+str(time.time_ns());ledger['reservations'][reservation]=maximum
        write(path,ledger);return reservation
def release(directory,reservation):
    with budget_lock:
        path=directory/'budget.json';ledger=json.loads(path.read_text(encoding='utf-8'));ledger['reservations'].pop(reservation,None);write(path,ledger)
def normalized(text):
    return re.sub(r'[\s。、！？!?.,「」『』…～~]', '', unicodedata.normalize('NFKC',str(text)))
def write(path,value):
    temporary=path.with_name(path.name+'.'+str(threading.get_ident())+'.tmp')
    temporary.write_text(json.dumps(value,ensure_ascii=False,indent=2),encoding='utf-8');os.replace(temporary,path)
def extract(path):
    rows=[]
    with zipfile.ZipFile(path) as outer:
        for name in sorted(outer.namelist()):
            if not name.endswith('.lrpack'):continue
            if outer.getinfo(name).file_size>10_000_000:raise ValueError('Pack demasiado grande')
            with zipfile.ZipFile(io.BytesIO(outer.read(name))) as pack:
                if pack.getinfo('study.json').file_size>20_000_000:raise ValueError('JSON demasiado grande')
                data=json.loads(pack.read('study.json'))
            episode=int(re.search(r'S01E(\d+)',name)[1])
            for index,segment in enumerate(data['segments']):
                rows.append(dict(segment,id=f'e{episode:02d}-{index:04d}',episode=episode,segment=index,source_file=pathlib.PurePosixPath(name).name,
                    context_before=data['segments'][index-1]['japanese'] if index else '',context_after=data['segments'][index+1]['japanese'] if index+1<len(data['segments']) else ''))
    return rows
def review(stage,items,directory,repair_attempt=0):
    payload={'operation':'collection_review','stage':stage,'items':items}
    if repair_attempt:payload['repair_attempt']=repair_attempt
    digest=hashlib.sha256(json.dumps(payload,ensure_ascii=False,sort_keys=True).encode()).hexdigest()[:20]
    target=directory/f'{stage}-{digest}.json'
    if target.exists():data=json.loads(target.read_text(encoding='utf-8'))
    else:
        key=os.environ.get('JAPOTEACHER_EDITORIAL_KEY')
        if not key:raise RuntimeError('Falta clave editorial')
        reservation=reserve(directory,digest,payload)
        req=urllib.request.Request(ENDPOINT,data=json.dumps(payload,ensure_ascii=False).encode(),headers={'Content-Type':'application/json','X-Editorial-Key':key.strip(),'Accept':'application/json','Accept-Encoding':'identity','Connection':'close','User-Agent':'JapoTeacher-Editorial/1.0'},method='POST')
        try:
            if os.environ.get('JAPOTEACHER_EDITORIAL_TRANSPORT')=='node':
                result=subprocess.run(['node',str(ROOT/'scripts/request-collection-editorial.cjs')],input=json.dumps(payload,ensure_ascii=False),encoding='utf-8',capture_output=True,timeout=185)
                if result.returncode:raise RuntimeError(result.stderr[:600])
                data=json.loads(result.stdout)
            else:
                with urllib.request.urlopen(req,timeout=180) as response:data=json.load(response)
        except urllib.error.HTTPError as error:
            budget_stopped.set()
            raise RuntimeError(f'Editorial HTTP {error.code}: {error.read().decode(errors="replace")[:600]}') from None
        except Exception:
            budget_stopped.set();raise
        # Cache even incomplete responses so consumed usage remains auditable.
        write(target,data)
        if isinstance(data.get('usage',{}).get('total_tokens'),int):release(directory,reservation)
    result=data.get('result',{}).get('items',[])
    expected={r['id'] for r in items};counts=collections.Counter(r.get('id') for r in result)
    valid=[r for r in result if r.get('id') in expected and counts[r['id']]==1]
    missing=[r for r in items if r['id'] not in {x['id'] for x in valid}]
    if missing:
        if repair_attempt>=2:raise RuntimeError(f'Respuesta editorial incompleta: {target.name}')
        valid.extend(review(stage,missing,directory,repair_attempt+1))
    result=valid
    return result
def run_stage(stage,items,size,directory,workers=4):
    groups=[items[i:i+size] for i in range(0,len(items),size)];result=[]
    with concurrent.futures.ThreadPoolExecutor(max_workers=workers) as pool:
        futures=[pool.submit(review,stage,group,directory) for group in groups]
        for i,future in enumerate(concurrent.futures.as_completed(futures),1):
            result.extend(future.result())
            print(json.dumps({'stage':stage,'batches':i,'total':len(groups),'accepted':sum(x['approved'] for x in result)}),flush=True)
    return sorted(result,key=lambda x:x['id'])
def main():
    parser=argparse.ArgumentParser();parser.add_argument('zip');parser.add_argument('workdir');parser.add_argument('--stage',choices=['extract','screen','annotate','verify','all'],default='all');args=parser.parse_args()
    directory=pathlib.Path(args.workdir);directory.mkdir(parents=True,exist_ok=True)
    rows=extract(args.zip);write(directory/'source.json',rows)
    write(directory/'source-manifest.json',{'archive_sha256':hashlib.sha256(pathlib.Path(args.zip).read_bytes()).hexdigest(),'archive_name':pathlib.Path(args.zip).name,'segments':len(rows),'files':sorted({r['source_file'] for r in rows})})
    bank=list(csv.DictReader((ROOT/'data/exercises.full.csv').open(encoding='utf-8-sig',newline='')))
    seen={normalized(r['source_text'] if r['direction']=='ja_es' else r['reference_translation']) for r in bank}
    candidates=[];rejected=[]
    for r in rows:
        sig=normalized(r['japanese']);reason=''
        if sig in seen:reason='duplicado'
        elif len(sig)<7:reason='expresión breve o fragmento sin carga suficiente'
        elif not re.search(r'[一-龯ぁ-んァ-ヶ]',sig):reason='sin japonés'
        if reason:rejected.append({'id':r['id'],'reason':reason})
        else:seen.add(sig);candidates.append(r)
    write(directory/'prefilter.json',rejected)
    print(json.dumps({'segments':len(rows),'prefilter_rejected':len(rejected),'candidates':len(candidates)}),flush=True)
    if args.stage=='extract':return
    if args.stage in ['screen','all']:
        screened=run_stage('screen',[{k:r[k] for k in ['id','japanese','context_before','context_after']} for r in candidates],45,directory)
        write(directory/'screened.json',screened)
    if args.stage=='screen':return
    screened=json.loads((directory/'screened.json').read_text(encoding='utf-8'));accepted={r['id'] for r in screened if r['approved']}
    candidates=[r for r in candidates if r['id'] in accepted]
    if args.stage in ['annotate','all']:
        annotated=run_stage('annotate',[{k:r[k] for k in ['id','japanese','reading','context_before','context_after']} for r in candidates],8,directory)
        write(directory/'annotated.json',annotated)
    if args.stage=='annotate':return
    annotated=json.loads((directory/'annotated.json').read_text(encoding='utf-8'));sources={r['id']:r for r in rows}
    if args.stage in ['verify','all']:
        verified=run_stage('verify',[dict(r,japanese=sources[r['id']]['japanese']) for r in annotated if r['approved']],25,directory)
        write(directory/'verified.json',verified)
    usage=sum(json.loads(p.read_text(encoding='utf-8')).get('usage',{}).get('total_tokens',0) for p in directory.glob('*-*.json'))
    print(json.dumps({'done':True,'tokens':usage}),flush=True)
if __name__=='__main__':main()
