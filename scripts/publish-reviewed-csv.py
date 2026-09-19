"""Append only explicitly reviewed CSV candidates, without generation or API calls.

First run snapshots matching editorial metadata. Later runs use that immutable
snapshot rather than unrelated pending generation queues. Default is dry-run.
"""
import argparse
import csv
import html
import importlib.util
import json
import os
from pathlib import Path
import re
import sys
import tempfile
import unicodedata

ROOT = Path(__file__).resolve().parents[1]
STEM = 'csv-review-2026-09-19'
EDITORIAL = ROOT / 'data/editorial'


def module(name, filename):
    spec = importlib.util.spec_from_file_location(name, ROOT / 'scripts' / filename)
    result = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(result)
    return result


def signature(text):
    return re.sub(r'[\s。、！？「」『』（）・,.!?]', '', unicodedata.normalize('NFKC', text))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--write', action='store_true')
    args = parser.parse_args()
    candidates = list(csv.DictReader((EDITORIAL / 'frases-aprobadas-2026-09-18-y-19.csv').open(encoding='utf-8-sig', newline='')))
    decisions = json.loads((EDITORIAL / f'{STEM}-decisions.json').read_text(encoding='utf-8'))
    keys = [f"{r['nivel']}:{r['slot']}" for r in candidates]
    assert len(keys) == len(set(keys)) and set(keys) == set(decisions), 'Missing or duplicate review decisions'
    snapshot_path = EDITORIAL / f'{STEM}-accepted.json'
    if snapshot_path.exists():
        metadata = json.loads(snapshot_path.read_text(encoding='utf-8'))
    else:
        metadata = {}
        for level in ('N5', 'N4'):
            for line in (EDITORIAL / f'{level.lower()}-approved.jsonl').read_text(encoding='utf-8').splitlines():
                if line.strip():
                    item = json.loads(line)
                    key = f"{level}:{item['slot']}"
                    if decisions.get(key, {}).get('accept'):
                        assert key not in metadata, f'Duplicate metadata: {key}'
                        metadata[key] = item
    bank = ROOT / 'data/exercises.full.csv'
    with bank.open(encoding='utf-8-sig', newline='') as stream:
        reader = csv.DictReader(stream)
        fields, old = reader.fieldnames, list(reader)
    old_by_id = {r['exercise_id']: r for r in old}
    collection = json.loads((ROOT / 'data/collections/sakamoto.json').read_text(encoding='utf-8'))
    known = {signature(r['source_text']) for r in old + collection['exercises'] if r['direction'] == 'ja_es'}
    prefix = 'window.JAPOTEACHER_FURIGANA='
    furi_path = ROOT / 'src/furigana-generated.js'
    furi = json.loads(furi_path.read_text(encoding='utf-8').strip()[len(prefix):-1])
    accepted = {'N5': [], 'N4': []}
    generator = module('csv_generator', 'editorial-generate.py')
    already = 0
    for candidate, key in zip(candidates, keys):
        decision = decisions[key]
        if not decision['accept']:
            continue
        item = metadata[key]
        assert (item['japanese'], item['spanish']) == (candidate['japones'], candidate['espanol']), f'CSV metadata mismatch: {key}'
        assert decision['level'] in ('N5', 'N4', 'N3', 'N2', 'N1')
        assert 0 <= decision['difficulty'] <= 100
        generator.validate_slot(item, item['coverage_slot'])
        assert item.get('equivalence_verified'), f'No equivalence review: {key}'
        level, slot = candidate['nivel'], int(candidate['slot'])
        ja_id = f'JAES-{level}-EDITORIAL-{slot:04d}'
        es_id = ja_id.replace('JAES-', 'ESJA-', 1)
        if ja_id in old_by_id or es_id in old_by_id:
            assert ja_id in old_by_id and es_id in old_by_id, f'Incomplete existing pair: {key}'
            assert old_by_id[ja_id]['source_text'] == item['japanese'] and old_by_id[ja_id]['reference_translation'] == item['spanish']
            assert old_by_id[es_id]['source_text'] == item['spanish'] and old_by_id[es_id]['reference_translation'] == item['japanese']
            already += 1
            continue
        sig = signature(item['japanese'])
        assert sig not in known, f'Duplicate Japanese: {key}'
        cursor, parts, uncovered = 0, [], ''
        for reading in item['kanji_readings']:
            chars = reading['characters']
            position = item['japanese'].find(chars, cursor)
            if position < 0:
                continue  # Ignore redundant annotations; all actual kanji must be covered below.
            between = item['japanese'][cursor:position]
            uncovered += between
            parts.extend([html.escape(between), f'<ruby>{html.escape(chars)}<rt>{html.escape(reading["reading_hiragana"])}</rt></ruby>'])
            cursor = position + len(chars)
        uncovered += item['japanese'][cursor:]
        assert not any(generator.is_kanji(c) for c in uncovered), f'Missing furigana: {key}'
        parts.append(html.escape(item['japanese'][cursor:]))
        furi[ja_id] = ''.join(parts)
        known.add(sig)
        accepted[level].append(item)
    print(json.dumps({'reviewed': len(candidates), 'accepted': len(metadata), 'new_pairs': sum(map(len, accepted.values())), 'already_present': already, 'write': args.write}))
    if not args.write:
        return
    if not snapshot_path.exists():
        snapshot_path.write_text(json.dumps(metadata, ensure_ascii=False, indent=2), encoding='utf-8')
    if not any(accepted.values()):
        return
    publisher = module('csv_publisher', 'publish-editorial-bank.py')
    classifier = module('csv_classifier', 'usage-classification.py')
    with tempfile.TemporaryDirectory(prefix='japoteacher-reviewed-csv-') as directory:
        stage = Path(directory)
        (stage / 'data/editorial').mkdir(parents=True)
        for level, items in accepted.items():
            (stage / f'data/editorial/{level.lower()}-approved.jsonl').write_text(''.join(json.dumps(i, ensure_ascii=False) + '\n' for i in items), encoding='utf-8')
        new_bank = stage / 'data/exercises.full.csv'
        with new_bank.open('w', encoding='utf-8-sig', newline='') as stream:
            csv.DictWriter(stream, fieldnames=fields).writeheader()
        publisher.ROOT, publisher.CSV_PATH = stage, new_bank
        prior_env = os.environ.get('JAPOTEACHER_USAGE_REFERENCE_ZIP')
        prior_argv = sys.argv
        os.environ['JAPOTEACHER_USAGE_REFERENCE_ZIP'] = str(stage / 'unused.zip')
        sys.argv = ['publish-editorial-bank.py', '--append-only']
        try:
            publisher.main()
        finally:
            sys.argv = prior_argv
            if prior_env is None:
                os.environ.pop('JAPOTEACHER_USAGE_REFERENCE_ZIP', None)
            else:
                os.environ['JAPOTEACHER_USAGE_REFERENCE_ZIP'] = prior_env
        classifier.classify_bank(new_bank, Path.home() / 'Downloads/japanese_usage_progress_v2_csv.zip', write=True)
        with new_bank.open(encoding='utf-8-sig', newline='') as stream:
            new = list(csv.DictReader(stream))
    for row in new:
        _, level, _, slot = row['exercise_id'].split('-')
        decision = decisions[f'{level}:{int(slot)}']
        row['jlpt_level'] = row['original_jlpt_level'] = decision['level']
        row['difficulty'] = row['original_difficulty'] = str(decision['difficulty'])
    staged_bank = bank.with_suffix('.reviewed.tmp')
    with staged_bank.open('w', encoding='utf-8-sig', newline='') as stream:
        writer = csv.DictWriter(stream, fieldnames=fields)
        writer.writeheader()
        writer.writerows(old + new)
    staged_furi = furi_path.with_suffix('.reviewed.tmp')
    staged_furi.write_text(prefix + json.dumps(furi, ensure_ascii=False, separators=(',', ':')) + ';\n', encoding='utf-8')
    os.replace(staged_furi, furi_path)
    os.replace(staged_bank, bank)


if __name__ == '__main__':
    main()
