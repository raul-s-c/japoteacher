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
