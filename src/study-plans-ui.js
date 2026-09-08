(function(){
  const $=s=>document.querySelector(s),esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let context,plans=[],direction='ja_es',editing=null,viewing=null;
  function planRows(p){return StudyPlans.classify(p,context.snap.exercises,context.snap.attempts,context.snap.progress,context.settings.profileId,context.session.local_date)}
  function assigned(p){return StudyPlans.parse(context.session.study_plan_assignments_json,{})[p.id]||[]}
  function draw(){
    if(!context)return;
    document.querySelectorAll('[data-plan-direction]').forEach(b=>{b.classList.toggle('active',b.dataset.planDirection===direction);b.setAttribute('aria-selected',String(b.dataset.planDirection===direction))});
    const done=new Set(StudyPlans.parse(context.session.completed_exercise_ids_json));
    $('#directionCards').innerHTML=plans.filter(p=>p.direction===direction).map(p=>{
      const c=planRows(p),ids=assigned(p),pending=ids.filter(id=>!done.has(id)),fresh=pending.filter(id=>c.ev.isNew(context.snap.eMap.get(id)||context.snap.exercises.find(e=>e.exercise_id===id))).length,n=ids.filter(id=>done.has(id)).length;
      const more=c.reviews.filter(e=>!ids.includes(e.exercise_id)).length,locked=c.unseen.filter(e=>!c.eligibleNew(e)).length;
      return `<article class="study-plan-row${p.paused?' is-paused':''}"><header><h3>${esc(p.name)}</h3>${p.paused?'<span class="plan-paused">En pausa</span>':''}</header><p class="plan-today">${p.paused?'Plan pausado':pending.length?`Hoy: <b>${pending.length-fresh} repasos · ${fresh} nuevas</b>`:n?'Objetivo de hoy completado':'Sin frases pendientes hoy'}</p><div class="plan-progress"><div class="progress-track"><span style="width:${Math.round(n/Math.max(1,ids.length)*100)}%"></span></div><span>${n} de ${ids.length} completadas</span></div><p class="plan-inventory"><b>${c.unseen.length}</b> por aprender · <b>${c.learned.length}</b> estudiadas · ${c.mastered.length} dominadas</p><p class="plan-limits">Máximo ${p.dailyLimit}/día · hasta ${p.mode==='review'?0:p.newLimit} nuevas${p.mode==='review'?' · Solo repaso':''}</p>${more?`<p class="plan-note">${more} repasos pendientes fuera de la selección de hoy.</p>`:''}${!pending.length&&c.unseen.length?`<p class="plan-note">${p.paused?'Reanuda el plan en Ajustes.':locked===c.unseen.length?'Las nuevas están en tramos aún no desbloqueados. Puedes cambiarlo en Más opciones.':'Se han aplicado los límites de nuevas y repasos de este plan.'}</p>`:''}<div class="plan-actions"><button class="primary" type="button" data-plan-study="${esc(p.id)}"${pending.length?'':' disabled'}>${n?'Continuar':'Estudiar'}</button><button class="secondary" type="button" data-plan-terms="${esc(p.id)}">Ver frases</button><button class="secondary" type="button" data-plan-edit="${esc(p.id)}">Ajustes</button></div></article>`;
    }).join('')||'<div class="panel empty"><p>No tienes planes en esta dirección.</p><button class="primary" type="button" data-plan-add>Añadir plan</button></div>';
    const preserved=StudyPlans.parse(context.session.selection_reason_json,{}).preserved||[];
    $('#preservedPlanWork').innerHTML=preserved.length?`<h3>Trabajo conservado</h3><p>${preserved.length} respuestas, borradores o repeticiones voluntarias conservadas.</p><button class="secondary" type="button" data-plan-preserved>Ver trabajo</button>`:'';$('#preservedPlanWork').hidden=!preserved.length;
    $('#selectionStatus').textContent='Los límites se aplican por plan y dirección. Los repasos pendientes no desaparecen al alcanzar el máximo diario.';
  }
  async function render(settings,session,snap){context={settings,session,snap};plans=await StudyPlans.all(settings.profileId);draw()}
  function openEditor(id){
    editing=plans.find(p=>p.id===id)||null;const dialog=$('#studyPlanDialog'),f=$('#studyPlanForm');f.reset();f.querySelector('details').open=false;
    const available=StudyPlans.catalog().filter(c=>!plans.some(p=>p.id===c.id+'::'+direction));
    f.source.innerHTML=(editing?StudyPlans.catalog():available).map(c=>`<option value="${esc(c.id)}">${esc(c.name)}</option>`).join('');
    if(!editing&&!available.length){UI.toast('Ya tienes todos los planes de esta dirección. Puedes reanudar los pausados.');return}
    const p=editing||{direction,dailyLimit:15,newLimit:5,quizSize:10,weeklyNewLimit:0,cooldownDays:1,reviewsFirst:true,adaptive:true,paused:false,mode:'learn'};
    $('#studyPlanTitle').textContent=editing?'Ajustes del plan':'Añadir plan';$('#studyPlanScope').textContent=(editing?editing.name+' · ':'')+UI.directionName(p.direction);
    f.source.disabled=!!editing;if(editing)f.source.value=editing.collection||editing.levels[0];
    for(const k of ['dailyLimit','newLimit','quizSize','weeklyNewLimit','cooldownDays','mode'])f.elements[k].value=p[k];
    for(const k of ['reviewsFirst','adaptive','paused'])f.elements[k].checked=p[k];
    $('#planLevels').innerHTML=['N5','N4','N3','N2','N1'].map(l=>`<label><input type="checkbox" name="planLevel" value="${l}"${(!editing||p.levels.includes(l))?' checked':''}>${l}</label>`).join('');
    toggleFields();$('#studyPlanSaveStatus').textContent='';dialog.showModal();
  }
  function toggleFields(){const f=$('#studyPlanForm'),c=StudyPlans.catalog().find(c=>c.id===f.source.value);$('#planLevelsField').hidden=!c?.collection;f.newLimit.disabled=f.mode.value==='review'}
  async function save(event){event.preventDefault();const f=event.currentTarget,button=$('#saveStudyPlan');if(button.disabled)return;const source=StudyPlans.catalog().find(c=>c.id===f.source.value);if(!source)return;
    const levelValues=[...f.querySelectorAll('[name=planLevel]:checked')].map(x=>x.value),d=editing?.direction||direction;
    if(source.collection&&!levelValues.length){$('#studyPlanSaveStatus').textContent='Elige al menos un nivel para este bloque.';return}
    const p={...editing,id:editing?.id||source.id+'::'+d,name:source.name,collection:source.collection,levels:source.collection?levelValues:source.levels,direction:d};
    for(const k of ['dailyLimit','newLimit','quizSize','weeklyNewLimit','cooldownDays'])p[k]=Number(f.elements[k].value);
    for(const k of ['reviewsFirst','adaptive','paused'])p[k]=f.elements[k].checked;p.mode=f.mode.value;
    if(p.newLimit>p.dailyLimit&&p.mode!=='review'){$('#studyPlanSaveStatus').textContent='El máximo de nuevas no puede superar el total diario.';return}
    button.disabled=true;try{await StudyPlans.save(context.settings.profileId,p);await App.applyStudyPlans();$('#studyPlanDialog').close();UI.toast('Plan guardado. Pendientes de hoy actualizadas.')}catch(error){$('#studyPlanSaveStatus').textContent=error.message||'No se pudo guardar el plan.'}finally{button.disabled=false}
  }
  function openTerms(id){viewing=plans.find(p=>p.id===id);if(!viewing)return;$('#planTermsTitle').textContent=viewing.name+' · '+UI.directionName(viewing.direction);$('#planTermSearch').value='';$('#planTermFilter').value='all';drawTerms();$('#planTermsDialog').showModal()}
  function drawTerms(){
    if(!viewing)return;const c=planRows(viewing),filter=$('#planTermFilter').value,q=$('#planTermSearch').value.trim().toLowerCase(),ids=new Set(assigned(viewing)),done=new Set(StudyPlans.parse(context.session.completed_exercise_ids_json));
    const rows=c.rows.filter(e=>(!q||(e.source_text+' '+e.reference_translation).toLowerCase().includes(q))&&(filter==='all'||filter==='new'&&c.ev.isNew(e)||filter==='studied'&&!c.ev.isNew(e)||filter==='today'&&ids.has(e.exercise_id)&&!done.has(e.exercise_id)||filter==='due'&&c.due(e)));
    $('#planTermsCount').textContent=`${rows.length} frases${rows.length>100?' · Mostrando las primeras 100. Usa el buscador para concretar.':''}`;
    $('#planTermsList').innerHTML=rows.slice(0,100).map(e=>`<article><span>${esc(e.jlpt_level)} · ${c.ev.isNew(e)?'Por aprender':c.due(e)?'Repaso pendiente':'Estudiada'}${ids.has(e.exercise_id)?' · Seleccionada hoy':''}</span><strong lang="${e.direction==='ja_es'?'ja':'es'}">${e.direction==='ja_es'?UI.japaneseWithFurigana(e.source_text,e.kanji_readings||[]):esc(e.source_text)}</strong><p>${esc(e.reference_translation)}</p></article>`).join('')||'<p class="empty">No hay frases con este filtro.</p>';
  }
  document.addEventListener('DOMContentLoaded',()=>{
    document.addEventListener('click',event=>{const b=event.target.closest('button');if(!b)return;
      if(b.hasAttribute('data-plan-direction')){direction=b.dataset.planDirection;draw()}
      if(b.hasAttribute('data-plan-add'))openEditor();if(b.dataset.planEdit)openEditor(b.dataset.planEdit);if(b.dataset.planTerms)openTerms(b.dataset.planTerms);
      if(b.dataset.planStudy){const p=plans.find(p=>p.id===b.dataset.planStudy),done=new Set(StudyPlans.parse(context.session.completed_exercise_ids_json));App.startPlan(p,assigned(p).filter(id=>!done.has(id)).slice(0,p.quizSize))}
      if(b.hasAttribute('data-plan-preserved'))App.startPlan(null,StudyPlans.parse(context.session.selection_reason_json,{}).preserved||[]);
      if(b.hasAttribute('data-plan-home')){UI.showView('hoy');$('#addStudyPlan').focus()}
    });
    $('#studyPlanForm').addEventListener('submit',save);$('#studyPlanForm').addEventListener('change',toggleFields);$('#closeStudyPlan').addEventListener('click',()=>$('#studyPlanDialog').close());$('#closePlanTerms').addEventListener('click',()=>$('#planTermsDialog').close());$('#planTermFilter').addEventListener('change',drawTerms);$('#planTermSearch').addEventListener('input',drawTerms);
  });
  window.StudyPlansUI={render};
})();
