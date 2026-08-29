(function(){
  const $=selector=>document.querySelector(selector),
    esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const state={analysis:null,messages:[]};
  function endpoint(settings){return (settings?.aiEndpoint||'https://japoteacher-ai.raul-nihongo.workers.dev/evaluate').replace(/\/evaluate$/,'/tutor')}
  function mode(){return document.querySelector('[name=aiTutorMode]:checked')?.value||'es_to_ja'}
  function setBusy(button,busy,text){if(!button)return;button.disabled=busy;button.textContent=busy?text:button.dataset.label}
  function paragraphs(items){return (Array.isArray(items)?items:[]).filter(Boolean).map(item=>`<p>${esc(item)}</p>`).join('')}
  function chips(items){return (Array.isArray(items)?items:[]).filter(Boolean).map(item=>`<span>${esc(item)}</span>`).join('')}
  function tableRows(items){return (Array.isArray(items)?items:[]).filter(Boolean).map(item=>`<tr><td>${esc(item.item||'')}</td><td>${esc(item.reading||'')}</td><td>${esc(item.meaning_es||'')}</td><td>${esc(item.role_es||'')}</td></tr>`).join('')}
  function renderAnalysis(data){
    state.analysis=data;
    const target=$('#aiTutorOutput'),chat=$('#aiTutorThread'),ask=$('#aiTutorAsk');
    const analysis=data.analysis||{};
    target.innerHTML=`<article class="ai-tutor-card">
      <header><p class="section-kicker">${analysis.mode_label||'Análisis didáctico'}</p><h3>${esc(analysis.title_es||'Traducción explicada')}</h3></header>
      <section class="ai-tutor-translation"><span>Traducción natural</span><strong lang="${mode()==='es_to_ja'?'ja':'es'}">${esc(analysis.natural_translation||'')}</strong></section>
      <section><h4>Lectura docente</h4>${paragraphs(analysis.teacher_explanation)}</section>
      <section><h4>Estructura</h4>${paragraphs(analysis.grammar_breakdown)}</section>
      ${analysis.kanji_vocabulary?.length?`<section><h4>Kanji, lecturas y vocabulario</h4><div class="table-wrap ai-tutor-table"><table><thead><tr><th>Elemento</th><th>Lectura</th><th>Significado</th><th>Función</th></tr></thead><tbody>${tableRows(analysis.kanji_vocabulary)}</tbody></table></div></section>`:''}
      ${analysis.natural_options?.length?`<section><h4>Alternativas naturales</h4><div class="ai-tutor-options">${chips(analysis.natural_options)}</div></section>`:''}
      ${analysis.common_pitfalls?.length?`<section><h4>Errores habituales</h4>${paragraphs(analysis.common_pitfalls)}</section>`:''}
    </article>`;
    state.messages=[];
    chat.innerHTML='<p class="empty">Análisis generado. Puedes preguntar sobre esta traducción.</p>';
    ask.disabled=false;
  }
  function renderThread(){
    const target=$('#aiTutorThread');
    target.innerHTML=state.messages.length?state.messages.map(message=>`<article class="ai-tutor-message ${message.role}"><span>${message.role==='user'?'Tú':'Tutor IA'}</span><p>${esc(message.content)}</p></article>`).join(''):'<p class="empty">Análisis generado. Puedes preguntar sobre esta traducción.</p>';
    target.scrollTop=target.scrollHeight;
  }
  async function callTutor(body){
    const [settings,token]=await Promise.all([JapoDB.get('settings','app'),window.CloudSync?.getAccessToken()]);
    if(!token)throw new Error('Inicia sesión para usar el Tutor IA.');
    const response=await fetch(endpoint(settings?.value||{}),{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`,'X-Device-ID':window.CloudSync?.getDeviceId?.()||''},body:JSON.stringify(body)});
    const data=await response.json();
    if(!response.ok)throw new Error(data.error||`Error HTTP ${response.status}`);
    return data;
  }
  async function analyze(){
    const button=$('#aiTutorSubmit'),text=$('#aiTutorText')?.value.trim(),target=$('#aiTutorOutput');
    if(!text){window.UI?.toast?.('Escribe un texto para analizar.');return}
    setBusy(button,true,'Analizando...');
    target.innerHTML='<div class="feedback-empty ai-tutor-loading"><span>訳</span><h3>Analizando con IA</h3><p>Preparando traducción natural, estructura y desglose didáctico.</p></div>';
    try{renderAnalysis(await callTutor({operation:'analyze',mode:mode(),text}))}
    catch(error){target.innerHTML=`<p class="dictionary-ai-error">${esc(error.message||'No se pudo analizar el texto.')}</p>`}
    finally{setBusy(button,false)}
  }
  async function ask(){
    const button=$('#aiTutorAsk'),input=$('#aiTutorQuestion'),question=input?.value.trim();
    if(!question||!state.analysis)return;
    state.messages.push({role:'user',content:question});
    renderThread();
    input.value='';
    setBusy(button,true,'Preguntando...');
    try{
      const data=await callTutor({operation:'chat',mode:mode(),text:$('#aiTutorText')?.value.trim()||'',question,analysis:state.analysis.analysis,messages:state.messages.slice(-8)});
      const answer=data.answer?.answer_es||'No se pudo preparar una respuesta.';
      state.messages.push({role:'assistant',content:answer});
      renderThread();
    }catch(error){state.messages.push({role:'assistant',content:error.message||'No se pudo responder.'});renderThread()}
    finally{setBusy(button,false)}
  }
  function clear(){
    state.analysis=null;state.messages=[];
    $('#aiTutorText').value='';$('#aiTutorQuestion').value='';$('#aiTutorAsk').disabled=true;
    $('#aiTutorOutput').innerHTML='<div class="feedback-empty"><span>訳</span><h3>La explicación aparecerá aquí</h3><p>Primero genera un análisis; después podrás preguntar sobre esa traducción en el chat lateral.</p></div>';
    $('#aiTutorThread').innerHTML='<p class="empty">Todavía no hay una traducción activa sobre la que preguntar.</p>';
  }
  function resetForModeChange(){
    state.analysis=null;state.messages=[];
    $('#aiTutorQuestion').value='';$('#aiTutorAsk').disabled=true;
    $('#aiTutorOutput').innerHTML='<div class="feedback-empty"><span>訳</span><h3>La explicación aparecerá aquí</h3><p>Primero genera un análisis; después podrás preguntar sobre esa traducción en el chat lateral.</p></div>';
    $('#aiTutorThread').innerHTML='<p class="empty">Todavía no hay una traducción activa sobre la que preguntar.</p>';
  }
  document.addEventListener('DOMContentLoaded',()=>{
    $('#aiTutorSubmit')?.setAttribute('data-label','Analizar con IA');
    $('#aiTutorAsk')?.setAttribute('data-label','Preguntar');
    $('#aiTutorSubmit')?.addEventListener('click',analyze);
    $('#aiTutorAsk')?.addEventListener('click',ask);
    $('#aiTutorClear')?.addEventListener('click',clear);
    document.querySelectorAll('input[name="aiTutorMode"]').forEach(radio=>radio.addEventListener('change',resetForModeChange));
    $('#aiTutorQuestion')?.addEventListener('keydown',event=>{if(event.key==='Enter'&&(event.ctrlKey||event.metaKey))ask()});
  });
})();
