import {PublicDialogueGRU} from '../../../language/public-gru.mjs';

const $=id=>document.getElementById(id);
let model,iterator,timer=null,history=[],finished=true;
const pause=()=>{clearTimeout(timer);timer=null;$('pause').disabled=true;$('play').disabled=finished;};
function controls(){for(const id of ['step','play'])$(id).disabled=finished;$('pause').disabled=timer===null;}
function show(row){
  $('answer').textContent=row.text||'(Token kết thúc; chưa có nội dung.)';$('count').textContent=row.step;
  $('chosen').textContent=row.piece;$('probability').textContent=(row.probability*100).toFixed(2)+'%';$('entropy').textContent=row.entropy.toFixed(2);
  const highest=Math.max(...row.attention,1e-8);
  $('source').replaceChildren(...row.source.map((token,index)=>{const span=document.createElement('span'),weight=row.attention[index];span.textContent=token.piece;span.style.backgroundColor=`rgba(82,149,219,${.08+.8*weight/highest})`;span.title=`Token ${index+1} · ${token.piece} · attention ${weight.toFixed(6)}`;return span;}));
  $('candidates').replaceChildren(...row.candidates.map(candidate=>{const div=document.createElement('div');div.className='candidate';const name=document.createElement('span');name.textContent=candidate.piece;const track=document.createElement('div');track.className='track';const bar=document.createElement('div');bar.className='bar';bar.style.width=(candidate.probability*100)+'%';track.append(bar);const value=document.createElement('small');value.textContent=(candidate.probability*100).toFixed(2)+'%';div.append(name,track,value);return div;}));
  $('hidden').replaceChildren(...row.hidden.map((value,index)=>{const cell=document.createElement('span');cell.style.backgroundColor=value>=0?`rgba(85,203,178,${.08+.92*Math.min(1,Math.abs(value))})`:`rgba(179,119,231,${.08+.92*Math.min(1,Math.abs(value))})`;cell.title=`h[${index}]=${value.toFixed(6)}`;return cell;}));
  for(const [index,button]of [...$('timeline').children].entries())button.setAttribute('aria-pressed',String(history[index]===row));
  $('status').textContent=`Đang xem bước ${row.step} / ${history.length} đã sinh. `+(row.ended?'Bước này chọn token kết thúc.':row.maximumReached?'Bước này chạm giới hạn 96 token.':'Có thể chọn lại một token đã sinh để xem trạng thái tại bước đó.');
}
function advance(){
  if(finished)return;const next=iterator.next();if(next.done){finished=true;pause();controls();return;}
  const row=next.value;history.push(row);const button=document.createElement('button');button.type='button';button.textContent=row.piece;button.title=`Xem lại bước ${row.step}`;button.addEventListener('click',()=>{pause();show(row);});$('timeline').append(button);show(row);
  if(row.ended||row.maximumReached){finished=true;pause();$('status').textContent=row.ended?'Mô hình đã chọn token kết thúc.':'Đã dừng ở giới hạn 96 token; mô hình chưa tự kết thúc.';}
  controls();
}
$('run').addEventListener('click',()=>{pause();try{const text=$('prompt').value.trim();if(!text)throw new Error('Hãy nhập một câu.');iterator=model.steps(`<user> ${text}\n<assistant>`,96);history=[];finished=false;$('timeline').replaceChildren();advance();}catch(error){finished=true;$('status').textContent=error.message;controls();}});
$('step').addEventListener('click',()=>{pause();advance();});
$('play').addEventListener('click',()=>{const tick=()=>{advance();if(!finished){timer=setTimeout(tick,220);controls();}};pause();tick();});
$('pause').addEventListener('click',pause);
try{model=new PublicDialogueGRU(await window.classroomFiles.loadResearch());$('hidden-title').textContent=`${model.config.hidden*2} giá trị đang thay đổi`;$('model').textContent=`${model.config.vocab} token · embedding ${model.config.embedding} · encoder ${model.config.hidden} × 2\nSHA-256: ${model.provenance.checkpoint_sha256}`;$('status').textContent='Đã nạp bản xuất cố định. Nhập câu rồi tạo lượt mới để quan sát.';$('run').disabled=false;}
catch(error){$('status').textContent='Chưa nạp được ứng viên. Chạy python training/transfer.py fetch rồi restore theo docs/HANDOFF.md. Chi tiết: '+error.message;}
