import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {validLessonInput,validLesson,generateLesson} from '../worker/src/daily-lesson.js';
const context={window:{},document:{addEventListener(){}}};
vm.runInNewContext(fs.readFileSync(new URL('../src/daily-lesson.js',import.meta.url),'utf8'),context);
const build=context.window.DailyLesson.buildPlan;
const row=(id,direction,terms,active=true)=>({exercise_id:id,direction,source_language:direction==='ja_es'?'ja':'es',source_text:direction==='ja_es'?'猫がいます。':'Hay un gato.',reference_translation:direction==='ja_es'?'Hay un gato.':'猫がいます。',vocabulary_tags:terms,active});
const session={profile_id:'p',session_id:'p::2026-09-05',local_date:'2026-09-05',exercise_ids_ja_es_json:'["a","blocked"]',exercise_ids_es_ja_json:'["b"]'};
test('prepares both directions, including unseen and weak vocabulary, excluding blocked and unplanned exercises',()=>{
 const plan=build(session,[row('a','ja_es',['猫']),row('b','es_ja',['猫','犬']),row('blocked','ja_es',['魚'],false),row('other','ja_es',['鳥'])],[{profile_id:'p',exercise_id:'b',total_attempts:3,last_score:40}]);
 assert.deepEqual([...plan.terms],['猫','犬']);assert.equal(plan.rows.length,2);assert.equal(plan.rows.find(x=>x.id==='b').priority,1);
 assert.equal(plan.signature,build(session,[row('a','ja_es',['猫']),row('b','es_ja',['猫','犬'])],[]).signature);
});
test('never truncates a large daily vocabulary and invalidates changed plan content',()=>{
 const rows=[row('a','ja_es',Array.from({length:53},(_,i)=>`語${i}`))];
 const p=build(session,rows);assert.equal(p.chunks.length,3);assert.equal(p.chunks.flatMap(c=>c.terms).length,53);
 assert.notEqual(p.signature,build(session,[row('a','ja_es',['犬'])]).signature);
});
test('validates bounds and requires literal coverage evidence for every term',()=>{
 assert.equal(validLessonInput({terms:['猫'],contexts:[{japanese:'猫',spanish:'gato'}]}),true);
 assert.equal(Boolean(validLessonInput(null)),false);
 assert.equal(validLessonInput({terms:Array(21).fill('猫'),contexts:[]}),false);
 const lesson={title_es:'Un gato',paragraphs:[{japanese:'猫がいます。',spanish:'Hay un gato.'}],vocabulary:[{term:'猫',surface:'猫',reading:'ねこ',meaning_es:'gato',note_es:''}],readings:[{characters:'猫',reading_hiragana:'ねこ'}],tips_es:[]};
 assert.equal(validLesson(lesson,['猫']),true);assert.equal(validLesson(lesson,['猫','犬']),false);
 assert.equal(validLesson({...lesson,vocabulary:[{...lesson.vocabulary[0],surface:'犬'}]},['猫']),false);
});
test('rejects incomplete model output instead of caching an incomplete lesson',async()=>{
 const original=globalThis.fetch;globalThis.fetch=async()=>new Response(JSON.stringify({output_text:JSON.stringify({title_es:'Missing words',paragraphs:[{japanese:'犬',spanish:'perro'}],vocabulary:[],readings:[],tips_es:[]})}));
 try{await assert.rejects(generateLesson({terms:['猫'],contexts:[]},{OPENAI_API_KEY:'test'}),/no cubrió/)}finally{globalThis.fetch=original}
});
