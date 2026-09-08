import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const context={window:{}};
vm.runInNewContext(fs.readFileSync(new URL('../src/srs.js',import.meta.url),'utf8'),context);
const {SRS}=context.window;
test('manual mastery survives grading rebuilds and never shortens a later review',()=>{
  const attempt={profile_id:'p',exercise_id:'e',attempt_id:'a',attempted_at:'2026-09-08T12:00:00Z',user_answer:'sí',mastered_at:'2026-09-08T12:01:00Z',mastered_until:'2026-11-09T12:01:00Z'};
  const ev={overall_score:50,comprehensibility_score:50,errors:[],meaning_changed:true};
  const p=SRS.update(null,attempt,ev,{cooldownDays:0});
  assert.equal(p.next_review_at,attempt.mastered_until);assert.equal(p.mastered,true);assert.equal(p.last_score,50);assert.equal(p.total_attempts,1);
  const later=SRS.applyMastery({...p,next_review_at:'2027-01-01T00:00:00Z'},attempt);
  assert.equal(later.next_review_at,'2027-01-01T00:00:00Z');
  const rebuilt=SRS.update(p,{...attempt,attempted_at:'2026-09-09T12:00:00Z',user_difficulty_feedback:'too_hard'},ev,{});
  assert.equal(rebuilt.next_review_at,attempt.mastered_until);
});

test('mastery survives an independent score edit during sync in either direction',()=>{
  const cloud=fs.readFileSync(new URL('../src/cloud-sync.js',import.meta.url),'utf8'),start=cloud.indexOf('  function attemptUpdatedAt('),end=cloud.indexOf('  function mergeSession(',start);
  const merge=vm.runInNewContext(cloud.slice(start,end)+';mergeAttempt');
  const marked={attempted_at:'2026-09-08T10:00:00Z',overall_score:60,mastered_at:'2026-09-08T12:00:00Z',mastered_until:'2026-11-09T12:00:00Z'};
  const score={attempted_at:marked.attempted_at,manual_score_adjusted_at:'2026-09-08T13:00:00Z',overall_score:85};
  for(const row of [merge(marked,score),merge(score,marked)]){assert.equal(row.overall_score,85);assert.equal(row.mastered_until,marked.mastered_until)}
});
