(function(){
  const CURRENT_NATIVE_VERSION='0.0.0';
  const MANIFEST_URL='android-version.json';
  const $=selector=>document.querySelector(selector),
    esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  function parts(version){return String(version||'0').split(/[.-]/).map(part=>Number.parseInt(part,10)).map(n=>Number.isFinite(n)?n:0)}
  function newer(remote,current){
    const a=parts(remote),b=parts(current),length=Math.max(a.length,b.length);
    for(let index=0;index<length;index++){const diff=(a[index]||0)-(b[index]||0);if(diff)return diff>0}
    return false;
  }
  function render(manifest){
    const status=$('#nativeUpdateStatus'),download=$('#nativeUpdateDownload'),notes=$('#nativeUpdateNotes');
    if(!status||!download||!notes)return;
    const version=manifest.version||'0.0.0',hasApk=Boolean(manifest.apk_url),available=hasApk&&newer(version,CURRENT_NATIVE_VERSION);
    status.classList.toggle('ready',available);
    status.classList.toggle('muted',!hasApk);
    status.innerHTML=hasApk?(available?`Actualización nativa disponible: ${esc(version)}. Tienes ${esc(CURRENT_NATIVE_VERSION)}.`:`Canal APK al día: ${esc(version)}.`):'Canal APK preparado, todavía sin APK publicada.';
    download.hidden=!available;
    if(available)download.href=manifest.apk_url;
    notes.innerHTML=Array.isArray(manifest.notes)&&manifest.notes.length?`<ul>${manifest.notes.map(item=>`<li>${esc(item)}</li>`).join('')}</ul>`:'<p class="empty">Cuando publiquemos una APK, aquí aparecerán los cambios y el enlace de descarga.</p>';
  }
  async function check(){
    const status=$('#nativeUpdateStatus');
    if(status)status.textContent='Buscando actualización…';
    try{
      const response=await fetch(`${MANIFEST_URL}?t=${Date.now()}`,{cache:'no-store'});
      if(!response.ok)throw new Error(`HTTP ${response.status}`);
      render(await response.json());
    }catch(error){
      if(status){status.classList.remove('ready');status.textContent='No se pudo consultar el canal APK ahora mismo.'}
      const notes=$('#nativeUpdateNotes');
      if(notes)notes.innerHTML=`<p class="dictionary-ai-error">${esc(error.message||'Error consultando actualizaciones.')}</p>`;
    }
  }
  document.addEventListener('DOMContentLoaded',()=>{
    $('#checkNativeUpdateButton')?.addEventListener('click',check);
    document.addEventListener('japoteacher:navigate',event=>{if(event.detail?.view==='ajustes')check()});
    setTimeout(check,900);
  });
  window.JapoNativeUpdate={check,currentVersion:CURRENT_NATIVE_VERSION};
})();
