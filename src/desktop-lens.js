(function(){
  const $=s=>document.querySelector(s),host=window.DesktopLens;
  let prefs,current=null,processing=false;
  const status=text=>{$('#desktopStatus').textContent=text};
  window.UI={toast:status};
  const run=fn=>Promise.resolve().then(fn).catch(e=>status(e.message||'No se pudo completar la acción.'));
  function inputs(disabled){for(const id of ['lensAnalyze','lensClear','lensImageInput','desktopDiscard'])$('#'+id).disabled=disabled}
  async function receive(item){
    if(await JapoDB.get('lens_captures',item.id)){await host.acknowledge(item.id);return}
    current=item;processing=true;inputs(true);
    JapoNativeLens.receiveCapture({text:'',imageDataUrl:''});
    try{
      let text='';if(prefs.mode==='text'){status('Leyendo el recorte en este PC…');text=await host.ocr(item.imageDataUrl);if(!text)throw Error('El OCR no detectó texto. Cambia a visión en ajustes y pulsa Reprocesar captura.')}
      JapoNativeLens.receiveCapture({captureId:item.id,imageDataUrl:prefs.mode==='vision'?item.imageDataUrl:'',text});
      $('#inputDetails').open=!prefs.auto;status('Captura recibida: '+item.label);
      if(prefs.auto){if(!await CloudSync.getAccessToken()){$('#desktopSettings').open=true;status('Captura preparada. Inicia sesión para analizarla.')}else await JapoLens.analyze()}
    }catch(e){status(e.message);$('#inputDetails').open=true;$('#desktopRetry').hidden=false}
    finally{processing=false;inputs(false)}
  }
  async function init(){
    if(!host){status('Esta página se utiliza desde JapoTeacher Lupa para Windows.');return}
    prefs=await host.settings();
    for(const [key,id] of Object.entries({auto:'desktopAuto',watch:'desktopWatch',top:'desktopTop',vertical:'desktopVertical'}))$('#'+id).checked=prefs[key];
    $('#desktopMode').value=prefs.mode;
    for(const id of ['desktopAuto','desktopWatch','desktopTop','desktopVertical','desktopMode'])$('#'+id).onchange=()=>run(async()=>{prefs={mode:$('#desktopMode').value,auto:$('#desktopAuto').checked,watch:$('#desktopWatch').checked,top:$('#desktopTop').checked,vertical:$('#desktopVertical').checked};await host.settings(prefs);status(prefs.watch?'Recepción automática del portapapeles activada.':'Ajustes guardados.');if(current&&!processing)$('#desktopRetry').hidden=false});
    for(const [id,fn] of Object.entries({desktopCapture:()=>host.capture(),desktopPaste:()=>host.paste(),desktopOpen:()=>host.open(),desktopHide:()=>host.hide(),desktopQuit:()=>host.quit()}))$('#'+id).onclick=()=>run(fn);
    const retry=document.createElement('button');retry.id='desktopRetry';retry.textContent='Reprocesar captura';retry.hidden=true;$('#inputDetails .capture-actions').append(retry);retry.onclick=()=>{if(current&&!processing){retry.hidden=true;run(()=>receive(current))}};
    $('#desktopDiscard').onclick=()=>run(async()=>{if(processing||JapoLens.isBusy())return;if(current){const id=current.id;current=null;retry.hidden=true;await host.acknowledge(id);status('Captura descartada.')}});
    document.addEventListener('japoteacher:lens-started',()=>inputs(true));
    document.addEventListener('japoteacher:lens-finished',event=>run(async()=>{
      inputs(false);
      if(event.detail.saved){status('Análisis y frases potenciales guardados en este PC. Sincronización pendiente o en curso.');$('#lensOutput').scrollIntoView({block:'start'});const id=current?.id;current=null;retry.hidden=true;if(id)setTimeout(()=>run(()=>host.acknowledge(id)),0);CloudSync.flush().catch(()=>status('Guardado en este PC. La sincronización se reintentará cuando haya conexión.'))}
      else status('No se completó el análisis. La captura sigue preparada para reintentar.');
    }));
    host.onStatus(status);host.onCapture(item=>run(()=>receive(item)));
    document.addEventListener('paste',event=>{if(event.clipboardData?.files?.length){event.preventDefault();run(()=>host.paste())}});
    document.addEventListener('dragover',e=>{e.preventDefault();document.body.classList.add('dragging')});
    document.addEventListener('dragleave',()=>document.body.classList.remove('dragging'));
    document.addEventListener('drop',e=>{e.preventDefault();document.body.classList.remove('dragging');run(async()=>{for(const file of e.dataTransfer.files){if(!file.type.startsWith('image/'))continue;if(file.size>25*1024*1024)throw Error('La imagen supera 25 MB.');const data=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(file)});await host.importImage(data)}})});
    await JapoDB.open();await CloudSync.initialSync;await JapoLens.renderHistory();
    if(!await CloudSync.getAccessToken())$('#desktopSettings').open=true;
    await host.ready();
  }
  document.addEventListener('DOMContentLoaded',()=>run(init));
})();
