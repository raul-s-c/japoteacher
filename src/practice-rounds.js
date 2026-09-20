(function(){
  const parse=value=>{try{return JSON.parse(value||'[]')}catch{return []}};
  function latest(attempts,session){
    const result=new Map();
    for(const a of attempts){
      if(a.profile_id&&a.profile_id!==session.profile_id||a.session_id!==session.session_id||a.evaluation_status==='invalid'||a.overall_score==null||a.overall_score===''||!Number.isFinite(Number(a.overall_score))||Number(a.overall_score)<0||Number(a.overall_score)>100||!Number.isFinite(Date.parse(a.attempted_at)))continue;
      const previous=result.get(a.exercise_id);
      if(!previous||Date.parse(a.attempted_at)>=Date.parse(previous.attempted_at))result.set(a.exercise_id,a);
    }
    return result;
  }
  function failed(ids,attempts,session){const byId=latest(attempts,session);return [...new Set(ids)].filter(id=>byId.has(id)&&Number(byId.get(id).overall_score)<50)}
  function completedIds(session,attempts){const ids=parse(session?.completed_exercise_ids_json),bad=new Set(failed(ids,attempts,session));return ids.filter(id=>!bad.has(id))}
  function shuffled(ids,random=Math.random){const out=[...ids];for(let i=out.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[out[i],out[j]]=[out[j],out[i]]}return out}
  const baseline=(attempts,session)=>Object.fromEntries([...latest(attempts,session)].map(([id,a])=>[id,a.attempt_id]));
  function create(ids,attempts,session){const scope=[...new Set(ids)];return {scope,order:scope,remaining:scope,number:1,baseline:baseline(attempts,session)}}
  function reconcile(round,attempts,session,available=()=>true,random=Math.random){
    const byId=latest(attempts,session),scope=round.scope.filter(available);
    const remaining=round.remaining.filter(id=>available(id)&&!(round.number>1&&byId.has(id)&&Number(byId.get(id).overall_score)>=50)&&(!byId.has(id)||byId.get(id).attempt_id===round.baseline[id]));
    if(remaining.length)return {...round,scope,remaining};
    const retry=shuffled(failed(scope,attempts,session),random);
    if(!retry.length)return {...round,scope,remaining:[],finished:true};
    return {scope,order:retry,remaining:retry,number:round.number+1,baseline:baseline(attempts,session),finished:false};
  }
  function sessionResult(session, attempts) {
    const evidence=latest(attempts,session), answered=new Set([...parse(session.completed_exercise_ids_json),...evidence.keys()]);
    const planned=[...new Set([...parse(session.exercise_ids_ja_es_json),...parse(session.exercise_ids_es_ja_json)])];
    const complete=planned.length>0&&planned.every(id=>answered.has(id)&&(!evidence.has(id)||Number(evidence.get(id).overall_score)>=50));
    const dates=[...evidence.values()].map(a=>a.attempted_at).sort();
    return {...session,completed_exercise_ids_json:JSON.stringify([...answered]),status:complete?'completed':answered.size?'in_progress':session.status,
      completed_at:complete?(session.completed_at||dates.at(-1)||session.started_at||session.created_at):null};
  }
  async function repairSessions(db) {
    const [sessions,attempts]=await Promise.all([db.all('daily_sessions'),db.all('attempts')]);
    const updated=sessions.map(session=>sessionResult(session,attempts)).filter((session,index)=>JSON.stringify(session)!==JSON.stringify(sessions[index]));
    if(updated.length)await db.bulkPut('daily_sessions',updated);
    return updated.length;
  }
  window.PracticeRounds={sessionResult,repairSessions,latest,failed,completedIds,shuffled,create,reconcile};
})();
