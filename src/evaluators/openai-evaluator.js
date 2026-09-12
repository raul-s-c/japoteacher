(function(){
  const DEFAULT_ENDPOINT='https://japoteacher-ai.raul-nihongo.workers.dev/evaluate';
  const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));

  class OpenAiEvaluator extends AiEvaluator{
    constructor({endpoint=DEFAULT_ENDPOINT,timeoutMs=60000,retries=2}={}){
      super();
      this.endpoint=String(endpoint||DEFAULT_ENDPOINT).trim().replace(/\/$/,'');
      this.timeoutMs=timeoutMs;
      this.retries=retries;
      this.lastRawResponse='';
      this.requestId='';
    }

    async workerAvailable(){
      const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),8000);
      try{
        const response=await fetch(this.endpoint.replace(/\/evaluate$/,'/health'),{
          cache:'no-store',
          signal:controller.signal,
        });
        if(!response.ok)return false;
        return (await response.json()).ok===true;
      }catch{
        return false;
      }finally{
        clearTimeout(timer);
      }
    }

    async evaluateAttempt(payload){
      const button=document.querySelector('#evaluateButton'),started=performance.now();
      if(button)button.textContent='Validando sesión…';
      let lastError;
      this.requestId=crypto.randomUUID();

      for(let attempt=0;attempt<=this.retries;attempt++){
        const accessToken=await window.CloudSync?.getAccessToken();
        if(!accessToken)throw new Error('Inicia sesión para usar la corrección con OpenAI.');
        const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),this.timeoutMs);
        try{
          if(button)button.textContent=attempt?`Reconectando (${attempt+1}/${this.retries+1})…`:'Analizando con IA…';
          const requestUrl=new URL(this.endpoint);
          requestUrl.searchParams.set('request_id',this.requestId);
          const response=await fetch(requestUrl.href,{
            method:'POST',
            headers:{
              'Content-Type':'application/json',
              'Authorization':`Bearer ${accessToken}`,
              'X-Device-ID':window.CloudSync.getDeviceId(),
            },
            body:JSON.stringify(payload),
            cache:'no-store',
            signal:controller.signal,
          });
          const text=await response.text();
          this.lastRawResponse=text;
          let data;
          try{data=JSON.parse(text)}catch{throw Object.assign(new Error(`El Worker devolvió una respuesta no JSON (${response.status}).`),{retryable:response.status>=500})}
          if(!response.ok){
            const error=new Error(data.error?.message||data.error||`Error HTTP ${response.status}`);
            error.retryable=response.status===408||response.status===425||response.status===429||response.status>=500;
            throw error;
          }
          const evaluation=data.evaluation||data;
          let schemaValid=false;
          try{schemaValid=SchemaValidation.validEvaluation(evaluation)}catch{throw Object.assign(new Error('La app no pudo interpretar la evaluación recibida.'),{retryable:false})}
          if(!schemaValid)throw Object.assign(new Error('OpenAI devolvió una evaluación que no cumple el esquema.'),{retryable:true});
          if(button)button.textContent='Guardando progreso…';
          return {...evaluation,correction_provider:'openai',correction_model:'gpt-5.4-mini',evaluation_latency_ms:Math.round(performance.now()-started),raw_ai_response_json:this.lastRawResponse};
        }catch(error){
          lastError=error.name==='AbortError'
            ?Object.assign(new Error('La evaluación agotó el tiempo de espera.'),{retryable:true})
            :error;
          if(lastError.retryable===undefined)lastError.retryable=error instanceof TypeError;
          if(!lastError.retryable||attempt>=this.retries)break;
          await wait([1200,3000][attempt]||3000);
        }finally{
          clearTimeout(timer);
        }
      }

      if(lastError instanceof TypeError||/failed to fetch|networkerror|load failed/i.test(lastError?.message||'')){
        const available=await this.workerAvailable();
        let host='dirección configurada';try{host=new URL(this.endpoint).hostname}catch{}
        throw new Error((available
          ?'El servicio responde, pero la petición de corrección se interrumpió o fue bloqueada.'
          :`La app no ha podido obtener respuesta de ${host}. Esto no demuestra que el móvil esté sin internet.`)+` Tu respuesta sigue guardada. Referencia: ${this.requestId}.`);
      }
      throw lastError;
    }
  }
  window.OpenAiEvaluator=OpenAiEvaluator;
})();
