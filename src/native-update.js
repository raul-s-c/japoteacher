(function(){
  const DEFAULT_NATIVE_VERSION='0.0.0';
  const DEFAULT_NATIVE_CODE=0;
  const MANIFEST_URL='android-version.json';
  const $=selector=>document.querySelector(selector),
    esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  function rememberNativeVersion(){
    const params=new URLSearchParams(location.search);
    const version=params.get('nativeVersion'),code=params.get('nativeCode');
    try{
      if(version)localStorage.setItem('japoteacher:nativeVersion',version);
      if(code)localStorage.setItem('japoteacher:nativeCode',code);
    }catch(_error){}
  }
  function currentNative(){
    rememberNativeVersion();
    try{
      return {
        version:localStorage.getItem('japoteacher:nativeVersion')||DEFAULT_NATIVE_VERSION,
        code:Number.parseInt(localStorage.getItem('japoteacher:nativeCode')||`${DEFAULT_NATIVE_CODE}`,10)||DEFAULT_NATIVE_CODE
      };
    }catch(_error){
      return {version:DEFAULT_NATIVE_VERSION,code:DEFAULT_NATIVE_CODE};
    }
  }
  function parts(version){return String(version||'0').split(/[.-]/).map(part=>Number.parseInt(part,10)).map(n=>Number.isFinite(n)?n:0)}
  function newer(remote,current){
    const a=parts(remote),b=parts(current),length=Math.max(a.length,b.length);
    for(let index=0;index<length;index++){const diff=(a[index]||0)-(b[index]||0);if(diff)return diff>0}
    return false;
  }
  function normalizeManifest(manifest){
    const version=manifest.version||manifest.versionName||'0.0.0';
    const apkUrl=manifest.apk_url||manifest.apkUrl||manifest.download_url||'';
    const versionCode=Number.parseInt(manifest.version_code??manifest.versionCode??0,10)||0;
    const notes=Array.isArray(manifest.notes)?manifest.notes:(manifest.notes?[manifest.notes]:[]);
    return {version,apkUrl,versionCode,notes,sha256:manifest.sha256||''};
  }
  function render(manifest){
    const status=$('#nativeUpdateStatus'),download=$('#nativeUpdateDownload'),notes=$('#nativeUpdateNotes');
    if(!status||!download||!notes)return;
    const normalized=normalizeManifest(manifest);
    const version=normalized.version,hasApk=Boolean(normalized.apkUrl);
    const current=currentNative();
    const available=hasApk&&(normalized.versionCode>current.code||newer(version,current.version));
    status.classList.toggle('ready',available);
    status.classList.toggle('muted',!hasApk);
    status.innerHTML=hasApk?(available?`Actualización nativa disponible: ${esc(version)}. Tienes ${esc(current.version)}.`:`Canal APK al día: ${esc(version)}.`):'Canal APK preparado, todavía sin APK publicada.';
    download.hidden=!available;
    if(available)download.href=normalized.apkUrl;
    notes.innerHTML=normalized.notes.length?`<ul>${normalized.notes.map(item=>`<li>${esc(item)}</li>`).join('')}${normalized.sha256?`<li>SHA-256: <code>${esc(normalized.sha256)}</code></li>`:''}</ul>`:'<p class="empty">Cuando publiquemos una APK, aquí aparecerán los cambios y el enlace de descarga.</p>';
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
  window.JapoNativeUpdate={check,currentNative};
})();
