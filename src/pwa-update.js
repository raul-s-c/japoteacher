(function(){
  if(!('serviceWorker'in navigator))return;
  let reloading=false;
  navigator.serviceWorker.addEventListener('controllerchange',()=>{if(reloading)return;reloading=true;location.reload()});
  window.addEventListener('load',()=>navigator.serviceWorker.ready.then(registration=>registration.update()).catch(()=>{}));
})();
