(function(){
  'use strict';
  const parse=(v,f=[])=>{try{return typeof v==='string'?JSON.parse(v):v||f}catch{return f}};
  const japanese=e=>e.direction==='ja_es'?e.source_text:e.reference_translation;
  const signature=e=>japanese(e).normalize('NFKC').replace(/[\s。、！？!?]/g,'');
  const valid=a=>a.evaluation_status!=='invalid'&&a.overall_score!==null&&a.overall_score!==''&&Number.isFinite(Number(a.overall_score));
  function build(data,exercises,attempts,progress,profile,direction,scope=()=>true,now=Date.now()){
    const rows=exercises.filter(e=>e.active!==false&&!e.blocked_by_user&&e.direction===direction&&scope(e)&&data.sentences[e.exercise_id]?.text===japanese(e));
    const byId=new Map(rows.map(e=>[e.exercise_id,e])), allRows=new Map(exercises.map(e=>[e.exercise_id,e]));
    const history=new Map(),pmap=new Map(progress.filter(p=>p.profile_id===profile).map(p=>[p.exercise_id,p]));
    for(const a of attempts){if(a.profile_id!==profile||!valid(a))continue;const e=allRows.get(a.exercise_id);if(!e||e.direction!==direction)continue;const k=signature(e),list=history.get(k)||[];list.push(a);history.set(k,list)}
    for(const list of history.values())list.sort((a,b)=>Date.parse(b.attempted_at)-Date.parse(a.attempted_at));
    const nodes=new Map(data.nodes.map(n=>[n.id,{...n,rows:[],seen:new Set(),success:new Set(),days:new Set(),failed:new Set(),due:false}]));
    const unique=new Set();
    for(const e of rows){const key=signature(e);if(unique.has(key))continue;unique.add(key);const hs=history.get(key)||[],p=pmap.get(e.exercise_id),latest=hs[0];
      for(const id of data.sentences[e.exercise_id].concepts){const n=nodes.get(id);if(!n)continue;n.rows.push(e);
        if(latest){n.seen.add(key);if(Number(latest.overall_score)<70)n.failed.add(key);if(!p?.suspended&&p?.next_review_at&&Date.parse(p.next_review_at)<=now)n.due=true;
          const recent=hs.slice(0,3);if(recent.every(a=>Number(a.overall_score)>=85))for(const a of recent){n.success.add(key);n.days.add(String(a.attempted_at).slice(0,10))}
        }
      }
    }
    for(const [id,n] of nodes){if(!n.rows.length){nodes.delete(id);continue}n.state=n.failed.size?'reinforce':n.due?'due':n.success.size>=2&&n.days.size>=3?'solid':n.seen.size?'learning':'new';}
    const ranked=rows.map(e=>{const concepts=data.sentences[e.exercise_id].concepts.map(id=>nodes.get(id)).filter(Boolean),learning=concepts.filter(n=>n.type!=='k'),unknown=learning.filter(n=>n.state==='new'),known=learning.length-unknown.length,hs=history.get(signature(e))||[],failed=hs[0]&&Number(hs[0].overall_score)<70,p=pmap.get(e.exercise_id),due=!!hs.length&&!p?.suspended&&Date.parse(p?.next_review_at)<=now;
      return {exercise:e,unknown:unknown.length,known,failed,due,score:(failed?100:due?80:0)+known*3-unknown.length*4,reason:failed?'La última respuesta a esta frase tuvo menos de 70 puntos.':due?'Esta frase tiene un repaso programado pendiente.':unknown.length===1?`Introduce un concepto nuevo y reutiliza ${known} ya trabajados.`:unknown.length?`${unknown.length} conceptos nuevos y ${known} ya trabajados.`:'Reutiliza conceptos que ya has trabajado.'};
    }).sort((a,b)=>b.score-a.score||a.exercise.exercise_id.localeCompare(b.exercise.exercise_id));
    return {nodes,ranked,byId};
  }
  window.KnowledgeMap={build,parse,japanese,signature};
})();
