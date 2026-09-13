(function(){
  const direct='https://japoteacher-ai.raul-nihongo.workers.dev';
  const relay='https://kvcptfbmhuagzauwoluh.supabase.co/functions/v1/ai-gateway';
  let preferred=relay;
  async function send(input,options){
    const url=new URL(input,location.href);
    if(url.origin!==direct)return fetch(input,options);
    const first=preferred,second=first===relay?direct:relay;
    const address=base=>base+url.pathname+url.search;
    try{return await fetch(address(first),options)}catch(error){
      // Do not retry timeouts/cancellation or HTTP errors: the operation may
      // already have run. Only a network failure tries the alternate route.
      if(!(error instanceof TypeError)||options?.signal?.aborted)throw error;
      const response=await fetch(address(second),options);
      preferred=second;
      return response;
    }
  }
  window.JapoAiTransport={fetch:send};
})();
