import json, sys, glob, itertools

def analyze(path):
    ids = {}
    naive = [0, 0, 0, 0]
    dedup = [0, 0, 0, 0]
    seen = set()
    usage_lines = 0
    with open(path, encoding='utf-8') as fh:
        for line in fh:
            line = line.strip()
            if not line:
                continue
            try:
                v = json.loads(line)
            except Exception:
                continue
            msg = v.get('message') or {}
            u = msg.get('usage')
            if not u:
                continue
            usage_lines += 1
            t = (u.get('input_tokens', 0), u.get('output_tokens', 0),
                 u.get('cache_read_input_tokens', 0), u.get('cache_creation_input_tokens', 0))
            for i in range(4):
                naive[i] += t[i]
            key = (msg.get('id'), v.get('requestId'))
            ids[key] = ids.get(key, 0) + 1
            if key in seen and key != (None, None):
                continue
            seen.add(key)
            for i in range(4):
                dedup[i] += t[i]
    return usage_lines, ids, naive, dedup

total_naive = [0]*4
total_dedup = [0]*4
files = glob.glob(sys.argv[1])
for f in files:
    usage_lines, ids, naive, dedup = analyze(f)
    dups = {k: c for k, c in ids.items() if c > 1}
    if dups:
        print(f'{f.split(chr(92))[-1]}: usage_lines={usage_lines} unique={len(ids)} dup_keys={len(dups)}')
    for i in range(4):
        total_naive[i] += naive[i]
        total_dedup[i] += dedup[i]
print('files:', len(files))
print('naive  (in,out,cache_read,cache_create):', total_naive, 'sum=', sum(total_naive))
print('dedup  (in,out,cache_read,cache_create):', total_dedup, 'sum=', sum(total_dedup))
if sum(total_dedup):
    print('inflation: %.2f%%' % ((sum(total_naive) - sum(total_dedup)) * 100.0 / sum(total_dedup)))
