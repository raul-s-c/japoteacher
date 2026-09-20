const crypto=require('node:crypto');
function cropRect(rect,size){
  if(!rect||!['x','y','width','height'].every(k=>Number.isFinite(rect[k])))throw Error('Recorte inválido');
  const x=Math.max(0,Math.min(size.width-1,Math.round(rect.x))),y=Math.max(0,Math.min(size.height-1,Math.round(rect.y)));
  const width=Math.min(size.width-x,Math.round(rect.width)),height=Math.min(size.height-y,Math.round(rect.height));
  if(width<3||height<3)throw Error('Selecciona una zona más grande');
  return {x,y,width,height};
}
function settings(value={}){return {mode:value.mode==='text'?'text':'vision',auto:value.auto!==false,watch:value.watch===true,top:value.top!==false,vertical:value.vertical===true}}
function digest(buffer){return crypto.createHash('sha256').update(buffer).digest('hex')}
module.exports={cropRect,settings,digest};
