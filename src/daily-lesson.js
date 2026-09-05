(function(){
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const $=s=>document.querySelector(s);
  let plan=null,cache=null,busy=false,furigana=true;
  const japanese=e=>e.source_language==='ja'?e.source_text:e.reference_translation;
  const spanish=e=>e.source_language==='es'?e.source_text:e.reference_translation;
  function validPart(part){
    return part&&typeof part.title_es==='string'&&Array.isArray(part.paragraphs)&&part.paragraphs.length>0&&part.paragraphs.every(p=>p&&typeof p.japanese==='string'&&typeof p.spanish==='string')
      &&Array.isArray(part.vocabulary)&&part.vocabulary.every(v=>v&&['term','surface','reading','meaning_es','note_es'].every(k=>typeof v[k]==='string'))
      &&Array.isArray(part.readings)&&part.readings.every(r=>r&&typeof r.characters==='string'&&typeof r.reading_hiragana==='string')&&Array.isArray(part.tips_es)&&part.tips_es.every(t=>typeof t==='string');
  }
  function buildPlan(session,exercises,progress=[]){
    const byId=new Map(exercises.map(e=>[e.exercise_id,e])),scores=new Map(progress.filter(p=>p.profile_id===session.profile_id).map(p=>[p.exercise_id,p]));
    const ids=[...new Set(['ja_es','es_ja'].flatMap(d=>JSON.parse(session[`exercise_ids_${d}_json`]||'[]')))];
    const rows=ids.map(id=>byId.get(id)).filter(e=>e&&e.active!==false).map(e=>{
      const p=scores.get(e.exercise_id),priority=!p?.total_attempts?0:Number(p.last_score)<70||Number(p.average_score)<70||p.consecutive_failures>0?1:2;
      const terms=[...new Set([...(e.vocabulary_tags||[]),...(e.verb_tags||[]),...(e.adjective_tags||[])])].filter(t=>typeof t==='string'&&t.trim());
      return {id:e.exercise_id,japanese:japanese(e),spanish:spanish(e),level:e.jlpt_level,terms:terms.length?terms:[japanese(e)],priority};
    }).sort((a,b)=>a.id.localeCompare(b.id));
    // Include every selected exercise in both directions; deduplicate words, not learning directions.
    const terms=[...new Set(rows.flatMap(e=>e.terms))],chunks=[];
    for(let i=0;i<terms.length;i+=20){const group=terms.slice(i,i+20);chunks.push({terms:group,contexts:rows.filter(e=>e.terms.some(t=>group.includes(t))).map(e=>({japanese:e.japanese,spanish:e.spanish}))})}
    const signature=JSON.stringify(rows.map(({id,japanese,spanish,terms})=>({id,japanese,spanish,terms})).sort((a,b)=>a.id.localeCompare(b.id)));
    return {sessionId:session.session_id,date:session.local_date,rows,terms,chunks,signature};
  }
  function storageKey(){return `japoteacher_lesson_v1:${window.CloudSync?.getUserId?.()||'local'}:${plan.sessionId}`}
  function save(){try{localStorage.setItem(storageKey(),JSON.stringify(cache))}catch{UI.toast('Lección disponible; no se pudo guardar en este dispositivo.')}}
  function update(session,exercises,progress){
    const next=buildPlan(session,exercises,progress);
    if(plan?.sessionId===next.sessionId&&plan.signature===next.signature)return;
    plan=next;cache={signature:plan.signature,parts:[],read:false};
    try{const stored=JSON.parse(localStorage.getItem(storageKey())||'null');if(stored?.signature===plan.signature&&Array.isArray(stored.parts)&&stored.parts.length<=plan.chunks.length&&stored.parts.every(validPart))cache=stored}catch{}
    const card=$('#dailyLessonCard');if(!card)return;
    card.hidden=!plan.rows.length;
    $('#dailyLessonSummary').textContent=`Prepara ${plan.terms.length} términos de tus ${plan.rows.length} ejercicios de hoy, en ambos sentidos. Incluye las frases nuevas y las que necesitan refuerzo.`;
    $('#openDailyLesson').textContent=cache.read?'Volver a leer la lección':'Lección explicativa';
    $('#dailyLessonContent').hidden=true;
  }
  async function request(path,body){
    const [settings,token]=await Promise.all([JapoDB.get('settings','app'),window.CloudSync?.getAccessToken?.()]);
    if(!token)throw new Error('Inicia sesión para usar la IA. Las lecturas guardadas se pueden leer sin conexión.');
    const endpoint=(settings?.value?.aiEndpoint||'https://japoteacher-ai.raul-nihongo.workers.dev/evaluate').replace(/\/evaluate$/,path);
    const response=await fetch(endpoint,{method:'POST',signal:AbortSignal.timeout(110000),headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`,'X-Device-ID':window.CloudSync?.getDeviceId?.()||''},body:JSON.stringify(body)});
    const data=await response.json();if(!response.ok)throw new Error(data.error||'No se pudo completar la consulta.');return data;
  }
  function render(){
    $('#dailyLessonParts').innerHTML=cache.parts.map((part,index)=>`<article class="lesson-part" data-lesson-part="${index}"><h3>${esc(part.title_es)}</h3>${part.paragraphs.map(p=>`<div class="lesson-paragraph"><p lang="ja">${furigana?UI.japaneseWithFurigana(p.japanese,part.readings):esc(p.japanese)}</p><p class="lesson-translation">${esc(p.spanish)}</p></div>`).join('')}
      <div class="source-tools"><button class="text-button" data-lesson-speak="${index}">Escuchar lectura</button></div>
      <details><summary>Diccionario · ${part.vocabulary.length} términos</summary><div class="dictionary-grid">${part.vocabulary.map((v,i)=>`<article><strong lang="ja">${esc(v.term)}</strong><span>${esc(v.reading)}</span><p>${esc(v.meaning_es)}</p><small>${esc(v.note_es)}</small><button class="text-button" data-lesson-explain="${i}">Explicar con IA</button><p class="lesson-explanation" aria-live="polite"></p></article>`).join('')}</div></details>
      <ul>${part.tips_es.map(t=>`<li>${esc(t)}</li>`).join('')}</ul>
      <form class="lesson-question"><label>Preguntar con IA sobre esta lectura<textarea name="question" required maxlength="900" rows="2" placeholder="¿Por qué se usa esta forma?" ></textarea></label><button class="secondary" type="submit">Preguntar</button><p class="lesson-answer" aria-live="polite"></p></form></article>`).join('');
    $('#lessonReadButton').hidden=cache.parts.length!==plan.chunks.length;
    $('#lessonFurigana').textContent=furigana?'Ocultar furigana':'Mostrar furigana';
    $('#lessonFurigana').setAttribute('aria-pressed',String(furigana));
  }
  async function open(){
    if(!plan||busy)return;
    busy=true;const active=plan,activeCache=cache;
    $('#openDailyLesson').disabled=true;$('#dailyLessonContent').hidden=false;render();
    $('#dailyLessonContent').focus();
    try{
      for(let i=cache.parts.length;i<active.chunks.length;i++){
        $('#dailyLessonStatus').textContent=`Preparando lectura ${i+1} de ${active.chunks.length}… Puedes seguir usando la aplicación.`;
        const data=await request('/daily-lesson',active.chunks[i]);
        if(plan!==active)return;
        if(!validPart(data.lesson))throw new Error('La lectura recibida no es válida.');
        activeCache.parts.push(data.lesson);save();render();
      }
      $('#dailyLessonStatus').textContent=active.chunks.length>1?'Vocabulario completo, dividido en lecturas breves para que no resulte pesado.':'Lectura preparada. Lee el japonés con su traducción y consulta tus dudas antes de practicar.';
    }catch(error){$('#dailyLessonStatus').textContent=`${error.name==='TimeoutError'?'La IA tardó demasiado.':error.message} Pulsa «Lección explicativa» para reintentar.`}
    finally{busy=false;$('#openDailyLesson').disabled=false}
  }
  document.addEventListener('DOMContentLoaded',()=>{
    $('#openDailyLesson')?.addEventListener('click',open);
    $('#lessonFurigana')?.addEventListener('click',()=>{furigana=!furigana;render()});
    $('#lessonCloseButton')?.addEventListener('click',()=>{$('#dailyLessonContent').hidden=true;$('#openDailyLesson').focus()});
    $('#lessonReadButton')?.addEventListener('click',()=>{cache.read=true;save();$('#openDailyLesson').textContent='Volver a leer la lección';$('#dailyLessonContent').hidden=true;App.startPractice()});
    $('#dailyLessonParts')?.addEventListener('click',async event=>{
      const button=event.target.closest('button');if(!button)return;
      const part=cache.parts[Number(button.closest('[data-lesson-part]')?.dataset.lessonPart)];if(!part)return;
      if(button.hasAttribute('data-lesson-speak')){try{await window.PracticeTools.speakText(part.paragraphs.map(p=>p.japanese).join('\n'))}catch(error){UI.toast(error.message)}return}
      if(!button.hasAttribute('data-lesson-explain'))return;
      const term=part.vocabulary[Number(button.dataset.lessonExplain)],target=button.nextElementSibling,paragraph=part.paragraphs.find(p=>p.japanese.includes(term.surface))||part.paragraphs[0];
      button.disabled=true;target.textContent='Consultando…';
      try{const data=await request('/explain',{term:term.term,type:'vocabulario',japanese_sentence:paragraph.japanese,spanish_sentence:paragraph.spanish,jlpt_level:plan.rows[0].level});const x=data.explanation;target.textContent=[x.meaning_es,x.reading_hiragana,x.context_es,x.usage_note_es].filter(Boolean).join(' · ')}catch(error){target.textContent=error.message}finally{button.disabled=false}
    });
    $('#dailyLessonParts')?.addEventListener('submit',async event=>{
      event.preventDefault();const form=event.target,button=form.querySelector('button'),target=form.querySelector('.lesson-answer'),part=cache.parts[Number(form.closest('[data-lesson-part]').dataset.lessonPart)];
      button.disabled=true;target.textContent='Consultando…';
      try{const data=await request('/tutor',{operation:'chat',mode:'ja_to_es',text:part.paragraphs.map(p=>p.japanese).join('\n'),question:form.elements.question.value,analysis:{natural_translation:part.paragraphs.map(p=>p.spanish).join('\n')},messages:[]});target.textContent=data.answer?.answer_es||'Sin respuesta.'}catch(error){target.textContent=error.message}finally{button.disabled=false}
    });
  });
  window.DailyLesson={update,buildPlan};
})();
