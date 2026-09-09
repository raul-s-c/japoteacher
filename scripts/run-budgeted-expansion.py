"""Concurrent editorial expansion with durable pre-request token reservations."""
import argparse, importlib.util, json, os, pathlib, subprocess, time, threading, concurrent.futures

ROOT = pathlib.Path(__file__).resolve().parents[1]
OUT = ROOT / 'data/editorial/run-2026-09-08-2.3m.json'
LIMIT = 2_300_000
LOCK = threading.RLock()
spec = importlib.util.spec_from_file_location('editorial', ROOT/'scripts/editorial-generate.py')
editorial = importlib.util.module_from_spec(spec)
spec.loader.exec_module(editorial)

class BudgetStop(Exception): pass

def save(ledger):
    tmp = OUT.with_suffix('.tmp')
    tmp.write_text(json.dumps(ledger, ensure_ascii=False, indent=2), encoding='utf-8')
    for attempt in range(20):
        try:
            os.replace(tmp, OUT)
            return
        except PermissionError:
            if attempt == 19: raise
            time.sleep(.25)

def request(payload, key, retries=1):
    with LOCK:
        ledger = json.loads(OUT.read_text(encoding='utf-8'))
        body = json.dumps(payload, ensure_ascii=False)
        # The entire Worker source bounds fixed instructions/schema bytes; UTF-8
        # bytes conservatively bound input tokens, plus maximum output and framing.
        maximum = len(body.encode()) + (ROOT/'worker/src/index.js').stat().st_size + 16000
        charged = ledger['used'] + sum(ledger['reservations'].values())
        if ledger.get('closed') or OUT.with_suffix('.stop').exists() or charged + maximum > ledger['limit']:
            raise BudgetStop('Insufficient budget for the next fully reserved request')
        rid = str(time.time_ns())
        ledger['reservations'][rid] = maximum
        save(ledger)
    result = subprocess.run(['node', str(ROOT/'scripts/request-collection-editorial.cjs')], input=body, text=True, encoding='utf-8', capture_output=True, timeout=195)
    if result.returncode:
        raise editorial.EditorialTransportError(result.stderr[:400])
    data = json.loads(result.stdout)
    usage = data.get('usage', {}).get('total_tokens')
    if not isinstance(usage, int):
        raise editorial.EditorialTransportError('Response lacks accountable token usage')
    with LOCK:
        ledger = json.loads(OUT.read_text(encoding='utf-8'))
        ledger['used'] += usage
        del ledger['reservations'][rid]
        ledger['calls'] += 1
        save(ledger)
        editorial.record_usage(payload, data)
        print(json.dumps({'tokens_confirmed': ledger['used'], 'reserved':sum(ledger['reservations'].values()), 'calls':ledger['calls']}), flush=True)
    if 'result' not in data:
        raise RuntimeError('Missing editorial result')
    return data['result']

if __name__ == '__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('--ledger',default=str(OUT))
    parser.add_argument('--token-budget',type=int,default=LIMIT)
    args=parser.parse_args();OUT=pathlib.Path(args.ledger);LIMIT=args.token_budget
    if LIMIT<=0:raise SystemExit('Budget must be positive')
    if OUT.exists() and json.loads(OUT.read_text(encoding='utf-8'))['limit']!=LIMIT:raise SystemExit('Existing ledger budget differs; do not reset it')
    if OUT.exists() and json.loads(OUT.read_text(encoding='utf-8')).get('closed'):raise SystemExit('Ledger is closed; preserve it and explicitly authorize continuation')
    if not os.environ.get('JAPOTEACHER_EDITORIAL_KEY'): raise SystemExit('Editorial key unavailable')
    if not OUT.exists():
        save({'limit': LIMIT, 'used': 0, 'calls': 0, 'reservations': {}, 'closed':False,
              'before':{level:len(editorial.read_jsonl(ROOT/f'data/editorial/{level.lower()}-approved.jsonl')) for level in ['N5','N4']}})
    editorial.request_editorial = request
    def worker(level):
        failures = 0
        while True:
            try:
                editorial.run(level, append=4, group_size=4, quality_mode='strict', usage_reference_zip=str(pathlib.Path.home()/'Downloads/japanese_usage_progress_v2_csv.zip'))
                failures = 0
            except BudgetStop:
                return
            except (editorial.EditorialTransportError, subprocess.TimeoutExpired) as error:
                failures += 1
                print(json.dumps({'level':level,'transport_error':str(error),'consecutive_failures':failures}),flush=True)
                if failures >= 3: raise
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
        futures=[pool.submit(worker,level) for level in ['N5','N4']]
        for future in futures: future.result()
    with LOCK:
        ledger=json.loads(OUT.read_text(encoding='utf-8'));ledger['closed']=True;ledger['paused_by_user']=OUT.with_suffix('.stop').exists();ledger['stop_reason']='User stop requested' if ledger['paused_by_user'] else 'Insufficient budget for another fully reserved request';save(ledger)
        print(json.dumps(ledger),flush=True)
