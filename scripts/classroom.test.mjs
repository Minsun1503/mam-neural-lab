import test from 'node:test';
import assert from 'node:assert/strict';
import {Brain, INPUTS, OUTPUTS} from '../frontend/src/classroom/brain.mjs';
import {createWorld, observe, teacher, execute, achieved, evaluate, MAX_STEPS, GOALS} from '../frontend/src/classroom/world.mjs';
import {teachEpisode, certification, mastered} from '../frontend/src/classroom/mentor.mjs';

test('teacher completes every lesson on diverse initial states', () => {
  for (let seed = 1; seed <= 2000; seed++) {
    const w = createWorld(seed);
    while (!w.done) assert.equal(execute(w, teacher(w)).ok, true);
    assert.ok(achieved(w));
    assert.ok(w.steps <= MAX_STEPS);
  }
});

test('real neural updates improve unseen episodes without teacher during evaluation', () => {
  const brain = new Brain();
  const before = evaluate(brain);
  const weights = [...brain.w1];
  for (let seed = 1; seed <= 6000; seed++) teachEpisode(brain,seed);
  const after = evaluate(brain);
  assert.notDeepEqual([...brain.w1], weights);
  assert.ok(after.rate >= .99, JSON.stringify({before, after}));
  assert.ok(after.rate > before.rate + .5);
  for (const lesson of after.perGoal) assert.ok(lesson.passed / lesson.total >= .95);
  const certificate=certification(brain);
  assert.ok(certificate.mastered,JSON.stringify(certificate));
  assert.equal(certificate.total,3000);
  const checkpoint = JSON.stringify(brain.serialize());
  const restored = Brain.restore(JSON.parse(checkpoint));
  assert.deepEqual(restored.forward(observe(createWorld(119))), brain.forward(observe(createWorld(119))));
  const counters = brain.updates;
  evaluate(brain, 200000);
  assert.equal(brain.updates, counters, 'exam must not train');
  assert.equal(JSON.stringify(brain.serialize()), checkpoint, 'exam must not change weights');
  assert.throws(() => Brain.restore({...brain.serialize(), w1: [NaN]}));
  console.log(JSON.stringify({baseline:before.rate,validation:after.rate,blindExam:{passed:certificate.passed,total:certificate.total},modelBytes:brain.bytes,examples:brain.examples}));
});

test('operations enforce focus, selection, clipboard and exact saved bytes',()=>{
  const w=createWorld(47,18,{text:'Tiếng Việt ✓\nDòng 2 🐾'});
  w.modal=false;w.interruption=false;w.notes=true;w.active='browser';
  assert.equal(execute(w,11).ok,false,'cannot type into an unfocused application');
  execute(w,7);execute(w,9);execute(w,10);execute(w,11);execute(w,14);execute(w,16);
  w.text='discarded working buffer';
  assert.equal(execute(w,15).ok,true);
  assert.equal(w.text,w.expected);
  assert.equal(w.savedText,w.expected);
  assert.ok(achieved(w));
  const copy=createWorld(42,19);copy.modal=false;copy.interruption=false;
  while(!copy.done)assert.ok(execute(copy,teacher(copy)).ok);
  assert.equal(copy.clipboard,copy.expected);assert.equal(copy.savedText,copy.expected);
  assert.ok(copy.trace.some(s=>s.action==='select_all'));
  assert.ok(copy.trace.some(s=>s.action==='copy'));
  assert.ok(copy.trace.some(s=>s.action==='paste'));
  assert.ok(copy.trace.some(s=>s.action==='save_file'));
  const early=createWorld(11,18);early.modal=false;
  assert.equal(execute(early,6).ok,false,'finish cannot fabricate successful task');
});

test('new neuron dimensions and checkpoints preserve old learned subnetwork',()=>{
  const legacy={version:1,shape:[20,28,7],examples:31,w1:Array(560).fill(.1),b1:Array(28).fill(.2),w2:Array(196).fill(.3),b2:Array(7).fill(.4)};
  const upgraded=Brain.upgrade(legacy);
  assert.equal(INPUTS,64);assert.equal(OUTPUTS,20);assert.equal(upgraded.examples,31);
  for(let j=0;j<28;j++)for(let i=0;i<20;i++)assert.ok(Math.abs(upgraded.w1[j*INPUTS+i]-.1)<1e-7);
  assert.throws(()=>Brain.upgrade({...legacy,w1:[Infinity]}));
  assert.throws(()=>teachEpisode(upgraded,100000),'held-out scenes cannot become teaching labels');
  assert.equal(GOALS.length,20);
  assert.equal(mastered({rate:1,perGoal:GOALS.map(()=>({passed:1,total:1}))}),false,'tiny exams cannot certify mastery');
});
