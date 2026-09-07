import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import vm from 'node:vm';
import {mnemonicInput,mnemonicRequest,validMnemonic} from '../worker/src/mnemonic.js';
import worker from '../worker/src/index.js';
const payload={exercise:{direction:'ja_es',japanese_sentence:'昨日、本を借りました。',spanish_sentence:'Ayer pedí prestado un libro.'},user_answer:'Ayer presté un libro.',errors:[{source_span:'presté',corrected_span:'pedí prestado',explanation_es:'借りる significa recibir prestado.'}]};
test('mnemonic request includes only bounded error context and caps generation',()=>{
  const input=mnemonicInput({...payload,account:'private',exercise:{...payload.exercise,unrelated:'private'}});
  assert.deepEqual(input,payload);assert.deepEqual(mnemonicInput({...payload,errors:[]}),{...payload,errors:[]});assert.equal(mnemonicInput({...payload,user_answer:'a'.repeat(1201)}),null);assert.equal(mnemonicInput({...payload,errors:[null]}),null);
  const request=mnemonicRequest(input);assert.equal(request.max_output_tokens,850);assert.equal(request.reasoning.effort,'none');assert.equal(request.text.format.schema.properties.tips.maxItems,2);
  assert(!validMnemonic({tips:[],note_es:''}));assert(validMnemonic({tips:[],note_es:'No hay un error real.'}));assert(!validMnemonic({tips:[{target_es:'x'}],note_es:''}));
});
test('mnemonic appears for correct and incorrect answers and escapes saved content',()=>{
  const context={window:{},document:{addEventListener(){}}};
  for(const file of ['mnemonic','ui'])vm.runInNewContext(fs.readFileSync(new URL('../src/'+file+'.js',import.meta.url),'utf8'),context);
  const feedback=errors=>context.window.UI.feedback({errors,kanji_readings:[],strengths:[],overall_score:80},'presté',{direction:'ja_es',attemptId:'a'});
  assert(feedback([]).includes('data-mnemonic-generate'));
  assert(feedback([{source_span:'本。',corrected_span:'本'}]).includes('data-mnemonic-generate'));
  assert(feedback(payload.errors).includes('data-mnemonic-generate'));
  const html=context.window.Mnemonic.html('a',payload.errors,{mnemonic_json:JSON.stringify({tips:[{target_es:'<img src=x>',trick_es:'Una escena.',rule_es:'Una regla.'}],note_es:''})});
  assert(html.includes('&lt;img'));assert(!html.includes('<img'));
});
test('sync preserves mnemonic independently of score and difficulty changes in either merge direction',()=>{
  const cloud=fs.readFileSync(new URL('../src/cloud-sync.js',import.meta.url),'utf8'),start=cloud.indexOf('  function attemptUpdatedAt('),end=cloud.indexOf('  function mergeSession(',start);
  const merge=vm.runInNewContext(cloud.slice(start,end)+';mergeAttempt');
  const advice={attempted_at:'2026-09-07T10:00:00Z',overall_score:60,mnemonic_json:'{"tips":[]}',mnemonic_updated_at:'2026-09-07T12:00:00Z'};
  const score={attempted_at:advice.attempted_at,manual_score_adjusted_at:'2026-09-07T11:00:00Z',overall_score:85};
  for(const result of [merge(advice,score),merge(score,advice)]){assert.equal(result.overall_score,85);assert.equal(result.mnemonic_json,advice.mnemonic_json)}
});
test('mnemonic endpoint authenticates, rejects bad input and handles incomplete model output without retries',async t=>{
  const env={OPENAI_API_KEY:'fake',SUPABASE_URL:'https://auth.test',SUPABASE_PUBLISHABLE_KEY:'fake',APP_ORIGINS:'https://app.test'};
  let calls=0,output={tips:[{target_es:'借りる',trick_es:'Imagina pedir un carrito prestado.',rule_es:'借りる（かりる）: recibir prestado.'}],note_es:''};
  t.mock.method(globalThis,'fetch',async(url,options)=>{
    if(String(url).startsWith(env.SUPABASE_URL))return Response.json(true);
    calls++;assert.equal(JSON.parse(options.body).max_output_tokens,850);
    return Response.json({output:[{content:[{type:'output_text',text:JSON.stringify(output)}]}]});
  });
  const request=(body=payload,headers={})=>new Request('https://worker.test/mnemonic',{method:'POST',headers:{Origin:'https://app.test','Content-Type':'application/json',Authorization:'Bearer fake','X-Device-ID':'test',...headers},body:JSON.stringify(body)});
  assert.equal((await worker.fetch(request(payload,{Authorization:''}),env)).status,409);assert.equal(calls,0);
  assert.equal((await worker.fetch(request({...payload,errors:null}),env)).status,400);assert.equal(calls,0);
  const result=await worker.fetch(request(),env);assert.equal(result.status,200);assert.deepEqual((await result.json()).mnemonic,output);assert.equal(calls,1);
  assert.equal((await worker.fetch(request({...payload,errors:[]}),env)).status,200);assert.equal(calls,2);
  output={tips:[],note_es:''};assert.equal((await worker.fetch(request(),env)).status,502);assert.equal(calls,3);
});
