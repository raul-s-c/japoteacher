(function(){
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let active=null,dayReview=null,timer,autoKey='';
  const current=()=>window.StudyPlansUI?.getContext?.();
  async function reviewPlan(id,force=false){
    if(active)await active;
    const state=current();if(!state?.context)return true;
    const {context,plans}=state,p=plans.find(p=>p.id===id);if(!p)return true;
    const options=StudyPlans.swapOptions(p,context.session,context.snap.exercises,context.snap.attempts,context.snap.progress,context.settings.profileId);
    const decisions=StudyPlans.parse(context.session.plan_swap_choices_json,{});
    if(!force&&decisions[id]===options.fingerprint)return true;
    if(!options.reviews.length){if(force)UI.toast('Este bloque no tiene repasos pendientes con media superior al 50 %.');return true;}
    active=new Promise(resolve=>{
      const dialog=document.createElement('dialog');dialog.className='plan-dialog plan-new-review';dialog.setAttribute('aria-labelledby','planNewReviewTitle');
      dialog.innerHTML=`<h2 id="planNewReviewTitle">Antes de estudiar este bloque</h2><h3>${esc(p.name)} · ${esc(UI.directionName(p.direction))}</h3><p>En la selección actual tienes <strong>${options.reviews.length} ${options.reviews.length===1?'frase':'frases'} cuya media es superior al 50 %</strong>. ¿Quieres sustituir algunas por nuevas?</p><p>Marca solo las que quieras sustituir. Las nuevas serán adicionales al máximo habitual de ${p.newLimit}, solo hoy; el total del bloque no aumenta. Se conserva el límite semanal.</p><p><strong>${options.fresh.length} nuevas disponibles</strong> con la dificultad y los límites actuales.</p><div class="plan-new-review-list">${options.reviews.map(r=>`<label class="plan-new-review-row"><input type="checkbox" value="${esc(r.exercise.exercise_id)}"${!options.fresh.length?' disabled':''}><span><strong>${esc(r.exercise.source_text)}</strong><span>${esc(r.exercise.reference_translation)}</span><small>Últimas notas (reciente → antigua): ${r.scores.join(' · ')} % · Media: ${(Math.round(r.average*100)/100).toLocaleString('es-ES')} %</small></span></label>`).join('')}</div><p role="status" data-review-status>Ninguna frase seleccionada.</p><div class="plan-actions"><button type="button" class="secondary" data-review-keep>Conservar selección</button><button type="button" class="primary" data-review-apply disabled>Sustituir seleccionadas</button></div>`;
      document.body.append(dialog);const apply=dialog.querySelector('[data-review-apply]'),keep=dialog.querySelector('[data-review-keep]'),status=dialog.querySelector('[data-review-status]');let saving=false;
      const checked=()=>[...dialog.querySelectorAll('input:checked')].map(x=>x.value);
      const finish=value=>{dialog.close();dialog.remove();resolve(value)};
      dialog.addEventListener('cancel',event=>{event.preventDefault();if(!saving)finish(false)});
      dialog.addEventListener('change',()=>{const n=checked().length;apply.disabled=!n||n>options.fresh.length;status.textContent=n>options.fresh.length?`Solo hay ${options.fresh.length} nuevas disponibles. Selecciona menos frases.`:`${n} ${n===1?'frase seleccionada':'frases seleccionadas'} para sustituir.`});
      async function save(ids){if(saving)return;saving=true;apply.disabled=keep.disabled=true;dialog.querySelectorAll('input').forEach(x=>x.disabled=true);status.textContent='Guardando tu selección…';
        try{await StudyPlans.chooseNewSwaps(context.settings.profileId,context.session.session_id,id,ids);await App.applyStudyPlans();finish(true)}
        catch(error){status.textContent=error.message||'No se pudo guardar. Tu historial se conserva.';saving=false;keep.disabled=false;dialog.querySelectorAll('input').forEach(x=>x.disabled=!options.fresh.length);apply.disabled=!checked().length||checked().length>options.fresh.length;}
      }
      keep.addEventListener('click',()=>save([]));apply.addEventListener('click',()=>save(checked()));dialog.showModal();keep.focus();
    });
    try{return await active}finally{active=null}
  }
  async function reviewAll(){
    if(dayReview)return dayReview;
    dayReview=(async()=>{for(const p of current()?.plans||[])if(!await reviewPlan(p.id))return false;return true})();
    try{return await dayReview}finally{dayReview=null}
  }
  function schedule(){clearTimeout(timer);timer=setTimeout(()=>{const s=current();if(!s?.context||active||dayReview||document.querySelector('dialog[open]')||!document.querySelector('#view-hoy.active'))return;const key=s.context.session.session_id+':'+s.context.session.study_plan_assignments_json;if(key===autoKey)return;autoKey=key;reviewAll().catch(e=>UI.toast(e.message));},300)}
  document.addEventListener('click',event=>{const button=event.target.closest('[data-plan-preview]');if(button)reviewPlan(button.dataset.planPreview,true).catch(e=>UI.toast(e.message))});
  window.PlanNewReview={reviewPlan,reviewAll,schedule};
})();
