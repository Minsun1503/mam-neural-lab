import fs from 'node:fs/promises';
import {Brain} from '../frontend/src/classroom/brain.mjs';
import {teachEpisode,validation,certification,mastered} from '../frontend/src/classroom/mentor.mjs';
import {GOALS,evaluate} from '../frontend/src/classroom/world.mjs';

const brain=new Brain();
const baseline=validation(brain),sessions=[];
let streak=0,certificate=null;
for(let seed=1;seed<=20000;seed++){
  teachEpisode(brain,seed);
  if(seed%500!==0)continue;
  const result=validation(brain);
  streak=mastered(result)&&seed>=6000?streak+1:0;
  sessions.push({episodes:seed,updates:brain.updates,passed:result.passed,total:result.total,perGoal:result.perGoal,streak});
  console.log(JSON.stringify(sessions.at(-1)));
  if(streak>=3){certificate=certification(brain);if(certificate.mastered)break;streak=0;}
}
if(!certificate?.mastered)throw new Error('Basic desktop standard not reached. No success checkpoint certified.');
const checkpoint=brain.serialize(),restored=Brain.restore(JSON.parse(JSON.stringify(checkpoint)));
const afterReload=evaluate(restored,900000,1000,{text:'Tệp kiểm tra sau khi nạp lại ✓\nKhông dùng làm bài mẫu.'});
if(!mastered(afterReload))throw new Error('Reloaded brain failed independent retention exam');
const report={scope:'Structured basic computer operations in synthetic desktop; not arbitrary real applications',
  lessons:GOALS,baseline,sessions,certificate,afterReload,modelBytes:brain.bytes,checkpointVersion:2};
await fs.mkdir(new URL('../outputs/classroom/',import.meta.url),{recursive:true});
await fs.writeFile(new URL('../outputs/classroom/trained-brain.json',import.meta.url),JSON.stringify(checkpoint));
await fs.writeFile(new URL('../outputs/classroom/basic-desktop-training.json',import.meta.url),JSON.stringify(report,null,2));
console.log(JSON.stringify({passed:certificate.passed,total:certificate.total,afterReload:afterReload.passed,modelBytes:brain.bytes,updates:brain.updates}));
