const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('classroomFiles',{
  export: payload=>ipcRenderer.invoke('classroom:export',payload),
  transferReport: payload=>ipcRenderer.invoke('classroom:transfer-report',payload),
});
