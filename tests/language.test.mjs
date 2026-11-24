import test from 'node:test';
import assert from 'node:assert/strict';
import {LanguageRNN} from '../language/rnn.mjs';
test('recurrent language weights learn sequences and survive serialization',()=>{
  const text='A: chào\nB: chào bạn\n',model=new LanguageRNN([...text],12);
  const before=model.loss(text),initial=[...model.recurrent];
  for(let i=0;i<150;i++)model.train(text,.025);
  assert.ok(model.loss(text)<before*.8);
  assert.notDeepEqual([...model.recurrent],initial);
  const restored=LanguageRNN.restore(JSON.parse(JSON.stringify(model.serialize())));
  const frozen=JSON.stringify(restored.serialize());
  assert.equal(restored.generate('A:',40),model.generate('A:',40));
  assert.equal(JSON.stringify(restored.serialize()),frozen);
  assert.throws(()=>LanguageRNN.restore({...model.serialize(),output:[NaN]}));
});
