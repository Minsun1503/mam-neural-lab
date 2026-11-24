const {app,BrowserWindow,ipcMain,clipboard}=require('electron');
const path=require('node:path'),fs=require('node:fs/promises');
let notes=null,browser=null,manager=null,spec=null,receipts=null;
const root=process.env.POKEMON_TRANSFER_DIR;
if(!root||!path.isAbsolute(root))throw new Error('A dedicated temporary transfer directory is required');
app.setPath('userData',path.join(root,'profile'));
const allowed=['text/plain','text/html','text/rtf','image/png'];
let clipboardSafe=false,originalClipboard=null;
let lastClipboard=null;
async function windowFor(kind,text=''){
  let win=kind==='notes'?notes:browser;
  if(win&&!win.isDestroyed()){win.focus();return;}
  win=new BrowserWindow({width:850,height:620,title:kind==='notes'?'Notes · kiểm tra độc lập':'Browser · kiểm tra độc lập',autoHideMenuBar:true,
    webPreferences:{preload:path.join(__dirname,'classroom-fixture-preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true}});
  win.webContents.on('will-navigate',(event,url)=>{
    const allowedURL=require('node:url').pathToFileURL(path.join(__dirname,'classroom-browser.html')).href;
    if(url.split('?')[0]!==allowedURL)event.preventDefault();
  });win.webContents.setWindowOpenHandler(()=>({action:'deny'}));
  if(kind==='notes')notes=win;else browser=win;
  await win.loadFile(path.join(__dirname,'classroom-fixture.html'));
  win.setTitle(kind==='notes'?'Notes · kiểm tra độc lập':'Browser · kiểm tra độc lập');
  await win.webContents.executeJavaScript(`document.getElementById('editor').value=${JSON.stringify(text)}`);
  win.focus();
}
const live=win=>win&&!win.isDestroyed();
ipcMain.handle('practice:save',async(event,text)=>{
  if(!live(notes)||event.sender.id!==notes.webContents.id||typeof text!=='string'||text.length>10000)throw new Error('Invalid save');
  await fs.writeFile(spec.file,text,'utf8');return true;
});
ipcMain.handle('practice:open',async event=>{
  if(!live(notes)||event.sender.id!==notes.webContents.id)throw new Error('Invalid open');
  return fs.readFile(spec.file,'utf8');
});
globalThis.practice={
  clipboardSafe,
  async setup(next){
    for(const win of[notes,browser])if(live(win))win.destroy();notes=null;browser=null;
    await manager.webContents.executeJavaScript("window.receipts={saved:0,opened:0,dismissed:0,pasted:0,researched:0};if(document.getElementById('notice').open)document.getElementById('notice').close()");
    spec={...next,file:path.join(root,`exercise-${next.seed}.txt`)};
    receipts={closed:false,closedAfterSave:false,minimizedOnce:false,restored:false,copied:false};
    if(next.savedText!==null)await fs.writeFile(spec.file,next.savedText,'utf8');
    if(next.browser)await windowFor('browser');
    if(next.notes)await windowFor('notes',next.text);
    if(next.minimized&&live(notes))notes.minimize();
    else if(next.active==='browser'&&live(browser))browser.focus();
    if(next.goal===11){if(!clipboardSafe)throw new Error('Clipboard has unsupported formats; transfer must preserve it');clipboard.writeText(next.expected);lastClipboard=next.expected;}
    if(next.modal)await this.showDialog();
  },
  async showDialog(){const win=live(notes)&&!notes.isMinimized()?notes:live(browser)?browser:manager;await win.webContents.executeJavaScript("if(!document.getElementById('notice').open)document.getElementById('notice').showModal()");},
  async control(action){
    if(action===0)await windowFor('browser');
    if(action===1)await windowFor('notes',spec.text);
    if(action===2&&live(browser)){
      await browser.loadFile(path.join(__dirname,'classroom-browser.html'));
      await browser.webContents.executeJavaScript(`(()=>{const chats=${JSON.stringify(spec.chats)};const c=document.getElementById('content');for(const item of [...chats].reverse()){const a=document.createElement('a');a.href='classroom-browser.html?view=chat&age='+item.age+'&title='+encodeURIComponent(item.title);a.dataset.age=item.age;a.textContent=item.title+' · '+item.age+' phút trước';c.append(a);}})()`);
    }
    if(action===7&&live(notes))notes.focus();
    if(action===8&&live(browser))browser.focus();
    if(action===15)await windowFor('notes','');
    if(action===16&&live(notes)){let data=null;try{data=await fs.readFile(spec.file,'utf8');}catch{}receipts.closed=true;receipts.closedAfterSave=data===spec.expected;notes.close();}
    if(action===17&&live(notes)){notes.minimize();receipts.minimizedOnce=true;}
    if(action===18&&live(notes)){notes.restore();notes.focus();receipts.restored=true;}
  },
  markCopy(){if(!clipboardSafe)throw new Error('Unsupported clipboard format');lastClipboard=clipboard.readText();receipts.copied=true;},
  async snapshot(){
    let savedText=null;try{savedText=await fs.readFile(spec.file,'utf8');}catch{}
    const state={notes:!!live(notes),browser:!!live(browser),minimized:live(notes)?notes.isMinimized():false,
      active:live(notes)&&notes.isFocused()?'notes':live(browser)&&browser.isFocused()?'browser':'desktop',
      text:'',focus:'none',selected:false,clipboard:clipboardSafe?clipboard.readText().replace(/\r\n/g,'\n'):'',savedText,...receipts,modal:false,pasted:false,reopened:false,dismissed:false,researched:false,site:'home',chat:false,searched:false,file:spec.file};
    for(const win of[notes,browser,manager])if(live(win)){
      const view=await win.webContents.executeJavaScript(`(()=>{const e=document.getElementById('editor');return{text:e?.value??'',focus:e&&document.activeElement===e?'editor':'none',selected:!!e&&e.value.length>0&&e.selectionStart===0&&e.selectionEnd===e.value.length,modal:document.getElementById('notice').open,receipts:window.receipts}})()`);
      if(win===notes){state.text=view.text;state.focus=state.active==='notes'?view.focus:'none';state.selected=view.selected;state.pasted=view.receipts.pasted>0;state.reopened=view.receipts.opened>0;}
      state.modal ||= view.modal;state.dismissed ||= view.receipts.dismissed>0;
      state.researched ||= view.receipts.researched>0;
      if(win===browser){const url=new URL(win.webContents.getURL());const mode=url.searchParams.get('view');state.site=url.pathname.endsWith('classroom-browser.html')&&mode!=='results'?'claude':'home';state.chat=mode==='chat'&&Number(url.searchParams.get('age'))===Math.min(...spec.chats.map(c=>c.age));state.searched=mode==='results'&&url.searchParams.get('q')===spec.query;}
    }
    return state;
  },
  restoreClipboard(){if(originalClipboard&&lastClipboard!==null&&clipboard.readText()===lastClipboard)clipboard.write(originalClipboard);},
};
app.whenReady().then(async()=>{
  const formats=clipboard.availableFormats();
  clipboardSafe=formats.every(format=>allowed.includes(format));
  globalThis.practice.clipboardSafe=clipboardSafe;
  originalClipboard=clipboardSafe?{text:clipboard.readText(),html:clipboard.readHTML(),rtf:clipboard.readRTF(),image:clipboard.readImage()}:null;
  manager=new BrowserWindow({width:500,height:400,autoHideMenuBar:true,webPreferences:{preload:path.join(__dirname,'classroom-fixture-preload.cjs'),sandbox:true}});
  await manager.loadFile(path.join(__dirname,'classroom-fixture.html'));
});
app.on('will-quit',()=>globalThis.practice.restoreClipboard());
