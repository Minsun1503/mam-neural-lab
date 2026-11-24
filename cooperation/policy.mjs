import {Brain,random} from '../frontend/src/classroom/brain.mjs';
export const ACTIONS=['request','share','receive','write','verify','acknowledge','finish','wait'];
export const PHRASES={
 request:['hãy gửi cho mình nội dung cần xử lý','mình cần bạn gửi dữ liệu trước khi làm','bạn gửi nội dung cho mình nhé'],
 info:['mình gửi nội dung cho bạn','đây là dữ liệu bạn cần','mình đã đọc được nội dung sau'],
 ack:['mình đã lưu và kiểm tra xong','đã xác minh nội dung tệp','mình đã hoàn thành việc ghi tệp'],
 wait:['mình đang chờ kết quả','chưa có nội dung để gửi','mình chưa đọc xong dữ liệu'],
};
export function observation(state){
 const x=new Float32Array(64);
 [state.role==='reader',state.role==='writer',state.asked,state.sent,!!state.buffer,state.written,state.verified,state.acked,!!state.inbox,/"[^"\n]+"/.test(state.inbox??'')].forEach((v,i)=>x[i]=+v);
 const words=(state.inbox??'').replace(/"[^"\n]*"/g,' ').normalize('NFKD').replace(/\p{M}/gu,'').toLowerCase().match(/[a-z]+/g)??[];
 for(const word of words){let h=2166136261;for(const c of word)h=Math.imul(h^c.charCodeAt(0),16777619);x[12+(h>>>0)%52]+=1/Math.sqrt(Math.max(1,words.length));}
 return x;
}
function target(s,type){
 if(s.role==='reader'){if(type==='ack')return 6;if(type==='request'&&!s.sent)return 1;return 7;}
 if(!s.buffer){if(type==='info'&&/"[^"\n]+"/.test(s.inbox))return 2;return s.asked?7:0;}
 if(!s.written)return 3;if(!s.verified)return 4;if(!s.acked)return 5;return 6;
}
export function trainPolicies(seed=83,examples=10000){
 const agents={A:new Brain(seed),B:new Brain(seed+1)},rng=random(seed);
 for(let i=0;i<examples;i++){
  // Balance real reachable phases instead of mostly inconsistent random flags.
  const phase=i%8,s={role:'writer',asked:false,sent:false,buffer:'',written:false,verified:false,acked:false,inbox:''};
  let type='none';
  if(phase===1){s.role='reader';type='request';}
  if(phase===2){s.asked=true;type='info';}
  if(phase>=3&&phase<=6){s.asked=true;s.buffer='sample';s.written=phase>=4;s.verified=phase>=5;s.acked=phase>=6;}
  if(phase===6&&rng()<.5){s.role='reader';s.sent=true;s.buffer='';s.asked=false;s.written=false;s.verified=false;s.acked=false;type='ack';}
  if(phase===7){s.role=rng()<.5?'reader':'writer';s.asked=s.role==='writer';s.sent=s.role==='reader';type=rng()<.5?'none':s.sent?'request':'wait';}
  if(type!=='none'){const phrases=PHRASES[type];s.inbox=phrases[Math.floor(rng()*phrases.length)]+(type==='info'||rng()<.3?' "nội dung mẫu"':'');}
  const label=target(s,type);for(const brain of Object.values(agents))brain.learn(observation(s),label,.02);
 }
 return agents;
}
