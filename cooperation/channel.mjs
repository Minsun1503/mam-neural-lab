// The only cross-agent information path. No direct partner-state access.
export class MessageChannel{
 constructor(mode='normal'){this.mode=mode;this.queue={A:[],B:[]};this.log=[];}
 send(from,text){const to=from==='A'?'B':'A';let delivered=text;
  if(this.mode==='muted')delivered='';
  if(this.mode==='corrupted')delivered=text.replace(/"[^"\n]*"/g,'"nội dung đã bị đổi"');
  if(this.mode==='semantic-scramble')delivered='mình đang chờ kết quả '+(text.match(/"[^"\n]*"/)?.[0]??'');
  if(this.mode==='info-prefix-scramble'&&/"[^"\n]*"/.test(text))delivered='mình đang chờ kết quả '+text.match(/"[^"\n]*"/)[0];
  this.log.push({from,to,text,delivered});if(delivered)this.queue[to].push(delivered);
 }
 receive(id){return this.queue[id].shift()??'';}
}
