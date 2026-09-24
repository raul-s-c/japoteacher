import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const context={window:{}};vm.runInNewContext(fs.readFileSync(new URL('../src/practice-rounds.js',import.meta.url),'utf8'),context);
const R=context.window.PracticeRounds,session={session_id:'day',profile_id:'p',completed_exercise_ids_json:'["a","b","c"]'};
const a=(id,score,n)=>({exercise_id:id,overall_score:score,attempt_id:String(n),attempted_at:`2026-09-18T10:00:${String(n).padStart(2,'0')}Z`,profile_id:'p',session_id:'day',evaluation_status:'valid'});
test('finish the entire round before shuffling failures; repeat until each reaches 50',()=>{
 let rows=[],round=R.create(['a','b','c'],rows,session);
 rows.push(a('a',20,1));round=R.reconcile(round,rows,session);assert.deepEqual([...round.remaining],['b','c']);assert.equal(round.number,1);
 rows.push(a('b',49,2),a('c',50,3));round=R.reconcile(round,rows,session,()=>true,()=>0);assert.deepEqual([...round.remaining],['b','a']);assert.equal(round.number,2);
 rows.push(a('b',50,4));round=R.reconcile(round,rows,session);assert.deepEqual([...round.remaining],['a']);
 rows.push(a('a',40,5));round=R.reconcile(round,rows,session);assert.equal(round.number,3);assert.deepEqual([...round.remaining],['a']);
 rows.push(a('a',50,6));round=R.reconcile(round,rows,session);assert.equal(round.finished,true);assert.equal(round.remaining.length,0);
});
test('manual edits of the same attempt change retries and completion, even after reload',()=>{
 const rows=[a('a',20,1)];let round=R.create(['a'],[],session);
 rows[0].overall_score=50;round=R.reconcile(JSON.parse(JSON.stringify(round)),rows,session);assert.equal(round.finished,true);
 rows[0].overall_score=49;assert.deepEqual([...R.failed(['a'],rows,session)],['a']);
 assert(!R.completedIds(session,rows).includes('a'));
});
test('invalid evaluations and different sessions/profiles do not finish a question',()=>{
 const round=R.create(['a'],[],session),rows=[{...a('a',100,1),evaluation_status:'invalid'},{...a('a',100,2),profile_id:'other'},{...a('a',100,3),session_id:'yesterday'},{...a('a',null,4)}];
 assert.deepEqual([...R.reconcile(round,rows,session).remaining],['a']);
});
test('a restored retry skips an answer manually raised to 50 and ignores blocked items',()=>{
 const rows=[a('a',10,1),a('b',20,2)];let round=R.reconcile(R.create(['a','b'],[],session),rows,session);
 rows[0].overall_score=50;round=R.reconcile(round,rows,session,id=>id!=='b');assert.equal(round.finished,true);
});


test('last passing answer completes yesterday without Next; failed retries remain open',()=>{
 const day={...session,exercise_ids_ja_es_json:'["a","b"]',exercise_ids_es_ja_json:'[]',completed_exercise_ids_json:'[]',status:'in_progress',drafts_json:'{"b":"answer"}'};
 const rows=[a('a',100,1),a('b',49,2)];
 assert.equal(R.sessionResult(day,rows).status,'in_progress');
 rows.push(a('b',50,3));const recovered=R.sessionResult(day,rows);
 assert.equal(recovered.status,'completed');assert.equal(recovered.completed_at,rows[2].attempted_at);
 assert.deepEqual(JSON.parse(recovered.completed_exercise_ids_json),['a','b']);assert.equal(recovered.drafts_json,day.drafts_json);
 rows[2].overall_score=20;assert.equal(R.sessionResult(recovered,rows).status,'in_progress');
});

test('historical repair is idempotent and cannot invent answers from another day',async()=>{
 let sessions=[{...session,exercise_ids_ja_es_json:'["a"]',completed_exercise_ids_json:'[]',drafts_json:'{}',status:'in_progress',completed_at:null}];
 let attempts=[{...a('a',100,1),session_id:'other'}];
 const db={all:async name=>name==='attempts'?attempts:sessions,bulkPut:async(_name,rows)=>sessions=rows};
 assert.equal(await R.repairSessions(db),0);
 attempts=[a('a',100,1)];assert.equal(await R.repairSessions(db),1);assert.equal(sessions[0].status,'completed');
 assert.equal(await R.repairSessions(db),0);
});

test('expand an old ten-question round to the full plan without replaying passed answers',()=>{
 const ids=Array.from({length:20},(_,i)=>'q'+i),rows=[];
 let round=R.create(ids.slice(0,10),rows,session);
 rows.push(a('q0',90,1),a('q1',20,2));
 round=R.reconcile(round,rows,session);
 const snapshot=JSON.stringify(rows);
 for(const size of [15,20]){
  round=R.reconcile(R.expand(round,ids.slice(1,size),rows,session),rows,session);
  assert.equal(round.scope.length,size);
  assert.equal(round.remaining.length,size-2);
  assert(!round.remaining.includes('q0'));
  assert(!round.remaining.includes('q1'));
  assert.equal(round.number,1);
 }
 for(let i=2;i<20;i++)rows.push(a('q'+i,80,i+1));
 round=R.reconcile(round,rows,session);
 assert.deepEqual([...round.remaining],['q1']);assert.equal(round.number,2);
 assert.equal(JSON.stringify(rows.slice(0,2)),snapshot);
});
