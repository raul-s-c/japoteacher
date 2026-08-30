(function(){
  const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const hasJapanese=value=>/[\u3400-\u9fff々〆ヶぁ-んァ-ンー]/.test(String(value||''));
  const parse=(row,key)=>{if(Array.isArray(row?.[key]))return row[key];try{return JSON.parse(row?.[`${key}_json`]||'[]')}catch{return []}};
  const lexicalItems=attempt=>{try{return JSON.parse(attempt.lexical_review_cards_json||'[]')}catch{return []}};
  const sourceIds=card=>{try{return new Set(JSON.parse(card?.source_answer_ids_json||'[]'))}catch{return new Set()}};

  async function retract(attempt,item){
    const card=await JapoDB.get('lexical_cards',item.card_id);if(!card)return;
    const ids=sourceIds(card);ids.delete(attempt.attempt_id);
    const progressRows=(await JapoDB.all('lexical_progress')).filter(row=>row.card_id===card.card_id);
    for(const progress of progressRows){
      progress.total_attempts=Math.max(0,Number(progress.total_attempts||0)-1);
      if(!progress.total_attempts&&!Number(progress.exp_total||0))await JapoDB.delete('lexical_progress',progress.progress_id);
      else await JapoDB.put('lexical_progress',progress);
    }
    if(ids.size)await JapoDB.put('lexical_cards',{...card,source_answer_ids_json:JSON.stringify([...ids]),updated_at:new Date().toISOString()});
    else await JapoDB.put('lexical_cards',{...card,status:'archived',archived_at:new Date().toISOString(),archived_reason:'user_rejected_ai_suggestion',source_answer_ids_json:'[]'});
  }
  async function add(attempt,item){
    const term=String(item.term||'').trim(),meaning=String(item.meaning||'').trim(),reading=String(item.reading||'').trim();
    if(!term||!hasJapanese(term)||!meaning)throw new Error(`Completa término japonés y significado: ${term||'fila vacía'}`);
    const cardId=`${attempt.profile_id}::${attempt.direction}::${term}`,now=new Date().toISOString(),previous=await JapoDB.get('lexical_cards',cardId),ids=sourceIds(previous),alreadyLinked=ids.has(attempt.attempt_id);ids.add(attempt.attempt_id);
    const card={...(previous||{}),card_id:cardId,profile_id:attempt.profile_id,direction:attempt.direction,term_ja:term,reading_hiragana:reading||previous?.reading_hiragana||'',prompt_es:meaning,desired_meaning_es:meaning,created_at:previous?.created_at||now,last_seen_at:now,last_reason_es:item.reason||previous?.last_reason_es||'Añadido por el usuario',source_exercise_id:attempt.exercise_id,source_sentence_ja:attempt.correct_japanese_sentence||'',review_mode:'contextual_transfer',ai_exercise_prompt_es:`Crear una frase nueva con ${term} en otro contexto donde signifique: ${meaning}. No reutilizar literalmente la frase original.`,source_answer_ids_json:JSON.stringify([...ids]),status:'active',confirmed_by_user:true,confirmed_at:now};
    await JapoDB.put('lexical_cards',card);
    const progressId=`${attempt.profile_id}::${cardId}`,progress=await JapoDB.get('lexical_progress',progressId)||{progress_id:progressId,card_id:cardId,profile_id:attempt.profile_id,total_attempts:0,successful_attempts:0,average_score:0,mastered:false,exp_total:0};
    if(!alreadyLinked){progress.total_attempts=Number(progress.total_attempts||0)+1;progress.last_score=0}
    progress.last_seen_at=now;progress.next_review_at=new Date(Date.now()+86400000).toISOString();await JapoDB.put('lexical_progress',progress);
    return {card_id:cardId,term,reading_hiragana:card.reading_hiragana,desired_meaning_es:meaning,reason:card.last_reason_es,next_review_at:progress.next_review_at};
  }
  function manualItems(value,known){
    return String(value||'').split(/[\n,、;]+/).map(value=>value.trim()).filter(Boolean).map(value=>{const [raw,...rest]=value.split(/\s*=\s*/),term=raw.trim(),match=known.find(item=>item.characters===term||item.term===term);return {term,meaning:rest.join('=').trim()||match?.meaning_es||match?.desired_meaning_es||'',reading:match?.reading_hiragana||'',reason:'Añadido manualmente por el usuario'}});
  }
  async function confirm(panel,attempt,original,readings){
    const selected=[];
    panel.querySelectorAll('[data-lexical-proposal]').forEach((row,index)=>{if(row.querySelector('[data-lexical-include]').checked)selected.push({term:row.querySelector('[data-lexical-term]').value,meaning:row.querySelector('[data-lexical-meaning]').value,reading:original[index].reading_hiragana||'',reason:original[index].reason||''})});
    const additions=manualItems(panel.querySelector('[data-lexical-additions]').value,[...readings,...original]),unique=[...new Map([...selected,...additions].map(item=>[`${String(item.term).trim()}::${String(item.meaning).trim()}`,item])).values()],final=[];
    await JapoDB.batch(async()=>{for(const item of original)await retract(attempt,item);for(const item of unique)final.push(await add(attempt,item));const fresh=await JapoDB.get('attempts',attempt.attempt_id)||attempt;await JapoDB.put('attempts',{...fresh,lexical_review_cards_json:JSON.stringify(final),lexical_review_confirmed_at:new Date().toISOString(),lexical_review_confirmed_by_user:true})});
    return final;
  }
  function editor(items,readings){
    const rows=items.length?items.map(item=>`<article class="lexical-proposal" data-lexical-proposal><label class="lexical-proposal-toggle"><input type="checkbox" data-lexical-include> Incluir</label><label>Término japonés<input lang="ja" data-lexical-term value="${esc(item.term)}"></label><label>Significado que quiero repasar<input data-lexical-meaning value="${esc(item.desired_meaning_es||item.reason||'')}"></label>${item.reading_hiragana?`<small>Lectura: ${esc(item.reading_hiragana)}</small>`:''}</article>`).join(''):'<p class="lexical-empty">La IA no ha aislado ningún término con suficiente seguridad.</p>';
    const existing=new Set(items.map(item=>item.term)),extra=readings.filter(item=>item.characters&&!existing.has(item.characters)).slice(0,14),chips=extra.map((item,index)=>`<button type="button" class="lexical-chip" data-lexical-chip="${index}"><span lang="ja">${esc(item.characters)}</span>${item.reading_hiragana?` <small>${esc(item.reading_hiragana)}</small>`:''}</button>`).join('');
    return {extra,html:`<section class="post-answer-srs lexical-review-editor"><p class="section-kicker">Mini-SRS</p><h4>¿Qué términos quieres repasar?</h4><p>La IA cree que has fallado estos elementos. Marca solo los correctos y edítalos si hace falta.</p><div class="lexical-proposal-list">${rows}</div>${chips?`<div class="lexical-chip-section"><strong>Otros términos de la frase</strong><p>Tócalos para añadirlos sin escribir el kanji.</p><div>${chips}</div></div>`:''}<label class="lexical-add-label">Esto también lo he fallado<textarea rows="2" data-lexical-additions placeholder="Pega uno o varios: もっと = más\n本 = libro"></textarea></label><small data-lexical-editor-status>Solo entrarán en el mini-SRS al continuar.</small></section>`};
  }
  async function reviewBeforeNext(attemptId){
    const attempt=attemptId?await JapoDB.get('attempts',attemptId):null;if(!attempt)return true;
    return new Promise(resolve=>{
      const current=attempt.user_difficulty_feedback||'',score=Math.max(0,Math.min(100,Math.round(Number(attempt.overall_score)||0))),items=lexicalItems(attempt),readings=parse(attempt,'kanji_readings'),lexical=editor(items,readings),modal=document.createElement('div');modal.className='post-answer-modal';
      modal.innerHTML=`<section class="post-answer-card" role="dialog" aria-modal="true" aria-labelledby="postAnswerTitle" data-attempt-id="${esc(attemptId)}"><p class="section-kicker">Antes del siguiente ejercicio</p><h3 id="postAnswerTitle">Revisa lo aprendido</h3><p class="post-answer-help">Confirma el mini-SRS y dinos cómo te ha parecido la pregunta.</p>${lexical.html}<section class="difficulty-feedback-panel"><h4>¿Cómo te ha parecido?</h4><div class="difficulty-feedback-buttons"><button type="button" data-difficulty-feedback="too_easy" class="${current==='too_easy'?'active':''}">Muy fácil</button><button type="button" data-difficulty-feedback="normal" class="${current==='normal'?'active':''}">Normal</button><button type="button" data-difficulty-feedback="too_hard" class="${current==='too_hard'?'active':''}">Muy difícil</button></div><span data-difficulty-feedback-status>${current?`Guardado: ${esc(attempt.user_difficulty_feedback_label||current)}.`:'Elige una opción para continuar.'}</span></section><label class="post-answer-check"><input type="checkbox" data-enable-manual-score> Quiero ajustar la nota</label><section class="manual-score-panel post-answer-score" hidden><h4>Ajustar nota del intento</h4><label>Nota real<input type="number" min="0" max="100" step="1" value="${esc(score)}" data-manual-score></label><label>Motivo<textarea rows="2" maxlength="300" data-manual-score-reason></textarea></label><span data-manual-score-status></span></section><div class="post-answer-actions"><button class="primary" type="button" data-continue-after-review ${current?'':'disabled'}>Confirmar y continuar</button></div></section>`;
      document.body.appendChild(modal);const panel=modal.querySelector('.post-answer-card'),next=modal.querySelector('[data-continue-after-review]'),scorePanel=modal.querySelector('.post-answer-score'),status=modal.querySelector('[data-lexical-editor-status]');
      (modal.querySelector('[data-difficulty-feedback].active')||modal.querySelector('[data-difficulty-feedback]'))?.focus();
      modal.addEventListener('click',async event=>{
        const difficulty=event.target.closest('[data-difficulty-feedback]');if(difficulty){await window.ManualAdjustments.saveDifficultyFeedback(panel,difficulty.dataset.difficultyFeedback);next.disabled=false;return}
        const chip=event.target.closest('[data-lexical-chip]');if(chip){const item=lexical.extra[Number(chip.dataset.lexicalChip)],input=panel.querySelector('[data-lexical-additions]');if(item){input.value=[input.value.trim(),`${item.characters}${item.meaning_es?` = ${item.meaning_es}`:''}`].filter(Boolean).join('\n');input.focus()}return}
        if(event.target.closest('[data-enable-manual-score]')){scorePanel.hidden=!event.target.checked;return}
        if(event.target.closest('[data-continue-after-review]')){if(next.disabled)return;next.disabled=true;next.textContent='Guardando...';try{const saved=await confirm(panel,attempt,items,readings);if(!scorePanel.hidden)await window.ManualAdjustments.saveScoreAdjustment(panel);status.textContent=saved.length?`${saved.length} término${saved.length===1?'':'s'} confirmado${saved.length===1?'':'s'}.`:'No se añadió ningún término.';modal.remove();resolve(true)}catch(error){status.textContent=error.message||'Revisa los términos.';next.disabled=false;next.textContent='Confirmar y continuar'}}
      });
      modal.addEventListener('keydown',event=>{if(event.key==='Escape')event.preventDefault()});
    });
  }
  document.addEventListener('DOMContentLoaded',()=>{if(window.ManualAdjustments)window.ManualAdjustments.reviewBeforeNext=reviewBeforeNext});
})();
