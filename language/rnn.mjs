// Character-level recurrent neural language experiment, trained from scratch.
// No reply templates are selected at inference. This does not imply comprehension.
import {random} from '../frontend/src/classroom/brain.mjs';
export class LanguageRNN {
  constructor(alphabet, hidden=32, seed=17) {
    this.alphabet=[...new Set(alphabet)];this.hidden=hidden;this.index=new Map(this.alphabet.map((c,i)=>[c,i]));
    const rng=random(seed),v=this.alphabet.length,h=hidden;
    this.embedding=Float64Array.from({length:v*h},()=> (rng()-.5)*.2);
    this.recurrent=Float64Array.from({length:h*h},()=> (rng()-.5)*.15);
    this.output=Float64Array.from({length:v*h},()=> (rng()-.5)*.2);
    this.bias=new Float64Array(v);this.steps=0;
  }
  step(token,previous) {
    const h=this.hidden,v=this.alphabet.length,state=new Float64Array(h),p=new Float64Array(v);
    for(let j=0;j<h;j++){let z=this.embedding[token*h+j];for(let k=0;k<h;k++)z+=this.recurrent[j*h+k]*previous[k];state[j]=Math.tanh(z);}
    let maximum=-Infinity;
    for(let c=0;c<v;c++){let z=this.bias[c];for(let j=0;j<h;j++)z+=this.output[c*h+j]*state[j];p[c]=z;maximum=Math.max(maximum,z);}
    let sum=0;for(let c=0;c<v;c++){p[c]=Math.exp(p[c]-maximum);sum+=p[c];}for(let c=0;c<v;c++)p[c]/=sum;
    return {state,p};
  }
  encode(text){return Array.from(text,c=>{const id=this.index.get(c);if(id===undefined)throw new Error(`Unknown character ${c}`);return id;});}
  train(text,rate=.02) {
    const ids=this.encode(text),h=this.hidden,v=this.alphabet.length;
    const cache=[];let previous=new Float64Array(h),loss=0;
    for(let t=0;t<ids.length-1;t++){const result=this.step(ids[t],previous);cache.push({previous,...result});loss-=Math.log(Math.max(1e-12,result.p[ids[t+1]]));previous=result.state;}
    const de=new Float64Array(this.embedding.length),dr=new Float64Array(this.recurrent.length),dout=new Float64Array(this.output.length),db=new Float64Array(v);
    let nextGradient=new Float64Array(h);
    for(let t=cache.length-1;t>=0;t--){
      const {state,p,previous:old}=cache[t],dy=Float64Array.from(p);dy[ids[t+1]]--;
      const dz=new Float64Array(h);
      for(let j=0;j<h;j++){let gradient=nextGradient[j];for(let c=0;c<v;c++)gradient+=this.output[c*h+j]*dy[c];dz[j]=gradient*(1-state[j]*state[j]);de[ids[t]*h+j]+=dz[j];for(let k=0;k<h;k++)dr[j*h+k]+=dz[j]*old[k];}
      for(let c=0;c<v;c++){db[c]+=dy[c];for(let j=0;j<h;j++)dout[c*h+j]+=dy[c]*state[j];}
      nextGradient=new Float64Array(h);for(let k=0;k<h;k++)for(let j=0;j<h;j++)nextGradient[k]+=this.recurrent[j*h+k]*dz[j];
    }
    for(const [weights,gradient] of [[this.embedding,de],[this.recurrent,dr],[this.output,dout],[this.bias,db]])for(let i=0;i<weights.length;i++)weights[i]-=rate*Math.max(-5,Math.min(5,gradient[i]));
    this.steps++;return loss/Math.max(1,ids.length-1);
  }
  loss(text){const ids=this.encode(text);let state=new Float64Array(this.hidden),loss=0;for(let t=0;t<ids.length-1;t++){const r=this.step(ids[t],state);state=r.state;loss-=Math.log(Math.max(1e-12,r.p[ids[t+1]]));}return loss/Math.max(1,ids.length-1);}
  generate(prompt,length=120,seed=19,temperature=.7){
    const rng=random(seed),ids=this.encode(prompt);if(!ids.length)throw new Error('Prompt required');
    let state=new Float64Array(this.hidden),result;
    for(const token of ids){result=this.step(token,state);state=result.state;}
    let generated='';
    for(let t=0;t<length;t++){
      const probabilities=Array.from(result.p,p=>Math.pow(p,1/temperature)),sum=probabilities.reduce((a,b)=>a+b,0);let pick=rng()*sum,index=probabilities.length-1;
      for(let i=0;i<probabilities.length;i++){pick-=probabilities[i];if(pick<=0){index=i;break;}}
      generated+=this.alphabet[index];result=this.step(index,state);state=result.state;
    }
    return generated;
  }
  serialize(){return {version:1,alphabet:this.alphabet,hidden:this.hidden,steps:this.steps,...Object.fromEntries(['embedding','recurrent','output','bias'].map(k=>[k,[...this[k]]]))};}
  static restore(data){
    if(data?.version!==1||!Array.isArray(data.alphabet)||data.alphabet.length<2||data.alphabet.length>512||!Number.isInteger(data.hidden)||data.hidden<1||data.hidden>256)throw new Error('Invalid language checkpoint');
    const model=new LanguageRNN(data.alphabet,data.hidden);
    for(const k of ['embedding','recurrent','output','bias']){if(data[k]?.length!==model[k].length||!data[k].every(Number.isFinite))throw new Error('Invalid weights');model[k].set(data[k]);}
    model.steps=data.steps;return model;
  }
}
