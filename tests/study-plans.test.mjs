import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
function fixture(exercises=[],attempts=[],progress=[]){
  const stores={settings:new Map(),daily_sessions:new Map(),exercises:new Map(exercises.map(e=>[e.exercise_id,e])),attempts:new Map(attempts.map((a,i)=>[i,a])),exercise_progress:new Map(progress.map((p,i)=>[i,p]))};
  const context={window:null,Date,Map,Set,JapoDB:{all:async s=>[...stores[s].values()],get:async(s,k)=>stores[s].get(k),put:async(s,v)=>stores[s].set(v.key||v.session_id,v)},TopicProgression:{},StudyCollections:{catalog:[{id:'sakamoto',name:'Sakamoto',available:true}]}};context.window=context;
  for(const file of ['difficulty','session-planner','practice-rounds','study-plans'])vm.runInNewContext(fs.readFileSync(new URL('../src/'+file+'.js',import.meta.url),'utf8'),context);
  return {plans:context.StudyPlans,stores,planner:context.SessionPlanner};
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
test('weak reviews ignore advisory dates while new difficulty and collection scope remain respected',()=>{
  const rows=[ex('future'),ex('hard',{difficulty:90}),ex('s',{source_collection:'sakamoto'})],a=[attempt('future')],p=[{exercise_id:'future',profile_id:'p',last_seen_at:old,next_review_at:'2027-01-01T00:00:00Z'}],{plans}=fixture();
  const result=plans.select({...plan,adaptive:true},rows,a,p,'p',date);assert.deepEqual([...result.ids],['future']);assert.equal(result.stats.locked,1);
  assert.deepEqual([...plans.select({...plan,adaptive:false},rows,a,p,'p',date).ids],['future','hard']);
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

test('manual mastery stays out of daily reselection until its review date',()=>{
  const e=ex('mastered'),a=[attempt(e.exercise_id)],p=[{profile_id:'p',exercise_id:e.exercise_id,last_seen_at:old,total_attempts:1,mastered:true,mastered_until:'2026-11-09T12:00:00Z',next_review_at:'2026-11-09T12:00:00Z'}],{plans}=fixture();
  assert.equal(plans.select(plan,[e],a,p,'p',date,[],[],true).ids.length,0);
  assert.equal(plans.select(plan,[e],a,p,'p','2026-11-10',[],[],true).ids.length,1);
});

test('nine-day forecast buckets actual review dates, respecting cooldown, scope and suspension',()=>{
 const rows=['one','two','nine','ten','overdue','suspended','cooldown','new','mastered'].map(id=>ex(id));rows.push(ex('inverse',{direction:'es_ja'}));
 const dates={one:'2026-09-09',two:'2026-09-10',nine:'2026-09-17',ten:'2026-09-18',overdue:'2026-09-07',suspended:'2026-09-09',cooldown:'2026-09-09',mastered:'2026-11-09',inverse:'2026-09-09'};
 const a=Object.keys(dates).map(id=>attempt(id,id==='cooldown'?today:old)),p=Object.entries(dates).map(([id,d])=>({exercise_id:id,profile_id:'p',last_seen_at:id==='cooldown'?today:old,total_attempts:1,next_review_at:d+'T12:00:00',suspended:id==='suspended'})),{plans}=fixture();
 const c=plans.classify({...plan,cooldownDays:3},rows,a,p,'p',date),forecast=plans.reviewForecast(c,date);
 assert.deepEqual(Array.from(forecast,r=>r.count),[1,1,1,0,0,0,0,0,1]);assert.equal(forecast[8].date,'2026-09-17');
 const boundary=plans.reviewForecast({learned:[]},'2026-12-29');assert.equal(boundary[2].date,'2027-01-01');assert.equal(boundary.length,9);
});


test('recent average beats dates, cached assignments, regeneration and legacy new-first preference',()=>{
 const rows=['weak','medium','strong','new'].map(id=>ex(id)),a=[{...attempt('weak'),overall_score:10},{...attempt('medium'),overall_score:45},{...attempt('strong','2026-07-01T10:00:00Z'),overall_score:90}],p=[{exercise_id:'weak',profile_id:'p',last_seen_at:old,next_review_at:'2027-01-01T00:00:00Z'}],{plans}=fixture();
 for(const regenerate of [false,true])assert.deepEqual([...plans.select({...plan,dailyLimit:2,newLimit:0,reviewsFirst:false},rows,a,p,'p',date,['strong'],[],regenerate).ids],['weak','medium']);
 assert.deepEqual([...plans.select({...plan,dailyLimit:8},rows,a,p,'p',date).ids],['weak','medium','strong','new']);
});

test('three recent 95+ scores retire automatic reviews; a later poor score restores priority',()=>{
 const rows=[ex('mastered'),ex('weak'),ex('new'),ex('new2')],a=[...['2026-08-01','2026-08-02','2026-08-03'].map((d,i)=>({...attempt('mastered',d+'T10:00:00Z'),overall_score:[100,100,95][i]})),{...attempt('weak'),overall_score:40}],{plans}=fixture();
 const c=plans.classify(plan,rows,a,[],'p',date);assert.equal(c.mastered.length,1);
 assert.deepEqual([...plans.select({...plan,dailyLimit:8},rows,a,[],'p',date,['mastered']).ids],['weak','new']);
 a.push({...attempt('mastered','2026-08-04T10:00:00Z'),overall_score:20});
 assert.deepEqual([...plans.select({...plan,dailyLimit:2,newLimit:0},rows,a,[],'p',date).ids],['weak','mastered']);
});

test('history averages valid scores, respects profiles/direction, and merges duplicate sentence IDs',()=>{
 const rows=[ex('a'),ex('copy',{source_text:'日本語a'}),ex('b'),ex('reverse',{direction:'es_ja',reference_translation:'日本語a'})],a=[{...attempt('copy','2026-08-04T10:00:00Z'),overall_score:20},{...attempt('a'),overall_score:90},{...attempt('b'),overall_score:40},{...attempt('a','2026-08-05T10:00:00Z'),overall_score:100,evaluation_status:'invalid'},{...attempt('a','2026-08-06T10:00:00Z'),overall_score:null},{...attempt('a','2026-08-07T10:00:00Z'),overall_score:100,profile_id:'other'},{...attempt('reverse'),overall_score:0,direction:'es_ja'}],{plans}=fixture();
 assert.deepEqual([...plans.select({...plan,dailyLimit:2},rows,a,[],'p',date).ids],['b','a']);
});

test('existing daily sessions drop mastered pending work and keep completed answers/drafts',async()=>{
 const rows=['mastered','weak','done','draft'].map(id=>ex(id)),a=[...['2026-08-01','2026-08-02','2026-08-03'].map(d=>({...attempt('mastered',d+'T10:00:00Z'),overall_score:100})),{...attempt('weak'),overall_score:20},attempt('done',today)],{plans,stores}=fixture(rows,a),settings={profileId:'p',dailyJaEs:3,dailyEsJa:0,levels:['N5'],newRatio:0};
 await plans.ensure(settings);await plans.save('p',plan);
 stores.daily_sessions.set('p::'+date,{session_id:'p::'+date,study_plan_assignments_json:JSON.stringify({[plan.id]:['mastered','done','draft']}),exercise_ids_ja_es_json:'["mastered","done","draft"]',completed_exercise_ids_json:'["done"]',drafts_json:'{"draft":"saved"}'});
 const session=await plans.build('p',settings,date);assert.deepEqual(JSON.parse(session.exercise_ids_ja_es_json),['done','draft','weak']);assert.equal(JSON.parse(session.drafts_json).draft,'saved');
});


test('daily priority averages only the last three available valid results, without rounding',()=>{
 const rows=['one','two','three','four'].map(id=>ex(id)),scores={one:[60],two:[20,90],three:[30,50,80],four:[0,100,100,40]},a=[];
 for(const [id,values] of Object.entries(scores))values.forEach((score,i)=>a.push({...attempt(id,`2026-08-0${i+1}T10:00:00Z`),overall_score:score}));
 const {plans}=fixture(),c=plans.classify(plan,rows,a,[],'p',date);
 assert.equal(c.ev.recentAverage(rows[0]),60);assert.equal(c.ev.recentAverage(rows[1]),55);assert.equal(c.ev.recentAverage(rows[2]),160/3);assert.equal(c.ev.recentAverage(rows[3]),80);
 assert.deepEqual([...plans.select({...plan,dailyLimit:4,newLimit:0},rows,a,[],'p',date).ids],['three','two','one','four']);
});

test('answered failures stay assigned without consuming new quota again, but day stays in progress',async()=>{
 const rows=[ex('failed'),ex('new')],a=[{...attempt('failed',today),session_id:'p::'+date,overall_score:20}],{plans,stores}=fixture(rows,a),settings={profileId:'p',dailyJaEs:1,dailyEsJa:0,levels:['N5'],newRatio:100};
 await plans.ensure(settings);await plans.save('p',{...plan,dailyLimit:1,newLimit:1});
 stores.daily_sessions.set('p::'+date,{session_id:'p::'+date,profile_id:'p',exercise_ids_ja_es_json:'["failed"]',study_plan_assignments_json:JSON.stringify({[plan.id]:['failed']}),completed_exercise_ids_json:'["failed"]'});
 const s=await plans.build('p',settings,date);assert.deepEqual(JSON.parse(s.exercise_ids_ja_es_json),['failed']);assert.equal(s.status,'in_progress');
});


test('after 6, 10 or 100 answers only the latest three valid scores rank selection',()=>{
 for(const count of [6,10,100]){
  const rows=[ex('many'),ex('medium')],a=[];
  for(let i=0;i<count;i++)a.push({...attempt('many',new Date(Date.UTC(2026,7,1,0,i)).toISOString()),attempt_id:String(i),overall_score:i<count-3?100:[10,20,30][i-(count-3)]});
  a.push({...attempt('medium'),overall_score:25});
  a.push({...attempt('many','2026-08-02T10:00:00Z'),overall_score:100,evaluation_status:'invalid'});
  a.reverse(); // IndexedDB order is not chronological.
  const {plans}=fixture(),c=plans.classify(plan,rows,a,[],'p',date);
  assert.equal(c.ev.recentAverage(rows[0]),20);
  assert.deepEqual([...plans.select({...plan,dailyLimit:1,newLimit:0},rows,a,[],'p',date).ids],['many']);
  const latest=a.find(row=>row.attempt_id===String(count-1));latest.overall_score=90;
  assert.equal(plans.classify(plan,rows,a,[],'p',date).ev.recentAverage(rows[0]),40);
  assert.deepEqual([...plans.select({...plan,dailyLimit:1,newLimit:0},rows,a,[],'p',date).ids],['medium']);
 }
});


test('new quota is reserved before filling with lowest-average reviews, including reselection',()=>{
 const rows=['weak','middle','strong','new1','new2'].map(id=>ex(id)),a=[{...attempt('weak'),overall_score:10},{...attempt('middle'),overall_score:40},{...attempt('strong'),overall_score:80}],{plans}=fixture();
 for(const regenerate of [false,true]){
  assert.deepEqual([...plans.select({...plan,dailyLimit:3,newLimit:1},rows,a,[],'p',date,['weak','middle','strong'],[],regenerate).ids],['weak','middle','new1']);
 }
 assert.deepEqual([...plans.select({...plan,dailyLimit:3,newLimit:0},rows,a,[],'p',date).ids],['weak','middle','strong']);
 assert.deepEqual([...plans.select({...plan,dailyLimit:3,mode:'review'},rows,a,[],'p',date).ids],['weak','middle','strong']);
 assert.deepEqual([...plans.select({...plan,dailyLimit:3,newLimit:2},rows.slice(0,4),a,[],'p',date).ids],['weak','middle','new1']);
 const consumed=[...a,attempt('new1',today)];
 assert.deepEqual([...plans.select({...plan,dailyLimit:3,newLimit:1},rows,consumed,[],'p',date,[],['new1']).ids],['new1','weak','middle']);
 assert.deepEqual([...plans.select({...plan,dailyLimit:3,newLimit:2,weeklyNewLimit:1},rows,consumed,[],'p',date,[],['new1']).ids],['new1','weak','middle']);
});


test('recalculating today twice leaves attempts, progress and previous days byte-for-byte intact',async()=>{
 const rows=['done','draft','review','new1','new2'].map(id=>ex(id));
 const attempts=[{...attempt('done',today),overall_score:30,session_id:'p::'+date},attempt('review')];
 const progress=[{progress_id:'p::done',profile_id:'p',exercise_id:'done',total_attempts:6,last_score:30,last_seen_at:today}];
 const {plans,stores}=fixture(rows,attempts,progress),settings={profileId:'p',dailyJaEs:4,dailyEsJa:0,levels:['N5'],newRatio:50};
 await plans.ensure(settings);await plans.save('p',{...plan,dailyLimit:4,newLimit:2});
 const yesterday={session_id:'p::2026-09-07',completed_exercise_ids_json:'["review"]',status:'completed',local_date:'2026-09-07'};
 stores.daily_sessions.set(yesterday.session_id,yesterday);
 stores.daily_sessions.set('p::'+date,{session_id:'p::'+date,profile_id:'p',exercise_ids_ja_es_json:'["done","draft","review"]',study_plan_assignments_json:JSON.stringify({[plan.id]:['done','draft','review']}),completed_exercise_ids_json:'["done"]',drafts_json:'{"draft":"respuesta sin terminar"}'});
 const before=JSON.stringify([Array.from(stores.attempts),Array.from(stores.exercise_progress),yesterday]);
 for(let n=0;n<2;n++){
  const day=await plans.build('p',settings,date,{regenerate:true});
  assert(JSON.parse(day.exercise_ids_ja_es_json).includes('done'));assert(JSON.parse(day.exercise_ids_ja_es_json).includes('draft'));
  assert.equal(JSON.parse(day.drafts_json).draft,'respuesta sin terminar');assert.equal(day.status,'in_progress');
  assert.equal(JSON.stringify([Array.from(stores.attempts),Array.from(stores.exercise_progress),stores.daily_sessions.get(yesterday.session_id)]),before);
 }
});


test('preview is strictly above 50 using last three; excludes new, today, drafts and other blocks',()=>{
 const rows=['high','edge','draft','today','new','other'].map(id=>ex(id)),a=[...Array.from({length:6},(_,i)=>({...attempt('high',`2026-08-0${i+1}T10:00:00Z`),overall_score:i<3?0:60})),{...attempt('edge'),overall_score:50},{...attempt('draft'),overall_score:80},attempt('today',today),attempt('other')],{plans}=fixture();
 const session={profile_id:'p',local_date:date,study_plan_assignments_json:JSON.stringify({[plan.id]:['high','edge','draft','today','new']}),exercise_ids_ja_es_json:'["high","edge","draft","today","new"]',completed_exercise_ids_json:'["today"]',drafts_json:'{"draft":"saved"}'};
 const preview=plans.swapOptions(plan,session,rows,a,[],'p');assert.deepEqual(preview.reviews.map(r=>r.exercise.exercise_id),['high']);assert.equal(preview.reviews[0].average,60);
});

test('chosen swaps survive recalculation, increase only today new quota and preserve all history',async()=>{
 const todayDate=fixture().planner.localDate();
 const rows=['r1','r2','n1','n2','n3','inverse'].map(id=>ex(id,id==='inverse'?{direction:'es_ja'}:{}));
 const attempts=[{...attempt('r1'),overall_score:70},{...attempt('r2'),overall_score:30}];
 const {plans,stores}=fixture(rows,attempts),settings={profileId:'p',dailyJaEs:3,dailyEsJa:0,levels:['N5'],newRatio:30};
 await plans.ensure(settings);await plans.save('p',{...plan,dailyLimit:3,newLimit:1});const session=await plans.build('p',settings,todayDate);
 const before=JSON.stringify([...stores.attempts]);
 await assert.rejects(()=>plans.chooseNewSwaps('p',session.session_id,plan.id,['r2']),/ya no/);
 const changed=await plans.chooseNewSwaps('p',session.session_id,plan.id,['r1']);assert.equal(JSON.parse(changed.exercise_ids_ja_es_json).length,3);assert(!JSON.parse(changed.exercise_ids_ja_es_json).includes('r1'));
 const rebuilt=await plans.build('p',settings,todayDate,{regenerate:true}),ids=JSON.parse(rebuilt.exercise_ids_ja_es_json);
 assert.equal(ids.length,3);assert(ids.includes('r2'));assert.equal(ids.filter(id=>id.startsWith('n')).length,2);assert(!ids.includes('r1'));
 assert.equal((await plans.all('p')).find(p=>p.id===plan.id).newLimit,1);assert.equal(JSON.stringify([...stores.attempts]),before);
 await assert.rejects(()=>plans.chooseNewSwaps('p',session.session_id,plan.id,['inverse']),/ya no/);
});

test('swap availability respects the weekly cap and cannot propose already planned new phrases',()=>{
 const rows=['review','new1','new2'].map(id=>ex(id)),attempts=[attempt('review')],{plans}=fixture();
 const session={profile_id:'p',local_date:date,study_plan_assignments_json:JSON.stringify({[plan.id]:['review','new1']}),exercise_ids_ja_es_json:'["review","new1"]'};
 assert.equal(plans.swapOptions({...plan,weeklyNewLimit:1},session,rows,attempts,[],'p').fresh.length,0);
 assert.deepEqual(plans.swapOptions(plan,session,rows,attempts,[],'p').fresh.map(e=>e.exercise_id),['new2']);
});


test('changing levels cannot bypass the weekly allowance through voluntary swaps',()=>{
 const rows=[ex('review'),ex('new'),ex('learned',{jlpt_level:'N4'})],a=[attempt('review'),{...attempt('learned','2026-09-07T10:00:00Z'),study_plan_id:plan.id}],{plans}=fixture();
 const session={profile_id:'p',local_date:date,study_plan_assignments_json:JSON.stringify({[plan.id]:['review']}),exercise_ids_ja_es_json:'["review"]'};
 assert.equal(plans.swapOptions({...plan,weeklyNewLimit:1},session,rows,a,[],'p').fresh.length,0);
});

test('after-midnight answers consume the previous study day limits until 03:00',()=>{
 const rows=[ex('done'),ex('fresh')],a=[attempt('done',new Date('2026-09-08T02:30:00').toISOString())],{plans}=fixture();
 const before=JSON.stringify(a),p={...plan,dailyLimit:1,newLimit:1};
 const previous=plans.select(p,rows,a,[],'p','2026-09-07');
 assert.equal(previous.stats.done,1);assert.equal(previous.stats.newToday,1);assert.equal(previous.ids.length,0);
 const next=plans.select(p,rows,a,[],'p','2026-09-08');
 assert.equal(next.stats.done,0);assert.equal(next.stats.newToday,0);assert.deepEqual([...next.ids],['fresh']);assert.equal(JSON.stringify(a),before);
});
test('Monday before 03:00 still consumes Sunday weekly quota',()=>{
 const rows=[ex('done'),ex('fresh')],a=[attempt('done',new Date('2026-09-07T02:30:00').toISOString())],{plans}=fixture(),p={...plan,dailyLimit:2,newLimit:2,weeklyNewLimit:1};
 assert.equal(plans.select(p,rows,a,[],'p','2026-09-06').ids.includes('fresh'),false);
 assert.equal(plans.select(p,rows,a,[],'p','2026-09-07').ids.includes('fresh'),true);
});
