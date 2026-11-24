// Bounded explicit episode memory. Stores received text, never a partner's
// hidden state. It is an adapter memory, not a claim of neural long-context recall.
export class TurnMemory {
  constructor(limit=12){this.limit=limit;this.turns=[];}
  add(speaker,text){
    if(!['user','self','peer'].includes(speaker)||typeof text!=='string'||text.length>2000)throw new Error('Invalid memory turn');
    this.turns.push({speaker,text});this.turns=this.turns.slice(-this.limit);
  }
  context(current){return this.turns.map(t=>`${t.speaker}: ${t.text}`).join('\n')+`\nuser: ${current}\nself:`;}
  serialize(){return {version:1,limit:this.limit,turns:this.turns.map(t=>({...t}))};}
}
