(function(){
  const catalog=[{id:'sakamoto',name:'Sakamoto',version:'20260907-1',url:'data/collections/sakamoto.json',available:true}];
  const normalized=text=>String(text||'').normalize('NFKC').replace(/[\s。、！？!?.,「」『』]/g,'');
  async function load(){
    for(const entry of catalog){
      if(!entry.available)continue;
      const key=`japoteacher_collection_${entry.id}`;
      const existing=await JapoDB.all('exercises');
      if(localStorage.getItem(key)===entry.version&&existing.some(e=>e.source_collection===entry.id))continue;
      const response=await fetch(`${entry.url}?v=${entry.version}`,{signal:AbortSignal.timeout(12000)});
      if(!response.ok)throw new Error(`No se pudo cargar el bloque ${entry.name}.`);
      const data=await response.json();
      if(data.collection_id!==entry.id||!Array.isArray(data.exercises)||!data.exercises.length)throw new Error('Bloque de estudio vacío o inválido.');
      const signatures=new Set(existing.filter(e=>e.source_collection!==entry.id).map(e=>normalized(e.direction==='ja_es'?e.source_text:e.reference_translation)));
      const rows=[];
      const pairs=new Map(),ids=new Set();
      for(const exercise of data.exercises){
        const errors=SchemaValidation.validateExercise(exercise);
        if(errors.length||exercise.review_status!=='approved'||exercise.source_collection!==entry.id||!exercise.pair_id||ids.has(exercise.exercise_id))throw new Error('El bloque contiene frases sin revisión válida.');
        ids.add(exercise.exercise_id);const pair=pairs.get(exercise.pair_id)||[];pair.push(exercise);pairs.set(exercise.pair_id,pair);
      }
      for(const pair of pairs.values()){
        const ja=pair.find(e=>e.direction==='ja_es'),es=pair.find(e=>e.direction==='es_ja');
        if(pair.length!==2||!ja||!es||ja.source_text!==es.reference_translation||ja.reference_translation!==es.source_text)throw new Error('El bloque contiene una pareja de traducciones incompleta.');
        const signature=normalized(ja.source_text);
        if(signatures.has(signature))continue;
        signatures.add(signature);rows.push(...pair.map(exercise=>({...exercise,sync_scope:'editorial'})));
      }
      await JapoDB.bulkPut('exercises',rows);
      localStorage.setItem(key,entry.version);
    }
  }
  function options(exercises,current=''){
    const counts=new Map();
    for(const e of exercises)if(e.active!==false&&e.source_collection&&e.direction==='ja_es')counts.set(e.source_collection,(counts.get(e.source_collection)||0)+1);
    return '<option value="">Solo banco general</option>'+catalog.map(c=>`<option value="${c.id}"${current===c.id?' selected':''}${counts.has(c.id)?'':' disabled'}>${c.name} · ${counts.has(c.id)?counts.get(c.id)+' frases revisadas':'pendiente de importar'}</option>`).join('');
  }
  window.StudyCollections={load,options,catalog};
})();
