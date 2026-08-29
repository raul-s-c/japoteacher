(function(){
  let cache=null;
  function tagAverage(tag){
    if(Number.isFinite(tag.mastery_score))return Math.round(tag.mastery_score);
    const scores=['average_objective_score','average_comprehensibility_score','average_naturalness_score','average_grammar_score','average_vocabulary_score'].map(key=>Number(tag[key])).filter(Number.isFinite);
    return scores.length?Math.round(scores.reduce((sum,value)=>sum+value,0)/scores.length):0;
  }
  function tagPriority(tag){return Math.round((100-tag.average)*Math.min(1,(tag.count||0)/3))}
  function groupTags(tags,limit=3){
    const groups=new Map();
    for(const tag of tags){const group=groups.get(tag.type)||[];group.push(tag);groups.set(tag.type,group)}
    return [...groups.entries()].map(([type,items])=>({type,total:items.length,items:items.sort((a,b)=>tagPriority(b)-tagPriority(a)||b.count-a.count||a.value.localeCompare(b.value,'es')).slice(0,limit)})).sort((a,b)=>b.items[0].priority-a.items[0].priority)
  }
  async function snapshot(){
    if(cache)return cache;
    const [attempts,progress,exercises,sessions,tagProgress,newsAnswers,lexicalCards]=await Promise.all(['attempts','exercise_progress','exercises','daily_sessions','tag_progress','news_answers','lexical_cards'].map(JapoDB.all));
    const eMap=new Map(exercises.map(e=>[e.exercise_id,e]));
    const dirs={ja_es:{count:0,total:0,acceptable:0},es_ja:{count:0,total:0,acceptable:0}};
    const validExerciseAttempts=attempts.filter(attempt=>attempt.evaluation_status!=='invalid'&&Number.isFinite(Number(attempt.overall_score))&&eMap.get(attempt.exercise_id)?.active!==false);
    const newsStudyAttempts=newsAnswers.filter(answer=>Number.isFinite(Number(answer.overall_score))).map(answer=>({
      ...answer,
      attempt_id:answer.answer_id,
      exercise_id:`news:${answer.article_id}:${answer.question_index}`,
      study_event_type:'daily_news_answer',
      correction_provider:'openai',
      evaluation_status:'valid',
      topic_tags:JSON.parse(answer.topic_tags_json||'[]'),
      grammar_tags:JSON.parse(answer.grammar_tags_json||'[]'),
      vocabulary_tags:JSON.parse(answer.vocabulary_tags_json||'[]'),
      weight:.42
    }));
    const validAttempts=[...validExerciseAttempts,...newsStudyAttempts];
    for(const attempt of validAttempts){const direction=dirs[attempt.direction];if(!direction)continue;direction.count++;direction.total+=attempt.overall_score||0;if(attempt.is_acceptable)direction.acceptable++}
    Object.values(dirs).forEach(direction=>direction.average=direction.count?Math.round(direction.total/direction.count):0);
    const tags=tagProgress.map(tag=>({direction:tag.direction,type:tag.tag_type,value:tag.tag_value,count:tag.attempts_count||0,average:tagAverage(tag)})).map(tag=>({...tag,priority:tagPriority(tag)})).sort((a,b)=>b.priority-a.priority||b.count-a.count||a.value.localeCompare(b.value,'es'));
    const completedDays=new Set(sessions.filter(s=>s.status==='completed'||JSON.parse(s.completed_exercise_ids_json||'[]').length).map(s=>s.local_date));
    cache={attempts:validAttempts.sort((a,b)=>b.attempted_at.localeCompare(a.attempted_at)),allAttempts:attempts.sort((a,b)=>b.attempted_at.localeCompare(a.attempted_at)),validAttempts,progress,exercises,eMap,dirs,tags,tagGroups:groupTags(tags),completedDays,newsAnswers,lexicalCards};
    return cache;
  }
  if(typeof document!=='undefined')document.addEventListener('japoteacher:db-write',()=>{cache=null});
  window.Analytics={snapshot,groupTags,tagPriority};
})();
