import test from 'node:test';
import assert from 'node:assert/strict';
import {createHandler} from '../supabase/functions/ai-gateway/handler.mjs';
import fs from 'node:fs';
import vm from 'node:vm';
const root='https://example.supabase.co/functions/v1/ai-gateway';
test('gateway authenticates users and forwards only fixed routes, preserving lease errors',async()=>{
 const calls=[];
 const handler=createHandler({authUrl:'https://auth.example',authKey:'public',fetchImpl:async(url,options)=>{calls.push({url,options});return calls.length===1?Response.json({id:'user'}):Response.json({error:'lease'}, {status:409})}});
 const response=await handler(new Request(root+'/evaluate?request_id=ref',{method:'POST',headers:{Authorization:'Bearer token','X-Device-ID':'device'},body:'{}'}));
 assert.equal(response.status,409);assert.equal(calls.length,2);
 assert.equal(calls[1].url,'https://japoteacher-ai.raul-nihongo.workers.dev/evaluate?request_id=ref');assert.equal(calls[1].options.headers['X-Device-ID'],'device');
});
test('gateway denies unauthorized requests, foreign origins and editorial routes without upstream work',async()=>{
 let calls=0;const handler=createHandler({fetchImpl:async()=>{calls++;return Response.json({})}});
 for(const [path,headers,status] of [['/evaluate',{},401],['/editorial/generate',{},404],['/evaluate',{Origin:'https://evil.example'},403]])assert.equal((await handler(new Request(root+path,{method:'POST',headers}))).status,status);
 assert.equal(calls,0);assert.equal((await handler(new Request(root+'/health'))).status,200);
});
test('gateway rejects invalid tokens before forwarding',async()=>{
 let calls=0;const handler=createHandler({authUrl:'https://auth.example',authKey:'public',fetchImpl:async()=>{calls++;return Response.json({}, {status:401})}});
 assert.equal((await handler(new Request(root+'/evaluate',{method:'POST',headers:{Authorization:'Bearer bad'}}))).status,401);assert.equal(calls,1);
});
function transport(fetch){const context={window:{},location:{href:'https://raul-s-c.github.io/japoteacher/'},URL,TypeError,fetch};vm.runInNewContext(fs.readFileSync('src/ai-transport.js','utf8'),context);return context.window.JapoAiTransport.fetch}
test('AI transport uses relay first and preserves body and authentication',async()=>{
 let seen;const send=transport(async(...args)=>{seen=args;return new Response('{}')});const options={method:'POST',body:'answer',headers:{Authorization:'Bearer user'}};
 await send('https://japoteacher-ai.raul-nihongo.workers.dev/evaluate?request_id=id',options);
 assert.match(seen[0],/supabase.co\/functions\/v1\/ai-gateway\/evaluate\?request_id=id$/);assert.equal(seen[1],options);
});
test('AI transport changes route on network failure but not HTTP rejection or cancellation',async()=>{
 const urls=[];const send=transport(async url=>{urls.push(url);if(url.includes('supabase.co'))throw new TypeError('network');return new Response('{}',{status:409})});
 assert.equal((await send('https://japoteacher-ai.raul-nihongo.workers.dev/evaluate')).status,409);assert.equal(urls.length,2);
 await send('https://japoteacher-ai.raul-nihongo.workers.dev/health');assert.equal(urls.length,3);assert.match(urls[2],/workers.dev/);
 let calls=0;const cancel=transport(async()=>{calls++;throw new TypeError('cancelled')});await assert.rejects(()=>cancel('https://japoteacher-ai.raul-nihongo.workers.dev/evaluate',{signal:{aborted:true}}));assert.equal(calls,1);
});
test('AI transport never redirects a custom endpoint',async()=>{let url;await transport(async value=>{url=value;return new Response('{}')})('https://custom.example/evaluate');assert.equal(url,'https://custom.example/evaluate')});
