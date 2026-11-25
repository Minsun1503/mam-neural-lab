"""Export a locally trained model, plus exact CPU reference vectors for JS QA."""
import array
import base64
import hashlib
import json
import sys
import argparse
import torch
import sentencepiece as spm
from sentencepiece import sentencepiece_model_pb2
from model import DialogueGRU
from public_data import ROOT, load_public, pairs

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--source',choices=['small','multiturn'],default='small');args=parser.parse_args()
    torch.set_num_threads(2)
    out=ROOT/('outputs/public-language' if args.source=='small' else 'outputs/public-language-multiturn')
    checkpoint=torch.load(out/'best.pt',map_location='cpu',weights_only=True)
    model=DialogueGRU(**checkpoint['config']);model.load_state_dict(checkpoint['weights']);model.eval()
    proto=sentencepiece_model_pb2.ModelProto();proto.ParseFromString((out/'tokenizer.model').read_bytes())
    if proto.normalizer_spec.name!='identity' or proto.trainer_spec.model_type!=2:
        raise ValueError('Unsupported tokenizer configuration')
    pieces=[{'piece':p.piece,'score':p.score,'type':p.type}for p in proto.pieces]
    weights={}
    for key,tensor in checkpoint['weights'].items():
        values=array.array('f',tensor.flatten().tolist())
        if sys.byteorder!='little':values.byteswap()
        weights[key]={'shape':list(tensor.shape),'data':base64.b64encode(values.tobytes()).decode('ascii')}
    bundle={'version':1,'kind':'mam-attention-gru','config':model.config,'weights':weights,
        'tokenizer':{'kind':'mam-identity-bpe','pieces':pieces},
        'provenance':{'weights':'locally trained from random initialization',
        'checkpoint_sha256':hashlib.sha256((out/'best.pt').read_bytes()).hexdigest(),
        'tokenizer_sha256':hashlib.sha256((out/'tokenizer.model').read_bytes()).hexdigest(),
        'dataset':json.loads((out/'data-manifest.json').read_text(encoding='utf-8'))}}
    (out/'browser-model.json').write_text(json.dumps(bundle,separators=(',',':')),encoding='utf-8')
    sp=spm.SentencePieceProcessor(model_file=str(out/'tokenizer.model'))
    splits,_=load_public(args.source)
    prompts=[p for p,_ in pairs(splits['validation'])][:50]+['a  b',' a ','a\nb','a\tb','Xin chào 🐾!','<user> Xin chào\n<assistant>']
    cases=[]
    with torch.no_grad():
        for i,prompt in enumerate(prompts):
            ids=sp.encode(prompt)[-192:]
            row={'prompt':prompt,'ids':ids,'decoded':sp.decode(ids)}
            if i<4:
                source=torch.tensor([ids]);encoded,hidden,mask=model.encode(source)
                logits,_=model.decode(torch.tensor([[1]]),hidden,encoded,mask)
                row['first_logits']=logits[0,0].tolist()
                generated=model.generate(source,24)
                row['generated_ids']=generated
                row['generated']=sp.decode(generated)
            cases.append(row)
    (out/'browser-reference.json').write_text(json.dumps(cases,ensure_ascii=False),encoding='utf-8')
    print(json.dumps({'bytes':(out/'browser-model.json').stat().st_size,'reference_cases':len(cases)}))

if __name__=='__main__':main()
