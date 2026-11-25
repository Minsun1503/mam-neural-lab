// Deterministic BPE for this project's trained SentencePiece identity model.
// Independent simple O(n²) merging; no third-party tokenizer runtime required.
export class SubwordTokenizer {
  constructor(data){
    if(data?.kind!=='mam-identity-bpe'||!Array.isArray(data.pieces)||data.pieces.length>8192)throw new Error('Unsupported tokenizer');
    this.pieces=data.pieces;this.byPiece=new Map(data.pieces.map((p,id)=>[p.piece,{...p,id}]));
    this.special=data.pieces.filter(p=>p.type===4).map(p=>p.piece).sort((a,b)=>b.length-a.length);
    if(data.pieces.some(p=>![1,2,3,4,6].includes(p.type)))throw new Error('Unsupported piece type');
  }
  encode(text){
    if(typeof text!=='string'||text.length>16000)throw new Error('Input too large');
    const normalized=text.replace(/ +/g,' ').replace(/^ | $/g,'');if(!normalized)return [];
    const source='▁'+normalized.replace(/ /g,'▁'),symbols=[];
    for(let i=0;i<source.length;){const special=this.special.find(s=>source.startsWith(s,i));const part=special??String.fromCodePoint(source.codePointAt(i));symbols.push({text:part,frozen:!!special});i+=part.length;}
    while(true){let best=-1,score=-Infinity;
      for(let i=0;i<symbols.length-1;i++){if(symbols[i].frozen||symbols[i+1].frozen)continue;const candidate=this.byPiece.get(symbols[i].text+symbols[i+1].text);if(candidate?.type===1&&candidate.score>score){score=candidate.score;best=i;}}
      if(best<0)break;symbols.splice(best,2,{text:symbols[best].text+symbols[best+1].text,frozen:false});
    }
    const ids=[];
    for(const symbol of symbols){const piece=this.byPiece.get(symbol.text);if(piece&&[1,4].includes(piece.type))ids.push(piece.id);else for(const byte of new TextEncoder().encode(symbol.text)){const id=this.byPiece.get(`<0x${byte.toString(16).toUpperCase().padStart(2,'0')}>`)?.id;if(id===undefined)throw new Error('Missing byte fallback');ids.push(id);}}
    return ids;
  }
  decode(ids){
    let text='',bytes=[];const flush=()=>{if(bytes.length){text+=new TextDecoder().decode(Uint8Array.from(bytes));bytes=[];}};
    for(const id of ids){const piece=this.pieces[id];if(!piece)throw new Error('Unknown token');if(piece.type===6){bytes.push(parseInt(piece.piece.slice(3,5),16));continue;}flush();if(piece.type===1||piece.type===4)text+=piece.piece;else if(piece.type===2)text+=' ⁇ ';}
    flush();return text.replace(/▁/g,' ').replace(/^ /,'');
  }
}
