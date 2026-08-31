(function(){
  let timer=null,running=false;
  const finite=value=>Number.isFinite(Number(value));
  const same=(left,right)=>Number(left)===Number(right);
  function patch(attempt,item){return {...attempt,ranked_xp_version:2,ranked_xp_policy:'guided_usability_v2',ranked_xp_score_basis:Number(attempt.overall_score),ranked_xp_delta:item.delta,ranked_xp_position_before:item.position_before,ranked_xp_position_after:item.position_after,ranked_xp_level_before:item.level_before,ranked_xp_level_after:item.level_after,ranked_xp_jlpt_level:item.level,ranked_xp_difficulty:item.difficulty,ranked_xp_families:item.families,ranked_xp_times_seen:item.times_seen,ranked_xp_study_event_type:item.study_event_type,ranked_xp_recorded_at:new Date().toISOString()}}
  function needsPatch(attempt,item){if(Number(attempt.ranked_xp_version)===1&&!attempt.manual_score_adjusted_at)return false;return Number(attempt.ranked_xp_version)!==2||!same(attempt.ranked_xp_score_basis,attempt.overall_score)||!same(attempt.ranked_xp_delta,item.delta)||!same(attempt.ranked_xp_position_before,item.position_before)||!same(attempt.ranked_xp_position_after,item.position_after)||attempt.ranked_xp_level_after!==item.level_after}
  async function sync(){
    if(running||!window.JapoDB||!window.RankedProgress)return;
    running=true;
    try{const [exercises,attempts]=await Promise.all([JapoDB.all('exercises'),JapoDB.all('attempts')]);if(!exercises.length||!attempts.some(attempt=>attempt.evaluation_status!=='invalid'&&finite(attempt.overall_score)))return;const history=RankedProgress.history(exercises,attempts),byAttempt=new Map(history.map(item=>[item.attempt_id,item])),updates=attempts.flatMap(attempt=>{const item=byAttempt.get(attempt.attempt_id);return item&&needsPatch(attempt,item)?[patch(attempt,item)]:[]});if(updates.length)await JapoDB.bulkPut('attempts',updates)}catch(error){console.warn('No se pudo registrar el historial de EXP.',error)}finally{running=false}}
  function schedule(){if(timer)clearTimeout(timer);timer=setTimeout(()=>{timer=null;sync()},450)}
  if(typeof document!=='undefined')document.addEventListener('japoteacher:db-write',schedule);
  if(typeof window!=='undefined')window.addEventListener('DOMContentLoaded',schedule);
  window.RankedHistory={sync,schedule};
})();
