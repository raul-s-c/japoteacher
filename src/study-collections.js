(function(){
  const catalog=[{id:'sakamoto',name:'Sakamoto',version:'20260907-1',url:'data/collections/sakamoto.json',available:false}];
  const normalized=text=>String(text||'').normalize('NFKC').replace(/[\s。、！？!?.,「」『』]/g,'');
  async function load(){
    for(const entry of catalog){
      if(!entry.available)continue;
      const key=`japoteacher_collection_${entry.id}`;
      const existing=await JapoDB.all('exercises');
      if(localStorage.getItem(key)===entry.version&&existing.some(e=>e.source_collection===entry.id))continue;
      const response=await fetch(`${entry.url}?v=${entry.version}`);
      if(!response.ok)throw new Error(`No se pudo cargar el bloque ${entry.name}.`);
      const data=await response.json();
      if(data.collection_id!==entry.id||!Array.isArray(data.exercises)||!data.exercises.length)throw new Error('Bloque de estudio vacío o inválido.');
      const signatures=new Map(existing.filter(e=>e.source_collection!==entry.id).map(e=>[`${e.direction}:${normalized(e.direction==='ja_es'?e.source_text:e.reference_translation)}`,e.exercise_id]));
      const rows=[];
      for(const exercise of data.exercises){
        const errors=SchemaValidation.validateExercise(exercise),signature=`${exercise.direction}:${normalized(exercise.direction==='ja_es'?exercise.source_text:exercise.reference_translation)}`;
        if(errors.length||exercise.review_status!=='approved'||exercise.source_collection!==entry.id)throw new Error('El bloque contiene frases sin revisión válida.');
        if(signatures.has(signature))continue;
        signatures.set(signature,exercise.exercise_id);rows.push({...exercise,sync_scope:'editorial'});
      }
      await JapoDB.bulkPut('exercises',rows);
      localStorage.setItem(key,entry.version);
    }
  }
  function options(exercises,current=''){
    const counts=new Map();
    for(const e of exercises)if(e.active!==false&&e.source_collection)counts.set(e.source_collection,(counts.get(e.source_collection)||0)+1);
    return '<option value="">Solo banco general</option>'+catalog.map(c=>`<option value="${c.id}"${current===c.id?' selected':''}${counts.has(c.id)?'':' disabled'}>${c.name} · ${counts.has(c.id)?Math.floor(counts.get(c.id)/2)+' frases revisadas':'pendiente de importar'}</option>`).join('');
  }
  window.StudyCollections={load,options,catalog};
})();
