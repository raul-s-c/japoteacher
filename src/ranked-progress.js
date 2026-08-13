(function(){
  const levels=['N5','N4','N3','N2','N1'];
  const families=[
    'Familia y amigos',
    'Trabajo y carrera',
    'Dinero y proyectos',
    'Ocio y vida diaria',
    'Conocimiento y consultas',
  ];
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
  const levelBase=level=>Math.max(0,levels.indexOf(level))*100;
  const exerciseChallenge=exercise=>levelBase(exercise?.jlpt_level||'N5')+clamp(Number(exercise?.difficulty)||0,0,100);
  function familyForExercise(exercise){
    const topics=exercise?.topic_tags||[];
    for(const topic of topics){const family=window.TopicProgression?.familyFor?.(topic);if(family)return family}
    return 'Conocimiento y consultas';
  }
  const emptyLevelPoints=()=>Object.fromEntries(levels.map(level=>[level,0]));
  const emptyEvidence=()=>Object.fromEntries(levels.map(level=>[level,{attempts:0,acceptable:0,totalScore:0,exerciseIds:new Set()}]));
  function emptyRating(direction,family){return {direction,family,points:0,pointsByLevel:emptyLevelPoints(),evidence:emptyEvidence(),availableLevels:new Set(),level:'N5',percent:0,attempts:0,lastDelta:0,lastChallenge:0,lastEarnedLevel:'N5'}}
  function mastered(evidence){return evidence.attempts>=12&&evidence.exerciseIds.size>=8&&evidence.totalScore/evidence.attempts>=80&&evidence.acceptable/evidence.attempts>=.75}
  function rankFromEvidence(rating){let index=0;while(index<levels.length-1&&mastered(rating.evidence[levels[index]])&&rating.availableLevels.has(levels[index+1]))index++;const level=levels[index],points=clamp(Math.round(rating.pointsByLevel[level]||0),0,99);return {points:levels.reduce((sum,current)=>sum+(rating.pointsByLevel[current]||0),0),level,percent:points,next:rating.availableLevels.has(levels[index+1])?levels[index+1]:null}}
  function deltaFor(current,exercise,attempt){
    const score=Number(attempt?.overall_score);
    if(!Number.isFinite(score))return 0;
    const challenge=exerciseChallenge(exercise),gap=challenge-current;
    if(score>=70){
      const quality=(score-70)/30,challengeFactor=clamp(.72+gap/130,.55,1.85);
      return Math.round(26*quality*challengeFactor);
    }
    const miss=(70-score)/70,penaltyFactor=clamp(.95-gap/150,.15,1.45);
    return -Math.round(24*miss*penaltyFactor);
  }
  function compute(exercises,attempts){
    const byId=new Map((exercises||[]).map(exercise=>[exercise.exercise_id,exercise]));
    const ratings=new Map();
    const valid=(attempts||[]).filter(attempt=>attempt.evaluation_status==='valid'&&Number.isFinite(Number(attempt.overall_score))).sort((a,b)=>String(a.attempted_at).localeCompare(String(b.attempted_at)));
    for(const attempt of valid){
      const exercise=byId.get(attempt.exercise_id);
      if(!exercise||exercise.active===false)continue;
      const family=familyForExercise(exercise),key=`${attempt.direction}::${family}`,rating=ratings.get(key)||emptyRating(attempt.direction,family),level=levels.includes(exercise.jlpt_level)?exercise.jlpt_level:'N5',delta=deltaFor(rating.pointsByLevel[level],exercise,attempt),evidence=rating.evidence[level];
      rating.pointsByLevel[level]=clamp(rating.pointsByLevel[level]+delta,0,99);evidence.attempts++;evidence.totalScore+=Number(attempt.overall_score)||0;evidence.acceptable+=attempt.is_acceptable?1:0;evidence.exerciseIds.add(exercise.exercise_id);rating.attempts++;rating.lastDelta=delta;rating.lastChallenge=exerciseChallenge(exercise);rating.lastEarnedLevel=level;
      Object.assign(rating,rankFromEvidence(rating));ratings.set(key,rating);
    }
    for(const exercise of exercises||[]){if(exercise.active===false)continue;const family=familyForExercise(exercise),key=`${exercise.direction}::${family}`,rating=ratings.get(key)||emptyRating(exercise.direction,family);rating.availableLevels.add(exercise.jlpt_level);Object.assign(rating,rankFromEvidence(rating));ratings.set(key,rating)}
    return {ratings,levels,families};
  }
  function get(snapshot,direction,family){return snapshot.ratings.get(`${direction}::${family}`)||emptyRating(direction,family)}
  function primaryForDirection(snapshot,direction){
    const rows=families.map(family=>get(snapshot,direction,family));
    const active=rows.filter(row=>row.attempts);
    if(!active.length)return emptyRating(direction,'General');
    const lowestIndex=Math.min(...active.map(row=>levels.indexOf(row.level))),sameLevelRows=active.filter(row=>levels.indexOf(row.level)===lowestIndex),level=levels[lowestIndex],percent=Math.round(sameLevelRows.reduce((sum,row)=>sum+row.percent,0)/sameLevelRows.length);
    return {...emptyRating(direction,'General'),level,percent,points:Math.round(active.reduce((sum,row)=>sum+row.points,0)/active.length),attempts:active.reduce((sum,row)=>sum+row.attempts,0)};
  }
  function snapshot(exercises,attempts){return compute(exercises,attempts)}
  function badgeHtml(rating){return `<span class="rank-badge" title="${rating.percent} puntos EXP dentro de ${rating.level}"><b>${rating.level}</b><em>${rating.percent} EXP</em></span>`}
  function miniHtml(rating,label='EXP contextual'){return `<div class="rank-mini"><div><span>${esc(label)}</span>${badgeHtml(rating)}</div><div class="rank-track"><span style="width:${rating.percent}%"></span></div></div>`}
  function deltaHtml(before,after,exercise,attempt){
    const family=familyForExercise(exercise),oldRating=get(before,attempt.direction,family),newRating=get(after,attempt.direction,family),delta=newRating.lastDelta,challenge=exerciseChallenge(exercise),verb=delta>=0?'ganas':'pierdes',sameLevel=oldRating.level===newRating.level;
    return `<section class="xp-feedback" data-xp-from="${sameLevel?oldRating.percent:0}" data-xp-to="${newRating.percent}"><div class="xp-head"><p class="section-kicker">EXP ranked</p><strong>${esc(newRating.level)} ${newRating.percent} EXP</strong></div><div class="rank-track xp-animated"><span style="width:${sameLevel?oldRating.percent:0}%"></span></div><p>${delta>=0?'+':''}${delta} EXP ${esc(newRating.lastEarnedLevel)}: ${verb} ${Math.abs(delta)} por una frase ${esc(exercise.jlpt_level)} ${Math.round(Number(exercise.difficulty)||0)}% en ${esc(family)}. Reto contextual ${challenge}/500.</p></section>`;
  }
  function animate(root=document){root.querySelectorAll('.xp-feedback[data-xp-to]').forEach(panel=>{const bar=panel.querySelector('.xp-animated span');if(!bar)return;const to=Number(panel.dataset.xpTo)||0;requestAnimationFrame(()=>{bar.style.width=`${to}%`})})}
  function panelHtml(snapshot,direction='all'){
    const directions=direction==='all'?['ja_es','es_ja']:[direction];
    return `<div class="ranked-grid">${directions.map(current=>`<article class="ranked-column"><header><span>${current==='ja_es'?'JP → ES':'ES → JP'}</span>${badgeHtml(primaryForDirection(snapshot,current))}</header>${families.map(family=>miniHtml(get(snapshot,current,family),family)).join('')}</article>`).join('')}</div>`;
  }
  window.RankedProgress={levels,families,snapshot,get,primaryForDirection,deltaFor,exerciseChallenge,familyForExercise,badgeHtml,miniHtml,deltaHtml,animate,panelHtml};
})();
