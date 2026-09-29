#!/usr/bin/env python3
"""Sum Claude Code token usage from session transcripts (dedup by message id).
Usage: tools/claude_usage.py <session.jsonl>... [--since ISO8601]"""
import json, sys
args = sys.argv[1:]; since = None
if '--since' in args:
    i = args.index('--since'); since = args[i + 1]; del args[i:i + 2]
seen = {}
for f in args:
    for l in open(f):
        try: d = json.loads(l)
        except Exception: continue
        m = d.get('message') or {}
        if d.get('type') != 'assistant' or not m.get('usage'): continue
        if since and d.get('timestamp', '') < since: continue
        seen[m.get('id') or d.get('uuid')] = m['usage']
t = {k: sum((u.get(k) or 0) for u in seen.values()) for k in
     ('input_tokens', 'cache_creation_input_tokens', 'cache_read_input_tokens', 'output_tokens')}
print(json.dumps({'calls': len(seen), **t}))
