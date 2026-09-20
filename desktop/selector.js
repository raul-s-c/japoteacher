let start,size,busy=false;
DesktopLens.screen().then(data=>{document.querySelector('#screen').src=data.image;size=data.size});
const box=document.querySelector('#selection');
document.onpointerdown=e=>{if(!size||busy||e.button!==0)return;start={x:e.clientX,y:e.clientY}};
document.onpointermove=e=>{if(!start)return;Object.assign(box.style,{left:Math.min(start.x,e.clientX)+'px',top:Math.min(start.y,e.clientY)+'px',width:Math.abs(e.clientX-start.x)+'px',height:Math.abs(e.clientY-start.y)+'px'})};
document.onpointerup=async e=>{if(!start||busy)return;const s=start;start=null;if(Math.abs(e.clientX-s.x)<3||Math.abs(e.clientY-s.y)<3)return;busy=true;await DesktopLens.crop({x:Math.min(s.x,e.clientX)*size.width/innerWidth,y:Math.min(s.y,e.clientY)*size.height/innerHeight,width:Math.abs(e.clientX-s.x)*size.width/innerWidth,height:Math.abs(e.clientY-s.y)*size.height/innerHeight})};
document.onkeydown=e=>{if(e.key==='Escape')DesktopLens.cancel()};
