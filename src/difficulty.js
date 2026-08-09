(function(){
  const legacyRanges={N5:[1,4],N4:[4,7],N3:[1,7],N2:[1,7],N1:[1,7]},levels=['N5','N4','N3','N2','N1'];
  function score(exercise){const raw=Number(exercise?.difficulty);if(!Number.isFinite(raw))return 50;if(raw>7)return Math.round(Math.max(0,Math.min(100,raw)));const [min,max]=legacyRanges[exercise?.jlpt_level]||[1,7];return Math.round(100*Math.max(0,Math.min(1,(raw-min)/Math.max(1,max-min))))}
  function levelIndex(exercise){const index=levels.indexOf(exercise?.jlpt_level);return index<0?levels.length:index}
  function label(value){if(value<20)return'Muy accesible';if(value<40)return'Base del nivel';if(value<60)return'Intermedio del nivel';if(value<80)return'Exigente dentro del nivel';return'Extremo superior del nivel'}
  function html(exercise,mode='compact'){const value=score(exercise),level=exercise?.jlpt_level||'JLPT',caption=mode==='full'?'Dificultad':'Dif.';return `<span class="difficulty-meter difficulty-${mode}" title="Dificultad dentro de ${level}: ${value}/100 · ${label(value)}"><span class="difficulty-caption">${caption} ${level}</span><i><b style="width:${value}%"></b></i><em>${value}/100</em></span>`}
  window.Difficulty={score,label,html,levelIndex};
})();
