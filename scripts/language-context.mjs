import fs from 'node:fs/promises';
import {ConditionedRNN,tokenize}from'../language/conditioned-rnn.mjs';
import{contextCorpus}from'../language/context-curriculum.mjs';import{random}from'../frontend/src/classroom/brain.mjs';
const corpus=contextCorpus(),vocabulary=[...new Set(corpus.train.flatMap(r=>{const words=tokenize(r.prompt);return [...tokenize(r.prompt+' '+r.reply),...words.slice(1).map((w,i)=>`§${words[i]}|${w}`)];}))],model=new ConditionedRNN(vocabulary,64),rng=random(11);
model.encoderMode=process.argv[3]??'ngram';const epochs=Number(process.argv[2]??200);
for(let epoch=0;epoch<epochs;epoch++){
 const rows=[...corpus.train];for(let i=rows.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[rows[i],rows[j]]=[rows[j],rows[i]];}
 let loss=0;for(const row of rows)loss+=model.train(row.prompt,row.reply,.015);
 if(epoch%25===0)console.log(JSON.stringify({epoch,loss:loss/rows.length}));
}
const contrast=corpus.contrastTests.map(row=>{const reply=model.reply(row.prompt);return {prompt:row.prompt,...reply,passed:row.must.every(s=>reply.text.includes(s))&&row.forbid.every(s=>!reply.text.includes(s))};});
const basic=corpus.test.map(row=>{const reply=model.reply(row.prompt);return {prompt:row.prompt,...reply,passed:row.check.every(s=>reply.text.includes(s))};});
const report={mode:model.encoderMode,updates:model.updates,contrast,basic,scope:'Small synthetic contrast and multi-turn experiment; not open-ended language competence.'};
await fs.mkdir(new URL('../outputs/language/',import.meta.url),{recursive:true});
await fs.writeFile(new URL('../outputs/language/context-model.json',import.meta.url),JSON.stringify(model.serialize()));
await fs.writeFile(new URL('../outputs/language/context-report.json',import.meta.url),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
