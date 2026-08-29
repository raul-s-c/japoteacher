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
  function localDate(){
    const now=new Date();
    return [now.getFullYear(),String(now.getMonth()+1).padStart(2,'0'),String(now.getDate()).padStart(2,'0')].join('-');
  }
  function extractCandidatePhrases(news){
    const text=stripInlineReadings(news.japanese_article||'');
    return text.split(/(?<=[。！？])/).map(sentence=>sentence.trim()).filter(sentence=>sentence.length>=6).slice(0,12).map((sentence,index)=>({
      candidate_id:`${index+1}`,
      japanese:sentence,
      source:'daily_news',
      status:'pending_editorial_review',
      topic_hint:news.selected_source?.title||news.selected_source?.source||''
    }));
  }
  async function saveArticle(news,data){
    try{
      const settings=(await JapoDB.get('settings','app'))?.value||{},now=new Date().toISOString(),articleId=news.article_id||crypto.randomUUID();
      state.currentArticleId=articleId;
      await JapoDB.put('news_articles',{
        article_id:articleId,
        profile_id:settings.profileId||'local-default',
        created_at:now,
        local_date:localDate(),
        jlpt_level:$('#dailyNewsJlpt')?.value||'N5',
        band:$('#dailyNewsBand')?.value||'medio',
        topic:$('#dailyNewsTopic')?.value||'',
        status:'generated',
        search_query:data.search_query||'',
        response_id:data.response_id||'',
        usage_json:JSON.stringify(data.usage||{}),
        source_json:JSON.stringify(news.selected_source||{}),
        news_json:JSON.stringify(news),
        candidates_json:JSON.stringify(extractCandidatePhrases(news))
      });
    }catch(error){
      console.warn('No se pudo guardar la noticia como cantera editorial',error);
    }
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
      await saveAnswer(index,question,studentAnswer,data);
    }catch(error){
      feedback.innerHTML=`<p class="dictionary-ai-error">${esc(error.message||'No se pudo corregir la respuesta.')}</p>`;
    }finally{
      button.disabled=false;button.textContent='Corregir respuesta';
    }
  }
  async function saveAnswer(index,question,studentAnswer,data){
    const correction=data.correction||{},settings=(await JapoDB.get('settings','app'))?.value||{},profileId=settings.profileId||'local-default',now=new Date().toISOString(),answerId=crypto.randomUUID(),articleId=state.currentArticleId||crypto.randomUUID(),direction=correction.direction||'ja_es',level=correction.jlpt_level||$('#dailyNewsJlpt')?.value||'N5',difficulty=Math.max(0,Math.min(100,Math.round(Number(correction.difficulty)||35))),topicTags=(correction.topic_tags||[$('#dailyNewsTopic')?.value||'noticia']).filter(Boolean),grammarTags=(correction.grammar_tags||[]).filter(Boolean),vocabularyTags=(correction.vocabulary_tags||[]).filter(Boolean),score=Number(correction.score)||0;
    await JapoDB.batch(async()=>{
      await JapoDB.put('news_answers',{
        answer_id:answerId,
        article_id:articleId,
        question_index:index,
        profile_id:profileId,
        attempted_at:now,
        local_date:localDate(),
        direction,
        jlpt_level:level,
        difficulty,
        user_answer:studentAnswer,
        overall_score:score,
        is_acceptable:Boolean(correction.is_correct)||score>=70,
        question_json:JSON.stringify(question),
        correction_json:JSON.stringify(correction),
        topic_tags_json:JSON.stringify(topicTags),
        grammar_tags_json:JSON.stringify(grammarTags),
        vocabulary_tags_json:JSON.stringify(vocabularyTags),
        lexical_failures_json:JSON.stringify(correction.lexical_failures||[]),
        response_id:data.response_id||'',
        usage_json:JSON.stringify(data.usage||{})
      });
      await updateNewsTagProgress({profileId,direction,score,isAcceptable:Boolean(correction.is_correct)||score>=70,attemptedAt:now,topicTags,grammarTags,vocabularyTags});
      await saveLexicalFailures({profileId,answerId,articleId,attemptedAt:now,failures:correction.lexical_failures||[]});
    });
  }
  async function updateNewsTagProgress({profileId,direction,score,isAcceptable,attemptedAt,topicTags,grammarTags,vocabularyTags}){
    for(const [type,values] of [['topic',topicTags],['grammar',grammarTags],['vocabulary',vocabularyTags]])for(const value of values||[]){
      const id=`${profileId}::${direction}::${type}::${value}`,p=await JapoDB.get('tag_progress',id)||{tag_progress_id:id,profile_id:profileId,direction,tag_type:type,tag_value:value,attempts_count:0,correct_count:0,acceptable_count:0,average_objective_score:0,average_comprehensibility_score:0,average_naturalness_score:0,average_grammar_score:0,average_vocabulary_score:0};
      const n=p.attempts_count;p.attempts_count++;p.correct_count+=score>=80?1:0;p.acceptable_count+=isAcceptable?1:0;
      for(const key of ['objective','comprehensibility','naturalness','grammar','vocabulary'])p[`average_${key}_score`]=Math.round((p[`average_${key}_score`]*n+score)/(n+1));
      p.last_seen_at=attemptedAt;p.mastery_score=Math.round((p.average_objective_score+p.average_comprehensibility_score+p.average_naturalness_score)/3);p.priority_score=100-p.mastery_score;await JapoDB.put('tag_progress',p);
    }
  }
  async function saveLexicalFailures({profileId,answerId,articleId,attemptedAt,failures}){
    for(const item of failures.filter(item=>item?.term_ja||item?.prompt_es).slice(0,8)){
      const direction=item.direction==='es_ja'?'es_ja':'ja_es',term=stripInlineReadings(item.term_ja||item.prompt_es),cardId=`${profileId}::${direction}::${term}`;
      const card=await JapoDB.get('lexical_cards',cardId)||{card_id:cardId,profile_id:profileId,direction,term_ja:stripInlineReadings(item.term_ja||''),reading_hiragana:stripInlineReadings(item.reading_hiragana||''),prompt_es:item.prompt_es||'',created_at:attemptedAt,source_answer_ids_json:'[]',status:'active'};
      const sourceIds=new Set(JSON.parse(card.source_answer_ids_json||'[]'));sourceIds.add(answerId);
      await JapoDB.put('lexical_cards',{...card,term_ja:stripInlineReadings(item.term_ja||card.term_ja||''),reading_hiragana:stripInlineReadings(item.reading_hiragana||card.reading_hiragana||''),prompt_es:item.prompt_es||card.prompt_es||'',source_article_id:articleId,last_seen_at:attemptedAt,last_reason_es:item.reason_es||'',source_answer_ids_json:JSON.stringify([...sourceIds]),status:'active'});
      const progressId=`${profileId}::${cardId}`,progress=await JapoDB.get('lexical_progress',progressId)||{progress_id:progressId,card_id:cardId,profile_id:profileId,total_attempts:0,successful_attempts:0,average_score:0,mastered:false};
      progress.total_attempts++;progress.last_seen_at=attemptedAt;progress.last_score=0;progress.next_review_at=attemptedAt;await JapoDB.put('lexical_progress',progress);
    }
  }
  function render(data){
    const news=data.news||{},source=news.selected_source||{},target=$('#dailyNewsOutput'),readings=news.furigana_readings||[];
    state.news=news;state.questionLanguage='ja';
    saveArticle(news,data);
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
