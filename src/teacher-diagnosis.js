(function(){
  const levels=['N5','N4','N3','N2','N1'];
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const directionName=direction=>direction==='ja_es'?'Japonés a español':'Español a japonés';
  const average=values=>values.length?Math.round(values.reduce((sum,value)=>sum+value,0)/values.length):null;
  const eligible=attempt=>attempt.evaluation_status!=='invalid'&&Number.isFinite(Number(attempt.overall_score));
  function evidenceByLevel(attempts,exercises){
    const exerciseById=new Map(exercises.map(exercise=>[exercise.exercise_id,exercise]));
    return levels.map(level=>{
      const rows=attempts.filter(attempt=>exerciseById.get(attempt.exercise_id)?.jlpt_level===level&&eligible(attempt));
      const scores=rows.map(row=>Number(row.overall_score));
      const difficulty=rows.map(row=>Number(exerciseById.get(row.exercise_id)?.difficulty)).filter(Number.isFinite);
      const acceptable=rows.filter(row=>row.is_acceptable).length;
      return {level,count:rows.length,average:average(scores),acceptableRate:rows.length?Math.round(acceptable*100/rows.length):0,difficulty:average(difficulty)};
    });
  }
  function assessment(rows){
    const practiced=rows.filter(row=>row.count),established=rows.filter(row=>row.count>=3),current=established.at(-1)||practiced.at(-1)||rows[0],reliable=current.count>=3,consolidated=reliable&&current.average>=80&&current.acceptableRate>=67,next=levels[levels.indexOf(current.level)+1],gaps=[];
    if(current.count<3)gaps.push(`completar ${3-current.count} respuesta${3-current.count===1?'':'s'} más`);
    if(current.count>=3&&current.average<80)gaps.push(`elevar la media ${80-current.average} puntos`);
    if(current.count>=3&&current.acceptableRate<67)gaps.push(`mejorar respuestas aceptables ${67-current.acceptableRate} puntos porcentuales`);
    return {current,reliable,consolidated,next,gaps};
  }
  function directionCard(direction,attempts,exercises){
    const rows=evidenceByLevel(attempts.filter(attempt=>attempt.direction===direction),exercises),info=assessment(rows),{current}=info,state=!current.count?'Sin evidencia':!info.reliable?'Exploración':info.consolidated?'Consolidado':'En consolidación',nextText=info.consolidated?(info.next?`Puedes abrir evidencia inicial en ${info.next}.`:'Mantén resultados en el tramo alto del nivel.'):`Antes de subir: ${info.gaps.join(' · ')}.`,difficulty=current.difficulty==null?'sin dificultad registrada':`dificultad media ${current.difficulty}/100`;
    return `<article class="teacher-direction"><header><p>${esc(directionName(direction))}</p><strong>${esc(current.level)}</strong></header><div class="teacher-levels">${rows.map(row=>`<span class="${row.level===current.level?'active':''}"><b>${row.level}</b><em>${row.average==null?'—':`${row.average}%`}</em></span>`).join('')}</div><dl><div><dt>Estado</dt><dd>${state}</dd></div><div><dt>Evidencia</dt><dd>${current.count} respuestas · ${difficulty}</dd></div></dl><p class="teacher-next">${esc(nextText)}</p></article>`;
  }
  function focus(attempts,exercises){
    const exerciseById=new Map(exercises.map(exercise=>[exercise.exercise_id,exercise])),scored=attempts.filter(eligible),weakest=[...scored].sort((left,right)=>Number(left.overall_score)-Number(right.overall_score))[0];
    if(!weakest)return {title:'Construye la primera evidencia',copy:'Resuelve al menos tres frases de una dirección. Entonces podremos situarte por nivel y detectar un patrón real.',target:'3 respuestas evaluadas'};
    const exercise=exerciseById.get(weakest.exercise_id)||{},level=exercise.jlpt_level||'tu nivel actual',tags=[...(exercise.grammar_tags||[]),...(exercise.vocabulary_tags||[])].filter(Boolean),score=Math.round(Number(weakest.overall_score)||0);
    return {title:`Refuerzo inmediato en ${level}`,copy:`Tu resultado más bajo registrado fue ${score}/100. Repite una frase del mismo tramo y practica ${tags.slice(0,2).join(' y ')||'la estructura y el vocabulario de esa frase'} antes de avanzar.`,target:'2 respuestas consecutivas de 80/100 o más'};
  }
  function render({attempts=[],exercises=[]},filter='all'){
    const root=document.querySelector('#teacherDiagnosis');if(!root)return;const scoped=filter==='all'?attempts:attempts.filter(attempt=>attempt.direction===filter),directions=filter==='all'?['ja_es','es_ja']:[filter],completed=scoped.filter(eligible).length,plan=focus(scoped,exercises);
    root.innerHTML=`<section class="teacher-diagnosis"><header class="section-heading"><div><p class="section-kicker">Lectura docente</p><h3>Tu siguiente paso, con evidencia</h3></div><span class="teacher-evidence">${completed} respuestas válidas analizadas</span></header><p class="teacher-intro">El nivel se interpreta dentro de cada JLPT y dirección. Una media no se considera dominio hasta reunir evidencia suficiente.</p><div class="teacher-direction-grid">${directions.map(direction=>directionCard(direction,scoped,exercises)).join('')}</div><aside class="teacher-focus"><div><p>Sesión recomendada</p><h4>${esc(plan.title)}</h4><span>${esc(plan.copy)}</span></div><strong>${esc(plan.target)}</strong></aside></section>`;
  }
  window.TeacherDiagnosis={render};
})();
