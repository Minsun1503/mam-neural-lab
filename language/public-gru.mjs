import {SubwordTokenizer} from './subword.mjs';
const sigmoid=x=>1/(1+Math.exp(-Math.max(-40,Math.min(40,x))));
function unpack(tensor){
  if(!Array.isArray(tensor.shape)||tensor.shape.some(n=>!Number.isInteger(n)||n<1)||tensor.shape.reduce((a,b)=>a*b,1)>10000000)throw new Error('Invalid tensor dimensions');
  const raw=Uint8Array.from(atob(tensor.data),c=>c.charCodeAt(0)),count=tensor.shape.reduce((a,b)=>a*b,1);
  if(raw.length!==count*4)throw new Error('Tensor length mismatch');
  const view=new DataView(raw.buffer),values=new Float32Array(count);for(let i=0;i<count;i++){values[i]=view.getFloat32(i*4,true);if(!Number.isFinite(values[i]))throw new Error('Invalid tensor value');}return values;
}
export class PublicDialogueGRU {
  constructor(bundle){
    if(bundle?.kind!=='mam-attention-gru'||bundle.version!==1)throw new Error('Unsupported model bundle');
    const {vocab,embedding,hidden}=bundle.config;
    if(![vocab,embedding,hidden].every(Number.isInteger)||vocab<16||vocab>8192||embedding<1||embedding>512||hidden<1||hidden>512)throw new Error('Unsupported network size');
    this.config=bundle.config;this.weights=Object.fromEntries(Object.entries(bundle.weights).map(([k,v])=>[k,unpack(v)]));
    this.tokenizer=new SubwordTokenizer(bundle.tokenizer);this.provenance=bundle.provenance;
    if(this.tokenizer.pieces.length!==vocab)throw new Error('Tokenizer/model mismatch');
    const shapes={'embedding.weight':[vocab,embedding],'output.weight':[vocab,hidden*4],'output.bias':[vocab]};
    for(const [prefix,size,suffix] of [['encoder',hidden,''],['encoder',hidden,'_reverse'],['decoder',hidden*2,'']]){
      shapes[`${prefix}.weight_ih_l0${suffix}`]=[size*3,embedding];shapes[`${prefix}.weight_hh_l0${suffix}`]=[size*3,size];shapes[`${prefix}.bias_ih_l0${suffix}`]=[size*3];shapes[`${prefix}.bias_hh_l0${suffix}`]=[size*3];
    }
    for(const [key,shape]of Object.entries(shapes))if(JSON.stringify(bundle.weights[key]?.shape)!==JSON.stringify(shape))throw new Error(`Invalid ${key}`);
  }
  embedding(id){const e=this.config.embedding;if(!Number.isInteger(id)||id<0||id>=this.config.vocab)throw new Error('Unknown token');return this.weights['embedding.weight'].subarray(id*e,(id+1)*e);}
  gru(input,previous,prefix,suffix=''){
    const n=previous.length,e=input.length,w=this.weights,wi=w[`${prefix}.weight_ih_l0${suffix}`],wh=w[`${prefix}.weight_hh_l0${suffix}`],bi=w[`${prefix}.bias_ih_l0${suffix}`],bh=w[`${prefix}.bias_hh_l0${suffix}`];
    const a=new Float64Array(n*3),b=new Float64Array(n*3),next=new Float32Array(n);
    for(let j=0;j<n*3;j++){a[j]=bi[j];b[j]=bh[j];for(let k=0;k<e;k++)a[j]+=wi[j*e+k]*input[k];for(let k=0;k<n;k++)b[j]+=wh[j*n+k]*previous[k];}
    for(let j=0;j<n;j++){const r=sigmoid(a[j]+b[j]),z=sigmoid(a[n+j]+b[n+j]),candidate=Math.tanh(a[2*n+j]+r*b[2*n+j]);next[j]=(1-z)*candidate+z*previous[j];}return next;
  }
  encode(ids){
    if(!ids.length)throw new Error('Empty source');const h=this.config.hidden,forward=[],backward=[];let f=new Float32Array(h),b=new Float32Array(h);
    for(let i=0;i<ids.length;i++){f=this.gru(this.embedding(ids[i]),f,'encoder');forward.push(f);}
    for(let i=ids.length-1;i>=0;i--){b=this.gru(this.embedding(ids[i]),b,'encoder','_reverse');backward[i]=b;}
    return {context:forward.map((state,i)=>Float32Array.from([...state,...backward[i]])),hidden:Float32Array.from([...f,...b])};
  }
  decode(token,hidden,context){
    const state=this.gru(this.embedding(token),hidden,'decoder'),scores=context.map(vector=>{let score=0;for(let i=0;i<state.length;i++)score+=state[i]*vector[i];return score/Math.sqrt(state.length);}),peak=Math.max(...scores),attention=scores.map(s=>Math.exp(s-peak)),sum=attention.reduce((a,b)=>a+b,0),weighted=new Float64Array(state.length);
    context.forEach((vector,t)=>{for(let i=0;i<vector.length;i++)weighted[i]+=vector[i]*attention[t]/sum;});
    const width=state.length*2,logits=new Float64Array(this.config.vocab),weights=this.weights['output.weight'],bias=this.weights['output.bias'];
    for(let v=0;v<logits.length;v++){let score=bias[v];for(let i=0;i<state.length;i++)score+=weights[v*width+i]*state[i]+weights[v*width+state.length+i]*weighted[i];logits[v]=score;}
    return {state,logits,attention:attention.map(a=>a/sum)};
  }
  reply(prompt,maximum=96){
    const ids=this.tokenizer.encode(prompt).slice(-192);if(!ids.length)throw new Error('Empty prompt');const encoded=this.encode(ids),tokens=[];let hidden=encoded.hidden,token=1;
    for(let i=0;i<maximum;i++){const result=this.decode(token,hidden,encoded.context);hidden=result.state;let best=0;for(let v=1;v<result.logits.length;v++)if(result.logits[v]>result.logits[best])best=v;token=best;if(token===2)break;tokens.push(token);}
    return {text:this.tokenizer.decode(tokens),tokens:tokens.length,maximumReached:tokens.length===maximum};
  }
}
