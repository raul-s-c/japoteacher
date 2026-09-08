(function(){
  const parse=(value,fallback=[])=>{try{return JSON.parse(value)||fallback}catch{return fallback}};
  const bounded=(value,fallback,max=200)=>Number.isFinite(Number(value))?Math.max(0,Math.min(max,Math.floor(Number(value)))):fallback;
  const day=value=>{const d=new Date(value);return Number.isFinite(d.getTime())?[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-'):''};
  const key=(profile,id)=>`study-plan:${profile}:${id}`;
  const identity=e=>String(e.direction==='ja_es'?e.source_text:e.reference_translation).normalize('NFKC').replace(/[\s。、！？!?.,]/g,'')+'::'+e.direction;
  const active=e=>e.active!==false&&!e.blocked_by_user;
  function normalize(p){return {...p,dailyLimit:bounded(p.dailyLimit,15),newLimit:bounded(p.newLimit,5),weeklyNewLimit:bounded(p.weeklyNewLimit,0,1400),quizSize:Math.max(1,bounded(p.quizSize,10,50)),cooldownDays:bounded(p.cooldownDays,1,90),reviewsFirst:p.reviewsFirst!==false,adaptive:p.adaptive!==false,paused:!!p.paused,mode:p.mode==='review'?'review':'learn',levels:(p.levels||['N5']).filter(l=>/^N[1-5]$/.test(l))}}
  function catalog(){return [...['N5','N4','N3','N2','N1'].map(level=>({id:level,name:level+' · Banco general',collection:'',levels:[level]})),...(window.StudyCollections?.catalog||[]).filter(c=>c.available).map(c=>({id:c.id,name:c.name,collection:c.id,levels:['N5','N4','N3','N2','N1']}))]}
  const matches=(p,e)=>active(e)&&e.direction===p.direction&&(e.source_collection||'')===(p.collection||'')&&p.levels.includes(e.jlpt_level);
  async function all(profile){return (await JapoDB.all('settings')).filter(row=>row.key.startsWith('study-plan:'+profile+':')).map(row=>normalize(row.value)).sort((a,b)=>a.direction.localeCompare(b.direction)||catalog().findIndex(c=>c.id===(a.collection||a.levels[0]))-catalog().findIndex(c=>c.id===(b.collection||b.levels[0])))}
  async function save(profile,p){p=normalize(p);await JapoDB.put('settings',{key:key(profile,p.id),value:p,updated_at:new Date().toISOString()});return p}
  async function ensure(settings){
    const profile=settings.profileId,marker='study-plans-migrated:'+profile;
    if(await JapoDB.get('settings',marker))return;
    const prior=await all(profile),existing=new Set(prior.map(p=>p.id));
    for(const direction of ['ja_es','es_ja']){
      const total=bounded(direction==='ja_es'?settings.dailyJaEs:settings.dailyEsJa,5),sourceTotal=settings.studyCollection?Math.round(total*bounded(settings.collectionRatio,70,100)/100):0;
      const levels=settings.levels?.length?settings.levels:['N5'],sources=levels.map((level,i)=>({id:level,name:level+' · Banco general',collection:'',levels:[level],limit:Math.floor((total-sourceTotal)/levels.length)+(i<(total-sourceTotal)%levels.length?1:0)}));
      if(settings.studyCollection)sources.push({id:settings.studyCollection,name:catalog().find(c=>c.id===settings.studyCollection)?.name||settings.studyCollection,collection:settings.studyCollection,levels,limit:sourceTotal});
      const newTotal=Math.ceil(total*bounded(settings.newRatio,60,100)/100),shares=sources.map(source=>Math.floor(source.limit*newTotal/Math.max(1,total)));
      let remainder=newTotal-shares.reduce((a,b)=>a+b,0);
      for(const {i} of sources.map((source,i)=>({i,f:source.limit*newTotal/Math.max(1,total)-shares[i]})).sort((a,b)=>b.f-a.f))if(remainder&&shares[i]<sources[i].limit){shares[i]++;remainder--}
      for(const [i,source] of sources.entries()){const id=source.id+'::'+direction,newLimit=shares[i];if(existing.has(id))continue;await save(profile,{id,name:source.name,collection:source.collection,levels:source.levels,direction,dailyLimit:source.limit,newLimit,quizSize:10,weeklyNewLimit:0,cooldownDays:bounded(settings.cooldownDays,14,90),reviewsFirst:true,adaptive:true,paused:source.limit===0,mode:'learn'})}
    }
    await JapoDB.put('settings',{key:marker,value:{version:1},updated_at:new Date().toISOString()});
  }
  function evidence(exercises,attempts,progress,profile,date){
    const byId=new Map(exercises.map(e=>[e.exercise_id,e])),first=new Map(),latest=new Map(),pMap=new Map();
    const signature=id=>byId.has(id)?identity(byId.get(id)):id;
    const record=(id,time)=>{if(!time)return;const k=signature(id);if(!first.has(k)||time<first.get(k))first.set(k,time);if(!latest.has(k)||time>latest.get(k))latest.set(k,time)};
    for(const p of progress.filter(p=>!p.profile_id||p.profile_id===profile)){if(p.last_seen_at||p.total_attempts>0){record(p.exercise_id,p.first_seen_at||p.last_seen_at);record(p.exercise_id,p.last_seen_at)}pMap.set(signature(p.exercise_id),p)}
    for(const a of attempts.filter(a=>(!a.profile_id||a.profile_id===profile)&&a.evaluation_status!=='invalid'&&Number.isFinite(Number(a.overall_score))))record(a.exercise_id,a.attempted_at);
    const today=e=>day(latest.get(identity(e)))===date;
    return {first,latest,pMap,today,isNew:e=>!first.has(identity(e)),newToday:e=>day(first.get(identity(e)))===date};
  }
  function scopeRows(plan,exercises){const seen=new Set();return exercises.filter(e=>{if(!matches(plan,e))return false;const k=identity(e);if(seen.has(k))return false;seen.add(k);return true})}
  function classify(plan,exercises,attempts,progress,profile,date=SessionPlanner.localDate()){
    const rows=scopeRows(plan,exercises),ev=evidence(exercises,attempts,progress,profile,date),gates=SessionPlanner.difficultyRoadmap(exercises,attempts.filter(a=>!a.profile_id||a.profile_id===profile),plan.direction),now=day(Date.now())===date?Date.now():Date.parse(date+'T23:59:59');
    const eligibleNew=e=>ev.isNew(e)&&(!plan.adaptive||Difficulty.bandFor(e)<=(gates[e.jlpt_level]?.unlockedBand??0));
    const dueAt=e=>{const p=ev.pMap.get(identity(e)),last=Date.parse(ev.latest.get(identity(e))||'')||0;return Math.max(Date.parse(p?.next_review_at||'')||0,last+plan.cooldownDays*86400000)};
    const due=e=>!ev.isNew(e)&&!ev.today(e)&&!ev.pMap.get(identity(e))?.suspended&&dueAt(e)<=now;
    return {rows,ev,eligibleNew,due,dueAt,unseen:rows.filter(ev.isNew),reviews:rows.filter(due),learned:rows.filter(e=>!ev.isNew(e)),mastered:rows.filter(e=>ev.pMap.get(identity(e))?.mastered)};
  }
  function reviewForecast(classified,date=SessionPlanner.localDate()){
    const days=Array.from({length:9},(_,i)=>{const d=new Date(date+'T12:00:00');d.setDate(d.getDate()+i+1);return {offset:i+1,date:day(d),count:0}}),byDate=new Map(days.map(d=>[d.date,d]));
    for(const e of classified.learned){if(classified.ev.pMap.get(identity(e))?.suspended)continue;const bucket=byDate.get(day(classified.dueAt(e)));if(bucket)bucket.count++;}
    return days;
  }
  function select(plan,exercises,attempts,progress,profile,date,old=[],pinned=[],regenerate=false){
    const c=classify(plan,exercises,attempts,progress,profile,date),byId=new Map(exercises.map(e=>[e.exercise_id,e])),preserved=pinned.filter(id=>byId.has(id)),selected=[...preserved],seen=new Set(selected.map(id=>identity(byId.get(id))));
    const start=new Date(date+'T12:00:00');start.setDate(start.getDate()-((start.getDay()+6)%7));const week=day(start);
    const tagged=attempts.filter(a=>a.study_plan_id===plan.id&&(!a.profile_id||a.profile_id===profile)).map(a=>byId.get(a.exercise_id)).filter(Boolean);
    const consumedRows=[...new Map([...c.rows,...preserved.map(id=>byId.get(id)),...tagged].map(e=>[identity(e),e])).values()];
    const completed=consumedRows.filter(c.ev.today),newToday=completed.filter(c.ev.newToday),weekly=consumedRows.filter(e=>{const d=day(c.ev.first.get(identity(e)));return d>=week&&d<=date});
    let slots=Math.max(0,plan.dailyLimit-new Set([...completed.map(identity),...selected.map(id=>identity(byId.get(id)))]).size);
    const pendingNew=selected.filter(id=>c.ev.isNew(byId.get(id))).length;
    let newSlots=Math.max(0,Math.min(plan.newLimit-newToday.length-pendingNew,plan.weeklyNewLimit?plan.weeklyNewLimit-weekly.length-pendingNew:Infinity));
    const readyFresh=c.unseen.filter(c.eligibleNew),readyReviews=c.reviews;
    const rank=(a,b)=>{if(!regenerate){const aOld=old.includes(a.exercise_id),bOld=old.includes(b.exercise_id);if(aOld!==bOld)return aOld?-1:1}else{const aOld=old.includes(a.exercise_id),bOld=old.includes(b.exercise_id);if(aOld!==bOld)return aOld?1:-1}return c.dueAt(a)-c.dueAt(b)||Difficulty.score(a)-Difficulty.score(b)||a.exercise_id.localeCompare(b.exercise_id)};
    const add=(pool,isNew)=>{for(const e of [...pool].sort(rank)){if(!slots||isNew&&!newSlots)break;if(seen.has(identity(e)))continue;seen.add(identity(e));selected.push(e.exercise_id);slots--;if(isNew)newSlots--}};
    if(!plan.paused&&plan.dailyLimit){
      if(plan.reviewsFirst)add(readyReviews,false);
      if(plan.mode==='learn'&&(!plan.reviewsFirst||readyReviews.every(e=>seen.has(identity(e)))))add(readyFresh,true);
      if(!plan.reviewsFirst)add(readyReviews,false);
    }
    return {ids:selected,stats:{total:c.rows.length,unseen:c.unseen.length,learned:c.learned.length,mastered:c.mastered.length,due:c.reviews.length,locked:c.unseen.filter(e=>!c.eligibleNew(e)).length,done:completed.length,newToday:newToday.length}};
  }
  async function build(profile,settings,date,options={}){
    await ensure(settings);
    const [plans,exercises,attempts,progress,existing]=await Promise.all([all(profile),JapoDB.all('exercises'),JapoDB.all('attempts'),JapoDB.all('exercise_progress'),JapoDB.get('daily_sessions',profile+'::'+date)]);
    const byId=new Map(exercises.map(e=>[e.exercise_id,e])),ev=evidence(exercises,attempts,progress,profile,date),drafts=parse(existing?.drafts_json,{}),oldAssignments=parse(existing?.study_plan_assignments_json,{}),completed=new Set(parse(existing?.completed_exercise_ids_json));
    for(const e of exercises)if(ev.today(e))completed.add(e.exercise_id);
    const assignments={},diagnostics={},used=new Set(),combined={ja_es:[],es_ja:[]},repeats={};
    for(const d of ['ja_es','es_ja'])repeats[d]=[...new Set([...parse(existing?.['voluntary_repeat_ids_'+d+'_json']),...SessionPlanner.voluntaryRepeatIds(exercises,attempts,profile,date,d)])].filter(id=>active(byId.get(id)||{active:false}));
    const repeatSet=new Set([...repeats.ja_es,...repeats.es_ja]);
    for(const plan of plans){
      const old=oldAssignments[plan.id]||parse(existing?.['exercise_ids_'+plan.direction+'_json']).filter(id=>matches(plan,byId.get(id)||{}));
      const pinned=[...new Set([...old.filter(id=>completed.has(id)||drafts[id]),...[...completed].filter(id=>matches(plan,byId.get(id)||{}))])].filter(id=>byId.has(id)&&!repeatSet.has(id)&&!used.has(identity(byId.get(id))));
      const result=select(plan,exercises.filter(e=>!used.has(identity(e))&&!repeatSet.has(e.exercise_id)),attempts,progress,profile,date,old,pinned,!!options.regenerate);
      assignments[plan.id]=result.ids;diagnostics[plan.id]=result.stats;
      for(const id of result.ids){used.add(identity(byId.get(id)));combined[plan.direction].push(id)}
    }
    // Pausing/changing a plan never discards an answered exercise or a draft.
    const preserved=[];
    for(const d of ['ja_es','es_ja']){
      for(const id of [...parse(existing?.['exercise_ids_'+d+'_json']),...[...completed].filter(id=>byId.get(id)?.direction===d)])if(byId.has(id)&&(completed.has(id)||drafts[id])&&!combined[d].includes(id)&&!repeatSet.has(id)){combined[d].push(id);preserved.push(id)}
      combined[d].push(...repeats[d].filter(id=>!combined[d].includes(id)));preserved.push(...repeats[d].filter(id=>!preserved.includes(id)));
    }
    const now=new Date().toISOString(),complete=combined.ja_es.length+combined.es_ja.length>0&&[...combined.ja_es,...combined.es_ja].every(id=>completed.has(id));
    const session={...existing,session_id:profile+'::'+date,profile_id:profile,local_date:date,created_at:existing?.created_at||now,status:complete?'completed':completed.size?'in_progress':'planned',completed_at:complete?(existing?.completed_at||now):null,started_at:existing?.started_at||null,plan_updated_at:now,settings_snapshot_json:JSON.stringify(settings),study_plan_assignments_json:JSON.stringify(assignments),completed_exercise_ids_json:JSON.stringify([...completed]),drafts_json:existing?.drafts_json||'{}',selection_reason_json:JSON.stringify({strategy:'study_plans_v1',diagnostics,preserved,plan_settings:plans})};
    for(const d of ['ja_es','es_ja']){session['exercise_ids_'+d+'_json']=JSON.stringify(combined[d]);session['voluntary_repeat_ids_'+d+'_json']=JSON.stringify(repeats[d]);session['planned_'+d]=plans.filter(p=>p.direction===d&&!p.paused).reduce((n,p)=>n+p.dailyLimit,0)}
    const stableKeys=['study_plan_assignments_json','completed_exercise_ids_json','drafts_json','selection_reason_json','exercise_ids_ja_es_json','exercise_ids_es_ja_json'];
    if(existing&&stableKeys.every(k=>existing[k]===session[k]))return existing;
    await JapoDB.put('daily_sessions',session);return session;
  }
  async function forExercise(profile,exercise,session){const plans=await all(profile),assignments=parse(session?.study_plan_assignments_json,{});return plans.find(p=>assignments[p.id]?.includes(exercise.exercise_id))||plans.find(p=>matches(p,exercise))}
  async function replace(session,id,reason,settings){
    const [exercises,attempts,progress]=await Promise.all([JapoDB.all('exercises'),JapoDB.all('attempts'),JapoDB.all('exercise_progress')]),current=exercises.find(e=>e.exercise_id===id);if(!current)return null;
    const plan=await forExercise(settings.profileId,current,session);if(!plan)return null;
    const c=classify(plan,exercises,attempts,progress,settings.profileId,session.local_date),planned=new Set([...parse(session.exercise_ids_ja_es_json),...parse(session.exercise_ids_es_ja_json)]),fresh=c.ev.isNew(current);
    const candidates=c.rows.filter(e=>!planned.has(e.exercise_id)&&(fresh?c.eligibleNew(e):c.due(e))).sort((a,b)=>{const score=e=>Math.abs(Difficulty.score(e)-Difficulty.score(current))+(reason==='too_hard'&&Difficulty.score(e)>Difficulty.score(current)?100:0)+(reason==='too_easy'&&Difficulty.score(e)<Difficulty.score(current)?100:0);return score(a)-score(b)});
    const next=candidates[0];if(!next)return null;
    const assignments=parse(session.study_plan_assignments_json,{});for(const key of Object.keys(assignments))assignments[key]=assignments[key].map(x=>x===id?next.exercise_id:x);
    const field='exercise_ids_'+current.direction+'_json',history=parse(session.replacement_history_json);history.push({from:id,to:next.exercise_id,reason,at:new Date().toISOString()});
    const updated={...session,[field]:JSON.stringify(parse(session[field]).map(x=>x===id?next.exercise_id:x)),study_plan_assignments_json:JSON.stringify(assignments),replacement_history_json:JSON.stringify(history),plan_updated_at:new Date().toISOString()};await JapoDB.put('daily_sessions',updated);return {session:updated,exerciseId:next.exercise_id,previousId:id};
  }
  window.StudyPlans={reviewForecast,all,save,ensure,normalize,catalog,matches,scopeRows,classify,select,build,forExercise,replace,parse};
})();
