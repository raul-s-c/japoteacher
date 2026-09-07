import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../src/feedback-vocabulary.js',import.meta.url),'utf8');
function vocabulary(){
  const context={window:{JAPOTEACHER_FEEDBACK_USAGE:[
    ['今日','きょう',0.31,'N5','today','今日|きょう'],
    ['作る','つくる',7.78,'N5','make','作る'],
    ['交渉','こうしょう',30,'N3','negotiate','交渉'],
    ['校章','こうしょう',75,'N2','emblem','校章'],
  ]}};
  vm.runInNewContext(source,context);return context.window.FeedbackVocabulary;
}
test('kana aliases and inflected verbs retain their real reference percentile',()=>{
  const api=vocabulary();
  assert.equal(api.resolve({characters:'きょう'})[0].p,0.31);
  assert.equal(api.resolve({characters:'作りました'})[0].p,7.78);
});
test('homophones and unknown terms never inherit an arbitrary percentile',()=>{
  const api=vocabulary();
  assert.equal(api.resolve({characters:'こうしょう'}).length,0);
  assert.equal(api.resolve({characters:'晩ご飯'}).length,0);
});
test('date spelling does not alter Kyoto or normally-kana words',()=>{
  const api=vocabulary();
  assert.equal(api.canonical('きょうとに行く。'),'きょうとに行く。');
  assert.equal(api.canonical('きょうはうちです。'),'今日はうちです。');
});
test('stale embedded percentiles cannot override the current reference, including grouped readings',()=>{
  const api=vocabulary(),exercise={usage_components:[{k:'v',t:'今日',p:1.3,l:'N4'},{k:'v',t:'交渉',p:1.3,l:'N4'}]};
  assert.equal(api.resolve({characters:'今日'},exercise)[0].p,.31);
  const group=api.resolve({characters:'今日の交渉'},exercise);
  assert.deepEqual(Array.from(group,x=>x.p),[.31,30]);
  assert.equal(api.resolve({characters:'交渉'},exercise)[0].l,'N3');
});


test('the published reference has consistent frequency bands for every entry',()=>{
  const context={window:{}};
  vm.runInNewContext(fs.readFileSync(new URL('../src/feedback-usage-data.js',import.meta.url),'utf8'),context);
  const api=vocabulary(),entries=context.window.JAPOTEACHER_FEEDBACK_USAGE;
  assert.equal(entries.length,10000);
  for(const [term,reading,percent,level] of entries)assert.equal(level,api.frequencyLevel(percent),`${term} (${reading}): ${percent}`);
});
