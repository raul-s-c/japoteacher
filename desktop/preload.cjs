const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('DesktopLens',{
  capture:()=>ipcRenderer.invoke('lens:capture'),
  paste:()=>ipcRenderer.invoke('lens:paste'),
  open:()=>ipcRenderer.invoke('lens:open'),
  importImage:data=>ipcRenderer.invoke('lens:import',data),
  hide:()=>ipcRenderer.invoke('lens:hide'),
  show:()=>ipcRenderer.invoke('lens:show'),
  quit:()=>ipcRenderer.invoke('lens:quit'),
  settings:value=>ipcRenderer.invoke('lens:settings',value),
  ready:()=>ipcRenderer.invoke('lens:ready'),
  acknowledge:id=>ipcRenderer.invoke('lens:ack',id),
  ocr:data=>ipcRenderer.invoke('lens:ocr',data),
  crop:rect=>ipcRenderer.invoke('lens:crop',rect),
  cancel:()=>ipcRenderer.invoke('lens:cancel'),
  screen:()=>ipcRenderer.invoke('lens:screen'),
  onCapture:callback=>{const fn=(_e,value)=>callback(value);ipcRenderer.on('lens:image',fn);return()=>ipcRenderer.removeListener('lens:image',fn)},
  onStatus:callback=>{ipcRenderer.on('lens:status',(_e,value)=>callback(value))}
});
