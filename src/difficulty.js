(function(){
  const bands={N5:[5,39],N4:[40,59],N3:[60,74],N2:[75,89],N1:[90,100]};
  function score(exercise){const [min,max]=bands[exercise?.jlpt_level]||[0,100],raw=Math.max(1,Math.min(7,Number(exercise?.difficulty)||4));return Math.round(min+(raw-1)/6*(max-min))}
  function label(value){if(value<20)return'Muy accesible';if(value<40)return'Base sólida';if(value<55)return'Intermedio';if(value<70)return'Puente al nivel superior';if(value<85)return'Avanzado';return'Muy avanzado'}
  function html(exercise,mode='compact'){const value=score(exercise),caption=mode==='full'?'Dificultad':'Dif.';return `<span class="difficulty-meter difficulty-${mode}" title="Dificultad pedagogica estimada ${value}/100 · ${label(value)}"><span class="difficulty-caption">${caption}</span><i><b style="width:${value}%"></b></i><em>${value}/100</em></span>`}
  window.Difficulty={score,label,html};
})();
