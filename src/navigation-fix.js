(function(){
  let pendingView=null;
  const loader=document.querySelector('#routeLoader');
  if(loader)new MutationObserver(()=>{if(!loader.classList.contains('active')&&pendingView&&window.UI){const view=pendingView;pendingView=null;window.UI.showView(view)}}).observe(loader,{attributes:true,attributeFilter:['class']});
  document.addEventListener('click',event=>{
    const button=event.target.closest('.nav-item[data-view]');
    if(!button||!window.UI)return;
    event.preventDefault();event.stopImmediatePropagation();pendingView=document.querySelector('#routeLoader')?.classList.contains('active')?button.dataset.view:null;
    if(button.dataset.view==='practicar'&&window.App?.startPractice)window.App.startPractice();
    else window.UI.showView(button.dataset.view);
  },true);
})();
