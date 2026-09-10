// Transport only. The parent reserves the full possible token cost first.
let input='';process.stdin.setEncoding('utf8');process.stdin.on('data',s=>input+=s);
process.stdin.on('end',async()=>{
  try{
    const payload=JSON.parse(input);
    if(['generate','review','equivalence_check'].includes(payload.operation)){
      payload.editorial_quality_requirements='Cada frase debe ser una situación comprensible por sí sola, con lógica de sentido común y español natural de España. No fuerces vocabulario dentro de un tema incompatible. Evita preguntas o negaciones genéricas sin referente (por ejemplo Eso no es evolución o Hay responsabilidad). No aceptes comparaciones absurdas como tan ligero que incluso un gigante puede levantarlo: incluso debe implicar una dificultad real. Conserva causas, negaciones, condiciones, agente y matices en ambas direcciones. No uses japonés arcaico salvo que la frase dé un contexto explícito. No contrapongas categorías arbitrarias (entrevista frente a degustación, pena de muerte frente a suspensión). Da un referente concreto a palabras como compartido, concepto o sensación. Usa colocaciones japonesas habituales. Nunca uses una palabra objetivo como nombre propio inventado de tienda, persona o lugar: debe enseñar su significado léxico. Las causas deben explicar realmente la consecuencia: la lluvia no justifica aplazar software, ni el repaso ajeno elegir una biblioteca. 会いました no debe traducirse como conocí salvo que se indique primer encuentro; 貸してもらいました expresa préstamo recibido, no solo solicitado. Si revisas, rechaza o corrige también estos defectos aunque la gramática sea válida.';
      input=JSON.stringify(payload);
    }
    const response=await fetch('https://japoteacher-ai.raul-nihongo.workers.dev/editorial/generate',{method:'POST',headers:{'Content-Type':'application/json','X-Editorial-Key':(process.env.JAPOTEACHER_EDITORIAL_KEY||'').trim(),'User-Agent':'JapoTeacher-Editorial/1.0'},body:input,signal:AbortSignal.timeout(180000)});
    const data=await response.text();if(!response.ok)throw new Error(`Editorial HTTP ${response.status}: ${data.slice(0,300)}`);
    JSON.parse(data);process.stdout.write(data);
  }catch(e){process.stderr.write(e.message);process.exitCode=1}
});
