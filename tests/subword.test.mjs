import test from'node:test';import assert from'node:assert/strict';import{SubwordTokenizer}from'../language/subword.mjs';
test('identity BPE merges by score, preserves special tokens and roundtrips byte fallbacks',()=>{
 const pieces=[{piece:'<pad>',score:0,type:3},{piece:'<s>',score:0,type:3},{piece:'</s>',score:0,type:3},{piece:'<unk>',score:0,type:2},{piece:'<user>',score:0,type:4},
 ...Array.from({length:256},(_,i)=>({piece:`<0x${i.toString(16).toUpperCase().padStart(2,'0')}>`,score:0,type:6})),
 ...['▁','a','b','▁a','ab','▁ab'].map((piece,i)=>({piece,score:-i,type:1}))];
 const tokenizer=new SubwordTokenizer({kind:'mam-identity-bpe',pieces});
 const ids=tokenizer.encode('ab');assert.equal(ids.length,1);assert.equal(pieces[ids[0]].piece,'▁ab');
 for(const text of['Xin chào 🐾!','a\nb','a\tb','<user> ab'])assert.equal(tokenizer.decode(tokenizer.encode(text)),text);
 assert.equal(tokenizer.decode(tokenizer.encode(' a  b ')),'a b');
 assert.deepEqual(tokenizer.encode('   '),[]);
 assert.throws(()=>tokenizer.encode('x'.repeat(16001)));
});
