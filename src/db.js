(function(){
  const DB_NAME='japoteacher'; const VERSION=1;
  const stores={exercises:'exercise_id',attempts:'attempt_id',exercise_progress:'progress_id',tag_progress:'tag_progress_id',daily_sessions:'session_id',settings:'key',import_history:'import_id'};
  let dbPromise;
  function open(){if(dbPromise)return dbPromise;dbPromise=new Promise((resolve,reject)=>{const req=indexedDB.open(DB_NAME,VERSION);req.onupgradeneeded=()=>{const db=req.result;Object.entries(stores).forEach(([name,keyPath])=>{if(!db.objectStoreNames.contains(name))db.createObjectStore(name,{keyPath});});};req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});return dbPromise;}
  async function tx(store,mode,action){const db=await open();return new Promise((resolve,reject)=>{const t=db.transaction(store,mode);const os=t.objectStore(store);let result;try{result=action(os);}catch(e){reject(e);return}t.oncomplete=()=>resolve(typeof IDBRequest!=='undefined'&&result instanceof IDBRequest?result.result:result);t.onerror=()=>reject(t.error);t.onabort=()=>reject(t.error);});}
  const changed=()=>window.CloudSync?.schedule();
  const write=async(store,action)=>{const result=await tx(store,'readwrite',action);changed();return result};
  const api={open,get:(s,k)=>tx(s,'readonly',o=>o.get(k)),all:s=>tx(s,'readonly',o=>o.getAll()),put:(s,v)=>write(s,o=>o.put(v)),bulkPut:(s,vs)=>write(s,o=>{vs.forEach(v=>o.put(v));return vs.length}),delete:(s,k)=>write(s,o=>o.delete(k)),clear:s=>write(s,o=>o.clear()),stores:Object.keys(stores),async clearProfileData(){for(const s of ['attempts','exercise_progress','tag_progress','daily_sessions'])await api.clear(s);},async backup(){const out={schema_version:1,exported_at:new Date().toISOString(),stores:{}};for(const s of api.stores){const rows=await api.all(s);out.stores[s]=s==='settings'?rows.map(row=>{const value={...(row.value||{})};delete value.apiKey;delete value.proxyToken;return {...row,value}}):rows}return out;},async restore(data){if(!data?.stores)throw new Error('Copia remota no válida');for(const store of api.stores){await tx(store,'readwrite',o=>{o.clear();for(const row of data.stores[store]||[])o.put(row)})}}};
  window.JapoDB=api;
})();
