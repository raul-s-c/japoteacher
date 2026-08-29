(function(){
  const $=selector=>document.querySelector(selector),
    esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

  function endpoint(settings){
    return (settings?.aiEndpoint||'https://japoteacher-ai.raul-nihongo.workers.dev/evaluate').replace(/\/evaluate$/,'/daily-news');
  }
  function list(items){
    return (Array.isArray(items)?items:[]).filter(Boolean).map(item=>`<li>${esc(item)}</li>`).join('');
  }
  function japaneseWithFurigana(text,readings=[]){
    const source=String(text||''),items=(Array.isArray(readings)?readings:[]).filter(item=>item.characters&&item.reading_hiragana).sort((a,b)=>b.characters.length-a.characters.length);
    let html='',index=0;
    while(index<source.length){
      const item=items.find(candidate=>source.startsWith(candidate.characters,index));
      if(item){html+=`<ruby>${esc(item.characters)}<rt>${esc(item.reading_hiragana)}</rt></ruby>`;index+=item.characters.length}
      else{html+=esc(source[index]);index++}
    }
    return html;
  }
  function vocab(items){
    return (Array.isArray(items)?items:[]).map(item=>`<article><strong lang="ja">${esc(item.term)}</strong><span>${esc(item.reading)}</span><p><b>${esc(item.meaning_es)}</b> · ${esc(item.note_es)}</p></article>`).join('');
  }
  function render(data){
    const news=data.news||{},source=news.selected_source||{},target=$('#dailyNewsOutput'),readings=news.furigana_readings||[];
    target.innerHTML=`<article class="daily-news-card">
      <header>
        <p class="section-kicker">Lectura graduada</p>
        <h3 lang="ja">${japaneseWithFurigana(news.japanese_title,readings)}</h3>
        <div class="daily-news-source"><span>${esc(source.source||'Fuente')}</span><span>${esc(source.published||'últimas 24h')}</span>${source.url?`<a href="${esc(source.url)}" target="_blank" rel="noopener">Ver fuente</a>`:''}</div>
      </header>
      <div class="daily-news-article" lang="ja">${japaneseWithFurigana(news.japanese_article,readings)}</div>
      ${news.spanish_summary?.length?`<section><h4>Resumen en español</h4><ul>${list(news.spanish_summary)}</ul></section>`:''}
      ${news.level_notes?.length?`<section><h4>Adaptación de nivel</h4><ul>${list(news.level_notes)}</ul></section>`:''}
      ${news.vocabulary?.length?`<section><h4>Vocabulario clave</h4><div class="daily-news-vocab">${vocab(news.vocabulary)}</div></section>`:''}
      ${news.grammar_points?.length?`<section><h4>Gramática</h4><ul>${list(news.grammar_points)}</ul></section>`:''}
      ${news.discussion_questions?.length?`<section><h4>Preguntas de comprensión</h4><ul>${list(news.discussion_questions)}</ul></section>`:''}
      ${news.source_note?`<section><h4>Nota de fuente</h4><p>${esc(news.source_note)}</p></section>`:''}
    </article>`;
  }
  async function generate(){
    const button=$('#dailyNewsGenerate'),target=$('#dailyNewsOutput');
    const topic=$('#dailyNewsTopic')?.value,jlpt=$('#dailyNewsJlpt')?.value,band=$('#dailyNewsBand')?.value;
    button.disabled=true;button.textContent='Buscando...';
    target.innerHTML='<div class="feedback-empty daily-news-loading"><span>新</span><h3>Buscando noticia</h3><p>Consultando Brave Search y preparando una lectura japonesa graduada.</p></div>';
    try{
      const [settings,token]=await Promise.all([JapoDB.get('settings','app'),window.CloudSync?.getAccessToken()]);
      if(!token)throw new Error('Inicia sesión para generar la noticia del día.');
      const response=await fetch(endpoint(settings?.value||{}),{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`,'X-Device-ID':window.CloudSync?.getDeviceId?.()||''},body:JSON.stringify({topic,jlpt,band})});
      const data=await response.json();
      if(!response.ok)throw new Error(data.error||`Error HTTP ${response.status}`);
      render(data);
    }catch(error){
      target.innerHTML=`<p class="dictionary-ai-error">${esc(error.message||'No se pudo generar la noticia.')}</p>`;
    }finally{
      button.disabled=false;button.textContent='Buscar y adaptar';
    }
  }
  document.addEventListener('DOMContentLoaded',()=>$('#dailyNewsGenerate')?.addEventListener('click',generate));
})();
