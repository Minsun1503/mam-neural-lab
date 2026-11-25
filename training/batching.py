"""Length buckets reduce padding, without dropping or duplicating examples."""
def schedule(rows, batch_size, rng=None):
    if not isinstance(batch_size,int) or batch_size<1:
        raise ValueError('Positive batch size required')
    indices=list(range(len(rows)))
    if rng is not None:
        rng.shuffle(indices)
    batches=[]
    pool=batch_size*20
    for offset in range(0,len(indices),pool):
        block=sorted(indices[offset:offset+pool],key=lambda i:(len(rows[i][1]),len(rows[i][0])))
        batches.extend(block[i:i+batch_size]for i in range(0,len(block),batch_size))
    if rng is not None:
        rng.shuffle(batches)
    return batches
