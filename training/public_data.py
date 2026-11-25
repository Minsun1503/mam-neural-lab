"""Pinned public-language data, distinct conversation groups and no private logs."""
from __future__ import annotations
import hashlib
import json
import pathlib
import unicodedata
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parents[1]
DATASET = 'hoanghai2110/vietnamese-dataset'
REVISION = '11c6d8416b3da6b53dceddd50d559582928957b8'
SHA256 = '4c61425f72de442239ecb129e3aaec648aba35d8eba32eaea3f4fb836fcc956c'
SOURCES = {
    'small': (DATASET,REVISION,'hypermamba_data.jsonl',SHA256,4*1024*1024),
    'multiturn': ('5CD-AI/Vietnamese-Multi-turn-Chat-Alpaca','3a1bef5b6681fe78eeaa25a97c4da1a2a1145a9e','vi_chatalpaca_cleaned.json','0a2f893e6bf435f30415428681beb234f276c93653e8ff64e9b4ad013a165825',80*1024*1024),
}

def normalize(text):
    return unicodedata.normalize('NFC', text).strip()

def load_public(source='small'):
    dataset,revision,filename,expected,maximum=SOURCES[source]
    directory = ROOT / 'data/external' / ('vietnamese-dataset' if source=='small' else 'multiturn-alpaca')
    directory.mkdir(parents=True, exist_ok=True)
    file = directory / filename
    url = f'https://huggingface.co/datasets/{dataset}/resolve/{revision}/{filename}'
    if not file.exists():
        with urllib.request.urlopen(url, timeout=60) as response:
            content = response.read(maximum+1)
        if len(content)>maximum or hashlib.sha256(content).hexdigest() != expected:
            raise ValueError('Source checksum mismatch; no data installed')
        file.write_bytes(content)
    raw = file.read_bytes()
    if hashlib.sha256(raw).hexdigest() != expected:
        raise ValueError('Cached source checksum mismatch')
    unique = {}
    raw_rows = 0
    records=[json.loads(line) for line in raw.decode('utf-8-sig').splitlines() if line.strip()] if source=='small' else json.loads(raw.decode('utf-8-sig'))
    skipped_oversize=0
    for record in records:
        raw_rows += 1
        messages = record['messages'] if source=='small' else [{'role':{'human':'user','gpt':'assistant'}[m['from']],'content':m['value']}for m in record['conversations']]
        if any(len(m['content'])>10000 for m in messages):
            skipped_oversize+=1
            continue
        clean = []
        for message in messages:
            if message.get('role') not in ('user', 'assistant'):
                raise ValueError('Unexpected conversation role')
            content = normalize(message['content'])
            if not content or len(content) > 10000:
                raise ValueError('Empty or oversized conversation turn')
            clean.append({'role': message['role'], 'content': content})
        canonical = json.dumps(clean, ensure_ascii=False, sort_keys=True)
        unique[canonical] = clean
    conversations = list(unique.values())
    # Link conversations that contain the same user utterance, so repeated
    # questions and all their continuations stay on one side of the split.
    parent = list(range(len(conversations)))
    def find(i):
        while parent[i] != i:
            parent[i] = parent[parent[i]]
            i = parent[i]
        return i
    seen = {}
    for i, messages in enumerate(conversations):
        for turn in messages:
            if turn['role'] != 'user':
                continue
            key = normalize(turn['content']).casefold()
            if key in seen:
                parent[find(i)] = find(seen[key])
            else:
                seen[key] = i
    groups = {}
    for i, messages in enumerate(conversations):
        groups.setdefault(find(i), []).append(messages)
    splits = {'train': [], 'validation': [], 'test': []}
    for group in groups.values():
        signature = min(json.dumps(row, ensure_ascii=False, sort_keys=True) for row in group)
        bucket = int(hashlib.sha256(signature.encode()).hexdigest()[:8], 16) % 100
        split = 'train' if bucket < 80 else 'validation' if bucket < 90 else 'test'
        splits[split].extend(group)
    question_sets = {key: {normalize(t['content']).casefold() for c in value for t in c if t['role'] == 'user'} for key, value in splits.items()}
    for a, b in [('train','validation'), ('train','test'), ('validation','test')]:
        if question_sets[a] & question_sets[b]:
            raise AssertionError('Question leakage across dataset partitions')
    manifest = {'dataset': dataset, 'revision': revision, 'sha256': expected,
                'declared_license': 'Apache-2.0 (upstream dataset card)',
                'source_url': url, 'raw_rows': raw_rows, 'unique_dialogues': len(conversations),
                'groups': len(groups), 'skipped_oversize_dialogues':skipped_oversize,'dialogues_by_split': {k: len(v) for k,v in splits.items()},
                'exact_user_question_overlap': 0,
                'limitations': 'Public third-party authored/translated text; quality and factual correctness are not independently certified. No private user data.'}
    return splits, manifest

def pairs(conversations):
    result = []
    for dialogue in conversations:
        history = []
        for turn in dialogue:
            if turn['role'] == 'assistant' and history:
                prompt = ''.join(f"<{t['role']}> {t['content']}\n" for t in history[-4:]) + '<assistant>'
                result.append((prompt, turn['content']))
            history.append(turn)
    return result

if __name__ == '__main__':
    splits, manifest = load_public()
    print(json.dumps(manifest, ensure_ascii=True, indent=2))
