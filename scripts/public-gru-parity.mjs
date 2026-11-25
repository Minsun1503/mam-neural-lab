import fs from'node:fs/promises';import assert from'node:assert/strict';import{PublicDialogueGRU}from'../language/public-gru.mjs';
const directory=process.argv[2]==='multiturn'?'public-language-multiturn':'public-language';
const root=new URL(`../outputs/${directory}/`,import.meta.url),model=new PublicDialogueGRU(JSON.parse(await fs.readFile(new URL('browser-model.json',root),'utf8'))),cases=JSON.parse(await fs.readFile(new URL('browser-reference.json',root),'utf8'));
let maximumError=0,compared=0;
for(const row of cases){const ids=model.tokenizer.encode(row.prompt).slice(-192);assert.deepEqual(ids,row.ids,`Tokenizer mismatch for ${row.prompt.slice(0,60)}`);assert.equal(model.tokenizer.decode(ids),row.decoded);
 if(row.first_logits){const encoded=model.encode(ids),step=model.decode(1,encoded.hidden,encoded.context);const error=Math.max(...row.first_logits.map((v,i)=>Math.abs(v-step.logits[i])));maximumError=Math.max(maximumError,error);assert.ok(error<.001,`Logit error ${error}`);const generated=model.reply(row.prompt,24);assert.equal(generated.text,row.generated);compared++;}}
const report={tokenizerCases:cases.length,inferenceCases:compared,maximumLogitError:maximumError,scope:'Numerical export fidelity only; not language quality'};await fs.writeFile(new URL('browser-parity.json',root),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
