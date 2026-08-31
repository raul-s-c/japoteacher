(function(){
  const levels=['N5','N4','N3','N2','N1'];
  const families=['Familia y amigos','Trabajo y carrera','Dinero y proyectos','Ocio y vida diaria','Conocimiento y consultas'];
  const goals={N5:100,N4:200,N3:400,N2:800,N1:1600};
  const policyVersion=2;
  const masteryRequirements={
    N5:{distinct:12,average:70,acceptable:60},
    N4:{distinct:18,average:72,acceptable:62},
    N3:{distinct:24,average:74,acceptable:65},
    N2:{distinct:32,average:76,acceptable:68},
    N1:{distinct:40,average:78,acceptable:70}
  };
  const activityWeights={translation_attempt:1,daily_news_answer:.65,lexical_review:.28};
  // goal/base targets roughly 1, 1.5, 2, 4 and 8 years at the requested cadence.
  const levelBase={N5:.022,N4:.0293,N3:.044,N2:.044,N1:.044};
  const directionPace={ja_es:1,es_ja:20/7};
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
  const levelIndex=level=>Math.max(0,levels.indexOf(level));
  const goalFor=level=>goals[level]||goals.N5;
  const roundXp=value=>Math.round((Number(value)||0)*1000)/1000;
  const formatXp=value=>new Intl.NumberFormat('es-ES',{maximumFractionDigits:2}).format(roundXp(value));
  const starts=Object.fromEntries(levels.map((level,index)=>[level,levels.slice(0,index).reduce((total,item)=>total+goalFor(item),0)]));
  const routeEnd=starts.N1+goalFor('N1');
  const startFor=level=>starts[level]??0;
  const questionPosition=exercise=>{const level=levels.includes(exercise?.jlpt_level)?exercise.jlpt_level:'N5',difficulty=clamp(Number(exercise?.difficulty)||0,0,100);return startFor(level)+goalFor(level)*difficulty/100};
  function exerciseForAttempt(attempt,byId){
    const stored=byId.get(attempt.exercise_id);
    if(stored)return stored;
    if(['daily_news_answer','lexical_review'].includes(attempt.study_event_type))return {
      exercise_id:attempt.exercise_id,
      direction:attempt.direction||'ja_es',
      jlpt_level:levels.includes(attempt.jlpt_level)?attempt.jlpt_level:'N5',
      difficulty:clamp(Number(attempt.difficulty)||35,0,100),
      topic_tags:Array.isArray(attempt.topic_tags)?attempt.topic_tags:[],
      grammar_tags:Array.isArray(attempt.grammar_tags)?attempt.grammar_tags:[],
      vocabulary_tags:Array.isArray(attempt.vocabulary_tags)?attempt.vocabulary_tags:[],
      study_event_type:attempt.study_event_type,
      weight:Number(attempt.weight)||activityWeights[attempt.study_event_type]||1,
      active:true
    };
    return null;
  }
  function familiesForExercise(exercise){const familiesForTags=[...new Set((exercise?.topic_tags||[]).map(topic=>window.TopicProgression?.familyFor?.(topic)).filter(Boolean))];return familiesForTags.length?familiesForTags:['Conocimiento y consultas']}
  function familyForExercise(exercise){return familiesForExercise(exercise)[0]}
  const emptyEvidence=()=>Object.fromEntries(levels.map(level=>[level,{attempts:0,totalScore:0,acceptable:0,exerciseIds:new Set(),lastSeenAt:null}]));
  function emptyRating(direction){return {direction,position:0,evidenceByFamily:Object.fromEntries(families.map(family=>[family,emptyEvidence()])),availableLevels:new Set(),attempts:0,level:'N5',points:0,goal:goalFor('N5'),percent:0,lastDelta:0,lastEarnedLevel:'N5',lastBreakdown:null}}
  function routeForPosition(position){const current=clamp(Number(position)||0,0,routeEnd);let index=levels.length-1;for(let item=levels.length-1;item>=0;item--)if(current>=startFor(levels[item])){index=item;break}const level=levels[index],points=roundXp(clamp(current-startFor(level),0,goalFor(level)));return {level,points,goal:goalFor(level),percent:Math.round(points/goalFor(level)*100),position:current,next:levels[index+1]||null}}
  function rankFrom(rating){const position=clamp(Number(rating.position)||0,0,routeEnd);let index=0;while(index<levels.length-1&&position>=startFor(levels[index+1])&&familyReady(rating,levels[index]))index++;const level=levels[index],points=roundXp(clamp(position-startFor(level),0,goalFor(level)));return {level,points,goal:goalFor(level),percent:Math.round(points/goalFor(level)*100),position,next:levels[index+1]||null}}
  function evidenceScore(evidence){if(!evidence?.attempts)return 0;return Math.round(evidence.totalScore/evidence.attempts)}
  function familySnapshot(rating,family,level=rating.level){const evidence=rating.evidenceByFamily[family]?.[level]||{attempts:0,totalScore:0,acceptable:0,exerciseIds:new Set()},score=evidenceScore(evidence),acceptableRate=evidence.attempts?Math.round(evidence.acceptable*100/evidence.attempts):0,requirement=masteryRequirements[level]||masteryRequirements.N5;return {family,level,score,attempts:evidence.attempts,acceptable:evidence.acceptable,acceptableRate,distinct:evidence.exerciseIds.size,lastSeenAt:evidence.lastSeenAt,ready:evidence.exerciseIds.size>=requirement.distinct&&score>=requirement.average&&acceptableRate>=requirement.acceptable,requirement,points:score,goal:100}}
  function familyReady(rating,level){return families.every(family=>familySnapshot(rating,family,level).ready)}
  function previewUnlocked(rating){const rank=rankFrom(rating);return Boolean(rank.next)&&rank.points>=rank.goal*.8&&familyReady(rating,rank.level)}
  function accessForDirection(snapshot,direction){const rating=snapshot.ratings.get(direction)||emptyRating(direction),rank=rankFrom(rating),index=levelIndex(rank.level),preview=previewUnlocked(rating);return {level:rank.level,preview,allowedLevels:levels.filter((level,position)=>position<=index||(position===index+1&&preview&&rating.availableLevels.has(level))),requirements:{exp:rank.points,goal:rank.goal,familiesReady:familyReady(rating,rank.level)}}}
  function baseExperience(exercise){const level=levels.includes(exercise?.jlpt_level)?exercise.jlpt_level:'N5',difficulty=clamp(Number(exercise?.difficulty)||0,0,100),type=exercise?.study_event_type||'translation_attempt',weight=Number(exercise?.weight)||activityWeights[type]||1;return levelBase[level]*(.72+difficulty/100*.56)*(directionPace[exercise?.direction]||1)*weight}
  function spacingMultiplier(context={}){const seen=Number(context.timesSeen)||0;if(!seen)return 1;const previous=Date.parse(context.previousAt||''),current=Date.parse(context.attemptedAt||'');if(Number.isFinite(previous)&&Number.isFinite(current)){const days=Math.max(0,(current-previous)/86400000);if(days<1)return .06;if(days<3)return .18;if(days<7)return .38;if(days<21)return .72;return .9}return Math.max(.12,Math.pow(.72,seen))}
  function deltaFor(_position,exercise,attempt,context={}){
    const score=Number(attempt?.overall_score);if(!Number.isFinite(score))return 0;
    const currentPosition=Number(context.position??_position)||0,currentLevel=context.currentLevel||routeForPosition(currentPosition).level,previousScore=Number(context.previousScore),timesSeen=Number(context.timesSeen)||0,base=baseExperience(exercise),target=questionPosition(exercise),span=goalFor(currentLevel),gap=target-currentPosition,spacing=spacingMultiplier(context),retention=timesSeen===0?1:(previousScore>=85?.55:previousScore>=70?.78:1),repeat=spacing*retention;
    // Correct answers always move right. A target to the right moves more; a known left-side item still helps, just less.
    if(score>=50){const quality=.06+(score-50)/50*1.44,distance=gap>=0?1+Math.min(3,gap/span)*.85:Math.max(.18,1-Math.min(1.35,-gap/span)*.6);return roundXp(base*quality*distance*repeat)}
    // An unmet minimum moves left. Above-level exploration is deliberately softened.
    const miss=(50-score)/50,distance=gap>0?Math.max(.12,1-Math.min(2,gap/span)*.44):1+Math.min(2,-gap/span)*.55,penalty=roundXp(base*miss*.55*distance*Math.max(.2,repeat)),minimum=gap>span*.35?.0001:.001;return -Math.max(minimum,penalty);
  }
  function legacyDeltaFor(_position,exercise,attempt,context={}){const score=Number(attempt?.overall_score);if(!Number.isFinite(score))return 0;const currentPosition=Number(context.position??_position)||0,currentLevel=context.currentLevel||routeForPosition(currentPosition).level,previousScore=Number(context.previousScore),timesSeen=Number(context.timesSeen)||0,base=baseExperience(exercise),target=questionPosition(exercise),span=goalFor(currentLevel),gap=target-currentPosition,repeat=timesSeen===0?1:Math.max(.12,(previousScore>=85?.22:previousScore>=70?.5:.9)*Math.pow(.72,Math.max(0,timesSeen-1)));if(score>=50){const quality=.08+(score-50)/50*1.42,distance=gap>=0?1+Math.min(3,gap/span)*.85:Math.max(.18,1-Math.min(1.35,-gap/span)*.6);return roundXp(base*quality*distance*repeat)}const miss=(50-score)/50,distance=gap>0?Math.max(.12,1-Math.min(2,gap/span)*.44):1+Math.min(2,-gap/span)*.55,penalty=roundXp(base*miss*.55*distance*Math.max(.35,repeat)),minimum=gap>span*.35?.0001:.001;return -Math.max(minimum,penalty)}
  function storedDelta(attempt){const version=Number(attempt?.ranked_xp_version),delta=Number(attempt?.ranked_xp_delta),basis=Number(attempt?.ranked_xp_score_basis),score=Number(attempt?.overall_score);if(!Number.isFinite(delta)||!version)return null;if(version===1&&!attempt.manual_score_adjusted_at)return delta;if(version>=2&&Number.isFinite(basis)&&basis===score)return delta;return null}
  function progressCeiling(rating){const rank=rankFrom(rating);return rank.next&&!familyReady(rating,rank.level)?startFor(rank.level)+rank.goal:routeEnd}
  function compute(exercises,attempts,captureHistory=false){
    const byId=new Map((exercises||[]).map(exercise=>[exercise.exercise_id,exercise])),ratings=new Map(),history=new Map(),ledger=[],valid=(attempts||[]).filter(attempt=>attempt.evaluation_status!=='invalid'&&Number.isFinite(Number(attempt.overall_score))).sort((a,b)=>String(a.attempted_at).localeCompare(String(b.attempted_at)));
    for(const exercise of exercises||[]){if(exercise.active===false)continue;const rating=ratings.get(exercise.direction)||emptyRating(exercise.direction);rating.availableLevels.add(exercise.jlpt_level);ratings.set(exercise.direction,rating)}
    for(const attempt of valid){const exercise=exerciseForAttempt(attempt,byId);if(!exercise||exercise.active===false)continue;const rating=ratings.get(attempt.direction)||emptyRating(attempt.direction),before=rankFrom(rating),beforePosition=rating.position,level=levels.includes(exercise.jlpt_level)?exercise.jlpt_level:'N5',exerciseFamilies=familiesForExercise(exercise),previous=history.get(exercise.exercise_id)||{timesSeen:0,previousScore:null,previousAt:null},context={...previous,position:rating.position,currentLevel:before.level,attemptedAt:attempt.attempted_at},preserved=storedDelta(attempt),usesV2=attempt.ranked_xp_policy==='guided_usability_v2'||Number(attempt.ranked_xp_version)>=2,calculated=usesV2?deltaFor(rating.position,exercise,attempt,context):legacyDeltaFor(rating.position,exercise,attempt,context),delta=preserved==null?calculated:preserved;rating.position=clamp(roundXp(rating.position+delta),0,progressCeiling(rating));for(const family of exerciseFamilies){const evidence=rating.evidenceByFamily[family][level];evidence.attempts++;evidence.totalScore+=Number(attempt.overall_score)||0;evidence.acceptable+=attempt.is_acceptable?1:0;evidence.exerciseIds.add(exercise.exercise_id);evidence.lastSeenAt=attempt.attempted_at}rating.attempts++;rating.lastDelta=delta;rating.lastEarnedLevel=level;rating.lastBreakdown={base:baseExperience(exercise),timesSeen:previous.timesSeen,difficulty:Number(exercise.difficulty)||0,previousScore:previous.previousScore,targetPosition:questionPosition(exercise),gap:questionPosition(exercise)-before.position,activityType:exercise.study_event_type||'translation_attempt',preserved:preserved!=null};history.set(exercise.exercise_id,{timesSeen:previous.timesSeen+1,previousScore:Number(attempt.overall_score),previousAt:attempt.attempted_at});Object.assign(rating,rankFrom(rating));if(captureHistory)ledger.push({attempt_id:attempt.attempt_id,exercise_id:attempt.exercise_id,direction:attempt.direction,attempted_at:attempt.attempted_at,delta:roundXp(rating.position-beforePosition),position_before:roundXp(beforePosition),position_after:roundXp(rating.position),level_before:before.level,level_after:rating.level,level:exercise.jlpt_level,difficulty:Number(exercise.difficulty)||0,families:exerciseFamilies,times_seen:previous.timesSeen+1,overall_score:Number(attempt.overall_score),study_event_type:attempt.study_event_type||'translation_attempt',policy_version:preserved==null?(usesV2?policyVersion:1):Number(attempt.ranked_xp_version)||1,preserved:preserved!=null});ratings.set(attempt.direction,rating)}
    for(const direction of ['ja_es','es_ja']){const rating=ratings.get(direction)||emptyRating(direction);Object.assign(rating,rankFrom(rating));ratings.set(direction,rating)}return {ratings,levels,families,ledger};
  }
  function get(snapshot,direction,family){const rating=snapshot.ratings.get(direction)||emptyRating(direction);return family?familySnapshot(rating,family):rating}
  function primaryForDirection(snapshot,direction){return snapshot.ratings.get(direction)||emptyRating(direction)}
  function badgeHtml(rating){const level=rating.level||'N5',goal=rating.goal||goalFor(level),points=roundXp(rating.points??rating.percent??0);return `<span class="rank-badge" title="${formatXp(points)}/${formatXp(goal)} EXP en ${level}"><b>${level}</b><em>${formatXp(points)}/${formatXp(goal)} EXP</em></span>`}
  function miniHtml(rating,label='Rango actual'){return `<div class="rank-mini"><div><span>${esc(label)}</span>${badgeHtml(rating)}</div><div class="rank-track"><span style="width:${rating.percent}%"></span></div></div>`}
  function familyHtml(snapshot,direction,family){const rating=primaryForDirection(snapshot,direction),item=familySnapshot(rating,family);return `<div class="rank-mini family-evidence"><div><span>${esc(family)}</span><b>${item.level} ${item.score}% <small>${item.distinct}/${item.requirement.distinct} frases</small></b></div><div class="rank-track"><span style="width:${item.score}%"></span></div></div>`}
  function deltaHtml(before,after,exercise,attempt){const family=familyForExercise(exercise),oldRating=primaryForDirection(before,attempt.direction),newRating=primaryForDirection(after,attempt.direction),delta=newRating.lastDelta,sameLevel=oldRating.level===newRating.level,detail=newRating.lastBreakdown||{},repeat=detail.timesSeen?`repeticion ${detail.timesSeen + 1}`:'primera vez',verb=delta>=0?'ganas':'pierdes',side=detail.gap>0?'a tu derecha':detail.gap<0?'a tu izquierda':'en tu posicion';return `<section class="xp-feedback" data-xp-from="${sameLevel?oldRating.percent:0}" data-xp-to="${newRating.percent}"><div class="xp-head"><p class="section-kicker">EXP ranked</p><strong>${esc(newRating.level)} ${formatXp(newRating.points)}/${formatXp(newRating.goal)} EXP</strong></div><div class="rank-track xp-animated"><span style="width:${sameLevel?oldRating.percent:0}%"></span></div><p>${delta>=0?'+':''}${formatXp(delta)} EXP: ${verb} ${formatXp(Math.abs(delta))} por ${repeat}. La frase esta ${side}; dificultad ${Math.round(detail.difficulty||0)}/100 y resultado ${attempt.overall_score}/100. ${esc(family)} se usa para el desbloqueo del siguiente JLPT.</p></section>`}
  function animate(root=document){root.querySelectorAll('.xp-feedback[data-xp-to]').forEach(panel=>{const bar=panel.querySelector('.xp-animated span');if(bar)requestAnimationFrame(()=>{bar.style.width=`${Number(panel.dataset.xpTo)||0}%`})})}
  function panelHtml(snapshot,direction='all'){const directions=direction==='all'?['ja_es','es_ja']:[direction];return `<div class="ranked-grid">${directions.map(current=>{const rating=primaryForDirection(snapshot,current),access=accessForDirection(snapshot,current),requirement=masteryRequirements[rating.level],next=rating.next?access.preview?`${rating.next} disponible como material puente.`:`Para abrir ${rating.next}: 80% de EXP y, en cada familia, ${requirement.distinct} frases distintas, media ${requirement.average}% y ${requirement.acceptable}% aceptables.`:'Ruta práctica completada.';return `<article class="ranked-column"><header><span>${current==='ja_es'?'JP -> ES':'ES -> JP'}</span>${badgeHtml(rating)}</header><p class="ranked-unlock">${esc(next)}</p>${families.map(family=>familyHtml(snapshot,current,family)).join('')}</article>`}).join('')}</div>`}
  const history=(exercises,attempts)=>compute(exercises,attempts,true).ledger;
  window.RankedProgress={levels,families,goals,starts,policyVersion,masteryRequirements,activityWeights,snapshot:compute,history,get,primaryForDirection,accessForDirection,deltaFor,legacyDeltaFor,baseExperience,questionPosition,routeForPosition,familyForExercise,badgeHtml,miniHtml,deltaHtml,animate,panelHtml};
})();
