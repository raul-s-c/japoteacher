(function(){
  const $=selector=>document.querySelector(selector),esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  let lastExerciseId='';
  let activeUtterance=null;
  function japaneseFor(exercise){return exercise?.source_language==='ja'?exercise.source_text:exercise?.reference_translation||''}
  function spanishFor(exercise){return exercise?.source_language==='es'?exercise.source_text:exercise?.reference_translation||''}
  function resetPanel(){const panel=$('#questionHelpPanel'),input=$('#questionHelpInput'),response=$('#questionHelpResponse'),toggle=$('#questionHelpToggle');if(panel)panel.hidden=true;if(input)input.value='';if(response){response.hidden=true;response.innerHTML=''}if(toggle)toggle.setAttribute('aria-expanded','false')}
  async function currentExercise(options={}){const source=$('#sourceText'),exerciseId=source?.dataset.exerciseId;if(!exerciseId)return null;if(exerciseId!==lastExerciseId){lastExerciseId=exerciseId;if(!options.keepPanel)resetPanel()}return JapoDB.get('exercises',exerciseId)}
  function nativeSpeak(text){
    try{
      const bridge=window.JapoNativeAndroid;
      if(!bridge?.speakJapanese)return false;
      return bridge.speakJapanese(text)!==false;
    }catch(_error){return false}
  }
  function waitForVoices(){
    const voices=speechSynthesis.getVoices?.()||[];
    if(voices.length)return Promise.resolve(voices);
    return new Promise(resolve=>{
      let settled=false;
      const finish=()=>{if(settled)return;settled=true;speechSynthesis.removeEventListener?.('voiceschanged',finish);resolve(speechSynthesis.getVoices?.()||[])};
      speechSynthesis.addEventListener?.('voiceschanged',finish,{once:true});
      setTimeout(finish,900);
    });
  }
  async function webSpeak(text){
    if(!('speechSynthesis'in window)||!window.SpeechSynthesisUtterance)throw new Error('Este dispositivo no permite reproducir voz.');
    speechSynthesis.cancel();
    const voices=await waitForVoices(),utterance=new SpeechSynthesisUtterance(text),voice=voices.find(item=>/^ja(?:[-_]|$)/i.test(item.lang));
    utterance.lang='ja-JP';utterance.rate=.86;utterance.pitch=1;if(voice)utterance.voice=voice;activeUtterance=utterance;
    await new Promise((resolve,reject)=>{
      let settled=false;
      const finish=callback=>event=>{if(settled)return;settled=true;clearTimeout(timer);callback(event)};
      utterance.onstart=finish(resolve);
      utterance.onerror=finish(event=>reject(new Error(event?.error==='not-allowed'?'Android ha bloqueado la reproducción de voz.':'No se pudo iniciar la voz japonesa.')));
      const timer=setTimeout(finish(()=>reject(new Error('La voz japonesa no respondió. Prueba a instalarla en los ajustes de texto a voz de Android.'))),3500);
      speechSynthesis.speak(utterance);
    });
  }
  async function speak(){
    const button=$('#speakSourceButton');
    try{
      const exercise=await currentExercise({keepPanel:true}),text=japaneseFor(exercise);
      if(!text)throw new Error('No hay frase japonesa disponible para reproducir.');
      button?.setAttribute('aria-busy','true');
      if(!nativeSpeak(text))await webSpeak(text);
    }catch(error){const message=error.message||'No se pudo reproducir la frase.';window.UI?.toast?window.UI.toast(message):alert(message)}finally{button?.removeAttribute('aria-busy')}
  }
  function toggleHelp(){const panel=$('#questionHelpPanel'),toggle=$('#questionHelpToggle'),input=$('#questionHelpInput');if(!panel)return;panel.hidden=!panel.hidden;toggle?.setAttribute('aria-expanded',String(!panel.hidden));if(!panel.hidden)input?.focus()}
  async function ask(){const button=$('#questionHelpSubmit'),input=$('#questionHelpInput'),target=$('#questionHelpResponse'),question=input?.value.trim();if(!button||!target||!question)return;button.disabled=true;button.textContent='Pensando...';target.hidden=false;target.innerHTML='<span class="dictionary-ai-loading">Consultando al profesor IA...</span>';try{const [settings,exercise,token]=await Promise.all([JapoDB.get('settings','app'),currentExercise({keepPanel:true}),window.CloudSync?.getAccessToken()]);if(!token)throw new Error('Inicia sesión para preguntar con IA.');if(!exercise)throw new Error('No se encontró la frase actual.');const endpoint=(settings?.value?.aiEndpoint||'https://japoteacher-ai.raul-nihongo.workers.dev/evaluate').replace(/\/evaluate$/,'/question-help'),response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`,'X-Device-ID':window.CloudSync?.getDeviceId?.()||''},body:JSON.stringify({question,user_answer:$('#answerInput')?.value||'',exercise:{exercise_id:exercise.exercise_id,direction:exercise.direction,jlpt_level:exercise.jlpt_level,difficulty:exercise.difficulty,source_text:exercise.source_text,reference_translation:exercise.reference_translation,japanese_sentence:japaneseFor(exercise),spanish_sentence:spanishFor(exercise),topic_tags:exercise.topic_tags||[],grammar_tags:exercise.grammar_tags||[],vocabulary_tags:exercise.vocabulary_tags||[]}})}),data=await response.json();if(!response.ok)throw new Error(data.error||`Error HTTP ${response.status}`);const help=data.help||{};target.hidden=false;target.innerHTML=`<strong>${esc(help.answer_es||'No se pudo preparar una respuesta.')}</strong>${help.example_ja&&help.example_ja!=='—'?`<p><b>Ejemplo:</b> ${esc(help.example_ja)}</p>`:''}${help.example_es&&help.example_es!=='—'?`<p>${esc(help.example_es)}</p>`:''}${help.caution_es?`<small>${esc(help.caution_es)}</small>`:''}`;}catch(error){target.hidden=false;target.innerHTML=`<p class="dictionary-ai-error">${esc(error.message||'No se pudo responder la pregunta.')}</p>`}finally{button.disabled=false;button.textContent='Preguntar'}}
  document.addEventListener('DOMContentLoaded',()=>{const source=$('#sourceText');$('#speakSourceButton')?.addEventListener('click',speak);$('#questionHelpToggle')?.addEventListener('click',toggleHelp);$('#questionHelpSubmit')?.addEventListener('click',ask);$('#questionHelpInput')?.addEventListener('keydown',event=>{if(event.key==='Enter'&&(event.ctrlKey||event.metaKey))ask()});if(source)new MutationObserver(()=>currentExercise()).observe(source,{childList:true,characterData:true,subtree:true,attributes:true,attributeFilter:['data-exercise-id']})});
})();
