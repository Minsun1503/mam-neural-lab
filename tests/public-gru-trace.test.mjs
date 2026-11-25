import test from 'node:test';
import assert from 'node:assert/strict';
import {PublicDialogueGRU} from '../language/public-gru.mjs';

function fixture(chosen){
  const vocab=16,embedding=2,hidden=2,weights={};
  const add=(name,shape)=>{const values=new Float32Array(shape.reduce((a,b)=>a*b,1));if(name==='output.bias')values[chosen]=3;weights[name]={shape,data:Buffer.from(values.buffer).toString('base64')};};
  add('embedding.weight',[vocab,embedding]);add('output.weight',[vocab,hidden*4]);add('output.bias',[vocab]);
  for(const [prefix,n,suffix]of [['encoder',hidden,''],['encoder',hidden,'_reverse'],['decoder',hidden*2,'']]){
    add(`${prefix}.weight_ih_l0${suffix}`,[n*3,embedding]);add(`${prefix}.weight_hh_l0${suffix}`,[n*3,n]);add(`${prefix}.bias_ih_l0${suffix}`,[n*3]);add(`${prefix}.bias_hh_l0${suffix}`,[n*3]);
  }
  const pieces=Array.from({length:vocab},(_,i)=>({piece:`p${i}`,score:0,type:1}));
  for(const [id,piece,type]of [[0,'<pad>',3],[1,'<s>',3],[2,'</s>',3],[3,'<unk>',2],[4,'▁a',1],[5,'▁',1],[6,'a',1]])pieces[id]={piece,score:1,type};
  return new PublicDialogueGRU({version:1,kind:'mam-attention-gru',config:{vocab,embedding,hidden},weights,tokenizer:{kind:'mam-identity-bpe',pieces},provenance:{}});
}
test('trace exposes the actual normalized decoder values, EOS and exact reply',()=>{
  const model=fixture(2),rows=[...model.steps('a',3)];assert.equal(rows.length,1);
  const row=rows[0];assert.equal(row.id,2);assert.equal(row.ended,true);assert.equal(row.text,'');assert.equal(row.tokens,0);assert.equal(row.maximumReached,false);
  assert.ok(Math.abs(row.probability-Math.exp(3)/(Math.exp(3)+15))<1e-8);
  assert.deepEqual(row.attention,[1]);assert.deepEqual(row.hidden,[0,0,0,0]);assert.equal(row.candidates[0].id,2);assert.ok(row.entropy>0&&row.entropy<4);
  assert.deepEqual(model.reply('a',3),{text:row.text,tokens:row.tokens,maximumReached:row.maximumReached});
  const bounded=fixture(4),sequence=[...bounded.steps('a',3)];assert.equal(sequence.length,3);assert.equal(sequence.at(-1).maximumReached,true);assert.equal(sequence.at(-1).ended,false);assert.equal(sequence.at(-1).text,bounded.reply('a',3).text);
  assert.throws(()=>[...bounded.steps('a',0)],/limit/);
});
