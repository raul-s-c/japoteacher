(function(){
  document.addEventListener('DOMContentLoaded',()=>{
    const continueButton=document.querySelector('#continueButton'),extraButton=document.querySelector('#extraStudyButton');
    if(!continueButton||!extraButton)return;
    const refresh=()=>{extraButton.hidden=!continueButton.disabled};
    new MutationObserver(refresh).observe(continueButton,{attributes:true,attributeFilter:['disabled']});
    extraButton.addEventListener('click',async()=>{
      extraButton.disabled=true;extraButton.textContent='Preparando tanda…';
      try{await window.JapoStartExtraStudy()}catch(error){window.UI.toast(error.message||'No se pudo preparar la práctica adicional')}
      finally{extraButton.disabled=false;extraButton.textContent='Estudiar más'}
    });
    refresh();
  });
})();
