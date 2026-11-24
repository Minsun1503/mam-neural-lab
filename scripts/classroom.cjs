// Isolated Electron entry point; does not restart or modify the MCP companion.
const {app, BrowserWindow, ipcMain} = require('electron');
const path = require('node:path');
const fs = require('node:fs/promises');
const {createHash}=require('node:crypto');
app.setName('Mam Neural Lab');
app.setPath('userData', process.env.POKEMON_CLASSROOM_PROFILE || path.join(app.getPath('appData'), 'mam-neural-lab'));
app.whenReady().then(async () => {
  const window = new BrowserWindow({width: 1440, height: 960, minWidth: 1060, minHeight: 760,
    title: 'Mầm Lab • Phòng học nơ-ron', backgroundColor: '#0b111b', autoHideMenuBar: true,
    webPreferences: {nodeIntegration: false, contextIsolation: true, sandbox: true,preload:path.join(__dirname,'classroom-preload.cjs')}});
  ipcMain.handle('classroom:export',async(event,payload)=>{
    if(event.sender.id!==window.webContents.id)throw new Error('Unknown classroom sender');
    if(typeof payload!=='string'||payload.length>1024*1024)throw new Error('Invalid checkpoint payload');
    const data=JSON.parse(payload);
    const {Brain}=await import('../frontend/src/classroom/brain.mjs');
    Brain.restore(data.brain);
    const directory=path.join(__dirname,'../outputs/classroom');
    await fs.mkdir(directory,{recursive:true});
    const destination=path.join(directory,process.env.POKEMON_CLASSROOM_PROFILE?'test-user-brain.json':'user-brain.json');
    await fs.writeFile(destination+'.tmp',payload);
    await fs.rename(destination+'.tmp',destination);
    return destination;
  });
  ipcMain.handle('classroom:transfer-report',async(event,payload)=>{
    if(event.sender.id!==window.webContents.id||typeof payload!=='string'||payload.length>1024*1024)throw new Error('Invalid report request');
    const {Brain}=await import('../frontend/src/classroom/brain.mjs');
    const model=Brain.restore(JSON.parse(payload));
    let report;try{report=JSON.parse(await fs.readFile(path.join(__dirname,'../outputs/classroom/real-editor-transfer.json'),'utf8'));}catch{return null;}
    if(report.checkpointSHA!==createHash('sha256').update(JSON.stringify(model.serialize())).digest('hex'))return null;
    return {passed:report.passed,total:report.total,scope:'Trình soạn thảo độc lập · ô nhập, clipboard, cửa sổ và tệp thật'};
  });
  window.webContents.setWindowOpenHandler(() => ({action: 'deny'}));
  window.webContents.on('will-navigate', event => event.preventDefault());
  ipcMain.handle('dialogue:load',async event=>{
    if(event.sender.id!==window.webContents.id)throw new Error('Unknown sender');
    const directory=process.env.POKEMON_LANGUAGE_DIR||path.join(__dirname,'../outputs/language');
    try{return JSON.parse(await fs.readFile(path.join(directory,'dialogue-pair.json'),'utf8'));}
    catch(error){if(error.code!=='ENOENT')throw error;return JSON.parse(await fs.readFile(path.join(directory,'conditioned-model.json'),'utf8'));}
  });
  ipcMain.handle('dialogue:save',async(event,payload)=>{
    if(event.sender.id!==window.webContents.id||typeof payload!=='string'||payload.length>4*1024*1024)throw new Error('Invalid dialogue checkpoint');
    const data=JSON.parse(payload),{ConditionedRNN}=await import('../language/conditioned-rnn.mjs');
    ConditionedRNN.restore(data.A);ConditionedRNN.restore(data.B);
    const directory=process.env.POKEMON_LANGUAGE_DIR||path.join(__dirname,'../outputs/language');
    await fs.writeFile(path.join(directory,'dialogue-pair.json.tmp'),payload);
    await fs.rename(path.join(directory,'dialogue-pair.json.tmp'),path.join(directory,'dialogue-pair.json'));return true;
  });
  await window.loadFile(path.join(__dirname, process.argv.includes('--conversation')?'../frontend/src/classroom/conversation.html':'../frontend/src/classroom/index.html'));
});
app.on('window-all-closed', () => app.quit());
