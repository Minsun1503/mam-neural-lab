"""Optional integration check using the already downloaded small public data."""
import pathlib
import shutil
import subprocess
import sys
import tempfile
import torch
from public_data import ROOT

def main():
    temporary=pathlib.Path(tempfile.mkdtemp(prefix='mam-resume-'))
    for name in ['split','continuous']:
        directory=temporary/name;directory.mkdir()
        shutil.copy2(ROOT/'outputs/public-language/tokenizer.model',directory/'tokenizer.model')
    def run(name,steps,resume=False):
        command=[sys.executable,str(ROOT/'training/train_public.py'),'--epochs','1','--threads','1','--output',str(temporary/name),'--stop-after-batches',str(steps)]
        if resume:command.append('--resume')
        result=subprocess.run(command,cwd=ROOT,stdout=subprocess.PIPE,stderr=subprocess.PIPE,timeout=120)
        if result.returncode:raise RuntimeError(result.stderr.decode('utf-8',errors='replace')[-2000:])
    run('split',2);run('split',2,True);run('continuous',4)
    a=torch.load(temporary/'split/latest.pt',map_location='cpu',weights_only=True)
    b=torch.load(temporary/'continuous/latest.pt',map_location='cpu',weights_only=True)
    assert a['batch_offset']==b['batch_offset']==4
    assert a['partial_tokens']==b['partial_tokens']
    assert a['batch_order']==b['batch_order']
    for key in a['weights']:assert torch.equal(a['weights'][key],b['weights'][key]),key
    print('Resume preserved exact weights, pending batch order and token counts across interruption.')

if __name__=='__main__':main()
