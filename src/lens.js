(function(){
  const $=selector=>document.querySelector(selector),
    esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const state={capture:null,messages:[],image:null};
  function endpoint(settings){return (settings?.aiEndpoint||'https://japoteacher-ai.raul-nihongo.workers.dev/evaluate').replace(/\/evaluate$/,'/lens')}
  function mode(){return document.querySelector('[name="lensMode"]:checked')?.value==='vision'?'vision':'text'}
  function localDate(){const now=new Date();return [now.getFullYear(),String(now.getMonth()+1).padStart(2,'0'),String(now.getDate()).padStart(2,'0')].join('-')}
  function parseJson(value,fallback){try{return JSON.parse(value||'')}catch{return fallback}}
  function setBusy(button,busy,label){if(!button)return;button.disabled=busy;button.textContent=busy?label:button.dataset.label}
  function japaneseWithFurigana(text,readings=[]){
    const source=String(text||''),items=(Array.isArray(readings)?readings:[]).map(item=>({characters:item.characters||item.item,reading_hiragana:item.reading_hiragana||item.reading})).filter(item=>item.characters&&item.reading_hiragana).sort((a,b)=>b.characters.length-a.characters.length);
    let html='',index=0;
    while(index<source.length){const item=items.find(candidate=>source.startsWith(candidate.characters,index));if(item){html+=`<ruby>${esc(item.characters)}<rt>${esc(item.reading_hiragana)}</rt></ruby>`;index+=item.characters.length}else{html+=esc(source[index]);index++}}
    return html;
  }
  function paragraphs(items){return (Array.isArray(items)?items:[]).filter(Boolean).map(item=>`<p>${esc(item)}</p>`).join('')}
  function list(items){return (Array.isArray(items)?items:[]).filter(Boolean).map(item=>`<li>${esc(item)}</li>`).join('')}
  function vocab(items){return (Array.isArray(items)?items:[]).filter(Boolean).map(item=>`<article><strong lang="ja">${esc(item.term||item.characters||'')}</strong><span>${esc(item.reading_hiragana||item.reading||'')}</span><p><b>${esc(item.meaning_es||'')}</b> · ${esc(item.note_es||item.explanation_es||'')}</p></article>`).join('')}
  function renderAnalysis(data){
    const analysis=data.analysis||{},target=$('#lensOutput'),thread=$('#lensThread'),ask=$('#lensAsk'),readings=analysis.kanji_vocabulary||[];
    state.capture=data;state.messages=[];
    target.innerHTML=`<article class="lens-card">
      <header><p class="section-kicker">${esc(analysis.context_label||'Análisis de lupa')}</p><h3>${esc(analysis.title_es||'Lectura capturada')}</h3><div class="lens-meta"><span>${esc(data.capture_mode==='vision'?'Visión + OCR':'Solo texto')}</span><span>${esc(analysis.jlpt_estimate||'JLPT —')}</span></div></header>
      ${analysis.ocr_text?`<section><h4>Texto detectado</h4><div class="lens-ocr" lang="ja">${japaneseWithFurigana(analysis.ocr_text,readings)}</div></section>`:''}
      <section class="lens-translation"><span>Traducción natural</span><p>${esc(analysis.translation_es||'')}</p></section>
      <section><h4>Explicación docente</h4>${paragraphs(analysis.teacher_explanation)}</section>
      ${analysis.grammar_points?.length?`<section><h4>Estructura y gramática</h4><ul>${list(analysis.grammar_points)}</ul></section>`:''}
      ${analysis.kanji_vocabulary?.length?`<section><h4>Kanji y vocabulario</h4><div class="daily-news-vocab">${vocab(analysis.kanji_vocabulary)}</div></section>`:''}
      ${analysis.study_notes?.length?`<section><h4>Notas de estudio</h4><ul>${list(analysis.study_notes)}</ul></section>`:''}
      ${analysis.reusable_phrase_candidates?.length?`<section><h4>Posibles frases para estudiar</h4><ul>${list(analysis.reusable_phrase_candidates)}</ul></section>`:''}
    </article>`;
    thread.innerHTML='<p class="empty">Análisis generado. Puedes preguntar sobre esta captura.</p>';
    ask.disabled=false;
  }
  function renderThread(){
    const target=$('#lensThread');
    target.innerHTML=state.messages.length?state.messages.map(message=>`<article class="ai-tutor-message ${message.role}"><span>${message.role==='user'?'Tú':'Lupa IA'}</span><p>${esc(message.content)}</p></article>`).join(''):'<p class="empty">Análisis generado. Puedes preguntar sobre esta captura.</p>';
    target.scrollTop=target.scrollHeight;
  }
  async function resizeImage(file){
    const bitmap=await createImageBitmap(file),max=1280,scale=Math.min(1,max/Math.max(bitmap.width,bitmap.height)),canvas=document.createElement('canvas');
    canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));
    const context=canvas.getContext('2d');context.drawImage(bitmap,0,0,canvas.width,canvas.height);
    return canvas.toDataURL('image/jpeg',.82);
  }
  async function selectImage(file){
    if(!file)return;
    state.image=await resizeImage(file);
    $('#lensPreview').innerHTML=`<img src="${state.image}" alt="Imagen seleccionada para analizar"><small>${esc(file.name)} · imagen reducida antes de enviar</small>`;
  }
  async function callLens(body){
    const [settings,token]=await Promise.all([JapoDB.get('settings','app'),window.CloudSync?.getAccessToken()]);
    if(!token)throw new Error('Inicia sesión para usar la Lupa IA.');
    const response=await fetch(endpoint(settings?.value||{}),{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`,'X-Device-ID':window.CloudSync?.getDeviceId?.()||''},body:JSON.stringify(body)});
    const data=await response.json();
    if(!response.ok)throw new Error(data.error||`Error HTTP ${response.status}`);
    return data;
  }
  async function saveCapture(data){
    const settings=(await JapoDB.get('settings','app'))?.value||{},now=new Date().toISOString(),capture=data.analysis||{},captureId=data.capture_id||crypto.randomUUID();
    data.capture_id=captureId;
    await JapoDB.put('lens_captures',{capture_id:captureId,profile_id:settings.profileId||'local-default',created_at:now,updated_at:now,local_date:localDate(),mode:data.capture_mode||mode(),context:$('#lensContext')?.value||'',context_detail:$('#lensContextDetail')?.value.trim()||'',input_text:$('#lensText')?.value.trim()||'',ocr_text:capture.ocr_text||'',title_es:capture.title_es||'',translation_es:capture.translation_es||'',jlpt_estimate:capture.jlpt_estimate||'',analysis_json:JSON.stringify(capture),usage_json:JSON.stringify(data.usage||{}),model:data.model||'',response_id:data.response_id||'',has_image:data.capture_mode==='vision'});
    await renderHistory();
  }
  async function analyze(){
    const button=$('#lensAnalyze'),target=$('#lensOutput'),selectedMode=mode(),text=$('#lensText')?.value.trim()||'',context=$('#lensContext')?.value||'',contextDetail=$('#lensContextDetail')?.value.trim()||'';
    if(selectedMode==='text'&&!text){window.UI?.toast?.('Pega texto japonés o cambia a modo visión.');return}
    if(selectedMode==='vision'&&!state.image&&!text){window.UI?.toast?.('Añade una imagen o una transcripción.');return}
    setBusy(button,true,selectedMode==='vision'?'Analizando imagen...':'Analizando texto...');
    target.innerHTML='<div class="feedback-empty lens-loading"><span>⌕</span><h3>Analizando con IA</h3><p>Extrayendo texto, traducción y explicación didáctica.</p></div>';
    try{
      const data=await callLens({operation:'analyze',mode:selectedMode,context,context_detail:contextDetail,text,image_data_url:selectedMode==='vision'?state.image:''});
      data.capture_mode=selectedMode;
      renderAnalysis(data);
      await saveCapture(data);
    }catch(error){target.innerHTML=`<p class="dictionary-ai-error">${esc(error.message||'No se pudo analizar la captura.')}</p>`}
    finally{setBusy(button,false)}
  }
  async function ask(){
    const button=$('#lensAsk'),input=$('#lensQuestion'),question=input?.value.trim();
    if(!question||!state.capture)return;
    state.messages.push({role:'user',content:question});renderThread();input.value='';setBusy(button,true,'Preguntando...');
    try{
      const data=await callLens({operation:'chat',mode:state.capture.capture_mode||mode(),question,analysis:state.capture.analysis,messages:state.messages.slice(-8)});
      const answer=data.answer?.answer_es||'No se pudo preparar una respuesta.';
      state.messages.push({role:'assistant',content:answer});
      await JapoDB.put('lens_messages',{message_id:crypto.randomUUID(),capture_id:state.capture.capture_id||'',created_at:new Date().toISOString(),role:'user',content:question});
      await JapoDB.put('lens_messages',{message_id:crypto.randomUUID(),capture_id:state.capture.capture_id||'',created_at:new Date().toISOString(),role:'assistant',content:answer});
      renderThread();
    }catch(error){state.messages.push({role:'assistant',content:error.message||'No se pudo responder.'});renderThread()}
    finally{setBusy(button,false)}
  }
  async function loadCapture(id){
    const row=await JapoDB.get('lens_captures',id);
    if(!row)return;
    const messages=(await JapoDB.all('lens_messages')).filter(item=>item.capture_id===id).sort((a,b)=>String(a.created_at).localeCompare(String(b.created_at)));
    renderAnalysis({capture_id:id,capture_mode:row.mode,analysis:parseJson(row.analysis_json,{})});
    state.messages=messages.map(item=>({role:item.role,content:item.content}));
    renderThread();
    await renderHistory();
  }
  async function deleteCapture(id){
    if(!confirm('¿Eliminar este análisis de la lupa?'))return;
    const messages=(await JapoDB.all('lens_messages')).filter(item=>item.capture_id===id);
    await JapoDB.batch(async()=>{await JapoDB.delete('lens_captures',id);for(const message of messages)await JapoDB.delete('lens_messages',message.message_id)});
    if(state.capture?.capture_id===id)clear();
    await renderHistory();
  }
  async function renderHistory(){
    const target=$('#lensHistory');
    if(!target||!window.JapoDB)return;
    const rows=(await JapoDB.all('lens_captures')).sort((a,b)=>String(b.created_at).localeCompare(String(a.created_at))).slice(0,30);
    target.innerHTML=rows.length?rows.map(row=>`<article class="lens-history-item ${state.capture?.capture_id===row.capture_id?'active':''}"><button type="button" data-lens-load="${esc(row.capture_id)}"><span>${esc(new Date(row.created_at).toLocaleDateString('es-ES',{day:'numeric',month:'short'}))} · ${esc(row.mode==='vision'?'visión':'texto')} · ${esc(row.context||'contexto')}</span><strong>${esc(row.title_es||row.ocr_text||'Análisis de lupa')}</strong><small>${esc(row.jlpt_estimate||'JLPT —')}</small></button><button class="icon-button" type="button" data-lens-delete="${esc(row.capture_id)}" aria-label="Eliminar análisis">×</button></article>`).join(''):'<p class="empty">Aún no hay capturas analizadas.</p>';
  }
  function updateMode(){
    const vision=mode()==='vision';
    $('#lensImageTools').hidden=!vision;
  }
  function clear(){
    state.capture=null;state.messages=[];state.image=null;
    $('#lensText').value='';$('#lensQuestion').value='';$('#lensContextDetail').value='';$('#lensPreview').innerHTML='';$('#lensAsk').disabled=true;
    $('#lensOutput').innerHTML='<div class="feedback-empty"><span>⌕</span><h3>La explicación aparecerá aquí</h3><p>Elige solo texto para ahorrar o visión si necesitas OCR de una captura.</p></div>';
    $('#lensThread').innerHTML='<p class="empty">Todavía no hay una captura activa sobre la que preguntar.</p>';
  }
  function nativeBridge(){
    try{return window.JapoNativeAndroid&&window.JapoNativeAndroid.isNativeApp?.()?window.JapoNativeAndroid:null}catch(_error){return null}
  }
  function setNativeVisible(){
    const tools=$('#lensNativeTools'),bridge=nativeBridge();
    if(tools)tools.hidden=!bridge;
  }
  function setLensMode(nextMode){
    const radio=document.querySelector(`[name="lensMode"][value="${nextMode==='vision'?'vision':'text'}"]`);
    if(radio){radio.checked=true;updateMode()}
  }
  function showLensView(){
    const button=document.querySelector('.nav-item[data-view="lupa"]');
    if(button)button.click();
    else location.hash='lupa';
  }
  function receiveNativeCapture(payload){
    const data=typeof payload==='string'?parseJson(payload,{}):(payload||{}),text=String(data.text||'').trim(),image=String(data.imageDataUrl||'').trim(),context=String(data.context||'').trim();
    showLensView();
    if(context)$('#lensContextDetail').value=context;
    if(text)$('#lensText').value=text;
    state.image=image||null;
    if(image){
      setLensMode('vision');
      $('#lensPreview').innerHTML=`<img src="${image}" alt="Recorte capturado con lupa nativa"><small>Recorte recibido desde la lupa nativa. Se enviará porque elegiste visión.</small>`;
    }else{
      setLensMode('text');
      $('#lensPreview').innerHTML='';
    }
    window.UI?.toast?.('Captura recibida. Revisa el texto y pulsa Analizar.');
  }
  document.addEventListener('DOMContentLoaded',()=>{
    $('#lensAnalyze')?.setAttribute('data-label','Analizar');$('#lensAsk')?.setAttribute('data-label','Preguntar');
    document.querySelectorAll('[name="lensMode"]').forEach(radio=>radio.addEventListener('change',updateMode));
    $('#lensImageInput')?.addEventListener('change',event=>selectImage(event.target.files?.[0]).catch(error=>window.UI?.toast?.(error.message||'No se pudo preparar la imagen.')));
    $('#lensAnalyze')?.addEventListener('click',analyze);$('#lensAsk')?.addEventListener('click',ask);$('#lensClear')?.addEventListener('click',clear);$('#lensRefreshHistory')?.addEventListener('click',renderHistory);
    $('#lensNativeEnable')?.addEventListener('click',()=>{try{nativeBridge()?.startFloatingLens?.()}catch(error){window.UI?.toast?.(error.message||'No se pudo activar la lupa.')}});
    $('#lensNativeDisable')?.addEventListener('click',()=>{try{nativeBridge()?.stopFloatingLens?.()}catch(error){window.UI?.toast?.(error.message||'No se pudo desactivar la lupa.')}});
    $('#lensQuestion')?.addEventListener('keydown',event=>{if(event.key==='Enter'&&(event.ctrlKey||event.metaKey))ask()});
    $('#lensHistory')?.addEventListener('click',event=>{const load=event.target.closest('[data-lens-load]')?.dataset.lensLoad,del=event.target.closest('[data-lens-delete]')?.dataset.lensDelete;if(load)loadCapture(load);if(del)deleteCapture(del)});
    document.addEventListener('japoteacher:navigate',event=>{if(event.detail?.view==='lupa')renderHistory()});
    updateMode();setNativeVisible();renderHistory();
  });
  window.JapoNativeLens={receiveCapture:receiveNativeCapture};
})();
