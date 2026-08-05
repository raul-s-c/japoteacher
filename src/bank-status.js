(function(){
  async function update(){
    const rows=await JapoDB.all('exercises');
    const active=rows.filter(exercise=>exercise.active!==false),archived=rows.length-active.length;
    const ja=active.filter(exercise=>exercise.direction==='ja_es').length,es=active.length-ja;
    const notice=document.querySelector('#bankNotice'),summary=document.querySelector('#bankSummary');
    if(notice)notice.textContent=`Banco activo: ${active.length} ejercicios (${ja} ja_es · ${es} es_ja) · ${archived} archivados.`;
    if(summary)summary.textContent=`${active.length} ejercicios activos · ${archived} archivados en IndexedDB.`;
  }
  document.addEventListener('DOMContentLoaded',()=>{setTimeout(()=>update().catch(()=>{}),800);document.addEventListener('japoteacher:navigate',()=>setTimeout(()=>update().catch(()=>{}),0))});
})();
