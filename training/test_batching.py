import random
import unittest
from batching import schedule

class BatchTests(unittest.TestCase):
    def test_no_dropped_or_duplicated_pairs_and_less_padding(self):
        rng=random.Random(8)
        rows=[([1]*rng.randint(5,192),[2]*rng.randint(4,256))for _ in range(1003)]
        batches=schedule(rows,32,random.Random(117))
        self.assertEqual(sorted(i for batch in batches for i in batch),list(range(len(rows))))
        self.assertEqual(batches,schedule(rows,32,random.Random(117)))
        def work(groups):return sum(len(group)*max(len(rows[i][1])for i in group)for group in groups)
        naive=[list(range(i,min(i+32,len(rows))))for i in range(0,len(rows),32)]
        self.assertLess(work(batches),work(naive)*.7)
        self.assertTrue(all(1<=len(batch)<=32 for batch in batches))
        self.assertEqual(schedule([],32),[])
        with self.assertRaises(ValueError):schedule(rows,0)

if __name__=='__main__':unittest.main()
