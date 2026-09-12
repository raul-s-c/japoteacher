(function(){
  'use strict';
  const $=s=>document.querySelector(s),esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const names={v:'Vocabulario',k:'Kanji',g:'Gramática'},states={new:'Sin estudiar',learning:'Aprendiendo',solid:'Consolidado en contexto',reinforce:'Frases con fallos',due:'Repaso pendiente'};
  let data,ctx,model,selected=null,page=0,zoom=1,pan={x:0,y:0},generation=0;
  async function open(planId){await UI.showView('mapa');if(planId){$('#mapPlan').value=planId;draw()}}
  async function load(){
    const current=++generation;$('#mapStatus').textContent='Preparando tu mapa…';
    try{
      const [raw,exercises,attempts,progress,settings]=await Promise.all([data||fetch('data/knowledge-map.json?v=1').then(r=>{if(!r.ok)throw Error('No se pudo descargar el mapa.');return r.json()}),JapoDB.all('exercises'),JapoDB.all('attempts'),JapoDB.all('exercise_progress'),JapoDB.get('settings','app')]);
      if(current!==generation)return;data=raw;const profile=settings?.value?.profileId||'local-default',plans=await StudyPlans.all(profile),sessions=await JapoDB.all('daily_sessions'),today=SessionPlanner.localDate(),session=sessions.find(s=>s.profile_id===profile&&s.local_date===today&&s.session_id===profile+'::'+today);
      const previous=$('#mapPlan').value;$('#mapPlan').innerHTML='<option value="all">Todo mi banco</option>'+plans.map(p=>`<option value="${esc(p.id)}">${esc(p.name)} · ${p.direction==='ja_es'?'JP → ES':'ES → JP'}</option>`).join('');if(plans.some(p=>p.id===previous))$('#mapPlan').value=previous;
      ctx={exercises,attempts,progress,profile,plans,session};draw();
    }catch(e){$('#mapStatus').textContent=e.message+' Pulsa Actualizar para reintentar.'}
  }
  function draw(){
    if(!ctx)return;const plan=ctx.plans.find(p=>p.id===$('#mapPlan').value);if(plan)$('#mapDirection').value=plan.direction;
    const d=$('#mapDirection').value,level=$('#mapLevel').value;
    model=KnowledgeMap.build(data,ctx.exercises,ctx.attempts,ctx.progress,ctx.profile,d,e=>(!plan||StudyPlans.matches(plan,e))&&(level==='all'||e.jlpt_level===level));
    const q=$('#mapSearch').value.normalize('NFKC').toLowerCase(),type=$('#mapType').value,state=$('#mapState').value;
    let nodes=[...model.nodes.values()].filter(n=>(type==='all'||n.type===type)&&(state==='all'||n.state===state)&&(!q||(n.label+' '+n.description).toLowerCase().includes(q)));
    const priority={reinforce:0,due:1,learning:2,solid:3,new:4};nodes.sort((a,b)=>priority[a.state]-priority[b.state]||b.rows.length-a.rows.length||a.id.localeCompare(b.id));
    if(type==='all'){const groups=['v','k','g'].map(t=>nodes.filter(n=>n.type===t)),balanced=[];for(let i=0;groups.some(g=>i<g.length);i++)for(const g of groups)if(g[i])balanced.push(g[i]);nodes=balanced}
    const total=nodes.length;page=Math.min(page,Math.max(0,Math.ceil(total/48)-1));nodes=nodes.slice(page*48,page*48+48);
    $('#mapStatus').textContent=`${model.nodes.size} conceptos en este filtro · ${nodes.length} de ${total} visibles${total?' · página '+(page+1)+' de '+Math.ceil(total/48):''}.`;
    $('#mapPrev').disabled=page===0;$('#mapNext').disabled=(page+1)*48>=total;
    $('#mapSummary').innerHTML=Object.entries(states).map(([s,label])=>`<span><b>${[...model.nodes.values()].filter(n=>n.state===s).length}</b> ${label}</span>`).join('');
    const graphNodes=[...nodes];if(selected&&model.nodes.has(selected)){const focus=model.nodes.get(selected);for(const n of [focus,...model.nodes.values()].filter(n=>n.id===selected||focus.type==='v'&&n.type==='k'&&focus.label.includes(n.label)||focus.type==='k'&&n.type==='v'&&n.label.includes(focus.label)).slice(0,12))if(!graphNodes.some(x=>x.id===n.id))graphNodes.push(n)}renderGraph(graphNodes);$('#mapNodeList').innerHTML=nodes.map(n=>`<button type="button" data-map-node="${esc(n.id)}" class="map-chip ${n.state}" aria-pressed="${selected===n.id}">${esc(n.label)} <small>${names[n.type]} · ${states[n.state]}</small></button>`).join('')||'<p>No hay conceptos con estos filtros. Prueba otra búsqueda.</p>';
    renderRecommendations();if(selected&&model.nodes.has(selected))detail(selected);else{$('#mapDetail').innerHTML='<p class="section-kicker">Explora una conexión</p><h3>Toca un punto del mapa</h3><p>Verás sus ejemplos, tu evidencia de aprendizaje y las relaciones con otros conceptos.</p>';selected=null}
  }
  function renderGraph(nodes){
    const positions=new Map(),groups=['v','k','g'];
    groups.forEach((type,col)=>{const group=nodes.filter(n=>n.type===type);group.forEach((n,i)=>{const angle=i*2.3999632297,r=25+Math.sqrt(i)*21;positions.set(n.id,{x:135+col*255+Math.cos(angle)*r,y:205+Math.sin(angle)*r})})});
    const edges=[];
    for(const n of nodes)if(n.type==='v')for(const k of nodes.filter(n=>n.type==='k'))if(n.label.includes(k.label))edges.push([n.id,k.id,'Contiene el kanji']);
    for(const [a,b] of data.prerequisites)if(positions.has(a)&&positions.has(b))edges.push([a,b,'Base recomendada']);
    // Co-occurrence is a labelled relationship, never an invented prerequisite.
    if(selected&&positions.has(selected))for(const n of nodes)if(n.id!==selected&&model.nodes.get(selected)?.rows.some(e=>data.sentences[e.exercise_id].concepts.includes(n.id)))edges.push([selected,n.id,'Aparecen en una misma frase']);
    $('#mapGraph').innerHTML=`<g id="mapTransform" transform="translate(${pan.x} ${pan.y}) scale(${zoom})">${groups.map((t,i)=>`<text x="${135+i*255}" y="35" text-anchor="middle" class="map-group-label">${names[t]}</text><circle cx="${135+i*255}" cy="205" r="145" class="map-region"/>`).join('')}${edges.map(([a,b,label])=>{const x=positions.get(a),y=positions.get(b);return `<line x1="${x.x}" y1="${x.y}" x2="${y.x}" y2="${y.y}" class="map-edge"><title>${label}</title></line>`}).join('')}${nodes.map(n=>{const p=positions.get(n.id);return `<g role="button" tabindex="0" data-map-node="${esc(n.id)}" aria-label="${esc(n.label)}: ${states[n.state]}" class="map-dot ${n.state}${selected===n.id?' selected':''}" transform="translate(${p.x} ${p.y})"><circle r="${selected===n.id?13:9}"/><title>${esc(n.label)} · ${states[n.state]}</title>${nodes.indexOf(n)<12||selected===n.id?`<text y="-19" text-anchor="middle">${esc(n.label)}</text>`:''}</g>`}).join('')}</g>`;
  }
  function readings(e){const raw=e.direction==='ja_es'?e.exercise_id:e.exercise_id.replace(/^ESJA/,'JAES');return window.JAPOTEACHER_FURIGANA?.[raw]||UI.japaneseWithFurigana(KnowledgeMap.japanese(e),e.kanji_readings||[])}
  function detail(id){selected=id;const n=model.nodes.get(id);if(!n)return;
    const related=[...model.nodes.values()].filter(x=>x.id!==id&&(n.type==='k'&&x.type==='v'&&x.label.includes(n.label)||n.type==='v'&&x.type==='k'&&n.label.includes(x.label)));
    const prerequisites=data.prerequisites.filter(([a,b])=>b===id).map(([a])=>model.nodes.get(a)).filter(Boolean);
    $('#mapDetail').innerHTML=`<p class="section-kicker">${names[n.type]} · ${states[n.state]}</p><h3>${esc(n.label)}</h3><p>${esc(n.description)}</p><p>${n.seen.size} frases trabajadas de ${n.rows.length}. ${n.failed.size?`${n.failed.size} con una respuesta reciente inferior a 70.`:''}</p><p class="map-note">Evidencia indirecta: el resultado de una frase no demuestra por sí solo el dominio de cada palabra. Consolidación: aciertos ≥85 en al menos dos frases y tres fechas distintas, sin fallo reciente.</p>${prerequisites.length?`<h4>Base recomendada</h4>${prerequisites.map(x=>`<button type="button" data-map-node="${esc(x.id)}">${esc(x.label)}</button>`).join('')}`:''}${related.length?`<h4>${n.type==='k'?'Palabras que contienen este kanji':'Kanji de esta palabra'}</h4>${related.slice(0,12).map(x=>`<button type="button" data-map-node="${esc(x.id)}">${esc(x.label)}</button>`).join('')}`:''}<h4>Ejemplos traducidos</h4>${n.rows.slice(0,5).map(e=>`<article class="map-example"><p lang="ja">${readings(e)}</p><p>${esc(e.direction==='ja_es'?e.reference_translation:e.source_text)}</p><small>${e.jlpt_level} · ${esc(e.source_collection_name||'Banco general')}</small><div><button type="button" data-map-audio="${esc(e.exercise_id)}">Escuchar</button><a target="_blank" rel="noopener noreferrer" href="https://jisho.org/search/${encodeURIComponent(n.label)}">Diccionario ↗</a>${todayPlan(e)?`<button type="button" class="primary" data-map-study="${esc(e.exercise_id)}">Practicar hoy</button>`:'<span class="map-note">Fuera de la selección de hoy</span>'}</div></article>`).join('')}`;
  }
  function todayPlan(e){const done=new Set(KnowledgeMap.parse(ctx.session?.completed_exercise_ids_json));if(done.has(e.exercise_id))return null;const assignments=KnowledgeMap.parse(ctx.session?.study_plan_assignments_json,{});return ctx.plans.find(p=>!p.paused&&assignments[p.id]?.includes(e.exercise_id))}
  function renderRecommendations(){
    const eligible=model.ranked.filter(x=>todayPlan(x.exercise)),ranked=(eligible.length?eligible:model.ranked).slice(0,3);
    $('#mapRecommendations').innerHTML=`<h3>${eligible.length?'Un buen siguiente paso hoy':'Para explorar después'}</h3><p class="map-note">${eligible.length?'Orden sugerido dentro de lo que tu plan ya permite hoy.':'No hay ejercicios pendientes de hoy en este filtro. Estos ejemplos son una vista previa; no amplían tus límites.'}</p>`+ranked.map(x=>`<article><p lang="ja">${esc(KnowledgeMap.japanese(x.exercise))}</p><p>${esc(x.reason)}</p><button type="button" data-map-node="${esc(data.sentences[x.exercise.exercise_id].concepts.find(id=>model.nodes.get(id)?.type==='v')||data.sentences[x.exercise.exercise_id].concepts[0])}">Explorar conceptos</button>${todayPlan(x.exercise)?`<button type="button" class="primary" data-map-study="${esc(x.exercise.exercise_id)}">Practicar hoy</button>`:''}</article>`).join('');
  }
  document.addEventListener('DOMContentLoaded',()=>{
    document.addEventListener('click',async e=>{const openButton=e.target.closest('[data-open-map]');if(openButton){await open(openButton.dataset.openMap);return}const node=e.target.closest('[data-map-node]');if(node){selected=node.dataset.mapNode;draw();$('#mapDetail').focus({preventScroll:true});return}const study=e.target.closest('[data-map-study]');if(study){const ex=model.byId.get(study.dataset.mapStudy),plan=ex&&todayPlan(ex);if(plan)await App.startMapExercise(plan.id,ex.exercise_id);return}const audio=e.target.closest('[data-map-audio]');if(audio){const ex=model.byId.get(audio.dataset.mapAudio);if(ex&&'speechSynthesis'in window){speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(KnowledgeMap.japanese(ex));u.lang='ja-JP';speechSynthesis.speak(u)}else UI.toast('Audio no disponible en este dispositivo.')}});
    $('#mapGraph').addEventListener('keydown',e=>{if(['Enter',' '].includes(e.key)&&e.target.matches('[data-map-node]')){e.preventDefault();e.target.dispatchEvent(new MouseEvent('click',{bubbles:true}))}});
    for(const id of ['mapPlan','mapDirection','mapLevel','mapType','mapState'])$('#'+id).addEventListener('change',()=>{if(id==='mapDirection')$('#mapPlan').value='all';page=0;draw()});
    $('#mapSearch').addEventListener('input',()=>{page=0;draw()});$('#mapRefresh').addEventListener('click',load);
    $('#mapPrev').addEventListener('click',()=>{page--;draw()});$('#mapNext').addEventListener('click',()=>{page++;draw()});
    for(const [id,factor] of [['mapZoomIn',1.25],['mapZoomOut',.8]])$('#'+id).addEventListener('click',()=>{zoom=Math.max(.6,Math.min(3,zoom*factor));draw()});$('#mapReset').addEventListener('click',()=>{zoom=1;pan={x:0,y:0};draw()});
    let drag=null;$('#mapGraph').addEventListener('pointerdown',e=>{if(e.target.closest('[data-map-node]'))return;drag={x:e.clientX,y:e.clientY,px:pan.x,py:pan.y};e.currentTarget.setPointerCapture(e.pointerId)});$('#mapGraph').addEventListener('pointermove',e=>{if(!drag)return;const ratio=780/e.currentTarget.getBoundingClientRect().width;pan={x:drag.px+(e.clientX-drag.x)*ratio,y:drag.py+(e.clientY-drag.y)*ratio};$('#mapTransform')?.setAttribute('transform',`translate(${pan.x} ${pan.y}) scale(${zoom})`)});for(const type of ['pointerup','pointercancel'])$('#mapGraph').addEventListener(type,()=>drag=null);
  });
  window.KnowledgeMapUI={open,load};
})();
