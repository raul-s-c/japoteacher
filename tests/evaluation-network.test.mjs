import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from 'node:vm';

const evaluator = fs.readFileSync(new URL("../src/evaluators/openai-evaluator.js", import.meta.url), "utf8");
const router = fs.readFileSync(new URL("../src/evaluators/evaluator-router.js", import.meta.url), "utf8");

test("mobile evaluation retries interrupted requests with backoff", () => {
  assert.match(evaluator, /retries=2/);
  assert.match(evaluator, /\[1200,3000\]/);
  assert.match(evaluator, /Reconectando/);
});

test("evaluation diagnoses worker reachability instead of exposing Failed to fetch", () => {
  assert.match(evaluator, /workerAvailable/);
  assert.match(evaluator, /tu respuesta sigue guardada/i);
  assert.match(evaluator, /failed to fetch\|networkerror\|load failed/i);
});

test("the evaluator honors the synchronized endpoint", () => {
  assert.match(router, /endpoint:settings\.aiEndpoint/);
});

function runtime(fetch,validEvaluation=()=>true){
  const context={window:{CloudSync:{getAccessToken:async()=> 'test-token',getDeviceId:()=> 'test-device'}},AiEvaluator:class{},document:{querySelector:()=>null},fetch,SchemaValidation:{validEvaluation},crypto:{randomUUID:()=> 'test-request'},performance:{now:()=>0},URL,TypeError,AbortController,setTimeout,clearTimeout};
  vm.createContext(context);vm.runInContext(evaluator,context);return new context.window.OpenAiEvaluator({endpoint:'https://custom.example/evaluate',retries:0});
}
test('POST and reachability diagnosis use the same configured service, with correlation ID',async()=>{
  const urls=[];const e=runtime(async(url,options)=>{urls.push(String(url));if(options.method==='POST')throw new TypeError('Failed to fetch');return {ok:true,json:async()=>({ok:true})}});
  await assert.rejects(e.evaluateAttempt({}),/El servicio responde.*Referencia: test-request/);
  assert.equal(urls[0],'https://custom.example/evaluate?request_id=test-request');assert.equal(urls[1],'https://custom.example/health');
});
test('unreachable endpoint does not diagnose loss of general mobile internet',async()=>{
  const e=runtime(async()=>{throw new TypeError('Failed to fetch')});await assert.rejects(e.evaluateAttempt({}),/Esto no demuestra que el móvil esté sin internet/);
});
test('schema TypeError is not misreported as a network failure',async()=>{
  let calls=0;const e=runtime(async()=>{calls++;return {ok:true,text:async()=>'{"evaluation":{}}'}},()=>{throw new TypeError('bad schema')});
  await assert.rejects(e.evaluateAttempt({}),/interpretar la evaluación/);assert.equal(calls,1);
});
test('settings connection test uses the saved endpoint rather than the default service',()=>{
  const source=fs.readFileSync(new URL('../src/ai-connection-test.js',import.meta.url),'utf8');assert.match(source,/endpoint:record\?\.value\?\.aiEndpoint/);
});
