import fs from 'node:fs/promises';
import {LanguageRNN} from '../language/rnn.mjs';
const corpus=JSON.parse(await fs.readFile(new URL('../language/teacher-seed.json',import.meta.url),'utf8'));
// The alphabet includes held-out characters, but no held-out target sequence
// is optimized. This is an explicit vocabulary assumption, not an open-vocabulary test.
const alphabet=[...new Set(Array.from([...corpus.train,...corpus.heldout].join('')))];
const model=new LanguageRNN(alphabet);
const loss=items=>items.reduce((sum,text)=>sum+model.loss(text),0)/items.length;
const before={train:loss(corpus.train),heldout:loss(corpus.heldout)};
for(let epoch=0;epoch<300;epoch++)for(const turn of corpus.train)model.train(turn);
const report={before,after:{train:loss(corpus.train),heldout:loss(corpus.heldout)},updates:model.steps,
  samples:['Chủ: Xin chào.\nMầm:','Chủ: Bạn đã kiểm tra chưa?\nMầm:','A: Bạn có dữ liệu chưa?\nB:'].map(prompt=>({prompt,generated:model.generate(prompt)})),
  status:'Experimental character prediction only; no claim of conversational competence or cooperation.'};
await fs.mkdir(new URL('../outputs/language/',import.meta.url),{recursive:true});
await fs.writeFile(new URL('../outputs/language/experiment.json',import.meta.url),JSON.stringify(report,null,2));
await fs.writeFile(new URL('../outputs/language/checkpoint.json',import.meta.url),JSON.stringify(model.serialize()));
console.log(JSON.stringify(report,null,2));
