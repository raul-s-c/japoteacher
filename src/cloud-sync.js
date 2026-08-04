(function(){
  const config=window.JAPOTEACHER_SUPABASE;
  const client=window.supabase.createClient(config.url,config.publishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
  let user=null,timer=null,syncing=false,ready=false;
  const $=s=>document.querySelector(s);
  const keyFor={exercises:'exercise_id',attempts:'attempt_id',exercise_progress:'progress_id',tag_progress:'tag_progress_id',daily_sessions:'session_id',settings:'key',import_history:'import_id'};
  function status(message,tone=''){const el=$('#cloudStatus');if(el){el.textContent=message;el.dataset.tone=tone}}
  function render(){const signed=Boolean(user);$('#authSignedOut').hidden=signed;$('#authSignedIn').hidden=!signed;if(signed)$('#authUserEmail').textContent=user.email||'Usuario';status(signed?'Sincronización activa':'Inicia sesión para sincronizar')}
  function newer(a,b,field){if(!a)return b;if(!b)return a;return String(a[field]||'')>=String(b[field]||'')?a:b}
  function unionRows(local=[],remote=[],key,chooser){const rows=new Map(remote.map(row=>[row[key],row]));for(const row of local){const previous=rows.get(row[key]);rows.set(row[key],previous?(chooser?chooser(row,previous):row):row)}return [...rows.values()]}
  function mergeSession(local,remote){
    const completed=[...new Set([...JSON.parse(remote.completed_exercise_ids_json||'[]'),...JSON.parse(local.completed_exercise_ids_json||'[]')])];
    const drafts={...JSON.parse(remote.drafts_json||'{}'),...JSON.parse(local.drafts_json||'{}')};
    const total=Math.max((local.planned_ja_es||0)+(local.planned_es_ja||0),(remote.planned_ja_es||0)+(remote.planned_es_ja||0));
    return {...remote,...local,created_at:[local.created_at,remote.created_at].filter(Boolean).sort()[0],started_at:[local.started_at,remote.started_at].filter(Boolean).sort()[0]||null,completed_at:completed.length>=total?(local.completed_at||remote.completed_at||new Date().toISOString()):null,status:completed.length>=total?'completed':completed.length?'in_progress':'planned',completed_exercise_ids_json:JSON.stringify(completed),drafts_json:JSON.stringify(drafts)};
  }
  function merge(local,remote){
    const out={schema_version:1,exported_at:new Date().toISOString(),stores:{}};
    for(const store of JapoDB.stores){const l=local.stores[store]||[],r=remote.stores[store]||[],key=keyFor[store];
      if(store==='attempts'||store==='exercises'||store==='import_history')out.stores[store]=unionRows(l,r,key);
      else if(store==='daily_sessions')out.stores[store]=unionRows(l,r,key,mergeSession);
      else if(store==='exercise_progress')out.stores[store]=unionRows(l,r,key,(a,b)=>newer(a,b,'last_seen_at'));
      else if(store==='tag_progress')out.stores[store]=unionRows(l,r,key,(a,b)=>(a.attempts_count||0)>=(b.attempts_count||0)?a:b);
      else if(store==='settings')out.stores[store]=unionRows(l,r,key,(a,b)=>newer(a,b,'updated_at'));
    }return out;
  }
  async function upload(payload){const {error}=await client.from('user_state').upsert({user_id:user.id,payload},{onConflict:'user_id'});if(error)throw error}
  async function push(){if(!user||syncing||!ready)return;syncing=true;status('Sincronizando…');try{await upload(await JapoDB.backup());status(`Sincronizado a las ${new Date().toLocaleTimeString('es-ES',{hour:'2-digit',minute:'2-digit'})}`,'ok')}catch(error){status(error.message||'No se pudo sincronizar','error')}finally{syncing=false}}
  function schedule(){if(!user||syncing||!ready)return;clearTimeout(timer);timer=setTimeout(push,900)}
  async function synchronize({reload=false}={}){if(!user||syncing)return;syncing=true;status('Combinando progreso…');try{const local=await JapoDB.backup();const {data,error}=await client.from('user_state').select('payload').eq('user_id',user.id).maybeSingle();if(error)throw error;if(!data?.payload){await upload(local);ready=true;status('Progreso inicial sincronizado','ok');return}const combined=merge(local,data.payload),changed=JSON.stringify(local.stores)!==JSON.stringify(combined.stores);await JapoDB.restore(combined);await upload(combined);ready=true;status('Progreso combinado y sincronizado','ok');if(reload&&changed){sessionStorage.setItem('japoteacher_skip_sync_once',user.id);setTimeout(()=>location.reload(),350)}}catch(error){ready=true;status(error.message||'No se pudo sincronizar','error')}finally{syncing=false}}
  async function signUp(){const email=$('#authEmail').value.trim(),password=$('#authPassword').value;if(!email||password.length<8){status('Introduce un email y una contraseña de al menos 8 caracteres','error');return}status('Creando cuenta…');const {data,error}=await client.auth.signUp({email,password});if(error){status(error.message,'error');return}if(!data.session)status('Revisa tu email para confirmar la cuenta','ok')}
  async function signIn(){const email=$('#authEmail').value.trim(),password=$('#authPassword').value;status('Iniciando sesión…');const {error}=await client.auth.signInWithPassword({email,password});if(error)status(error.message,'error')}
  async function signOut(){ready=false;sessionStorage.removeItem('japoteacher_skip_sync_once');await client.auth.signOut()}
  async function getAccessToken(){const {data}=await client.auth.getSession();return data.session?.access_token||''}
  async function beginSync(){if(sessionStorage.getItem('japoteacher_skip_sync_once')===user?.id){sessionStorage.removeItem('japoteacher_skip_sync_once');ready=true;status('Sincronización activa','ok');return}await synchronize({reload:true})}
  async function init(){const {data}=await client.auth.getSession();user=data.session?.user||null;render();$('#signUpButton').addEventListener('click',signUp);$('#signInButton').addEventListener('click',signIn);$('#signOutButton').addEventListener('click',signOut);$('#syncNowButton').addEventListener('click',()=>synchronize({reload:true}));client.auth.onAuthStateChange((event,session)=>{const previous=user?.id;user=session?.user||null;render();if(user&&user.id!==previous)setTimeout(()=>beginSync(),0)});document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&user&&ready)synchronize({reload:true})});if(user)await beginSync()}
  window.CloudSync={schedule,push,getAccessToken,synchronize};document.addEventListener('DOMContentLoaded',()=>init().catch(e=>status(e.message,'error')));
})();
