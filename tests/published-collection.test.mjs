import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
const read=file=>fs.readFileSync(new URL('../'+file,import.meta.url),'utf8');
const data=JSON.parse(read('data/collections/sakamoto.json')),audit=JSON.parse(read('data/collections/sakamoto-audit.json'));
test('published Sakamoto has reviewed, unique, reversible pairs from every episode',()=>{
  const context={window:{}};vm.runInNewContext(read('src/schema-validation.js'),context);vm.runInNewContext(read('src/difficulty.js'),context);
  const pairs=new Map(),ids=new Set(),japanese=new Set(),spanish=new Set();
  for(const e of data.exercises){
    assert.equal(context.window.SchemaValidation.validateExercise(e).length,0,e.exercise_id);
    assert.equal(e.review_status,'approved');assert.equal(e.sync_scope,'editorial');assert.equal(e.source_collection,'sakamoto');
    assert.equal(context.window.Difficulty.score(e),e.difficulty);assert(!ids.has(e.exercise_id));ids.add(e.exercise_id);
    assert(e.source_episode>=1&&e.source_episode<=11);assert(e.source_start_ms<e.source_end_ms);
    const sentence=e.direction==='ja_es'?e.source_text:e.reference_translation,covered=new Set();
    for(const r of e.kanji_readings){assert(sentence.includes(r.characters));assert(/^[ぁ-ゖー\s・]+$/.test(r.reading_hiragana));for(const c of r.characters.match(/[一-龯]/g)||[])covered.add(c)}
    for(const c of sentence.match(/[一-龯]/g)||[])assert(covered.has(c),`${e.exercise_id}: ${c}`);
    if(e.direction==='ja_es'){
      const ja=sentence.replace(/[\s。、！？!?.,「」『』…]/g,''),es=e.reference_translation.toLowerCase().replace(/[^\p{L}\p{N}_]/gu,'');
      assert(!japanese.has(ja));assert(!spanish.has(es));japanese.add(ja);spanish.add(es);
    }
    const pair=pairs.get(e.pair_id)||[];pair.push(e);pairs.set(e.pair_id,pair);
  }
  for(const pair of pairs.values()){
    assert.equal(pair.length,2);const ja=pair.find(e=>e.direction==='ja_es'),es=pair.find(e=>e.direction==='es_ja');assert(ja&&es);assert.equal(ja.source_text,es.reference_translation);assert.equal(ja.reference_translation,es.source_text);
  }
  assert.equal(Object.keys(audit.episodes).length,11);assert.equal(pairs.size,audit.approved_pairs);assert.equal(data.exercises.length,audit.directional_exercises);
  assert.equal(audit.prefilter_rejected+audit.screen_rejected+audit.annotation_rejected+audit.verification_rejected+audit.publication_rejected.length+audit.approved_pairs,audit.source_segments);
});
test('reviewed tags prevent accidental vocabulary matches across token boundaries',()=>{
  // The collection's classifier consumes its checked lexical inventory instead
  // of finding e.g. 時に (sometimes) inside a clock time followed by に.
  for(const e of data.exercises){
    for(const c of e.usage_components.filter(c=>c.k==='v'))assert(e.vocabulary_tags.some(tag=>tag===c.t||tag.startsWith(c.t)),`${e.exercise_id}: ${c.t}`);
    assert.equal(e.usage_percentile,Math.max(...e.usage_components.map(c=>c.p)));
    const p=e.usage_percentile;assert.equal(e.jlpt_level,p<10?'N5':p<30?'N4':p<60?'N3':p<90?'N2':'N1');
  }
});
