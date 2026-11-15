#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""t089_wp5b_ns_bulk.py — T089: bulk-decrypt the whole namespace table.

Decrypts every id whose record pointer is populated in NS_TABLE 0xBA7B04,
prints all names, and highlights Shape2D#* class ids and WZ property names
relevant to G10/G35/G36/G39. Output: T089-NAMESPACE-BULK.txt
"""
import hashlib
import os
import struct
import sys

REPO = os.environ.get('RE_VALIDATE_ROOT') or os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
EXE = os.path.join(REPO, '.work', 'task-036', 'game-image-unpacked.bin')
EXE_SHA = 'd4a67597a7e1a072679c7b67c91a03a1242eab7aaa635ad8368277dc12a31718'
BASE = 0x400000
OUT = os.path.join(REPO, 'research', 'result', 'stage-readiness', 'forensics', 'T089-NAMESPACE-BULK.txt')

data = open(EXE, 'rb').read()
assert hashlib.sha256(data).hexdigest() == EXE_SHA, 'exe sha mismatch'

NS_TABLE = 0xBA7B04
BASE_KEY_VA = 0xB07640


def u32(va):
    return struct.unpack('<I', data[va - BASE:va - BASE + 4])[0]


def rotate_bytes_left(arr, n):
    ln = len(arr)
    n %= ln
    return arr[n:] + arr[:n]


def rotate_bits_left(arr, shift):
    ln = len(arr)
    if ln == 0 or shift % 8 == 0:
        return arr[:]
    val = int.from_bytes(arr, 'big')
    val = ((val << shift) | (val >> (ln * 8 - shift))) & ((1 << (ln * 8)) - 1)
    return val.to_bytes(ln, 'big')


def derive_key(rec_type, key_len):
    key = bytearray(data[BASE_KEY_VA - BASE: BASE_KEY_VA - BASE + key_len])
    if rec_type == 0 or not key:
        return bytes(key)
    if rec_type >= 8:
        key = bytearray(rotate_bytes_left(bytes(key), (rec_type // 8) % key_len))
    shift = rec_type & 7
    if shift:
        key = bytearray(rotate_bits_left(bytes(key), shift))
    return bytes(key)


def decrypt_record(rec_va):
    off = rec_va - BASE
    rtype = data[off]
    cipher = data[off + 1: off + 128].split(b'\0')[0]
    key_len = u32(BASE_KEY_VA + 0x10)
    key = derive_key(rtype, key_len)
    out = bytearray()
    for i, c in enumerate(cipher):
        p = c ^ key[i % len(key)]
        if p == 0:
            p = key[i % len(key)]
        out.append(p)
    return rtype, bytes(out)


lines = ["# T089 bulk namespace decryption", f"# source sha256={EXE_SHA}", ""]
shape2d = []
maxid = 0x2000
for sid in range(0, maxid):
    rec = u32(NS_TABLE + sid * 4)
    if rec == 0:
        continue
    off = rec - BASE
    if off <= 0 or off >= len(data):
        continue
    try:
        rtype, plain = decrypt_record(rec)
    except Exception:
        continue
    if not plain:
        continue
    try:
        txt = plain.decode('ascii')
        ok = all(32 <= ord(ch) < 127 for ch in txt)
    except UnicodeDecodeError:
        ok = False
        txt = repr(plain)
    if not ok:
        continue
    lines.append(f"0x{sid:04X}  {txt}")
    if txt.startswith('Shape2D'):
        shape2d.append((sid, txt))

lines.append("")
lines.append("## Shape2D classes:")
for sid, txt in shape2d:
    lines.append(f"  0x{sid:04X}  {txt}")

open(OUT, 'w', newline='\n', encoding='utf-8').write('\n'.join(lines) + '\n')
print(f"wrote {OUT}; Shape2D classes: {[(hex(s), t) for s, t in shape2d]}")
