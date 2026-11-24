import {dialogueCorpus} from './task-dialogues.mjs';
export function contextCorpus(){
 const base=dialogueCorpus();
 const contrasts=[
  {intent:'save',phrases:['hãy lưu tệp nhưng đừng sao chép','đừng sao chép, hãy lưu tệp','mình muốn lưu, không sao chép'],reply:'mình sẽ lưu tệp rồi đọc lại để kiểm tra.',must:['lưu'],forbid:['sẽ chọn']},
  {intent:'copy',phrases:['đừng lưu tệp, hãy sao chép','hãy sao chép nhưng đừng lưu','mình muốn sao chép, không lưu'],reply:'mình sẽ chọn văn bản rồi sao chép.',must:['sao chép'],forbid:['sẽ lưu']},
  {intent:'received',phrases:['mình đã gửi dữ liệu rồi, bạn đã nhận chưa','dữ liệu đã gửi, hãy xác nhận','mình vừa gửi nội dung cho bạn'],reply:'mình đã nhận nội dung và sẽ kiểm tra.',must:['đã nhận'],forbid:['cần bạn gửi']},
  {intent:'waiting',phrases:['mình chưa gửi dữ liệu, hãy chờ','dữ liệu chưa gửi, đừng làm vội','mình sẽ gửi sau, bạn chờ nhé'],reply:'mình sẽ chờ bạn gửi dữ liệu rồi mới làm.',must:['chờ'],forbid:['đã nhận']},
  {intent:'cancel',phrases:['dừng lại, đừng làm nữa','hãy hủy việc đang làm','không tiếp tục việc này nữa'],reply:'mình sẽ dừng và không thực hiện tiếp.',must:['dừng'],forbid:['sẽ lưu']},
 ];
 const train=[...base.train];
 for(const row of contrasts)for(const q of row.phrases)train.push({prompt:`chủ: ${q}?\nmầm:`,reply:row.reply,family:row.intent});
 // Teach responses to the latest question despite a contradictory prior turn.
 const single=[...train];
 for(let i=0;i<single.length;i++){
   const old=single[(i+17)%single.length],current=single[i];
   train.push({...current,prompt:`${old.prompt} ${old.reply}\n${current.prompt}`});
 }
 const prompts=[
 ['save','bạn hãy lưu tệp, đừng sao chép nhé'],['copy','bạn hãy sao chép, đừng lưu tệp nhé'],
 ['received','nội dung mình đã gửi rồi, bạn nhận chưa'],['waiting','mình chưa gửi nội dung, chờ nhé'],['cancel','dừng việc này lại nhé'],
 ];
 const tests=prompts.map(([intent,q])=>({prompt:`chủ: ${q}?\nmầm:`,...contrasts.find(c=>c.intent===intent)}));
 return {...base,train,contrastTests:tests};
}
