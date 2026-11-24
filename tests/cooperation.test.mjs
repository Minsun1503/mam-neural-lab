import test from'node:test';import assert from'node:assert/strict';import{execFileSync}from'node:child_process';import fs from'node:fs';
import{MessageChannel}from'../cooperation/channel.mjs';import{observation}from'../cooperation/policy.mjs';
test('the channel is the only delivered information path and ablations alter deliveries',()=>{
 const c=new MessageChannel();c.send('A','nội dung "bí mật"');assert.equal(c.receive('B'),'nội dung "bí mật"');assert.equal(c.receive('A'),'');assert.equal(c.receive('B'),'');
 const muted=new MessageChannel('muted');muted.send('A','nội dung "bí mật"');assert.equal(muted.receive('B'),'');
 const scrambled=new MessageChannel('info-prefix-scramble');scrambled.send('A','mình gửi nội dung "bí mật"');assert.equal(scrambled.receive('B'),'mình đang chờ kết quả "bí mật"');
 const s={role:'writer',asked:true,inbox:'mình gửi nội dung "secret one"'};
 assert.deepEqual(observation(s),observation({...s,inbox:'mình gửi nội dung "a different secret"'}),'policy wording features must not encode secret payload contents');
});
test('frozen independent policies transfer actual file contents and depend on both wording and payload',()=>{
 execFileSync(process.execPath,['scripts/cooperation-experiment.mjs'],{cwd:new URL('../',import.meta.url),stdio:'pipe'});
 const report=JSON.parse(fs.readFileSync(new URL('../outputs/cooperation/report.json',import.meta.url)));
 assert.equal(report.summary.normal.passed,40);
 for(const mode of['muted','corrupted','semantic-scramble','info-prefix-scramble'])assert.equal(report.summary[mode].passed,0);
 for(const episode of report.results.filter(r=>r.mode==='normal')){
   assert.ok(episode.trace.some(t=>t.action==='verify'));
   assert.ok(episode.messages.some(m=>m.text.includes('"')));
 }
});
