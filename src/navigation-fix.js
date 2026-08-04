(function(){
  document.addEventListener('click',event=>{
    const button=event.target.closest('.nav-item[data-view="practicar"]');
    if(!button||!window.App?.startPractice)return;
    event.preventDefault();event.stopImmediatePropagation();window.App.startPractice();
  },true);
})();
