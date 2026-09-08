import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
function fixture(exercises=[],attempts=[],progress=[]){
  const stores={settings:new Map(),daily_sessions:new Map(),exercises:new Map(exercises.map(e=>[e.exercise_id,e])),attempts:new Map(attempts.map((a,i)=>[i,a])),exercise_progress:new Map(progress.map((p,i)=>[i,p]))};
  const context={window:null,Date,Map,Set,JapoDB:{all:async s=>[...stores[s].values()],get:async(s,k)=>stores[s].get(k),put:async(s,v)=>stores[s].set(v.key||v.session_id,v)},TopicProgression:{},StudyCollections:{catalog:[{id:'sakamoto',name:'Sakamoto',available:true}]}};context.window=context;
  for(const file of ['difficulty','session-planner','study-plans'])vm.runInNewContext(fs.readFileSync(new URL('../src/'+file+'.js',import.meta.url),'utf8'),context);
  return {plans:context.StudyPlans,stores};
}
const ex=(id,extra={})=>({exercise_id:id,source_text:'日本語'+id,reference_translation:'Frase '+id,direction:'ja_es',jlpt_level:'N5',difficulty:10,dataset_version:4,active:true,...extra});
const date='2026-09-08',old='2026-08-01T10:00:00Z',today=date+'T10:00:00Z';
const plan={id:'N5::ja_es',name:'N5',collection:'',levels:['N5'],direction:'ja_es',dailyLimit:3,newLimit:1,weeklyNewLimit:0,quizSize:2,cooldownDays:0,adaptive:false,reviewsFirst:true,mode:'learn'};
const attempt=(id,time=old)=>({exercise_id:id,profile_id:'p',direction:'ja_es',attempted_at:time,overall_score:80,evaluation_status:'valid'});
test('independent content/direction plans use total and new caps with reviews first',()=>{
  const rows=[ex('r1'),ex('r2'),ex('n1'),ex('n2'),ex('s',{source_collection:'sakamoto'}),ex('reverse',{direction:'es_ja'}),ex('n4',{jlpt_level:'N4'})],a=[attempt('r1'),attempt('r2')],{plans}=fixture();
  const selected=plans.select(plan,rows,a,[],'p',date);assert.deepEqual([...selected.ids].sort(),['n1','r1','r2']);assert.equal(selected.stats.total,4);assert.equal(selected.stats.unseen,2);
  assert.equal(plans.select({...plan,dailyLimit:1},rows,a,[],'p',date).ids.length,1);
  assert.equal(plans.select({...plan,mode:'review'},rows,[],[],'p',date).ids.length,0);
});
test('recalculation cannot reset total/new/weekly consumption and preserves drafts',()=>{
  const rows=[ex('done'),ex('n1'),ex('draft')],a=[attempt('done',today)],{plans}=fixture();
  assert.equal(plans.select(plan,rows,a,[],'p',date,[],['done'],true).ids.length,1);
  const result=plans.select({...plan,newLimit:3,weeklyNewLimit:1},rows,a,[],'p',date,[],['done'],true);assert.deepEqual([...result.ids],['done']);
  assert.deepEqual([...plans.select({...plan,paused:true,dailyLimit:0},rows,a,[],'p',date,['draft'],['done','draft'],true).ids],['done','draft']);
});
test('review schedules and blocked difficulty are respected; general never consumes collections',()=>{
  const rows=[ex('future'),ex('hard',{difficulty:90}),ex('s',{source_collection:'sakamoto'})],a=[attempt('future')],p=[{exercise_id:'future',profile_id:'p',last_seen_at:old,next_review_at:'2027-01-01T00:00:00Z'}],{plans}=fixture();
  const result=plans.select({...plan,adaptive:true},rows,a,p,'p',date);assert.equal(result.ids.length,0);assert.equal(result.stats.locked,1);
  assert.deepEqual([...plans.select({...plan,adaptive:false},rows,a,p,'p',date).ids],['hard']);
});
test('legacy migration is idempotent and preserves aggregate daily quotas',async()=>{
  const {plans}=fixture();const settings={profileId:'p',dailyJaEs:15,dailyEsJa:7,levels:['N5','N4'],studyCollection:'sakamoto',collectionRatio:70,newRatio:60};
  await plans.ensure(settings);await plans.ensure(settings);const rows=await plans.all('p');assert.equal(rows.length,6);
  for(const [d,total]of [['ja_es',15],['es_ja',7]]){assert.equal(rows.filter(p=>p.direction===d).reduce((n,p)=>n+p.dailyLimit,0),total);assert.equal(rows.filter(p=>p.direction===d).reduce((n,p)=>n+p.newLimit,0),Math.ceil(total*.6))}
  const first=rows[0];await plans.save('p',{...first,newLimit:0});await plans.ensure(settings);assert.equal((await plans.all('p')).find(p=>p.id===first.id).newLimit,0);
});
test('build preserves old answers/drafts and paused plans without changing attempts',async()=>{
  const rows=[ex('done'),ex('draft'),ex('new')],a=[attempt('done',today)],{plans,stores}=fixture(rows,a);const settings={profileId:'p',dailyJaEs:3,dailyEsJa:0,levels:['N5'],newRatio:100};
  await plans.ensure(settings);await plans.save('p',{...plan,paused:true,dailyLimit:0});stores.daily_sessions.set('p::'+date,{session_id:'p::'+date,exercise_ids_ja_es_json:'["done","draft","new"]',completed_exercise_ids_json:'["done"]',drafts_json:'{"draft":"mi respuesta"}'});
  const session=await plans.build('p',settings,date,{regenerate:true});assert.deepEqual(JSON.parse(session.exercise_ids_ja_es_json),['done','draft']);assert.equal(JSON.parse(session.drafts_json).draft,'mi respuesta');assert.equal(stores.attempts.size,1);
});
test('replacement stays within the plan and keeps the new/review category',async()=>{
  const rows=[ex('current'),ex('other'),ex('s',{source_collection:'sakamoto'}),ex('r')],a=[attempt('r')],{plans}=fixture(rows,a);await plans.save('p',plan);
  const session={profile_id:'p',local_date:date,exercise_ids_ja_es_json:'["current"]',study_plan_assignments_json:JSON.stringify({[plan.id]:['current']})};
  const result=await plans.replace(session,'current','too_hard',{profileId:'p'});assert.equal(result.exerciseId,'other');assert.deepEqual(JSON.parse(result.session.study_plan_assignments_json)[plan.id],['other']);
});
test('changing plan levels cannot reset the new allowance already consumed today',()=>{
  const rows=[ex('done',{jlpt_level:'N4'}),ex('new')],a=[{...attempt('done',today),study_plan_id:plan.id}],{plans}=fixture();
  assert.deepEqual([...plans.select(plan,rows,a,[],'p',date,['done'],['done'],true).ids],['done']);
});
