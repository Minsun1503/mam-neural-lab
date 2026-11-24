import fs from 'node:fs/promises';
import {ConditionedRNN,tokenize} from '../language/conditioned-rnn.mjs';
import {dialogueCorpus} from '../language/task-dialogues.mjs';
import {random} from '../frontend/src/classroom/brain.mjs';
const corpus=dialogueCorpus(),rng=random(3);
const vocabulary=[...new Set(corpus.train.flatMap(row=>tokenize(row.prompt+' '+row.reply)))];
const model=new ConditionedRNN(vocabulary,48),epochs=Number(process.argv[2]??250);
for(let epoch=0;epoch<epochs;epoch++){
 const rows=[...corpus.train];for(let i=rows.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[rows[i],rows[j]]=[rows[j],rows[i]];}
 let loss=0;for(const row of rows)loss+=model.train(row.prompt,row.reply);
 if(epoch%25===0)console.log(JSON.stringify({epoch,loss:loss/rows.length}));
}
const samples=corpus.test.map(row=>{const generated=model.reply(row.prompt);return {...row,...generated,passed:row.check.every(word=>generated.text.includes(word))};});
const report={updates:model.updates,passed:samples.filter(row=>row.passed).length,total:samples.length,samples,
 scope:'Eight bounded task-dialogue families; generated word tokens, no runtime reply lookup. Not open-ended Vietnamese conversation.'};
await fs.mkdir(new URL('../outputs/language/',import.meta.url),{recursive:true});
await fs.writeFile(new URL('../outputs/language/conditioned-model.json',import.meta.url),JSON.stringify(model.serialize()));
await fs.writeFile(new URL('../outputs/language/conditioned-report.json',import.meta.url),JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
