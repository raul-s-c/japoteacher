(function(){
  const $=selector=>document.querySelector(selector),
    esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const state={news:null,questionLanguage:'ja'};

  function endpoint(settings){
    return (settings?.aiEndpoint||'https://japoteacher-ai.raul-nihongo.workers.dev/evaluate').replace(/\/evaluate$/,'/daily-news');
  }
  function answerEndpoint(settings){
    return (settings?.aiEndpoint||'https://japoteacher-ai.raul-nihongo.workers.dev/evaluate').replace(/\/evaluate$/,'/daily-news-answer');
  }
  function list(items){
    return (Array.isArray(items)?items:[]).filter(Boolean).map(item=>`<li>${esc(item)}</li>`).join('');
  }
  function stripInlineReadings(text){
    return String(text||'').replace(/([\u3400-\u9fff々〆ヶぁ-んァ-ンー]+)[（(]([ぁ-んァ-ンー]+)[)）]/g,'$1');
  }
  function cleanReadings(readings=[]){
    return (Array.isArray(readings)?readings:[]).map(item=>({...item,characters:stripInlineReadings(item.characters),reading_hiragana:stripInlineReadings(item.reading_hiragana)}));
  }
  function japaneseWithFurigana(text,readings=[]){
    const source=stripInlineReadings(text),items=cleanReadings(readings).filter(item=>item.characters&&item.reading_hiragana).sort((a,b)=>b.characters.length-a.characters.length);
    let html='',index=0;
    while(index<source.length){
      const item=items.find(candidate=>source.startsWith(candidate.characters,index));
      if(item){html+=`<ruby>${esc(item.characters)}<rt>${esc(item.reading_hiragana)}</rt></ruby>`;index+=item.characters.length}
      else{html+=esc(source[index]);index++}
    }
    return html;
  }
  function vocab(items){
    return (Array.isArray(items)?items:[]).map(item=>`<article><strong lang="ja">${esc(stripInlineReadings(item.term))}</strong><span>${esc(stripInlineReadings(item.reading))}</span><p><b>${esc(item.meaning_es)}</b> · ${esc(item.note_es)}</p></article>`).join('');
  }
  function normalizeQuestions(items){
    return (Array.isArray(items)?items:[]).filter(Boolean).map(item=>{
      if(typeof item==='string')return {question_ja:item,question_es:item,answer_ja:'',answer_es:''};
      return {
        question_ja:stripInlineReadings(item.question_ja||item.question||''),
        question_es:item.question_es||item.question||'',
        answer_ja:stripInlineReadings(item.answer_ja||''),
        answer_es:item.answer_es||''
      };
    }).filter(item=>item.question_ja||item.question_es);
  }
  function questionText(question,lang,readings){
    return lang==='es'?esc(question.question_es||question.question_ja):japaneseWithFurigana(question.question_ja||question.question_es,readings);
  }
  function questionsHtml(news,readings){
    const questions=normalizeQuestions(news.discussion_questions);
    if(!questions.length)return '';
    return `<section class="daily-news-questions">
      <div class="daily-news-question-head">
        <h4>Preguntas de comprensión</h4>
        <div class="daily-news-toggle" role="group" aria-label="Idioma de las preguntas">
          <button type="button" class="active" data-news-question-lang="ja">日本語</button>
          <button type="button" data-news-question-lang="es">Español</button>
        </div>
      </div>
      <div class="daily-news-question-list">
        ${questions.map((question,index)=>`<article class="daily-news-question" data-news-question="${index}">
          <div class="daily-news-question-title">
            <span>${String(index+1).padStart(2,'0')}</span>
            <strong class="daily-news-question-text" lang="ja">${questionText(question,state.questionLanguage,readings)}</strong>
          </div>
          <textarea data-news-answer="${index}" rows="3" placeholder="Responde en español o japonés"></textarea>
          <div class="daily-news-question-actions">
            <button class="secondary" type="button" data-correct-news-answer="${index}">Corregir respuesta</button>
          </div>
          <div class="daily-news-question-feedback" data-news-feedback="${index}" hidden></div>
        </article>`).join('')}
      </div>
    </section>`;
  }
  function setQuestionLanguage(lang){
    state.questionLanguage=lang==='es'?'es':'ja';
    const output=$('#dailyNewsOutput'),questions=normalizeQuestions(state.news?.discussion_questions),readings=state.news?.furigana_readings||[];
    output?.querySelectorAll('[data-news-question-lang]').forEach(button=>button.classList.toggle('active',button.dataset.newsQuestionLang===state.questionLanguage));
    output?.querySelectorAll('[data-news-question]').forEach(card=>{
      const index=Number(card.dataset.newsQuestion),target=card.querySelector('.daily-news-question-text'),question=questions[index];
      if(target&&question){
        target.lang=state.questionLanguage==='ja'?'ja':'es';
        target.innerHTML=questionText(question,state.questionLanguage,readings);
      }
    });
  }
  function correctionHtml(correction){
    const score=Number(correction.score)||0;
    return `<div class="daily-news-answer-grade ${correction.is_correct?'ok':'review'}"><strong>${score}/100</strong><span>${correction.is_correct?'Correcta':'Revisar'}</span></div>
      <p>${esc(correction.feedback_es)}</p>
      ${correction.model_answer_ja||correction.model_answer_es?`<div class="daily-news-model-answer">
        ${correction.model_answer_ja?`<strong lang="ja">${japaneseWithFurigana(correction.model_answer_ja,state.news?.furigana_readings||[])}</strong>`:''}
        ${correction.model_answer_es?`<span>${esc(correction.model_answer_es)}</span>`:''}
      </div>`:''}
      ${correction.improvement_tip_es?`<small>${esc(correction.improvement_tip_es)}</small>`:''}`;
  }
  async function correctAnswer(index){
    const questions=normalizeQuestions(state.news?.discussion_questions),question=questions[index],textarea=$(`[data-news-answer="${index}"]`),feedback=$(`[data-news-feedback="${index}"]`),button=$(`[data-correct-news-answer="${index}"]`);
    const studentAnswer=textarea?.value.trim();
    if(!question||!studentAnswer){window.toast?window.toast('Escribe primero tu respuesta.'):alert('Escribe primero tu respuesta.');return}
    button.disabled=true;button.textContent='Corrigiendo...';feedback.hidden=false;feedback.innerHTML='<p>Corrigiendo con IA...</p>';
    try{
      const [settings,token]=await Promise.all([JapoDB.get('settings','app'),window.CloudSync?.getAccessToken()]);
      if(!token)throw new Error('Inicia sesión para corregir la respuesta.');
      const response=await fetch(answerEndpoint(settings?.value||{}),{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`,'X-Device-ID':window.CloudSync?.getDeviceId?.()||''},body:JSON.stringify({title:state.news?.japanese_title||'',article:state.news?.japanese_article||'',question,student_answer:studentAnswer})});
      const data=await response.json();
      if(!response.ok)throw new Error(data.error||`Error HTTP ${response.status}`);
      feedback.innerHTML=correctionHtml(data.correction||{});
    }catch(error){
      feedback.innerHTML=`<p class="dictionary-ai-error">${esc(error.message||'No se pudo corregir la respuesta.')}</p>`;
    }finally{
      button.disabled=false;button.textContent='Corregir respuesta';
    }
  }
  function render(data){
    const news=data.news||{},source=news.selected_source||{},target=$('#dailyNewsOutput'),readings=news.furigana_readings||[];
    state.news=news;state.questionLanguage='ja';
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
      ${questionsHtml(news,readings)}
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
  document.addEventListener('DOMContentLoaded',()=>{
    $('#dailyNewsGenerate')?.addEventListener('click',generate);
    $('#dailyNewsOutput')?.addEventListener('click',event=>{
      const lang=event.target.closest('[data-news-question-lang]')?.dataset.newsQuestionLang;
      if(lang){setQuestionLanguage(lang);return}
      const correct=event.target.closest('[data-correct-news-answer]')?.dataset.correctNewsAnswer;
      if(correct!=null)correctAnswer(Number(correct));
    });
  });
})();
