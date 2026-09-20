const {app,BrowserWindow,Menu,Tray,dialog,ipcMain,globalShortcut,desktopCapturer,screen,clipboard,nativeImage,session}=require('electron');
const path=require('node:path'),fs=require('node:fs'),crypto=require('node:crypto');
const {cropRect,settings,digest}=require('./core.cjs');
const BASE='https://raul-s-c.github.io/japoteacher/';
// Test server is permitted only in an unpackaged build, never in a release.
const testBase=!app.isPackaged&&process.env.JAPO_LENS_TEST_URL;
const base=testBase&&/^http:\/\/127\.0\.0\.1:\d+\/$/.test(testBase)?testBase:BASE;
if(base!==BASE&&process.env.JAPO_LENS_TEST_PROFILE)app.setPath('userData',process.env.JAPO_LENS_TEST_PROFILE);
let panel,bubble,selector,tray,prefs,quitting=false,capturing=false,shot,queue=[],ready=false,delivered=false,lastClipboard='',ocrWorker,ocrBusy=false;
const preload=path.join(__dirname,'preload.cjs');
const prefsPath=()=>path.join(app.getPath('userData'),'lens-settings.json');
function status(text){panel?.webContents.send('lens:status',text)}
function windowOptions(extra={}){return {icon:path.join(__dirname,'icon.png'),...extra,webPreferences:{preload,contextIsolation:true,nodeIntegration:false,sandbox:true,partition:'persist:japoteacher-lens'}}}
function secure(win,allowed){win.webContents.setWindowOpenHandler(()=>({action:'deny'}));win.webContents.on('will-navigate',(event,url)=>{if(!allowed(url))event.preventDefault()});win.webContents.on('will-attach-webview',event=>event.preventDefault())}
function panelURL(url){try{const u=new URL(url),b=new URL(base);return u.origin===b.origin&&u.pathname===b.pathname+'desktop-lens.html'}catch{return false}}
function localURL(url,name){return url===require('node:url').pathToFileURL(path.join(__dirname,name)).href}
function trusted(event,kind='panel'){
  const win=kind==='selector'?selector:kind==='bubble'?bubble:panel;
  if(!win||event.sender!==win.webContents||event.senderFrame!==win.webContents.mainFrame)throw Error('Origen no autorizado');
  const url=event.senderFrame.url;
  if(!(kind==='panel'?panelURL(url):localURL(url,kind+'.html')))throw Error('Página no autorizada');
}
function show(){panel.show();panel.focus()}
function dispatch(){if(ready&&!delivered&&queue.length){delivered=true;panel.webContents.send('lens:image',queue[0])}}
function enqueue(image,label){
  if(image.isEmpty())throw Error('No se encontró una imagen');
  if(queue.length>=10)throw Error('Hay 10 capturas pendientes. Termina o descarta alguna antes de añadir más.');
  const size=image.getSize(),scale=Math.min(1,1600/Math.max(size.width,size.height));
  const resized=scale<1?image.resize({width:Math.round(size.width*scale),height:Math.round(size.height*scale)}):image;
  queue.push({id:crypto.randomUUID(),imageDataUrl:'data:image/jpeg;base64,'+resized.toJPEG(88).toString('base64'),label});show();dispatch();
}
async function clipboardImage(){for(const item of await clipboard.read()){const type=item.types.find(t=>['image/png','image/jpeg','image/webp','image/bmp'].includes(t));if(type){const blob=await item.getType(type);if(blob.size>25*1024*1024)throw Error('La imagen supera 25 MB.');return nativeImage.createFromBuffer(Buffer.from(await blob.arrayBuffer()))}}return nativeImage.createEmpty()}
async function paste(){const image=await clipboardImage();if(image.isEmpty())throw Error('El portapapeles no contiene una imagen. Usa Win + Mayús + S para copiar un recorte.');lastClipboard=digest(image.toPNG());enqueue(image,'Portapapeles')}
async function openFile(){const result=await dialog.showOpenDialog(panel,{properties:['openFile','multiSelections'],filters:[{name:'Imágenes',extensions:['png','jpg','jpeg','webp','bmp']}]});for(const file of result.filePaths){if(fs.statSync(file).size>25*1024*1024)throw Error('La imagen supera 25 MB.');enqueue(nativeImage.createFromPath(file),path.basename(file))}}
async function capture(){
  if(capturing)return;
  capturing=true;panel.hide();bubble.hide();
  try{
    await new Promise(resolve=>setTimeout(resolve,220));
    const display=screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
    const sources=await desktopCapturer.getSources({types:['screen'],thumbnailSize:{width:Math.ceil(display.size.width*display.scaleFactor),height:Math.ceil(display.size.height*display.scaleFactor)}});
    const source=sources.find(s=>s.display_id===String(display.id));if(!source||source.thumbnail.isEmpty())throw Error('No se pudo capturar esta pantalla. Prueba Win + Mayús + S y Pegar.');
    shot=source.thumbnail;
    selector=new BrowserWindow(windowOptions({...display.bounds,frame:false,alwaysOnTop:true,skipTaskbar:true,resizable:false,movable:false,show:false}));
    selector.on('close',event=>{if(!quitting){event.preventDefault();endCapture();show()}});
    secure(selector,u=>localURL(u,'selector.html'));await selector.loadFile(path.join(__dirname,'selector.html'));selector.show();selector.focus();
  }catch(error){endCapture();show();status(error.message)}
}
function endCapture(){if(selector){selector.destroy();selector=null}shot=null;capturing=false;bubble?.show()}
async function quit(){const {response}=await dialog.showMessageBox(panel,{type:'question',buttons:['Seguir usando la lupa','Cerrar lupa'],defaultId:0,cancelId:0,message:'¿Cerrar la lupa de Windows?',detail:queue.length?'Hay capturas pendientes sin terminar. Se perderán esas imágenes; los análisis ya guardados se conservan.':'Los análisis y las frases candidatas guardadas se conservan.'});if(response===1){quitting=true;app.quit()}}
function handle(name,fn,kinds=['panel']){ipcMain.handle('lens:'+name,async(event,...args)=>{let ok=false;for(const kind of kinds){try{trusted(event,kind);ok=true;break}catch{}}if(!ok)throw Error('Origen no autorizado');try{return await fn(...args)}catch(error){status(error.message);throw error}})}
function installIPC(){
  handle('import',data=>{if(typeof data!=='string'||data.length>35000000||!/^data:image\/(png|jpeg|webp|bmp);base64,[A-Za-z0-9+/=]+$/.test(data))throw Error('Imagen inválida');enqueue(nativeImage.createFromDataURL(data),'Imagen arrastrada')});
  handle('capture',capture,['panel','bubble']);handle('paste',paste);handle('open',openFile);handle('hide',()=>panel.hide());handle('show',show,['bubble']);handle('quit',quit,['panel','bubble']);
  handle('settings',async value=>{if(value){const next=settings(value);if(next.watch&&!prefs.watch)lastClipboard=digest((await clipboardImage()).toPNG());prefs=next;fs.writeFileSync(prefsPath(),JSON.stringify(prefs));panel.setAlwaysOnTop(prefs.top)}return prefs});
  handle('ready',()=>{ready=true;delivered=false;dispatch();return {pending:queue.length}});
  handle('ack',id=>{if(queue[0]?.id!==id)throw Error('Captura pendiente distinta');queue.shift();delivered=false;dispatch()});
  handle('screen',()=>({image:shot.toDataURL(),size:shot.getSize()}),['selector']);
  handle('cancel',()=>{endCapture();show()},['selector']);
  handle('crop',rect=>{const image=shot.crop(cropRect(rect,shot.getSize()));endCapture();enqueue(image,'Recorte de pantalla')},['selector']);
  handle('ocr',async data=>{
    if(ocrBusy)throw Error('Hay un reconocimiento en curso');
    if(typeof data!=='string'||data.length>12000000||!/^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/.test(data))throw Error('Imagen OCR inválida');
    ocrBusy=true;try{
      if(!ocrWorker){const {createWorker}=require('tesseract.js');ocrWorker=await createWorker('jpn',1,{langPath:path.join(__dirname,'node_modules/@tesseract.js-data/jpn/4.0.0_best_int'),cachePath:app.getPath('userData'),logger:m=>{if(m.status==='recognizing text')status('Leyendo japonés localmente… '+Math.round(m.progress*100)+' %')}})}
      await ocrWorker.setParameters({tessedit_pageseg_mode:prefs.vertical?'5':'6'});
      const result=await ocrWorker.recognize(Buffer.from(data.split(',')[1],'base64'));return result.data.text.trim();
    }finally{ocrBusy=false}
  });
}
if(!app.requestSingleInstanceLock())app.quit();else{
  app.on('second-instance',()=>panel&&show());
  app.whenReady().then(async()=>{
    try{prefs=settings(JSON.parse(fs.readFileSync(prefsPath(),'utf8')))}catch{prefs=settings()}
    const ses=session.fromPartition('persist:japoteacher-lens');ses.setPermissionRequestHandler((_w,_p,cb)=>cb(false));ses.setPermissionCheckHandler(()=>false);
    installIPC();
    const area=screen.getPrimaryDisplay().workArea;
    panel=new BrowserWindow(windowOptions({width:490,height:Math.min(850,area.height),minWidth:390,minHeight:500,x:area.x+area.width-560,y:area.y,alwaysOnTop:prefs.top,title:'JapoTeacher · Lupa',autoHideMenuBar:true}));secure(panel,panelURL);
    panel.on('close',event=>{if(!quitting){event.preventDefault();panel.hide()}});
    panel.webContents.on('did-start-navigation',(_e,_u,inPlace,main)=>{if(main&&!inPlace){ready=false;delivered=false}});
    panel.webContents.on('did-fail-load',(_e,code)=>{if(code!==-3)dialog.showMessageBox(panel,{message:'No se pudo abrir la lupa. Comprueba la conexión y pulsa Reintentar desde el icono de la bandeja.',type:'error'})});
    bubble=new BrowserWindow(windowOptions({width:64,height:88,x:area.x+area.width-70,y:area.y+Math.round(area.height/2),frame:false,transparent:true,alwaysOnTop:true,skipTaskbar:true,resizable:false}));secure(bubble,u=>localURL(u,'bubble.html'));await bubble.loadFile(path.join(__dirname,'bubble.html'));
    bubble.on('close',event=>{if(!quitting){event.preventDefault();show()}});
    const icon=nativeImage.createFromPath(path.join(__dirname,'icon.png')).resize({width:32,height:32});
    tray=new Tray(icon);tray.setToolTip('JapoTeacher Lupa · Ctrl + Mayús + L');tray.setContextMenu(Menu.buildFromTemplate([{label:'Abrir resultados',click:show},{label:'Capturar zona · Ctrl+Mayús+L',click:capture},{label:'Pegar imagen · Ctrl+Mayús+V',click:()=>paste().catch(e=>status(e.message))},{label:'Reintentar conexión',click:()=>panel.loadURL(base+'desktop-lens.html')},{type:'separator'},{label:'Cerrar lupa…',click:quit}]));tray.on('click',show);
    const captureKey=globalShortcut.register('CommandOrControl+Shift+L',capture),pasteKey=globalShortcut.register('CommandOrControl+Shift+V',()=>paste().catch(e=>{show();status(e.message)}));
    panel.loadURL(base+'desktop-lens.html');
    if(!captureKey||!pasteKey)panel.webContents.once('did-finish-load',()=>status('Algún atajo está ocupado. Puedes usar los botones o la bandeja.'));
    if(prefs.watch)lastClipboard=digest((await clipboardImage()).toPNG());let readingClipboard=false;setInterval(async()=>{if(!prefs.watch||capturing||readingClipboard)return;readingClipboard=true;try{const image=await clipboardImage();if(!prefs.watch||capturing||image.isEmpty())return;const hash=digest(image.toPNG());if(hash!==lastClipboard){enqueue(image,'Captura automática del portapapeles');lastClipboard=hash}}catch(e){status(e.message)}finally{readingClipboard=false}},1000);
  }).catch(error=>{console.error(error);if(!testBase)dialog.showErrorBox('Lupa',error.message);quitting=true;app.quit()});
  app.on('before-quit',()=>{quitting=true;globalShortcut.unregisterAll();ocrWorker?.terminate()});
  app.on('window-all-closed',()=>{});
}
