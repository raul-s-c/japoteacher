import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

test('an installed app opens immediately without waiting for a stalled network',async()=>{
  const listeners={},shell={body:'installed release'},context={URL,self:{location:{origin:'https://example.test'},registration:{scope:'https://example.test/app/'},addEventListener:(name,handler)=>listeners[name]=handler},caches:{open:async()=>({match:async()=>shell})},fetch:()=>{throw Error('Navigation must use the installed shell')}};
  vm.runInNewContext(fs.readFileSync(new URL('../service-worker.js',import.meta.url),'utf8'),context);
  let result;listeners.fetch({request:{method:'GET',url:'https://example.test/app/',mode:'navigate'},respondWith:p=>result=p});
  assert.equal(await result,shell);
});

test('versioned local assets reuse the installed release cache, never an unrelated URL',async()=>{
  let options;const listeners={},context={URL,self:{location:{origin:'https://example.test'},registration:{scope:'https://example.test/app/'},addEventListener:(name,handler)=>listeners[name]=handler},caches:{open:async()=>({match:async(_request,o)=>{options=o;return 'cached'}})}};
  vm.runInNewContext(fs.readFileSync(new URL('../service-worker.js',import.meta.url),'utf8'),context);
  let result;listeners.fetch({request:{method:'GET',url:'https://example.test/app/src/daily-lesson.js?v=1'},respondWith:p=>result=p});await result;assert.equal(options.ignoreSearch,true);
  listeners.fetch({request:{method:'GET',url:'https://external.test/private?token=x'},respondWith:p=>result=p});await result;assert.equal(options.ignoreSearch,false);
});
