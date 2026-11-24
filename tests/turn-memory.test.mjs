import test from 'node:test';import assert from 'node:assert/strict';
import {TurnMemory} from '../language/turn-memory.mjs';
test('each agent retains only its own received transcript with bounded history',()=>{
 const a=new TurnMemory(2),b=new TurnMemory(2);
 a.add('peer','nội dung một');a.add('self','mình đã nhận');a.add('user','hãy kiểm tra');
 assert.equal(a.turns.length,2);assert.equal(b.turns.length,0);
 assert.ok(a.context('xong chưa').includes('mình đã nhận'));
 assert.ok(!a.context('xong chưa').includes('nội dung một'));
 const exported=a.serialize();exported.turns[0].text='tampered';assert.equal(a.turns[0].text,'mình đã nhận');
});
