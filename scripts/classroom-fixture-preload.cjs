const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('practiceFiles',{
  save:text=>ipcRenderer.invoke('practice:save',text),
  open:()=>ipcRenderer.invoke('practice:open'),
});
