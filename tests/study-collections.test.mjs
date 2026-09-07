import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
function fixture(rows=[],existing=[]){
  let fetches=0,writes=0;const storage=new Map();
  const context={window:{},AbortSignal,localStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)},JapoDB:{all:async()=>existing,bulkPut:async(store,rows)=>{writes++;existing.push(...rows)}},fetch:async()=>{fetches++;return {ok:true,json:async()=>({collection_id:'sakamoto',exercises:rows})}}};
  vm.runInNewContext(fs.readFileSync(new URL('../src/schema-validation.js',import.meta.url),'utf8'),context);context.SchemaValidation=context.window.SchemaValidation;
  vm.runInNewContext(fs.readFileSync(new URL('../src/study-collections.js',import.meta.url),'utf8'),context);
  const api=context.window.StudyCollections;api.catalog[0].available=true;
  return {api,existing,storage,get fetches(){return fetches},get writes(){return writes}};
}
function pair(id='x',japanese='明日は休みです。'){
  const common={pair_id:id,source_collection:'sakamoto',review_status:'approved',jlpt_level:'N5',topic_tags:['rutina']};
  return [{...common,exercise_id:id+'ja',direction:'ja_es',source_language:'ja',target_language:'es',source_text:japanese,reference_translation:'Mañana es día libre.'},{...common,exercise_id:id+'es',direction:'es_ja',source_language:'es',target_language:'ja',source_text:'Mañana es día libre.',reference_translation:japanese}];
}
test('collection loads once and excludes its editorial bank from user-owned content',async()=>{
  const f=fixture(pair());await f.api.load();await f.api.load();assert.equal(f.fetches,1);assert.equal(f.writes,1);assert.equal(f.existing.length,2);assert(f.existing.every(e=>e.sync_scope==='editorial'));assert(f.api.options(f.existing).includes('1 frases revisadas'));
});
test('unreviewed or incomplete pairs never enter IndexedDB or create a success checkpoint',async()=>{
  for(const rows of [[pair()[0]],pair().map(e=>({...e,review_status:'pending'}))]){
    const f=fixture(rows);await assert.rejects(f.api.load());assert.equal(f.writes,0);assert.equal(f.storage.size,0);
  }
});
test('a duplicate in either direction excludes the whole pair without losing existing progress identities',async()=>{
  const old={...pair()[0],exercise_id:'old',source_collection:''};const f=fixture([...pair(),...pair('new','今日は休みです。')],[old]);await f.api.load();assert.equal(f.existing.length,3);assert.equal(f.existing[0].exercise_id,'old');assert(f.existing.slice(1).every(e=>e.pair_id==='new'));
});
