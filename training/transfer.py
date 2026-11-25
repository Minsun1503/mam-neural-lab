"""Portable public-research snapshot. Uses only the Python standard library."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import zipfile

ROOT = Path(__file__).resolve().parents[1]
FILES = (
    'latest.pt', 'best.pt', 'tokenizer.model', 'tokenizer.vocab',
    'data-manifest.json', 'length-filter.json', 'truncation.json', 'progress.json',
    'browser-model.json', 'browser-reference.json', 'browser-parity.json',
)
DEFAULT = ROOT/'checkpoints/public-language-multiturn.zip'
MAX_BYTES = 64 * 1024 * 1024
RELEASE = ROOT/'checkpoints/release.json'

def digest(data):
    return hashlib.sha256(data).hexdigest()

def fetch_archive(archive):
    import urllib.request
    release = json.loads(RELEASE.read_text(encoding='utf-8'))
    expected = archive.with_suffix('.sha256').read_text(encoding='ascii').strip()
    if release.get('version') != 1 or release.get('sha256') != expected:
        raise ValueError('Release descriptor differs from pinned checksum')
    if archive.exists():
        if digest(archive.read_bytes()) != expected:
            raise ValueError('Existing archive differs; refusing to overwrite local work')
        return
    request = urllib.request.Request(release['url'], headers={'User-Agent':'mam-neural-lab'})
    with urllib.request.urlopen(request, timeout=60) as response:
        data = response.read(MAX_BYTES+1)
    if len(data) != release['bytes'] or len(data) > MAX_BYTES or digest(data) != expected:
        raise ValueError('Downloaded release checksum/size mismatch')
    archive.parent.mkdir(parents=True, exist_ok=True)
    temporary = archive.with_suffix('.tmp')
    temporary.write_bytes(data)
    os.replace(temporary, archive)

def pack(directory, archive):
    # An explicit allowlist prevents accidental publication of private classroom
    # corrections, browser logs, credentials, or the downloaded corpus.
    progress = json.loads((directory/'progress.json').read_text(encoding='utf-8'))
    if progress.get('status') not in ('stopped-with-checkpoint', 'trained-not-certified'):
        raise ValueError('Stop training at a checkpoint before creating a transfer snapshot')
    contents = {name: (directory/name).read_bytes() for name in FILES}
    if sum(map(len, contents.values())) > MAX_BYTES:
        raise ValueError('Snapshot exceeds size limit')
    manifest = {
        'version': 1, 'kind': 'mam-public-multiturn-research',
        'files': {name: {'bytes': len(data), 'sha256': digest(data)} for name, data in contents.items()},
        'scope': 'Public-data research weights, optimizer and tokenizer; not certified for conversation.',
        'data': json.loads(contents['data-manifest.json']),
    }
    archive.parent.mkdir(parents=True, exist_ok=True)
    temporary = archive.with_suffix('.tmp')
    with zipfile.ZipFile(temporary, 'w', compression=zipfile.ZIP_DEFLATED) as bundle:
        bundle.writestr('manifest.json', json.dumps(manifest, indent=2))
        for name, data in contents.items():
            bundle.writestr(name, data)
    os.replace(temporary, archive)
    archive.with_suffix('.sha256').write_text(digest(archive.read_bytes())+'\n', encoding='ascii')
    return manifest

def verify(archive):
    expected = archive.with_suffix('.sha256').read_text(encoding='ascii').strip()
    if digest(archive.read_bytes()) != expected:
        raise ValueError('Archive checksum mismatch')
    with zipfile.ZipFile(archive) as bundle:
        members = bundle.infolist()
        if len(members) != len(FILES)+1 or {m.filename for m in members} != set(FILES)|{'manifest.json'}:
            raise ValueError('Unexpected or duplicate archive members')
        if sum(m.file_size for m in members) > MAX_BYTES:
            raise ValueError('Expanded snapshot exceeds size limit')
        manifest = json.loads(bundle.read('manifest.json'))
        if manifest.get('version') != 1 or manifest.get('kind') != 'mam-public-multiturn-research' or set(manifest.get('files', {})) != set(FILES):
            raise ValueError('Invalid snapshot manifest')
        contents = {name: bundle.read(name) for name in FILES}
        for name, data in contents.items():
            if manifest['files'][name] != {'bytes': len(data), 'sha256': digest(data)}:
                raise ValueError('File checksum mismatch: '+name)
    return manifest, contents

def restore(archive, directory):
    manifest, contents = verify(archive)
    directory.mkdir(parents=True, exist_ok=True)
    # Check every collision before writing anything; never overwrite local work.
    for name, data in contents.items():
        target = directory/name
        if target.is_symlink() or (target.exists() and target.read_bytes() != data):
            raise ValueError('Restore destination has different local work: '+name)
    for name, data in contents.items():
        target = directory/name
        if not target.exists():
            with target.open('xb') as stream:
                stream.write(data)
    return manifest

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('action', choices=['pack','verify','restore','fetch'])
    parser.add_argument('--archive', type=Path, default=DEFAULT)
    parser.add_argument('--directory', type=Path, default=ROOT/'outputs/public-language-multiturn')
    args = parser.parse_args()
    if args.action == 'fetch':
        fetch_archive(args.archive)
        result, _ = verify(args.archive)
    elif args.action == 'pack': result = pack(args.directory, args.archive)
    elif args.action == 'restore': result = restore(args.archive, args.directory)
    else: result, _ = verify(args.archive)
    print(json.dumps({'action': args.action, 'verified_files': len(result['files']), 'archive': str(args.archive)}))

if __name__ == '__main__': main()
