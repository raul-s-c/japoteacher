const ORIGIN='https://raul-s-c.github.io';
const UPSTREAM='https://japoteacher-ai.raul-nihongo.workers.dev';
const PATHS=new Set(['/evaluate','/explain','/daily-lesson','/mnemonic','/question-help','/tutor','/lens','/daily-news','/daily-news-answer']);
export function createHandler({fetchImpl=fetch,authUrl,authKey}){
  return async request=>{
    const headers={'Access-Control-Allow-Origin':ORIGIN,'Access-Control-Allow-Headers':'Authorization, Content-Type, X-Device-ID','Access-Control-Allow-Methods':'GET, POST, OPTIONS','Cache-Control':'no-store','Vary':'Origin'};
    const reply=(value,status=200)=>Response.json(value,{status,headers});
    if(request.headers.get('Origin')&&request.headers.get('Origin')!==ORIGIN)return reply({error:'Origen no permitido.'},403);
    if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
    const url=new URL(request.url),path=url.pathname.replace(/^\/ai-gateway|^\/functions\/v1\/ai-gateway/,'');
    if(path==='/health'&&request.method==='GET')return reply({ok:true,route:'supabase-gateway'});
    if(!PATHS.has(path)||request.method!=='POST')return reply({error:'Ruta no permitida.'},404);
    const authorization=request.headers.get('Authorization')||'';
    if(!authorization.startsWith('Bearer '))return reply({error:'Inicia sesión para usar la IA.'},401);
    try{
      // Explicit user authentication; gateway JWT verification is disabled to
      // allow public health checks and this project's signing-key rotation.
      const auth=await fetchImpl(`${authUrl}/auth/v1/user`,{headers:{Authorization:authorization,apikey:authKey},signal:AbortSignal.timeout(10000)});
      if(!auth.ok)return reply({error:auth.status>=500?'No se pudo validar la sesión.':'Sesión no válida.'},auth.status>=500?503:401);
      const user=await auth.json();
      if(!user.id)return reply({error:'Sesión no válida.'},401);
      const body=await request.text();
      if(new TextEncoder().encode(body).length>8*1024*1024)return reply({error:'Petición demasiado grande.'},413);
      const target=new URL(path,UPSTREAM);
      const ref=url.searchParams.get('request_id');if(ref)target.searchParams.set('request_id',ref.slice(0,100));
      const response=await fetchImpl(target.href,{method:'POST',headers:{Origin:ORIGIN,Authorization:authorization,'Content-Type':'application/json','X-Device-ID':request.headers.get('X-Device-ID')||''},body,signal:AbortSignal.timeout(115000),redirect:'error'});
      // Preserve the original session/lease checks and the upstream status.
      return new Response(response.body,{status:response.status,headers:{...headers,'Content-Type':response.headers.get('Content-Type')||'application/json'}});
    }catch{return reply({error:'La ruta alternativa no ha podido completar la petición. Tu respuesta sigue guardada.'},502)}
  };
}
