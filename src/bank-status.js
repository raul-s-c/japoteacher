(function(){
  const levels=['N5','N4','N3','N2','N1'];
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const avg=values=>values.length?Math.round(values.reduce((sum,value)=>sum+value,0)/values.length):null;
  function pairKey(exercise){return String(exercise.exercise_id||'').replace(/^(JAES|ESJA)-/,'')}
  function levelRows(active){
    return levels.map(level=>{
      const rows=active.filter(exercise=>exercise.jlpt_level===level),ja=rows.filter(exercise=>exercise.direction==='ja_es'),es=rows.filter(exercise=>exercise.direction==='es_ja'),pairs=new Set(rows.map(pairKey)),difficulty=avg(rows.map(exercise=>Number(exercise.difficulty)).filter(Number.isFinite));
      return {level,pairs:pairs.size,ja:ja.length,es:es.length,difficulty};
    }).filter(row=>row.pairs||row.ja||row.es);
  }
  function familyRows(active){
    const groups=new Map();
    for(const exercise of active)for(const topic of exercise.topic_tags||['Sin tema']){
      const family=window.TopicProgression?.familyFor?.(topic)||'Otros contextos',item=groups.get(family)||{family,pairs:new Set(),ja:0,es:0,levels:new Set(),difficulties:[]};
      item.pairs.add(pairKey(exercise));item[exercise.direction==='ja_es'?'ja':'es']++;item.levels.add(exercise.jlpt_level);if(Number.isFinite(Number(exercise.difficulty)))item.difficulties.push(Number(exercise.difficulty));groups.set(family,item);
    }
    return [...groups.values()].map(item=>({...item,pairs:item.pairs.size,levels:[...item.levels].sort(),difficulty:avg(item.difficulties)})).sort((a,b)=>b.pairs-a.pairs||a.family.localeCompare(b.family,'es'));
  }
  function update(){
    return JapoDB.all('exercises').then(rows=>{
      const active=rows.filter(exercise=>exercise.active!==false),archived=rows.length-active.length,ja=active.filter(exercise=>exercise.direction==='ja_es').length,es=active.filter(exercise=>exercise.direction==='es_ja').length,pairs=Math.max(ja,es),notice=document.querySelector('#bankNotice'),summary=document.querySelector('#bankSummary'),dashboard=document.querySelector('#bankDashboard');
      const noticeText=`Banco local: ${pairs} pares activos (${active.length} ejercicios: ${ja} JP->ES y ${es} ES->JP). ${rows.length} registros totales${archived?`, ${archived} archivados`:''}.`;
      if(notice)notice.textContent=noticeText;
      if(summary)summary.textContent=`${pairs} pares activos · ${active.length} ejercicios direccionales · ${archived} archivados · ${rows.length} registros en IndexedDB.`;
      if(!dashboard)return;
      const levelHtml=levelRows(active).map(row=>`<article><strong>${row.level}</strong><span>${row.pairs} pares</span><small>${row.ja} JP->ES · ${row.es} ES->JP · dif. media ${row.difficulty??'—'}</small></article>`).join('');
      const familyHtml=familyRows(active).slice(0,9).map(row=>`<article><strong>${esc(row.family)}</strong><span>${row.pairs} pares · ${row.levels.join('/')}</span><small>${row.ja} JP->ES · ${row.es} ES->JP · dif. ${row.difficulty??'—'}</small></article>`).join('');
      dashboard.innerHTML=`<div class="bank-dashboard-grid">${levelHtml}</div><div class="bank-family-list"><h4>Cobertura por familia</h4>${familyHtml}</div><p class="bank-review-note">${archived} ejercicios archivados o fuera del banco activo. Las frases editoriales aprobadas están publicadas; las no aprobadas no entran en práctica.</p>`;
    });
  }
  document.addEventListener('DOMContentLoaded',()=>{document.addEventListener('japoteacher:navigate',event=>{if(event.detail?.view==='ajustes')update().catch(()=>{})})});
  window.BankStatus={update};
})();
