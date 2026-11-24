import {ConditionedRNN} from './conditioned-rnn.mjs';
import {TurnMemory} from './turn-memory.mjs';
export class DialogueSession {
  constructor(checkpoint){
    this.agents={A:ConditionedRNN.restore(checkpoint),B:ConditionedRNN.restore(checkpoint)};
    this.turns=[];
    this.memory={A:new TurnMemory(),B:new TurnMemory()};
  }
  respond(agent,message){
    if(!this.agents[agent]||typeof message!=='string'||!message.trim()||message.length>2000)throw new Error('Invalid turn');
    const history=this.agents[agent].encoderMode!=='mean'?this.memory[agent].turns.map(t=>`${t.speaker==='self'?'mầm':'chủ'}: ${t.text}`).join('\n')+'\n':'';
    const prompt=history+`chủ: ${message.trim()}\nmầm:`,reply=this.agents[agent].reply(prompt);
    this.memory[agent].add('user',message);this.memory[agent].add('self',reply.text);
    this.turns.push({agent,input:message,prompt,...reply});this.turns=this.turns.slice(-100);
    return reply;
  }
  teach(agent,message,target,repeats=20){
    const model=this.agents[agent];if(!model||!target.trim())throw new Error('Invalid correction');
    if(model.encode(target).includes(0))throw new Error('Câu sửa có từ chưa có trong từ vựng; chưa thể dạy chính xác câu này.');
    const last=this.turns.findLast(turn=>turn.agent===agent&&turn.input===message);
    const prompt=last?.prompt??`chủ: ${message}\nmầm:`;
    for(let i=0;i<repeats;i++)model.train(prompt,target,.01);
  }
  serialize(){return {version:1,A:this.agents.A.serialize(),B:this.agents.B.serialize()};}
}
