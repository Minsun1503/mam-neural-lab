import fs from 'node:fs/promises';
import readline from 'node:readline/promises';
import {PublicDialogueGRU} from '../language/public-gru.mjs';

const file=new URL('../outputs/public-language-multiturn/browser-model.json',import.meta.url);
const model=new PublicDialogueGRU(JSON.parse(await fs.readFile(file,'utf8')));
console.log('Ứng viên nghiên cứu attention-GRU. Chưa đạt khả năng hội thoại; câu trả lời có thể sai hoặc lặp.');
const once=process.argv.slice(2).join(' ');
function reply(message){
  const result=model.reply(`<user> ${message}\n<assistant>`,96);
  console.log(result.text);
  if(result.maximumReached)console.log('[Đã chạm giới hạn 96 token; mô hình chưa tự kết thúc.]');
}
if(once)reply(once);
else{
  const input=readline.createInterface({input:process.stdin,output:process.stdout});
  try{while(true){const message=await input.question('Bạn (/exit để thoát): ');if(message.trim()==='/exit')break;if(message.trim())reply(message);}}
  finally{input.close();}
}
