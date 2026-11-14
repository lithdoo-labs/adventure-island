#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""t083_fsdb_manifest.py — deterministic manifest for the 13-map FSDB
Foothold/Rope/Seat dataset backing EV-63 (t083 F1 fix).

Reproducibility contract:
  * Input  : content/[FSDB]adventure/[group]map.{Foothold,Rope,Seat}/map.<id>.jsonl
             restricted to the 13-map stage allowlist (TARGETED-FORENSICS-RESULT.md).
  * Sorting: files sorted by (group, map_id) — group order Foothold < Rope < Seat
             (fixed literal order), map ids ascending numerically.
  * Encoding of manifest: UTF-8, LF line endings, trailing newline.
  * Per file: relative path (forward slashes), byte size, SHA-256 (raw bytes),
             record count (one JSON object per non-empty line).
  * Type-level census: Foothold total + per-map; Rope ladder(l=1)/rope(l=0);
             Seat total + per-map.
  * Dataset identity: sha256 of the manifest text itself (final line, excluded
             from the hashed content — the hash is computed over the manifest
             body before the identity line is appended).

Fail-closed: an allowlist map without a Rope/Seat file is legal (that map has
no ropes/seats); a Rope/Seat file for a map OUTSIDE the allowlist is an error;
any parse failure is an error.
"""
import hashlib
import json
import os
import sys

REPO = os.environ.get('RE_VALIDATE_ROOT') or os.path.dirname(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

ALLOWLIST = [
    '222000000', '222000001',
    '230000000', '230000001', '230000002', '230000003',
    '230020000', '230020100', '230020200', '230020300',
    '230030000', '230030100', '230030200',
]
GROUPS = ['map.Foothold', 'map.Rope', 'map.Seat']


def main() -> int:
    if sys.stdout.encoding and sys.stdout.encoding.lower() not in ('utf-8', 'utf8'):
        import io
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

    errors = []
    lines = []
    lines.append('# T083 FSDB MANIFEST — 13-map Foothold/Rope/Seat dataset (EV-63 source)')
    lines.append('# generator: research/scripts/t083_fsdb_manifest.py')
    lines.append('# sorting: (group Foothold<Rope<Seat, map_id ascending); encoding UTF-8; LF; trailing newline')
    lines.append('# per-file record: relpath,bytes,sha256,records')
    lines.append('')

    per_group_files = {g: [] for g in GROUPS}
    census = {}

    for group in GROUPS:
        gdir = os.path.join(REPO, 'content', '[FSDB]adventure', '[group]' + group)
        if not os.path.isdir(gdir):
            errors.append(f'missing group dir {group}')
            continue
        for fname in sorted(os.listdir(gdir)):
            if not fname.startswith('map.') or not fname.endswith('.jsonl'):
                continue
            map_id = fname[len('map.'):-len('.jsonl')]
            if map_id not in ALLOWLIST:
                errors.append(f'{group}/{fname}: map {map_id} outside 13-map allowlist')
                continue
            path = os.path.join(gdir, fname)
            raw = open(path, 'rb').read()
            sha = hashlib.sha256(raw).hexdigest()
            records = 0
            l_counts = {'l=1 (ladder)': 0, 'l=0 (rope)': 0}
            for ln in raw.decode('utf-8').splitlines():
                if not ln.strip():
                    continue
                rec = json.loads(ln)
                records += 1
                if group == 'map.Rope':
                    if rec.get('l') == 1:
                        l_counts['l=1 (ladder)'] += 1
                    elif rec.get('l') == 0:
                        l_counts['l=0 (rope)'] += 1
                    else:
                        errors.append(f'{group}/{fname}: rope record without l field: {ln[:60]}')
            rel = f'content/[FSDB]adventure/[group]{group}/{fname}'
            per_group_files[group].append((map_id, rel, len(raw), sha, records, l_counts))

        for map_id, rel, size, sha, records, l_counts in sorted(per_group_files[group]):
            lines.append(f'{rel},{size},{sha},{records}')
        census[group] = {
            'files': len(per_group_files[group]),
            'records': sum(r for *_x, r, _l in per_group_files[group]),
            'maps': sorted(m for m, *_ in per_group_files[group]),
            'l': {k: sum(item[5][k] for item in per_group_files[group]) for k in l_counts}
                  if group == 'map.Rope' else None,
        }

    lines.append('')
    lines.append('# type-level census')
    fh = census['map.Foothold']; rp = census['map.Rope']; st = census['map.Seat']
    lines.append(f'Foothold files={fh["files"]} records={fh["records"]} maps={",".join(fh["maps"])}')
    lines.append(f'Rope files={rp["files"]} records={rp["records"]} ladder(l=1)={rp["l"]["l=1 (ladder)"]} '
                 f'rope(l=0)={rp["l"]["l=0 (rope)"]} maps={",".join(rp["maps"])}')
    lines.append(f'Seat files={st["files"]} records={st["records"]} maps={",".join(st["maps"])}')
    total_records = fh['records'] + rp['records'] + st['records']
    total_files = fh['files'] + rp['files'] + st['files']
    lines.append(f'TOTAL files={total_files} records={total_records}')
    lines.append('# dataset identity: FSDB content/[FSDB]adventure groups as committed on the')
    lines.append('# design/adventure-field-map-scene branch (source of EV-63; EXE/DLL hashes do NOT')
    lines.append('# certify this dataset).')

    body = '\n'.join(lines) + '\n'
    manifest_sha = hashlib.sha256(body.encode('utf-8')).hexdigest()
    text = body + f'MANIFEST-SHA256 {manifest_sha}\n'

    out_path = os.path.join(REPO, 'research', 'result', 'stage-readiness', 'forensics',
                            'T083-FSDB-MANIFEST.txt')
    with open(out_path, 'w', encoding='utf-8', newline='\n') as f:
        f.write(text)

    print(text)
    if errors:
        for e in errors:
            print(f'ERROR: {e}', file=sys.stderr)
        return 1
    print(f'manifest written: {os.path.relpath(out_path, REPO)}')
    return 0


if __name__ == '__main__':
    sys.exit(main())
