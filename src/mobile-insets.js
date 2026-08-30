(function(){
  const viewport=window.visualViewport;
  if(!viewport)return;
  let baseline=Math.max(window.innerHeight,viewport.height);
  function sync(){
    if(viewport.height>baseline)baseline=viewport.height;
    const covered=Math.max(0,baseline-viewport.height-viewport.offsetTop);
    const keyboardOpen=covered>120&&document.activeElement?.matches?.('input, textarea, select, [contenteditable="true"]');
    document.documentElement.classList.toggle('soft-keyboard-open',Boolean(keyboardOpen));
    document.documentElement.style.setProperty('--visual-viewport-height',`${Math.round(viewport.height)}px`);
  }
  viewport.addEventListener('resize',sync);
  viewport.addEventListener('scroll',sync);
  document.addEventListener('focusin',event=>{
    setTimeout(sync,80);
    setTimeout(()=>{
      if(event.target?.matches?.('input, textarea, select, [contenteditable="true"]')){
        event.target.scrollIntoView({block:'center',inline:'nearest',behavior:'smooth'});
      }
    },260);
  });
  document.addEventListener('focusout',()=>setTimeout(sync,180));
  window.addEventListener('orientationchange',()=>{baseline=window.innerHeight;setTimeout(sync,250)});
  sync();
})();
