from __future__ import annotations
import argparse
import json
import pathlib
import random
import time
import sys
import hashlib
import os
import torch
from torch import nn
import sentencepiece as spm
from model import DialogueGRU
from public_data import ROOT, load_public, pairs
from batching import schedule

def atomic_json(file, data):
    temporary = file.with_suffix('.tmp')
    temporary.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding='utf-8')
    os.replace(temporary, file)

def main():
    sys.stdout.reconfigure(encoding='utf-8')
    parser = argparse.ArgumentParser()
    parser.add_argument('--epochs', type=int, default=25)
    parser.add_argument('--batch', type=int, default=32)
    parser.add_argument('--threads', type=int, default=3)
    parser.add_argument('--resume', action='store_true')
    parser.add_argument('--source',choices=['small','multiturn'],default='small')
    parser.add_argument('--max-target',type=int,default=256)
    parser.add_argument('--output',type=pathlib.Path)
    parser.add_argument('--stop-after-batches',type=int,default=0)
    args = parser.parse_args()
    torch.set_num_threads(args.threads)
    torch.manual_seed(117)
    rng = random.Random(117)
    out = args.output or ROOT/('outputs/public-language' if args.source=='small' else 'outputs/public-language-multiturn')
    out.mkdir(parents=True, exist_ok=True)
    splits, manifest = load_public(args.source)
    data = {name: pairs(rows) for name, rows in splits.items()}
    if any(len(data[name]) < 20 for name in data):
        raise ValueError('A partition has insufficient examples')
    atomic_json(out/'data-manifest.json', manifest)
    tokenizer_prefix = out/'tokenizer'
    if not tokenizer_prefix.with_suffix('.model').exists():
        text = out/'tokenizer-train.txt'
        text.write_text('\n'.join(x for pair in data['train'] for x in pair), encoding='utf-8')
        spm.SentencePieceTrainer.train(input=str(text), model_prefix=str(tokenizer_prefix), vocab_size=1024,
            model_type='bpe', pad_id=0, bos_id=1, eos_id=2, unk_id=3,
            user_defined_symbols=['<user>','<assistant>'], byte_fallback=True,
            hard_vocab_limit=False, normalization_rule_name='identity', num_threads=args.threads)
    sp = spm.SentencePieceProcessor(model_file=str(tokenizer_prefix.with_suffix('.model')))
    tokenizer_sha=hashlib.sha256(tokenizer_prefix.with_suffix('.model').read_bytes()).hexdigest()
    if args.source=='multiturn':
        original_counts={name:len(rows)for name,rows in data.items()}
        data={name:[(p,r)for p,r in rows if len(sp.encode(r))<=args.max_target]for name,rows in data.items()}
        atomic_json(out/'length-filter.json',{'maximum_reply_tokens':args.max_target,'before':original_counts,'retained':{k:len(v)for k,v in data.items()},'policy':'Exclude overlong targets instead of inventing EOS in the middle of a sentence. Full objective remains open-ended conversation.'})
    target_limit=127 if args.source=='small' else args.max_target
    tokenized = {name: [(sp.encode(p)[-192:], [1]+sp.encode(r)[:target_limit]+[2]) for p,r in rows] for name,rows in data.items()}
    truncation={name:{'source_over_192':sum(len(sp.encode(p))>192 for p,r in rows),'reply_over_limit':sum(len(sp.encode(r))>target_limit for p,r in rows),'reply_limit':target_limit,'total':len(rows)}for name,rows in data.items()}
    atomic_json(out/'truncation.json',truncation)
    model = DialogueGRU(sp.vocab_size())
    optimizer = torch.optim.Adam(model.parameters(), lr=.001)
    start = 0
    history = []
    best = float('inf')
    resume_checkpoint=None
    seconds_offset=0
    if args.resume:
        checkpoint = torch.load(out/'latest.pt', map_location='cpu', weights_only=True)
        model.load_state_dict(checkpoint['weights'])
        optimizer.load_state_dict(checkpoint['optimizer'])
        start = checkpoint['epoch']
        history = checkpoint['history']
        best = min((row['validation_loss'] for row in history),default=float('inf'))
        if checkpoint['data_sha'] != manifest['sha256']:
            raise ValueError('Resume data checksum differs')
        if checkpoint.get('tokenizer_sha',tokenizer_sha)!=tokenizer_sha:
            raise ValueError('Resume tokenizer checksum differs')
        if checkpoint.get('target_limit',target_limit)!=target_limit:
            raise ValueError('Resume reply limit differs')
        if checkpoint.get('batch_size',args.batch)!=args.batch:
            raise ValueError('Resume batch size differs')
        if 'rng_state' in checkpoint:rng.setstate(checkpoint['rng_state'])
        seconds_offset=checkpoint.get('seconds',history[-1]['seconds']if history else 0)
        resume_checkpoint=checkpoint if checkpoint.get('batch_offset',0)>0 else None
    criterion = nn.CrossEntropyLoss(ignore_index=0, reduction='sum')
    def batches(rows, order=None):
        for indices in (order if order is not None else schedule(rows,args.batch)):
            items = [rows[i] for i in indices]
            source = torch.zeros(len(items),max(len(s) for s,_ in items),dtype=torch.long)
            target = torch.zeros(len(items),max(len(t) for _,t in items),dtype=torch.long)
            for i,(s,t) in enumerate(items):
                source[i,:len(s)] = torch.tensor(s)
                target[i,:len(t)] = torch.tensor(t)
            yield source,target
    def loss_on(rows):
        model.eval(); total=0.; count=0
        with torch.no_grad():
            for source,target in batches(rows):
                logits=model(source,target[:,:-1]);gold=target[:,1:]
                total+=criterion(logits.reshape(-1,sp.vocab_size()),gold.reshape(-1)).item()
                count+=gold.ne(0).sum().item()
        return total/count
    started=time.monotonic()
    steps_this_run=0
    def save_checkpoint(epoch,order,offset,total,count):
        checkpoint={'config':model.config,'weights':model.state_dict(),'optimizer':optimizer.state_dict(),
            'epoch':epoch,'history':history,'data_sha':manifest['sha256'],'tokenizer_sha':tokenizer_sha,'source':args.source,'target_limit':target_limit,
            'batch_order':order,'batch_offset':offset,'partial_loss':total,'partial_tokens':count,
            'rng_state':rng.getstate(),'batch_size':args.batch,'seconds':seconds_offset+time.monotonic()-started}
        torch.save(checkpoint,out/'latest.tmp');os.replace(out/'latest.tmp',out/'latest.pt')
    parameters=sum(p.numel() for p in model.parameters())
    for epoch in range(start,args.epochs):
        model.train(); total=0.; count=0
        if resume_checkpoint:
            order=resume_checkpoint['batch_order'];offset=resume_checkpoint['batch_offset']
            total=resume_checkpoint['partial_loss'];count=resume_checkpoint['partial_tokens'];resume_checkpoint=None
        else:order=schedule(tokenized['train'],args.batch,rng);offset=0
        for index,(source,target) in enumerate(batches(tokenized['train'],order[offset:]),start=offset+1):
            optimizer.zero_grad()
            logits=model(source,target[:,:-1]);gold=target[:,1:];n=gold.ne(0).sum()
            loss=criterion(logits.reshape(-1,sp.vocab_size()),gold.reshape(-1))
            (loss/n).backward();nn.utils.clip_grad_norm_(model.parameters(),1.0);optimizer.step()
            total+=loss.item();count+=n.item()
            steps_this_run+=1
            stop=(args.stop_after_batches>0 and steps_this_run>=args.stop_after_batches)or(out/'stop-request').exists()
            if index%50==0 or stop:
                save_checkpoint(epoch,order,index,total,count)
                status={'status':'stopped-with-checkpoint'if stop else'running','epoch':epoch+1,'batch':index,'batches':len(order),'history':history,'parameters':parameters,'seconds':seconds_offset+time.monotonic()-started}
                atomic_json(out/'progress.json',status)
                print(json.dumps({k:v for k,v in status.items()if k!='history'}),flush=True)
            if stop:return
        validation=loss_on(tokenized['validation'])
        row={'epoch':epoch+1,'train_loss':total/count,'validation_loss':validation,'seconds':seconds_offset+time.monotonic()-started}
        history.append(row)
        save_checkpoint(epoch+1,None,0,0.,0)
        if validation<best:
            best=validation;torch.save({'config':model.config,'weights':model.state_dict()},out/'best.tmp');os.replace(out/'best.tmp',out/'best.pt')
        atomic_json(out/'progress.json',{'status':'running','history':history,'parameters':sum(p.numel() for p in model.parameters())})
        print(json.dumps(row),flush=True)
    checkpoint=torch.load(out/'best.pt',map_location='cpu',weights_only=True);model.load_state_dict(checkpoint['weights'])
    prompts=['Xin chào, bạn tên gì?','Hôm nay tôi hơi buồn, bạn có thể nói chuyện với tôi không?',
        'Tôi muốn học tiếng Việt. Tôi nên bắt đầu thế nào?','Bạn có thể giúp tôi lên kế hoạch học tập không?']
    examples=[{'prompt':prompt,'generated':sp.decode(model.generate(torch.tensor([sp.encode('<user> '+prompt+'\n<assistant>')[-192:]])))} for prompt in prompts]
    heldout=[]
    for prompt,reference in data['test'][:12]:
        generated=sp.decode(model.generate(torch.tensor([sp.encode(prompt)[-192:]])))
        heldout.append({'prompt':prompt,'reference':reference,'generated':generated})
    report={'status':'trained-not-certified','history':history,'test_loss':loss_on(tokenized['test']),
        'examples':examples,'heldout_samples':heldout,'parameters':sum(p.numel() for p in model.parameters()),
        'splits':{k:len(v) for k,v in data.items()},'torch':torch.__version__,
        'scope':'From-scratch CPU language model. Loss and samples require relevance review; training completion is not conversational competence.'}
    atomic_json(out/'report.json',report);atomic_json(out/'progress.json',report)
    print(json.dumps({'status':report['status'],'test_loss':report['test_loss'],'examples':examples},ensure_ascii=False),flush=True)

if __name__=='__main__':main()
