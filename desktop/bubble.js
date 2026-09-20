document.querySelector('#capture').onclick=()=>DesktopLens.capture();
document.addEventListener('contextmenu',event=>{event.preventDefault();DesktopLens.show()});
