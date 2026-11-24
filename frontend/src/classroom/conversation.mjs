import {DialogueSession} from '../../../language/dialogue-session.mjs';
const $=id=>document.getElementById(id);let session=null,stop=false,busy=false;
function status(text){$('status').textContent=text;}
function update(){for(const key of ['A','B'])$(key.toLowerCase()).textContent=`${session.agents[key].updates.toLocaleString('vi-VN')} cập nhật · ${session.agents[key].vocabulary.length} từ/ký hiệu`;
  for(const id of ['send','talk','teach','save'])$(id).disabled=busy||!session;}
function append(who,text,meta=''){const row=document.createElement('div');row.className='turn';const label=document.createElement('b');label.textContent=who;const content=document.createElement('span');content.textContent=text;row.append(label,content);if(meta){const m=document.createElement('small');m.textContent=meta;row.append(m);} $('messages').append(row);$('messages').scrollTop=$('messages').scrollHeight;}
function respond(who,text){const t=performance.now(),result=session.respond(who,text);append(`Mầm ${who}`,result.text,`${result.tokens} từ/ký hiệu · ${(performance.now()-t).toFixed(1)} ms · ${(result.unknownFraction*100).toFixed(0)}% từ đầu vào chưa biết`);update();return result.text;}
$('form').onsubmit=event=>{event.preventDefault();if(!session||busy)return;try{const message=$('message').value;append('Bạn',message);respond($('agent').value,message);status('Câu được sinh từ trọng số. Hãy kiểm tra nội dung, đặc biệt với câu ngoài chương trình.');}catch(error){status(error.message);}};
$('talk').onclick=async()=>{if(!session||busy)return;busy=true;stop=false;update();let message=$('message').value.trim()||'bạn cần dữ liệu gì';const recent=[];try{for(let i=0;i<6&&!stop;i++){message=respond(i%2?'B':'A',message);recent.push(message);if(recent.length>=3&&recent.slice(-3).every(text=>text===message)){status('Đã dừng vì hai cá thể đang lặp lại cùng câu. Chưa đạt đối thoại có tiến triển.');return;}await new Promise(resolve=>setTimeout(resolve,600));}status('Đã kết thúc trao đổi thử. Đối thoại này chưa chứng minh chúng phối hợp giải nhiệm vụ.');}catch(error){status(error.message);}finally{busy=false;update();}};
$('stop').onclick=()=>{stop=true;};
$('teach').onclick=()=>{try{session.teach($('agent').value,$('message').value,$('correction').value);update();status(`Đã cập nhật riêng Mầm ${$('agent').value}; chưa tự lưu.`);}catch(error){status(error.message);}};
$('save').onclick=async()=>{try{await window.classroomFiles.saveDialogue(JSON.stringify(session.serialize()));status('Đã lưu hai bộ trọng số riêng trên máy này.');}catch(error){status(error.message);}};
$('cooperate').onclick=async()=>{
  $('cooperate').disabled=true;const host=$('cooperation-result');host.textContent='Đang dạy và chạy các lượt kiểm chứng trên tệp thử nghiệm…';
  try{const report=await window.classroomFiles.runCooperation();host.replaceChildren();
    for(const [mode,result]of Object.entries(report.summary)){const p=document.createElement('p');p.textContent=`${mode}: ${result.passed}/${result.total}`;host.append(p);}
    const title=document.createElement('p');title.textContent='Nhật ký lượt đã chạy (câu do mạng sinh; phần nội dung trong ngoặc kép do adapter sao chép):';host.append(title);
    for(const item of report.results.find(r=>r.mode==='normal').messages){const p=document.createElement('p');p.textContent=`${item.from} → ${item.to}: ${item.text}`;host.append(p);}
  }catch(error){host.textContent=error.message;}finally{$('cooperate').disabled=false;}
};
try{const checkpoint=await window.classroomFiles.loadDialogue();session=new DialogueSession(checkpoint.A??checkpoint);if(checkpoint.B){const {ConditionedRNN}=await import('../../../language/conditioned-rnn.mjs');session.agents.B=ConditionedRNN.restore(checkpoint.B);}status('Đã nạp mô hình. Bạn có thể nhập câu hỏi mới hoặc cho hai cá thể trao đổi.');update();}catch(error){status(`Chưa nạp được: ${error.message}. Chạy npm run train:dialogue trước.`);$('send').disabled=true;}
