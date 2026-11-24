const editor=document.getElementById('editor');
window.receipts={saved:0,opened:0,dismissed:0,pasted:0,researched:0};
document.getElementById('ask-teacher').onclick=()=>{window.receipts.researched++;document.getElementById('status').textContent='Đã yêu cầu hướng dẫn, chưa tự biết cách làm';};
document.getElementById('save-file').onclick=async()=>{
  try{await window.practiceFiles.save(editor.value);window.receipts.saved++;document.getElementById('status').textContent='Đã ghi tệp trên ổ đĩa';}
  catch(error){document.getElementById('status').textContent=error.message;}
};
document.getElementById('open-file').onclick=async()=>{
  try{editor.value=await window.practiceFiles.open();window.receipts.opened++;document.getElementById('status').textContent='Đã đọc tệp từ ổ đĩa';}
  catch(error){document.getElementById('status').textContent=error.message;}
};
document.getElementById('dismiss').onclick=()=>{document.getElementById('notice').close();window.receipts.dismissed++;};
editor.addEventListener('input',event=>{if(event.inputType==='insertFromPaste')window.receipts.pasted++;});
