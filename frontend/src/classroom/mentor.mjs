import {random} from './brain.mjs';
import {createWorld,observe,teacher,execute,GOALS,MAX_STEPS,evaluate,CURRICULUM_VERSION} from './world.mjs';

export const STANDARD = {overall:.99,eachLesson:.95,consecutive:3};
export function mastered(result) {
  return result.rate>=STANDARD.overall && result.perGoal.length===GOALS.length && result.perGoal.every(g=>g.total>=20 && g.passed/g.total>=STANDARD.eachLesson);
}
// Training scenes and validation/test partitions are disjoint. The teacher
// produces labels only here; evaluate performs pure student inference.
export function teachEpisode(brain,seed,goal=seed%GOALS.length) {
  if(seed<0||seed>=90000)throw new Error('Training seed outside training partition');
  const w=createWorld(seed,goal),samples=[];
  while(!w.done){
    const x=observe(w),target=teacher(w);
    samples.push({x,target});execute(w,target);
  }
  // Shuffle steps to reduce bias toward the common terminal action and keep
  // old and new task families interleaved throughout the curriculum.
  const rng=random(seed+19317);
  for(let i=samples.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[samples[i],samples[j]]=[samples[j],samples[i]];}
  for(const sample of samples)brain.learn(sample.x,sample.target,.025);
  return {samples:samples.length,steps:w.steps,errors:w.errors};
}
export function validation(brain) { return evaluate(brain,100000,400); }
export function certification(brain) {
  // Fresh, larger independent exam, never used as training labels.
  const suites=[300000,500000,700000].map(seed=>evaluate(brain,seed,1000,{text:`Nội dung chưa từng dạy — ${seed}\nKý hiệu: ✓ α β 🐾`}));
  return {suites,passed:suites.reduce((n,r)=>n+r.passed,0),total:suites.reduce((n,r)=>n+r.total,0),mastered:suites.every(mastered),
    scope:'20 structured basic-desktop lessons; synthetic environment only',stepLimit:MAX_STEPS,curriculumVersion:CURRICULUM_VERSION};
}
