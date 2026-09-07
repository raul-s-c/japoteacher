// Transport only. The parent reserves the full possible token cost first.
let input='';process.stdin.setEncoding('utf8');process.stdin.on('data',s=>input+=s);
process.stdin.on('end',async()=>{
  try{
    const response=await fetch('https://japoteacher-ai.raul-nihongo.workers.dev/editorial/generate',{method:'POST',headers:{'Content-Type':'application/json','X-Editorial-Key':(process.env.JAPOTEACHER_EDITORIAL_KEY||'').trim(),'User-Agent':'JapoTeacher-Editorial/1.0'},body:input,signal:AbortSignal.timeout(180000)});
    const data=await response.text();if(!response.ok)throw new Error(`Editorial HTTP ${response.status}: ${data.slice(0,300)}`);
    JSON.parse(data);process.stdout.write(data);
  }catch(e){process.stderr.write(e.message);process.exitCode=1}
});
