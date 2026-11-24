import fs from'node:fs/promises';import path from'node:path';import os from'node:os';
import{ConditionedRNN,tokenize}from'../language/conditioned-rnn.mjs';
import{trainPolicies,observation,ACTIONS,PHRASES}from'../cooperation/policy.mjs';import{MessageChannel}from'../cooperation/channel.mjs';
const agents=trainPolicies();
const frozenPolicies=JSON.stringify({A:agents.A.serialize(),B:agents.B.serialize()});
// Decoder learns to verbalize three action intents. Payload copying is an
// explicit tool binding, not a claim that this tiny generator learned copying.
const examples=[['yêu cầu dữ liệu',PHRASES.request[0]],['gửi dữ liệu',PHRASES.info[0]],['xác nhận xong',PHRASES.ack[0]]];
const vocabulary=examples.flatMap(e=>tokenize(e.join(' '))),language=new ConditionedRNN(vocabulary,32);
for(let epoch=0;epoch<600;epoch++)for(const [prompt,reply]of examples)language.train(prompt,reply,.025);
const decoders={A:ConditionedRNN.restore(language.serialize()),B:ConditionedRNN.restore(language.serialize())};
const directory=await fs.mkdtemp(path.join(os.tmpdir(),'mam-coop-'));
async function episode(seed,mode){
 const reader=seed%2?'A':'B',writer=reader==='A'?'B':'A',secret=`tài liệu thử nghiệm ${seed}: xanh đỏ ${seed*17}`;
 const source=path.join(directory,`${seed}-${mode}-source.txt`),destination=path.join(directory,`${seed}-${mode}-out.txt`);await fs.writeFile(source,secret);
 const state={A:{},B:{}};for(const id of['A','B'])state[id]={role:id===reader?'reader':'writer',asked:false,sent:false,buffer:'',written:false,verified:false,acked:false,inbox:'',finished:false};
 const channel=new MessageChannel(mode),trace=[];
 for(let step=0;step<30;step++)for(const id of[writer,reader]){
  const s=state[id];if(s.finished)continue;
  s.inbox=channel.receive(id);
  const action=agents[id].forward(observation(s)).action;trace.push({id,action:ACTIONS[action]??'invalid'});
  if(action===0){channel.send(id,decoders[id].reply('yêu cầu dữ liệu').text);s.asked=true;}
  if(action===1&&s.role==='reader'){const text=await fs.readFile(source,'utf8');channel.send(id,decoders[id].reply('gửi dữ liệu').text+` "${text}"`);s.sent=true;}
  if(action===2){s.buffer=s.inbox.match(/"([^"\n]+)"/)?.[1]??'';s.inbox='';}
  if(action===3&&s.role==='writer'&&s.buffer){await fs.writeFile(destination,s.buffer);s.written=true;}
  if(action===4&&s.written)s.verified=(await fs.readFile(destination,'utf8'))===s.buffer;
  if(action===5&&s.verified){channel.send(id,decoders[id].reply('xác nhận xong').text);s.acked=true;}
  if(action===6)s.finished=true;
  if(state.A.finished&&state.B.finished)break;
 }
 let actual=null;try{actual=await fs.readFile(destination,'utf8');}catch{}
 return {seed,mode,passed:actual===secret&&state[writer].verified&&state[reader].finished,trace,messages:channel.log};
}
const modes=['normal','muted','corrupted','semantic-scramble','info-prefix-scramble'];
const results=[];for(const mode of modes)for(let seed=100001;seed<100041;seed++)results.push(await episode(seed,mode));
if(JSON.stringify({A:agents.A.serialize(),B:agents.B.serialize()})!==frozenPolicies)throw new Error('Evaluation changed policy weights');
const summary=Object.fromEntries(modes.map(mode=>{const rows=results.filter(r=>r.mode===mode);return[mode,{passed:rows.filter(r=>r.passed).length,total:rows.length}];}));
const report={summary,generatedPhrases:examples.map(([intent])=>({intent,...language.reply(intent)})),results,
 scope:'Bounded neural tool/message protocol. Learner actions and Vietnamese intent wording are learned. Payload binding and quote parsing are explicit adapters. Not general dialogue or arbitrary collaboration.'};
await fs.mkdir(new URL('../outputs/cooperation/',import.meta.url),{recursive:true});
await fs.writeFile(new URL('../outputs/cooperation/report.json',import.meta.url),JSON.stringify(report,null,2));
await fs.writeFile(new URL('../outputs/cooperation/checkpoint.json',import.meta.url),JSON.stringify({A:{policy:agents.A.serialize(),language:decoders.A.serialize()},B:{policy:agents.B.serialize(),language:decoders.B.serialize()}}));
console.log(JSON.stringify({summary,generatedPhrases:report.generatedPhrases},null,2));
