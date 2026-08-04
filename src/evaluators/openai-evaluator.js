(function(){
  class OpenAiEvaluator extends AiEvaluator{
    constructor({endpoint,proxyToken,timeoutMs=45000,retries=1}={}){super();this.endpoint=(endpoint||'').replace(/\/$/,'');this.proxyToken=proxyToken||'';this.timeoutMs=timeoutMs;this.retries=retries;this.lastRawResponse='';}
    async evaluateAttempt(payload){
      if(!this.endpoint)throw new Error('Configura la URL del Worker en Ajustes.');
      if(!this.proxyToken)throw new Error('Configura el token privado del proxy en Ajustes.');
      let lastError;
      for(let attempt=0;attempt<=this.retries;attempt++){
        const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),this.timeoutMs);
        try{
          const response=await fetch(this.endpoint,{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${this.proxyToken}`},body:JSON.stringify(payload),signal:controller.signal});
          const text=await response.text();this.lastRawResponse=text;
          let data;try{data=JSON.parse(text)}catch{throw new Error(`El Worker devolvió una respuesta no JSON (${response.status}).`)}
          if(!response.ok)throw new Error(data.error?.message||data.error||`Error HTTP ${response.status}`);
          const evaluation=data.evaluation||data;
          if(!SchemaValidation.validEvaluation(evaluation))throw new Error('OpenAI devolvió una evaluación que no cumple el esquema.');
          return {...evaluation,correction_provider:'openai',correction_model:'gpt-5.4-mini',raw_ai_response_json:this.lastRawResponse};
        }catch(error){lastError=error.name==='AbortError'?new Error('La evaluación agotó el tiempo de espera.'):error;if(attempt<this.retries)await new Promise(resolve=>setTimeout(resolve,500*(attempt+1)));}
        finally{clearTimeout(timer)}
      }
      throw lastError;
    }
  }
  window.OpenAiEvaluator=OpenAiEvaluator;
})();
