import json
from pathlib import Path
import tempfile
import unittest
from transfer import FILES, pack, restore, verify

class TransferTests(unittest.TestCase):
    def test_roundtrip_collision_and_tamper(self):
        with tempfile.TemporaryDirectory() as temporary:
            root=Path(temporary); source=root/'source'; source.mkdir()
            for name in FILES: (source/name).write_bytes(name.encode())
            (source/'progress.json').write_text(json.dumps({'status':'stopped-with-checkpoint'}))
            (source/'data-manifest.json').write_text('{}')
            (source/'private-correction.json').write_text('private')
            archive=root/'snapshot.zip';pack(source,archive)
            manifest,_=verify(archive)
            self.assertNotIn('private-correction.json',manifest['files'])
            target=root/'restored';restore(archive,target);restore(archive,target)
            for name in FILES:self.assertEqual((source/name).read_bytes(),(target/name).read_bytes())
            (target/'latest.pt').write_bytes(b'local work')
            (target/'best.pt').unlink()
            with self.assertRaisesRegex(ValueError,'local work'):restore(archive,target)
            self.assertFalse((target/'best.pt').exists())
            archive.write_bytes(archive.read_bytes()+b'changed')
            with self.assertRaisesRegex(ValueError,'checksum'):verify(archive)

if __name__=='__main__':unittest.main()
