(function(){
  const LocalMockEvaluator=window.MockEvaluator;
  class EvaluatorRouter extends AiEvaluator{
    async evaluateAttempt(payload){
      const record=await JapoDB.get('settings','app'),settings=record?.value||{};
      if(settings.aiProvider==='openai'){
        const evaluator=new OpenAiEvaluator();
        return evaluator.evaluateAttempt(payload);
      }
      const result=await new LocalMockEvaluator().evaluateAttempt(payload);
      return {...result,correction_provider:'mock',correction_model:'mock-v1'};
    }
  }
  window.MockEvaluator=EvaluatorRouter;
})();
