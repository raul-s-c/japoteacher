(function(){
  document.addEventListener('click',event=>{
    const button=event.target.closest('.nav-item[data-view]');
    if(!button||!window.App||!window.UI)return;
    event.preventDefault();event.stopImmediatePropagation();
    if(button.dataset.view==='practicar')window.App.startPractice();
    else window.UI.showView(button.dataset.view);
  },true);
})();
