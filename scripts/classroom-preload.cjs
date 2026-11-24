const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('classroomFiles',{
  export: payload=>ipcRenderer.invoke('classroom:export',payload),
  transferReport: payload=>ipcRenderer.invoke('classroom:transfer-report',payload),
  loadDialogue:()=>ipcRenderer.invoke('dialogue:load'),
  saveDialogue:payload=>ipcRenderer.invoke('dialogue:save',payload),
});
