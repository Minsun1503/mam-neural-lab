// Learned word generation with prompt context injected at every recurrent step.
// Unlike a reply lookup, every output token is predicted from learned weights.
import {random} from '../frontend/src/classroom/brain.mjs';
export const tokenize=text=>text.normalize('NFC').toLowerCase().match(/[\p{L}\p{N}_]+|[^\s\p{L}\p{N}_]/gu)??[];
export const detokenize=tokens=>tokens.join(' ').replace(/\s+([.,!?;:])/g,'$1');
const matrices=['embedding','recurrent','context','output','bias'];
export class ConditionedRNN {
  constructor(vocabulary,hidden=40,seed=31){
    this.vocabulary=[...new Set(['<unk>','<start>','<end>',...vocabulary])];this.index=new Map(this.vocabulary.map((w,i)=>[w,i]));this.hidden=hidden;this.updates=0;this.encoderMode='mean';
    const rng=random(seed),v=this.vocabulary.length,h=hidden;
    for(const [key,size] of [['embedding',v*h],['recurrent',h*h],['context',h*h],['output',v*h]])this[key]=Float32Array.from({length:size},()=> (rng()-.5)*.25);
    this.bias=new Float32Array(v);
  }
  encode(text){return tokenize(text).map(w=>this.index.get(w)??0);}
  prompt(text){
    const ids=this.encode(text).slice(-96),h=this.hidden,vector=new Float32Array(h);
    if(this.encoderMode==='ngram'){
      const words=tokenize(text).slice(-96),entries=[];
      words.forEach((word,i)=>{
        const weight=Math.pow(.94,words.length-1-i);entries.push({id:this.index.get(word)??0,weight});
        if(i){const id=this.index.get(`§${words[i-1]}|${word}`);if(id!==undefined)entries.push({id,weight:weight*1.5});}
      });
      const sum=entries.reduce((a,e)=>a+e.weight,0)||1;
      for(const e of entries)for(let j=0;j<h;j++)vector[j]+=this.embedding[e.id*h+j]*e.weight/sum;
      return {ids:entries.map(e=>e.id),weights:entries.map(e=>e.weight/sum),vector};
    }
    if(this.encoderMode==='sequence'){
      const states=[];let previous=new Float32Array(h);
      for(const id of ids){const state=new Float32Array(h);for(let j=0;j<h;j++){let z=this.embedding[id*h+j];for(let k=0;k<h;k++)z+=this.recurrent[j*h+k]*previous[k];state[j]=Math.tanh(z);}states.push({previous,state});previous=state;}
      return {ids,states,vector:previous};
    }
    // Recency weights preserve the latest question while retaining recent turns.
    const weights=ids.map((_,i)=>Math.pow(.98,ids.length-1-i)),sum=weights.reduce((a,b)=>a+b,0)||1;
    ids.forEach((id,i)=>{for(let j=0;j<h;j++)vector[j]+=this.embedding[id*h+j]*weights[i]/sum;});
    return {ids,weights:weights.map(w=>w/sum),vector};
  }
  step(token,previous,context){
    const h=this.hidden,v=this.vocabulary.length,state=new Float32Array(h),p=new Float64Array(v);
    for(let j=0;j<h;j++){let z=this.embedding[token*h+j];for(let k=0;k<h;k++)z+=this.recurrent[j*h+k]*previous[k]+this.context[j*h+k]*context[k];state[j]=Math.tanh(z);}
    let max=-Infinity;for(let c=0;c<v;c++){let z=this.bias[c];for(let j=0;j<h;j++)z+=this.output[c*h+j]*state[j];if(this.vocabulary[c].startsWith('§'))z=-1e9;p[c]=z;max=Math.max(max,z);}
    let sum=0;for(let c=0;c<v;c++){p[c]=Math.exp(p[c]-max);sum+=p[c];}for(let c=0;c<v;c++)p[c]/=sum;
    return {state,p};
  }
  train(prompt,reply,rate=.025){
    const h=this.hidden,v=this.vocabulary.length,context=this.prompt(prompt),ids=[1,...this.encode(reply),2],cache=[];
    let previous=new Float32Array(h),loss=0;
    for(let t=0;t<ids.length-1;t++){const r=this.step(ids[t],previous,context.vector);cache.push({previous,...r});previous=r.state;loss-=Math.log(Math.max(r.p[ids[t+1]],1e-12));}
    const gradients=Object.fromEntries(matrices.map(k=>[k,new Float64Array(this[k].length)])),dc=new Float64Array(h);let next=new Float64Array(h);
    for(let t=cache.length-1;t>=0;t--){
      const {state,p,previous:old}=cache[t],dy=Float64Array.from(p),dz=new Float64Array(h);dy[ids[t+1]]--;
      for(let j=0;j<h;j++){let d=next[j];for(let c=0;c<v;c++)d+=this.output[c*h+j]*dy[c];dz[j]=d*(1-state[j]*state[j]);gradients.embedding[ids[t]*h+j]+=dz[j];
        for(let k=0;k<h;k++){gradients.recurrent[j*h+k]+=dz[j]*old[k];gradients.context[j*h+k]+=dz[j]*context.vector[k];dc[k]+=this.context[j*h+k]*dz[j];}}
      for(let c=0;c<v;c++){gradients.bias[c]+=dy[c];for(let j=0;j<h;j++)gradients.output[c*h+j]+=dy[c]*state[j];}
      next=new Float64Array(h);for(let k=0;k<h;k++)for(let j=0;j<h;j++)next[k]+=this.recurrent[j*h+k]*dz[j];
    }
    if(this.encoderMode==='sequence'){
      let next=dc;
      for(let t=context.ids.length-1;t>=0;t--){const {previous,state}=context.states[t],dz=new Float64Array(h);
        for(let j=0;j<h;j++){dz[j]=next[j]*(1-state[j]*state[j]);gradients.embedding[context.ids[t]*h+j]+=dz[j];for(let k=0;k<h;k++)gradients.recurrent[j*h+k]+=dz[j]*previous[k];}
        next=new Float64Array(h);for(let k=0;k<h;k++)for(let j=0;j<h;j++)next[k]+=this.recurrent[j*h+k]*dz[j];
      }
    }else context.ids.forEach((id,i)=>{for(let j=0;j<h;j++)gradients.embedding[id*h+j]+=dc[j]*context.weights[i];});
    for(const key of matrices)for(let i=0;i<this[key].length;i++)this[key][i]-=rate*Math.max(-3,Math.min(3,gradients[key][i]));
    this.updates++;return loss/(ids.length-1);
  }
  reply(prompt,maxTokens=48){
    const context=this.prompt(prompt),tokens=[];let state=new Float32Array(this.hidden),token=1;
    for(let t=0;t<maxTokens;t++){const r=this.step(token,state,context.vector);state=r.state;token=r.p.indexOf(Math.max(...r.p));if(token===2)break;tokens.push(this.vocabulary[token]);}
    const wordIds=this.encode(prompt).slice(-96);
    return {text:detokenize(tokens),unknownFraction:wordIds.filter(i=>i===0).length/Math.max(1,wordIds.length),tokens:tokens.length};
  }
  serialize(){return {version:1,kind:'conditioned-word-rnn',encoderMode:this.encoderMode,hidden:this.hidden,vocabulary:this.vocabulary,updates:this.updates,...Object.fromEntries(matrices.map(k=>[k,[...this[k]]]))};}
  static restore(data){
    if(data?.version!==1||data.kind!=='conditioned-word-rnn'||!Array.isArray(data.vocabulary)||data.vocabulary.length>4096||!Number.isInteger(data.hidden)||data.hidden<1||data.hidden>256)throw new Error('Invalid conditioned model');
    const model=new ConditionedRNN(data.vocabulary,data.hidden);
    for(const key of matrices){if(data[key]?.length!==model[key].length||!data[key].every(Number.isFinite))throw new Error('Invalid weights');model[key].set(data[key]);}
    if(data.encoderMode!==undefined&&!['mean','sequence','ngram'].includes(data.encoderMode))throw new Error('Invalid encoder mode');
    model.encoderMode=data.encoderMode??'mean';model.updates=data.updates;return model;
  }
}
