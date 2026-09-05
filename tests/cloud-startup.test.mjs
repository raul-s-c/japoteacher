import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

function fixture({saved,known=true,rev=7,remote,failClaim=false,slowCommit=false}={}){
  const events={},nodes=new Map(),storage=new Map(),calls=[],timers=[];
  if(known)storage.set('japoteacher_last_account_id','user');
  if(saved)storage.set('japoteacher_sync_v1:user',JSON.stringify(saved));
  let options,resolveCommit;
  const stores={settings:[{key:'app',value:{profileName:'Alumno'}}],attempts:[],daily_sessions:[]};
  const client={auth:{getSession:async()=>({data:{session:{user:{id:'user'},access_token:'test'}}}),onAuthStateChange(){}},rpc:async(name)=>{
    calls.push(name);
    if(name==='claim_user_session')return failClaim?{error:new Error('network timeout')}:{data:[{claimed:true,out_revision:rev}]};
    if(name==='commit_user_state'&&slowCommit)await new Promise(r=>resolveCommit=r);
    return {data:[{committed:true,lease_granted:true,out_revision:rev+1}]};
  },from(){calls.push('remote');return {select(){return this},eq(){return this},maybeSingle:async()=>({data:{revision:rev,payload:remote||{stores}}})}}};
  const context={console:{warn(){}},Date,AbortController,Response,fetch,crypto:{randomUUID:()=> 'device'},navigator:{platform:'test',userAgent:'test'},localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},setTimeout:(fn,ms)=>{timers.push({fn,ms});return timers.length},clearTimeout(){},setInterval(){},document:{addEventListener:(n,f)=>events[n]=f,querySelector:s=>{if(!nodes.has(s))nodes.set(s,{hidden:false,dataset:{},addEventListener(){}});return nodes.get(s)}},location:{reload(){calls.push('reload')}},JapoDB:{syncStores:Object.keys(stores),get:async()=>stores.settings[0],syncBackup:async()=>{calls.push('backup');return {stores:structuredClone(stores)}},restoreSync:async data=>{calls.push('restore');Object.assign(stores,structuredClone(data.stores))},clearUserData:async()=>{calls.push('clear')}}};
  context.window={JAPOTEACHER_SUPABASE:{},supabase:{createClient(_u,_k,o){options=o;return client}},addEventListener(){}};
  vm.runInNewContext(fs.readFileSync(new URL('../src/cloud-sync.js',import.meta.url),'utf8'),context);
  const cloud=context.window.CloudSync;
  return {cloud,calls,storage,timers,options,context,begin:()=>events.DOMContentLoaded(),start:async()=>{events.DOMContentLoaded();await cloud.initialSync},finishCommit:()=>resolveCommit?.()};
}
test('unchanged remote revision opens without downloading, merging or rewriting history',async()=>{
  const f=fixture({saved:{revision:7,dirty:false}});await f.start();assert.deepEqual(f.calls,['claim_user_session']);
});
test('pending local changes survive reload and upload without redownloading the same revision',async()=>{
  const f=fixture({saved:{revision:7,dirty:true}});await f.start();assert(!f.calls.includes('remote'));await f.cloud.flush();assert(f.calls.includes('commit_user_state'));assert.equal(JSON.parse(f.storage.get('japoteacher_sync_v1:user')).dirty,false);
});
test('new remote revision still restores progress before releasing startup',async()=>{
  const f=fixture({saved:{revision:6,dirty:false}});await f.start();assert(f.calls.includes('remote'));assert(f.calls.includes('restore'));
});
test('first restore does not wait for uploading the merged history',async()=>{
  const f=fixture({slowCommit:true,remote:{stores:{settings:[],attempts:[],daily_sessions:[]}}});await f.start();assert(f.calls.includes('restore'));assert(!f.calls.includes('commit_user_state'));
  const flushing=f.cloud.flush();await new Promise(r=>setImmediate(r));assert(f.calls.includes('commit_user_state'));f.finishCommit();await flushing;
});
test('failed session claim does not hang startup or mark local changes synchronized',async()=>{
  const f=fixture({failClaim:true,saved:{revision:7,dirty:false}});await f.start();await f.cloud.commit();assert.equal(JSON.parse(f.storage.get('japoteacher_sync_v1:user')).dirty,true);assert(!f.calls.includes('commit_user_state'));
});
test('a different account cannot take the revision shortcut',async()=>{
  const f=fixture({known:false,saved:{revision:7,dirty:false}});await f.start();assert(f.calls.includes('remote'));
});
test('network timeout also aborts a stalled response body within the startup budget',async()=>{
  const f=fixture({saved:{revision:7,dirty:false}});
  f.context.fetch=async(_url,{signal})=>({arrayBuffer:()=>new Promise((_resolve,reject)=>signal.addEventListener('abort',()=>reject(new Error('aborted')))),status:200});
  f.begin();const downloading=f.options.global.fetch('https://example.test');
  await new Promise(r=>setImmediate(r));
  const timer=f.timers.find(t=>t.ms>1000);assert(timer.ms<=12000);
  timer.fn();await assert.rejects(downloading,/aborted/);
});
test('changes made during an upload remain dirty for the next upload or reload',async()=>{
  const f=fixture({saved:{revision:7,dirty:true},slowCommit:true});await f.start();
  const flushing=f.cloud.flush();await new Promise(r=>setImmediate(r));await f.cloud.commit();f.finishCommit();await flushing;
  assert.equal(JSON.parse(f.storage.get('japoteacher_sync_v1:user')).dirty,true);
});
