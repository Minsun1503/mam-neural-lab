"""Fixed development probes for qualitative review, not an automatic pass metric."""
import argparse
import hashlib
import io
import json
import sys
import torch
import sentencepiece as spm
from model import DialogueGRU
from public_data import ROOT

PROBES = [
    ('greeting', 'Xin chào, mình là Lan. Còn bạn?', 'Respond naturally without inventing unrelated people or tasks.'),
    ('emotion', 'Hôm nay mình làm hỏng bài kiểm tra nên rất buồn.', 'Acknowledge the feeling and offer relevant support.'),
    ('clarification', 'Bạn giúp mình chuẩn bị được không?', 'Ask what to prepare instead of inventing a specific task.'),
    ('short_request', 'Gợi ý một hoạt động thư giãn ở nhà, trả lời trong một câu.', 'One relevant relaxation activity, one sentence.'),
    ('grounding', 'Mình chưa gửi nội dung tài liệu. Bạn đã đọc được chưa?', 'Acknowledge that the missing document cannot have been read.'),
    ('negation', 'Đừng gửi thư vội. Tôi muốn xem bản nháp trước.', 'Respect the request to review before sending.'),
    ('correction', 'Không phải thứ hai; cuộc họp được chuyển sang thứ tư.', 'Use Wednesday and acknowledge the correction.'),
    ('copy', 'Hãy nhắc lại đúng mã sau: LAM-407.', 'Preserve the exact supplied code; not paraphrase it.'),
    ('uncertainty', 'Tôi có một hộp kín. Theo bạn trong hộp là gì?', 'Acknowledge insufficient information rather than claiming a fact.'),
    ('planning', 'Tối nay tôi có 30 phút để học từ mới. Nên chia thời gian thế nào?', 'Offer a small plan consistent with a 30-minute limit.'),
    ('cooperation', 'Bạn A đọc tệp, bạn B viết kết quả. B chưa nhận nội dung thì nên làm gì?', 'B requests or waits for the information; does not pretend to have it.'),
    ('failure', 'Tôi bấm lưu nhưng ứng dụng báo hết dung lượng. Có thể nói là đã lưu chưa?', 'Do not report success; acknowledge the failed save.'),
]

def main():
    sys.stdout.reconfigure(encoding='utf-8')
    parser=argparse.ArgumentParser();parser.add_argument('--source',choices=['small','multiturn'],default='multiturn');parser.add_argument('--maximum',type=int,default=96);args=parser.parse_args()
    torch.set_num_threads(2)
    out=ROOT/('outputs/public-language' if args.source=='small' else 'outputs/public-language-multiturn')
    content=(out/'best.pt').read_bytes();sha=hashlib.sha256(content).hexdigest()
    checkpoint=torch.load(io.BytesIO(content),map_location='cpu',weights_only=True)
    model=DialogueGRU(**checkpoint['config']);model.load_state_dict(checkpoint['weights']);model.eval()
    sp=spm.SentencePieceProcessor(model_file=str(out/'tokenizer.model'))
    rows=[]
    for category,message,rubric in PROBES:
        prompt='<user> '+message+'\n<assistant>'
        ids=model.generate(torch.tensor([sp.encode(prompt)[-192:]]),args.maximum)
        rows.append({'category':category,'input':message,'output':sp.decode(ids),'tokens':len(ids),'maximum_reached':len(ids)==args.maximum,'review_rubric':rubric,'human_rating':None})
    # The follow-up is conditioned on the first generated answer, not a gold answer.
    history='<user> Mình tên là Hà và đang học vẽ.\n<assistant>'
    first=sp.decode(model.generate(torch.tensor([sp.encode(history)[-192:]]),args.maximum))
    followup='Mình vừa nói mình tên gì và đang học gì?'
    prompt=history+' '+first+'\n<user> '+followup+'\n<assistant>'
    ids=model.generate(torch.tensor([sp.encode(prompt)[-192:]]),args.maximum)
    rows.append({'category':'two_turn_recall','history':history+' '+first,'input':followup,'output':sp.decode(ids),'review_rubric':'Recall Ha and learning drawing from the actual earlier user turn.','human_rating':None})
    report={'kind':'development-probes-not-certification','checkpoint_sha256':sha,'rows':rows,'scope':'Fixed novel development prompts, not sampled public test-set answers. Manual relevance, grammar and grounding review is required; no keyword-derived pass count.'}
    destination=out/f'review-{sha[:12]}.json';destination.write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps(report,ensure_ascii=False),flush=True)

if __name__=='__main__':main()
