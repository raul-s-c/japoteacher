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
  function emptyRating(direction,family){return {direction,family,points:0,level:'N5',percent:0,attempts:0,lastDelta:0,lastChallenge:0}}
  function rankFromPoints(points){const clamped=clamp(Math.round(points),0,499),index=Math.floor(clamped/100);return {points:clamped,level:levels[index],percent:clamped-index*100,next:levels[index+1]||null}}
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
      const family=familyForExercise(exercise),key=`${attempt.direction}::${family}`,rating=ratings.get(key)||emptyRating(attempt.direction,family),delta=deltaFor(rating.points,exercise,attempt);
      rating.points=clamp(rating.points+delta,0,499);rating.attempts++;rating.lastDelta=delta;rating.lastChallenge=exerciseChallenge(exercise);
      Object.assign(rating,rankFromPoints(rating.points));ratings.set(key,rating);
    }
    return {ratings,levels,families};
  }
  function get(snapshot,direction,family){return snapshot.ratings.get(`${direction}::${family}`)||emptyRating(direction,family)}
  function primaryForDirection(snapshot,direction){
    const rows=families.map(family=>get(snapshot,direction,family));
    const active=rows.filter(row=>row.attempts);
    if(!active.length)return emptyRating(direction,'General');
    const points=Math.round(active.reduce((sum,row)=>sum+row.points,0)/active.length),rank=rankFromPoints(points);
    return {...emptyRating(direction,'General'),...rank,attempts:active.reduce((sum,row)=>sum+row.attempts,0)};
  }
  function snapshot(exercises,attempts){return compute(exercises,attempts)}
  function badgeHtml(rating){return `<span class="rank-badge"><b>${rating.level}</b><em>${rating.percent}%</em></span>`}
  function miniHtml(rating,label='EXP contextual'){return `<div class="rank-mini"><div><span>${esc(label)}</span>${badgeHtml(rating)}</div><div class="rank-track"><span style="width:${rating.percent}%"></span></div></div>`}
  function deltaHtml(before,after,exercise,attempt){
    const family=familyForExercise(exercise),oldRating=get(before,attempt.direction,family),newRating=get(after,attempt.direction,family),delta=newRating.points-oldRating.points,challenge=exerciseChallenge(exercise),verb=delta>=0?'ganas':'pierdes';
    return `<section class="xp-feedback" data-xp-from="${oldRating.percent}" data-xp-to="${newRating.percent}"><div class="xp-head"><p class="section-kicker">EXP ranked</p><strong>${esc(newRating.level)} ${newRating.percent}%</strong></div><div class="rank-track xp-animated"><span style="width:${oldRating.percent}%"></span></div><p>${delta>=0?'+':''}${delta} EXP: ${verb} ${Math.abs(delta)} por una frase ${esc(exercise.jlpt_level)} ${Math.round(Number(exercise.difficulty)||0)}% en ${esc(family)}. Reto contextual ${challenge}/500.</p></section>`;
  }
  function animate(root=document){root.querySelectorAll('.xp-feedback[data-xp-to]').forEach(panel=>{const bar=panel.querySelector('.xp-animated span');if(!bar)return;const to=Number(panel.dataset.xpTo)||0;requestAnimationFrame(()=>{bar.style.width=`${to}%`})})}
  function panelHtml(snapshot,direction='all'){
    const directions=direction==='all'?['ja_es','es_ja']:[direction];
    return `<div class="ranked-grid">${directions.map(current=>`<article class="ranked-column"><header><span>${current==='ja_es'?'JP → ES':'ES → JP'}</span>${badgeHtml(primaryForDirection(snapshot,current))}</header>${families.map(family=>miniHtml(get(snapshot,current,family),family)).join('')}</article>`).join('')}</div>`;
  }
  window.RankedProgress={levels,families,snapshot,get,primaryForDirection,deltaFor,exerciseChallenge,familyForExercise,badgeHtml,miniHtml,deltaHtml,animate,panelHtml};
})();
