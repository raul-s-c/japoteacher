(function(){
  const $=selector=>document.querySelector(selector);
  function status(message,state=''){
    const el=$('#providerStatus');if(!el)return;el.textContent=message;el.className=`provider-status ${state}`.trim();
  }
  function refresh(){
    const form=$('#settingsForm');if(!form)return;
    if(form.aiProvider.value==='mock')status('Modo simulado activo: las correcciones no usan OpenAI.');
    else if(!form.aiEndpoint.value.trim()||!form.proxyToken.value)status('OpenAI seleccionado, pero faltan la URL o el token del proxy.');
    else status('OpenAI configurado. Usa “Probar conexión” para verificarlo.','ready');
  }
  async function testConnection(){
    const form=$('#settingsForm'),button=$('#testAiButton');
    if(form.aiProvider.value!=='openai'){status('Selecciona OpenAI antes de probar la conexión.');return}
    const endpoint=form.aiEndpoint.value.trim(),proxyToken=form.proxyToken.value;
    if(!endpoint||!proxyToken){status('Introduce la URL completa del Worker y el token privado.');return}
    form.aiProvider.dispatchEvent(new Event('change',{bubbles:true}));
    button.disabled=true;button.textContent='Probando…';status('Contactando con el Worker y OpenAI…','testing');
    const payload={schema_version:'1.0',prompt_version:'1.0',exercise:{exercise_id:'CONNECTION-TEST',direction:'ja_es',source_text:'これは本です。',reference_translation:'Esto es un libro.',accepted_alternatives:[],jlpt_level:'N5',grammar_tags:['copula_desu'],vocabulary_tags:['本'],register:'cortés'},attempt:{user_answer:'Esto es un libro.'},student_context:{target_level:'N5',explanation_language:'es'}};
    try{const result=await new OpenAiEvaluator({endpoint,proxyToken,timeoutMs:45000,retries:0}).evaluateAttempt(payload);status(`Conexión correcta: OpenAI respondió con ${result.overall_score}/100.`,'ready');}
    catch(error){status(`No se pudo conectar: ${error.message}`);}
    finally{button.disabled=false;button.textContent='Probar conexión con OpenAI'}
  }
  document.addEventListener('DOMContentLoaded',()=>{const form=$('#settingsForm');form.addEventListener('change',refresh);form.addEventListener('input',refresh);$('#testAiButton').addEventListener('click',testConnection);setTimeout(refresh,0)});
  window.AiConnectionTest={refresh};
})();
