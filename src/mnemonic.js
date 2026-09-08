(function(){
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const pending=new Map();
  function valid(value){return value&&Array.isArray(value.tips)&&value.tips.length<=2&&typeof value.note_es==='string'&&value.note_es.length<=800&&(value.tips.length>0||value.note_es.trim())&&value.tips.every(t=>t&&['target_es','trick_es','rule_es'].every(k=>typeof t[k]==='string'&&t[k].trim()&&t[k].length<=1000))}
  function saved(attempt){try{const value=JSON.parse(attempt?.mnemonic_json||'null');return valid(value)?value:null}catch{return null}}
  function content(value){return value.tips.map(t=>`<article><strong>${esc(t.target_es)}</strong><p>${esc(t.trick_es)}</p><p class="mnemonic-rule"><b>Recuerda:</b> ${esc(t.rule_es)}</p></article>`).join('')+(value.note_es?`<p>${esc(value.note_es)}</p>`:'')+'<button class="text-button" type="button" data-mnemonic-refresh>Probar otra asociación</button>'}
  function html(attemptId,errors,attempt){
    if(!attemptId||attempt?.evaluation_status==='invalid')return '';
    const value=saved(attempt);
    return `<section class="mnemonic-card" data-mnemonic-attempt="${esc(attemptId)}"><h4>¿Quieres un consejo mnemotécnico?</h4><p>${errors.length?'Un truco breve para recordar lo que has fallado.':'Un truco breve para recordar el vocabulario o la estructura de esta frase.'}</p><button type="button" class="secondary" data-mnemonic-generate${value?' hidden':''}>Dame un consejo</button><div class="mnemonic-result" aria-live="polite"${value?'':' hidden'}>${value?content(value):''}</div><small>Las asociaciones son ayudas de memoria inventadas.</small></section>`;
  }
  async function generate(id,refresh=false){
    const attempt=await JapoDB.get('attempts',id);if(!attempt||attempt.evaluation_status!=='valid')throw new Error('No se encontró una corrección válida.');
    const cached=saved(attempt);if(cached&&!refresh)return cached;
    const [settings,exercise,token]=await Promise.all([JapoDB.get('settings','app'),JapoDB.get('exercises',attempt.exercise_id),window.CloudSync?.getAccessToken()]);
    if(!token)throw new Error('Inicia sesión para pedir un consejo con IA.');
    if(!exercise)throw new Error('No se encontró la frase de este intento.');
    let errors;try{errors=JSON.parse(attempt.errors_json||'null')}catch{}
    errors=Array.isArray(errors)?errors:Array.isArray(attempt.errors)?attempt.errors:[];
    errors=errors.filter(e=>String(e.source_span||'').trim()!==String(e.corrected_span||'').trim()).slice(0,6);
    const endpoint=(settings?.value?.aiEndpoint||'https://japoteacher-ai.raul-nihongo.workers.dev/evaluate').replace(/\/evaluate\/?$/,'/mnemonic');
    const response=await fetch(endpoint,{method:'POST',signal:AbortSignal.timeout(45000),headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`,'X-Device-ID':window.CloudSync?.getDeviceId?.()||''},body:JSON.stringify({exercise:{direction:attempt.direction,japanese_sentence:exercise.direction==='ja_es'?exercise.source_text:attempt.correct_japanese_sentence||exercise.reference_translation,spanish_sentence:exercise.direction==='ja_es'?exercise.reference_translation:exercise.source_text},user_answer:attempt.user_answer||'',errors:errors.map(e=>({source_span:String(e.source_span||''),corrected_span:String(e.corrected_span||''),explanation_es:String(e.explanation_es||'')}))})});
    const data=await response.json();if(!response.ok)throw new Error(data.error||'No se pudo preparar el consejo.');
    if(!valid(data.mnemonic))throw new Error('El consejo llegó incompleto. Puedes reintentarlo.');
    const latest=await JapoDB.get('attempts',id);if(!latest)throw new Error('El intento ya no está disponible.');
    await JapoDB.put('attempts',{...latest,mnemonic_json:JSON.stringify(data.mnemonic),mnemonic_updated_at:new Date().toISOString()});
    return data.mnemonic;
  }
  async function click(button){
    const card=button.closest('[data-mnemonic-attempt]'),id=card.dataset.mnemonicAttempt,target=card.querySelector('.mnemonic-result');
    const refresh=button.hasAttribute('data-mnemonic-refresh');if(refresh)card.insertBefore(button,target);button.disabled=true;button.textContent='Preparando consejo…';target.hidden=false;target.textContent='Buscando una asociación fácil de recordar…';
    try{
      if(!pending.has(id))pending.set(id,generate(id,button.hasAttribute('data-mnemonic-refresh')).finally(()=>pending.delete(id)));
      const value=await pending.get(id);target.innerHTML=content(value);button.hidden=true;
    }catch(error){target.textContent=error.name==='TimeoutError'?'El consejo está tardando demasiado. Puedes reintentarlo.':error.message||'No se pudo preparar el consejo.';button.textContent='Reintentar consejo'}
    finally{button.disabled=false;if(refresh&&button.hidden)button.remove()}
  }
  document.addEventListener('click',event=>{const button=event.target.closest('[data-mnemonic-generate],[data-mnemonic-refresh]');if(button&&!button.disabled)void click(button)});
  window.Mnemonic={html,saved};
})();
