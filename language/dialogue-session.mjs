import {ConditionedRNN} from './conditioned-rnn.mjs';
export class DialogueSession {
  constructor(checkpoint){
    this.agents={A:ConditionedRNN.restore(checkpoint),B:ConditionedRNN.restore(checkpoint)};
    this.turns=[];
  }
  respond(agent,message){
    if(!this.agents[agent]||typeof message!=='string'||!message.trim()||message.length>2000)throw new Error('Invalid turn');
    // Latest utterance is the current prompt. Conversation history is visible
    // but this first word model is not a long-context conversational memory.
    const prompt=`chủ: ${message.trim()}\nmầm:`,reply=this.agents[agent].reply(prompt);
    this.turns.push({agent,input:message,...reply});this.turns=this.turns.slice(-100);
    return reply;
  }
  teach(agent,message,target,repeats=20){
    const model=this.agents[agent];if(!model||!target.trim())throw new Error('Invalid correction');
    if(model.encode(target).includes(0))throw new Error('Câu sửa có từ chưa có trong từ vựng; chưa thể dạy chính xác câu này.');
    const prompt=`chủ: ${message}\nmầm:`;
    for(let i=0;i<repeats;i++)model.train(prompt,target,.01);
  }
  serialize(){return {version:1,A:this.agents.A.serialize(),B:this.agents.B.serialize()};}
}
