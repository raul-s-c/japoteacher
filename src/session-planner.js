(function(){
  const localDate=()=>{const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')};
  const nextLocalDate=(date=localDate())=>{const d=new Date(`${date}T12:00:00`);d.setDate(d.getDate()+1);return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')};
  const hash=s=>{let h=2166136261;for(const c of s){h^=c.charCodeAt(0);h=Math.imul(h,16777619)}return h>>>0};
  const seededSort=(items,seed)=>[...items].sort((a,b)=>hash(seed+a.exercise_id)-hash(seed+b.exercise_id));
  const similarity=(a,b)=>{const at=new Set([...(a.grammar_tags||[]),...(a.vocabulary_tags||[])]),bt=new Set([...(b.grammar_tags||[]),...(b.vocabulary_tags||[])]);let n=0;at.forEach(x=>{if(bt.has(x))n++});return n/Math.max(1,Math.min(at.size,bt.size))};
  const validAttempts=attempts=>attempts.filter(attempt=>attempt.evaluation_status!=='invalid'&&Number.isFinite(Number(attempt.overall_score)));

  // The 0-100 difficulty scale advances independently in every JLPT and direction.
  function difficultyRoadmap(exercises,attempts,direction){
    const latestByExercise=new Map();
    for(const attempt of validAttempts(attempts.filter(item=>item.direction===direction)).sort((a,b)=>String(a.attempted_at).localeCompare(String(b.attempted_at))))latestByExercise.set(attempt.exercise_id,attempt);
    const levels=[...new Set(exercises.filter(exercise=>exercise.active!==false&&exercise.direction===direction).map(exercise=>exercise.jlpt_level))];
    return Object.fromEntries(levels.map(level=>{
      const states=Difficulty.bands.map((band,index)=>{
        const items=exercises.filter(exercise=>exercise.active!==false&&exercise.direction===direction&&exercise.jlpt_level===level&&Difficulty.bandFor(exercise)===index),results=items.map(exercise=>latestByExercise.get(exercise.exercise_id)).filter(Boolean),required=Math.min(items.length,Math.max(4,Math.ceil(items.length*.1))),average=results.length?Math.round(results.reduce((sum,item)=>sum+Number(item.overall_score),0)/results.length):0,acceptable=results.length?results.filter(item=>item.is_acceptable).length/results.length:0;
        return {index,count:items.length,seen:results.length,required,average,acceptable,mastered:items.length===0||(results.length>=required&&average>=82&&acceptable>=.75)};
      });
      let unlockedBand=0;
      for(let index=0;index<states.length-1;index++){if(!states[index].mastered)break;unlockedBand=index+1}
      return [level,{unlockedBand,bands:states}];
    }));
  }

  const familyFor=exercise=>window.TopicProgression?.familyFor?.((exercise.topic_tags||[])[0]||'')||'Conocimiento y consultas';
  const topicFor=exercise=>(exercise.topic_tags||[])[0]||'sin tema';
  const registerFor=exercise=>String(exercise.register||'neutro').trim().toLowerCase()||'neutro';
  const selectionStrategy='guided_coverage_srs_v15_hard_constraints';
  const normalizedNewRatio=settings=>Math.max(0,Math.min(100,Number(settings?.newRatio??60)));
  function needsRebalance(session,settings){try{const reason=JSON.parse(session?.selection_reason_json||'{}');return reason.strategy!==selectionStrategy||(settings&&(Number(reason.new_ratio)!==normalizedNewRatio(settings)||Number(reason.cooldown_days)!==Number(settings.cooldownDays??14)||JSON.stringify(reason.levels)!==JSON.stringify(settings.levels)))}catch{return true}}
  const lexicalTags=exercise=>[...(exercise.vocabulary_tags||[]).map(value=>`v:${value}`),...(exercise.kanji_tags||[]).map(value=>`k:${value}`),...(exercise.grammar_tags||[]).map(value=>`g:${value}`)];
  const varietyTags=exercise=>[`family:${familyFor(exercise)}`,`topic:${topicFor(exercise)}`,`register:${registerFor(exercise)}`,...lexicalTags(exercise)];
  function recentExposure(exercises,attempts,direction,limit=90){
    const byId=new Map(exercises.map(exercise=>[exercise.exercise_id,exercise])),exercisePenalty=new Map(),tagPenalty=new Map(),rows=validAttempts(attempts.filter(attempt=>attempt.direction===direction)).sort((a,b)=>String(a.attempted_at).localeCompare(String(b.attempted_at))).slice(-limit);
    rows.forEach((attempt,index)=>{const exercise=byId.get(attempt.exercise_id);if(!exercise||exercise.active===false)return;const recency=(index+1)/Math.max(1,rows.length),exact=42*recency;exercisePenalty.set(exercise.exercise_id,(exercisePenalty.get(exercise.exercise_id)||0)+exact);for(const tag of varietyTags(exercise)){const weight=tag.startsWith('topic:')?22:tag.startsWith('family:')?14:tag.startsWith('register:')?6:18;tagPenalty.set(tag,(tagPenalty.get(tag)||0)+weight*recency)}});
    return {exercisePenalty,tagPenalty,penalty(exercise){const exact=exercisePenalty.get(exercise.exercise_id)||0,tagSum=varietyTags(exercise).reduce((sum,tag)=>sum+(tagPenalty.get(tag)||0),0);return Math.min(170,exact+tagSum/Math.max(1,varietyTags(exercise).length))},summary:Object.fromEntries([...tagPenalty.entries()].sort((a,b)=>b[1]-a[1]).slice(0,40).map(([tag,value])=>[tag,Math.round(value)]))};
  }
  function coverageProfile(exercises,attempts,direction){
    const byId=new Map(exercises.map(exercise=>[exercise.exercise_id,exercise])),buckets=new Map();
    const add=(kind,value)=>{const key=`${kind}:${value}`;if(!buckets.has(key))buckets.set(key,{kind,value,attempts:0,total:0,exerciseIds:new Set()});return buckets.get(key)};
    for(const exercise of exercises.filter(exercise=>exercise.active!==false&&exercise.direction===direction)){add('family',familyFor(exercise)).exerciseIds.add(exercise.exercise_id);add('topic',topicFor(exercise)).exerciseIds.add(exercise.exercise_id);add('register',registerFor(exercise)).exerciseIds.add(exercise.exercise_id);for(const value of exercise.vocabulary_tags||[])add('vocabulary',value).exerciseIds.add(exercise.exercise_id);for(const value of exercise.grammar_tags||[])add('grammar',value).exerciseIds.add(exercise.exercise_id);for(const value of exercise.kanji_tags||[])add('kanji',value).exerciseIds.add(exercise.exercise_id)}
    for(const attempt of validAttempts(attempts.filter(attempt=>attempt.direction===direction))){const exercise=byId.get(attempt.exercise_id);if(!exercise||exercise.active===false)continue;for(const [kind,value] of [['family',familyFor(exercise)],['topic',topicFor(exercise)],['register',registerFor(exercise)],...(exercise.vocabulary_tags||[]).map(value=>['vocabulary',value]),...(exercise.grammar_tags||[]).map(value=>['grammar',value]),...(exercise.kanji_tags||[]).map(value=>['kanji',value])]){const bucket=add(kind,value);bucket.attempts++;bucket.total+=Number(attempt.overall_score)||0}}
    for(const bucket of buckets.values()){const average=bucket.attempts?bucket.total/bucket.attempts:0,confidence=Math.min(1,bucket.attempts/4);bucket.evidence=Math.round(average*confidence);bucket.deficit=100-bucket.evidence}
    const get=(kind,value)=>buckets.get(`${kind}:${value}`)||{evidence:0,deficit:100,attempts:0};
    return {buckets,get,bonus(exercise){const family=get('family',familyFor(exercise)),topic=get('topic',topicFor(exercise)),register=get('register',registerFor(exercise)),lexical=[...(exercise.vocabulary_tags||[]).map(value=>get('vocabulary',value)),...(exercise.grammar_tags||[]).map(value=>get('grammar',value)),...(exercise.kanji_tags||[]).map(value=>get('kanji',value))],lexicalBonus=lexical.length?lexical.reduce((sum,bucket)=>sum+Math.min(100,bucket.deficit),0)/lexical.length:0;return family.deficit*.65+topic.deficit*.55+register.deficit*.22+lexicalBonus*.5},summary:Object.fromEntries([...buckets.values()].map(bucket=>[`${bucket.kind}:${bucket.value}`,{attempts:bucket.attempts,evidence:bucket.evidence}]))};
  }

  function voluntaryRepeatIds(exercises,attempts,profileId,date,direction){
    const active=new Set(exercises.filter(exercise=>exercise.active!==false&&exercise.direction===direction).map(exercise=>exercise.exercise_id));
    const latest=new Map();for(const attempt of attempts.filter(attempt=>attempt.profile_id===profileId&&attempt.direction===direction&&attempt.repeat_request_updated_at&&active.has(attempt.exercise_id)).sort((left,right)=>String(left.repeat_request_updated_at).localeCompare(String(right.repeat_request_updated_at))))latest.set(attempt.exercise_id,attempt);
    return [...latest.values()].filter(attempt=>attempt.repeat_tomorrow===true&&attempt.repeat_requested_for===date).map(attempt=>attempt.exercise_id);
  }

  const sentenceKey=exercise=>String((exercise.direction==='es_ja'?exercise.reference_translation:exercise.source_text)||exercise.exercise_id).normalize('NFKC').replace(/[\s。、！？!?.,]/g,'');
  const profileRows=(rows,profileId)=>rows.filter(row=>!profileId||!row.profile_id||row.profile_id===profileId);
  const list=value=>{try{return JSON.parse(value||'[]')}catch{return []}};
  const words=exercise=>(exercise.vocabulary_tags||[]).filter(word=>/[一-龯ァ-ヺ]/.test(word)&&!['私','彼','彼女','何'].includes(word));
  const nearDuplicate=(a,b)=>{if(sentenceKey(a)===sentenceKey(b))return true;const aw=words(a),bw=new Set(words(b));return aw.length&&bw.size?aw.filter(word=>bw.has(word)).length/Math.max(aw.length,bw.size)>=.8:similarity(a,b)>.8};
  function historyFor(exercises,progress,attempts,direction){
    const byId=new Map(exercises.map(exercise=>[exercise.exercise_id,exercise])),seen=new Set(),latest=new Map(),pMap=new Map();
    const key=id=>sentenceKey(byId.get(id)||{exercise_id:id});
    for(const row of progress.filter(row=>!byId.get(row.exercise_id)||byId.get(row.exercise_id).direction===direction)){
      const k=key(row.exercise_id);if(Number(row.times_seen)>0||row.last_seen_at)seen.add(k);
      const previous=pMap.get(k);
      const merged={...previous,...row,deferred_until_new_exhausted:previous?.deferred_until_new_exhausted||row.deferred_until_new_exhausted};
      for(const field of ['last_seen_at','cooldown_until','next_review_at'])merged[field]=[previous?.[field],row[field]].filter(value=>Number.isFinite(Date.parse(value))).sort((a,b)=>Date.parse(b)-Date.parse(a))[0];
      pMap.set(k,merged);
    }
    for(const attempt of validAttempts(attempts.filter(row=>row.direction===direction)).sort((a,b)=>String(a.attempted_at).localeCompare(String(b.attempted_at)))){
      const k=key(attempt.exercise_id);seen.add(k);latest.set(k,attempt);
    }
    return {seen,latest,pMap,key};
  }
  function choose(exercises,progress,attempts,count,settings,direction,date,roadmap=[],options={}){
    count=Math.max(0,Math.floor(Number(count)||0));if(!count)return [];
    const now=Date.now();progress=profileRows(progress,settings.profileId);attempts=profileRows(attempts,settings.profileId);const history=historyFor(exercises,progress,attempts,direction),gates=difficultyRoadmap(exercises,attempts,direction);
    // Explicit level settings are the study scope. EXP never silently overrides them.
    const levels=new Set(settings.levels||['N5']),excluded=new Set(options.excludeIds||[]),excludedKeys=new Set(exercises.filter(e=>excluded.has(e.exercise_id)).map(sentenceKey));
    const coverage=coverageProfile(exercises,attempts,direction),exposure=recentExposure(exercises,attempts,direction);
    const isNew=e=>!history.seen.has(sentenceKey(e)),unlocked=e=>Difficulty.bandFor(e)<=(gates[e.jlpt_level]?.unlockedBand??0);
    const deferred=e=>{const k=sentenceKey(e),p=history.pMap.get(k),last=history.latest.get(k);return p?.deferred_until_new_exhausted||(Number(last?.overall_score)>=90&&last?.user_difficulty_feedback==='too_easy')};
    const scope=exercises.filter(e=>e.direction===direction&&e.active!==false&&levels.has(e.jlpt_level)&&!excluded.has(e.exercise_id)&&!excludedKeys.has(sentenceKey(e)));
    const anyUnseen=exercises.some(e=>e.direction===direction&&e.active!==false&&levels.has(e.jlpt_level)&&isNew(e));
    const ready=e=>{
      if(isNew(e))return unlocked(e);
      const k=sentenceKey(e),p=history.pMap.get(k),last=history.latest.get(k),lastAt=Math.max(Date.parse(last?.attempted_at||'')||-Infinity,Date.parse(p?.last_seen_at||'')||-Infinity),age=(now-lastAt)/86400000;
      if(!Number.isFinite(lastAt)||age<Math.max(0,Number(settings.cooldownDays??14)))return false;
      if(p?.cooldown_until&&Date.parse(p.cooldown_until)>now||p?.next_review_at&&Date.parse(p.next_review_at)>now)return false;
      return !(deferred(e)&&anyUnseen);
    };
    const eligible=seededSort(scope.filter(ready),date+direction);
    const selected=[],selectedKeys=new Set(),counts=new Map(),tagMap=new Map(eligible.map(e=>[e.exercise_id,varietyTags(e)])),baseScores=new Map(eligible.map(e=>[e.exercise_id,coverage.bonus(e)+TopicProgression.bonus(e,roadmap)-exposure.penalty(e)-Difficulty.levelIndex(e)*35+(Difficulty.bandFor(e)===(gates[e.jlpt_level]?.unlockedBand??0)?25:0)]));
    for(const id of options.contextIds||[]){const e=exercises.find(row=>row.exercise_id===id);if(e)for(const tag of varietyTags(e))counts.set(tag,(counts.get(tag)||0)+1)}
    const score=e=>{
      const k=sentenceKey(e),p=history.pMap.get(k);
      const diversity=tagMap.get(e.exercise_id).reduce((sum,tag)=>sum+(counts.get(tag)||0)*(tag.startsWith('v:')?90:tag.startsWith('topic:')?55:tag.startsWith('family:')?35:8),0);
      return baseScores.get(e.exercise_id)-diversity+(p?Math.max(0,80-Number(p.average_score||0)):20);
    };
    const add=(pool,limit)=>{
      while(selected.length<limit){
        const candidates=pool.filter(e=>!selectedKeys.has(sentenceKey(e)));
        if(!candidates.length)break;
        const varied=candidates.filter(e=>!selected.some(other=>nearDuplicate(e,other)));
        const ranked=(varied.length?varied:candidates).map(e=>({exercise:e,score:score(e)})),next=ranked.reduce((best,item)=>item.score>best.score?item:best).exercise;
        selected.push(next);selectedKeys.add(sentenceKey(next));
        for(const tag of varietyTags(next))counts.set(tag,(counts.get(tag)||0)+1);
      }
    };
    const fresh=eligible.filter(isNew),reviews=eligible.filter(e=>!isNew(e)&&!deferred(e)),easy=eligible.filter(e=>!isNew(e)&&deferred(e));
    const freshTarget=Math.max(0,Math.min(count,options.freshTarget??Math.ceil(count*normalizedNewRatio(settings)/100)));
    add(fresh,freshTarget);
    // A shortage is reported instead of filling new slots with old or premature reviews.
    const freshCount=selected.length,reviewLimit=count-freshTarget;
    add(reviews,freshCount+reviewLimit);if(!anyUnseen)add(easy,freshCount+reviewLimit);
    add(fresh,count);
    if(options.diagnostics)Object.assign(options.diagnostics,{requested:count,selected:selected.length,new_required:freshTarget,new_selected:selected.filter(isNew).length,reviews_selected:selected.filter(e=>!isNew(e)).length,eligible_fresh:new Set(fresh.map(sentenceKey)).size,shortfall:count-selected.length});
    return selected.map(e=>e.exercise_id);
  }

  const pendingPlans=new Map();
  async function getOrCreate(profileId,settings,date=localDate(),options={}){
    const key=profileId+'::'+date,previous=pendingPlans.get(key)||Promise.resolve();
    const task=previous.catch(()=>{}).then(()=>buildPlan(profileId,settings,date,options));pendingPlans.set(key,task);
    try{return await task}finally{if(pendingPlans.get(key)===task)pendingPlans.delete(key)}
  }
  async function buildPlan(profileId,settings,date,options){
    const id=profileId+'::'+date,[existing,exercises,allProgress,allAttempts]=await Promise.all([JapoDB.get('daily_sessions',id),JapoDB.all('exercises'),JapoDB.all('exercise_progress'),JapoDB.all('attempts')]);
    const attempts=profileRows(allAttempts,profileId),progress=profileRows(allProgress,profileId),byId=new Map(exercises.map(e=>[e.exercise_id,e])),completed=new Set(list(existing?.completed_exercise_ids_json)),drafts=JSON.parse(existing?.drafts_json||'{}');
    for(const a of validAttempts(attempts)){const d=new Date(a.attempted_at);if([d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')===date)completed.add(a.exercise_id)}
    const roadmaps={ja_es:TopicProgression.analyze(exercises,attempts,'ja_es'),es_ja:TopicProgression.analyze(exercises,attempts,'es_ja')},repeats={},plans={},diagnostics={};
    const oldReason=JSON.parse(existing?.selection_reason_json||'{}'),rebalance=Boolean(options.regenerate)||needsRebalance(existing,settings),revision=Number(oldReason.revision||0)+(options.regenerate?1:0);
    for(const direction of ['ja_es','es_ja']){
      const field='exercise_ids_'+direction+'_json',repeatField='voluntary_repeat_ids_'+direction+'_json',active=id=>byId.get(id)?.active!==false&&byId.get(id)?.direction===direction;
      repeats[direction]=[...new Set([...list(existing?.[repeatField]),...voluntaryRepeatIds(exercises,attempts,profileId,date,direction)])].filter(active);
      const repeatSet=new Set(repeats[direction]),old=list(existing?.[field]),target=Math.max(0,Number(direction==='ja_es'?settings.dailyJaEs:settings.dailyEsJa)||0);
      const pinned=[...new Set([...old.filter(id=>completed.has(id)||drafts[id]),...[...completed].filter(id=>byId.get(id)?.direction===direction)])].filter(id=>!repeatSet.has(id));
      const extraCount=list(existing?.extra_study_history_json).reduce((sum,item)=>sum+Math.max(0,Number(item['added_'+direction])||0),0),limit=Math.max(target+extraCount,pinned.length),kept=[...pinned];
      if(!rebalance)for(const exerciseId of old){if(kept.length>=limit)break;if(active(exerciseId)&&!repeatSet.has(exerciseId)&&!kept.includes(exerciseId))kept.push(exerciseId)}
      const beforeDay=attempts.filter(a=>new Date(a.attempted_at)<new Date(date+'T00:00:00')),historical=historyFor(exercises,progress.filter(p=>p.last_seen_at&&new Date(p.last_seen_at)<new Date(date+'T00:00:00')),beforeDay,direction);
      const alreadyNew=kept.filter(id=>!historical.seen.has(historical.key(id))).length;
      const quota=Math.max(0,Math.min(limit-kept.length,Math.ceil(target*normalizedNewRatio(settings)/100)-alreadyNew));
      const removed=rebalance?old.filter(id=>!completed.has(id)&&!repeatSet.has(id)&&!drafts[id]):[];
      const diag={},exclude=[...kept,...repeats[direction],...removed];
      let picked=choose(exercises,progress,attempts,limit-kept.length,settings,direction,date+':revision:'+revision,roadmaps[direction],{excludeIds:exclude,contextIds:kept,freshTarget:quota,diagnostics:diag});
      if(picked.length<limit-kept.length&&removed.length){
        // Previous pending items may return only if they still pass every hard rule.
        picked=choose(exercises,progress,attempts,limit-kept.length,settings,direction,date+':revision:'+revision,roadmaps[direction],{excludeIds:[...kept,...repeats[direction]],contextIds:kept,freshTarget:quota,diagnostics:diag});
      }
      plans[direction]=[...kept,...picked,...repeats[direction]];
      const normalNew=[...kept,...picked].filter(id=>!historical.seen.has(historical.key(id))).length;
      diagnostics[direction]={...diag,normal_target:target,normal_selected:kept.length+picked.length,normal_new:normalNew,normal_reviews:kept.length+picked.length-normalNew,preserved:kept.length,voluntary:repeats[direction].length};
    }
    const planned=new Set([...plans.ja_es,...plans.es_ja]),complete=planned.size>0&&[...planned].every(id=>completed.has(id)),now=new Date().toISOString();
    const changed=!existing||rebalance||Number(existing.planned_ja_es)!==Number(settings.dailyJaEs)||Number(existing.planned_es_ja)!==Number(settings.dailyEsJa)||['ja_es','es_ja'].some(d=>existing['exercise_ids_'+d+'_json']!==JSON.stringify(plans[d])||existing['voluntary_repeat_ids_'+d+'_json']!==JSON.stringify(repeats[d]))||existing.completed_exercise_ids_json!==JSON.stringify([...completed]);
    if(!changed)return existing;
    const session={...existing,plan_updated_at:now,session_id:id,profile_id:profileId,local_date:date,created_at:existing?.created_at||now,started_at:existing?.started_at||null,completed_at:complete?(existing?.completed_at||now):null,status:complete?'completed':completed.size?'in_progress':'planned',planned_ja_es:Math.max(0,Number(settings.dailyJaEs)||0),planned_es_ja:Math.max(0,Number(settings.dailyEsJa)||0),exercise_ids_ja_es_json:JSON.stringify(plans.ja_es),exercise_ids_es_ja_json:JSON.stringify(plans.es_ja),voluntary_repeat_ids_ja_es_json:JSON.stringify(repeats.ja_es),voluntary_repeat_ids_es_ja_json:JSON.stringify(repeats.es_ja),completed_exercise_ids_json:JSON.stringify([...completed]),drafts_json:existing?.drafts_json||'{}',settings_snapshot_json:JSON.stringify(settings),selection_reason_json:JSON.stringify({strategy:selectionStrategy,new_ratio:normalizedNewRatio(settings),cooldown_days:Number(settings.cooldownDays??14),levels:settings.levels,revision,diagnostics,regenerated_at:options.regenerate?now:oldReason.regenerated_at,rebalanced_existing_plan:rebalance})};
    await JapoDB.put('daily_sessions',session);return session;
  }
  const regenerate=(profileId,settings,date=localDate())=>getOrCreate(profileId,settings,date,{regenerate:true});
  async function createExtra(profileId,settings){const date=localDate(),id=`${profileId}::${date}`,seed=`${date}::extra::${Date.now()}`,[existing,exercises,progress,attempts]=await Promise.all([JapoDB.get('daily_sessions',id),JapoDB.all('exercises'),JapoDB.all('exercise_progress'),JapoDB.all('attempts')]),base=existing||await getOrCreate(profileId,settings,date),roadmaps={ja_es:TopicProgression.analyze(exercises,attempts,'ja_es'),es_ja:TopicProgression.analyze(exercises,attempts,'es_ja')},completed=new Set(JSON.parse(base.completed_exercise_ids_json||'[]')),append=(field,direction,count)=>{const current=JSON.parse(base[field]||'[]'),planned=new Set([...current,...completed]),candidates=choose(exercises,profileRows(progress,profileId),profileRows(attempts,profileId),count,settings,direction,`${seed}:${direction}`,roadmaps[direction],{excludeIds:[...planned],contextIds:current});return [...current,...candidates.slice(0,count)]},ja=append('exercise_ids_ja_es_json','ja_es',1),es=append('exercise_ids_es_ja_json','es_ja',1),history=JSON.parse(base.extra_study_history_json||'[]');history.push({at:new Date().toISOString(),added_ja_es:ja.length-JSON.parse(base.exercise_ids_ja_es_json||'[]').length,added_es_ja:es.length-JSON.parse(base.exercise_ids_es_ja_json||'[]').length});const session={...base,plan_updated_at:new Date().toISOString(),session_id:id,planned_ja_es:base.planned_ja_es||settings.dailyJaEs,planned_es_ja:base.planned_es_ja||settings.dailyEsJa,exercise_ids_ja_es_json:JSON.stringify(ja),exercise_ids_es_ja_json:JSON.stringify(es),status:'in_progress',completed_at:null,selection_reason_json:JSON.stringify({...JSON.parse(base.selection_reason_json||'{}'),extra_extension:'same_day_small_extension_v1'}),extra_study_history_json:JSON.stringify(history)};await JapoDB.put('daily_sessions',session);return session}
  async function replaceExercise(session,exerciseId,reason,settings){
    const [exercises,progress,attempts]=await Promise.all([JapoDB.all('exercises'),JapoDB.all('exercise_progress'),JapoDB.all('attempts')]),current=exercises.find(exercise=>exercise.exercise_id===exerciseId);if(!current)return null;
    const completed=new Set(JSON.parse(session.completed_exercise_ids_json||'[]')),planned=new Set([...(JSON.parse(session.exercise_ids_ja_es_json||'[]')),...(JSON.parse(session.exercise_ids_es_ja_json||'[]'))]),gates=difficultyRoadmap(exercises,attempts,current.direction),unlocked=(gates[current.jlpt_level]?.unlockedBand)??0,currentScore=Difficulty.score(current),recent=new Set(validAttempts(attempts).filter(attempt=>attempt.direction===current.direction).sort((left,right)=>String(right.attempted_at).localeCompare(String(left.attempted_at))).slice(0,12).map(attempt=>attempt.exercise_id));
    const eligibleIds=new Set(choose(exercises,progress,attempts,40,settings,current.direction,session.session_id+reason,[],{excludeIds:[...planned,...completed,exerciseId]})),candidates=exercises.filter(exercise=>eligibleIds.has(exercise.exercise_id));
    const levelCandidates=candidates.filter(exercise=>exercise.jlpt_level===current.jlpt_level),pool=levelCandidates.length?levelCandidates:candidates;
    const scored=pool.map(exercise=>{const distance=Math.abs(Difficulty.score(exercise)-currentScore),recentPenalty=recent.has(exercise.exercise_id)?70:0,plannedPenalty=planned.has(exercise.exercise_id)?25:0;let preference=0;if(reason==='too_hard')preference=Difficulty.score(exercise)<=currentScore?80:0;if(reason==='too_easy')preference=Difficulty.score(exercise)>=currentScore?80:0;if(reason==='recent')preference=recent.has(exercise.exercise_id)?-120:40;return {exercise,score:preference-distance-recentPenalty-plannedPenalty+hash(`${session.session_id}:${reason}:${exercise.exercise_id}`)%17}}).sort((left,right)=>right.score-left.score);
    const replacement=scored[0]?.exercise;if(!replacement)return null;const field=current.direction==='ja_es'?'exercise_ids_ja_es_json':'exercise_ids_es_ja_json',ids=JSON.parse(session[field]||'[]'),index=ids.indexOf(exerciseId),nextIds=index<0?[replacement.exercise_id,...ids.filter(id=>id!==replacement.exercise_id)]:ids.map(id=>id===exerciseId?replacement.exercise_id:id),history=JSON.parse(session.replacement_history_json||'[]');history.push({from:exerciseId,to:replacement.exercise_id,reason,at:new Date().toISOString()});const next={...session,plan_updated_at:new Date().toISOString(),[field]:JSON.stringify(nextIds),replacement_history_json:JSON.stringify(history)};await JapoDB.put('daily_sessions',next);return {session:next,exerciseId:replacement.exercise_id,previousId:exerciseId};
  }
  window.SessionPlanner={localDate,nextLocalDate,getOrCreate,regenerate,createExtra,choose,difficultyRoadmap,coverageProfile,needsRebalance,replaceExercise,voluntaryRepeatIds};
})();
