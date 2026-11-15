#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""t089_wp1f_names.py — T089: decrypt namespace/string ids used by the
background loader (0x669397), the tiler (0x66A8D5) and related paths.

Reuses the cipher proven in t087_wp1_fieldctx_d4.py (C-103):
  record = {type:u8, cipher[]}; key = rot16(bytes@0xB07640, type);
  plain = cipher XOR key[i%16] (zero result -> key byte).
NS_TABLE 0xBA7B04 = dense id -> record pointer (runtime-populated in the dump).

Decrypts the full id set consumed by the Back/Obj loader family so property
identities (front, type, cx, cy, a, ani, x, y, rx, ry, flow, move*, and the
tiler's 0x155D/0x1550/0x1551) become statically proven names.
"""
import hashlib
import os
import struct
import sys

REPO = os.environ.get('RE_VALIDATE_ROOT') or os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
EXE = os.path.join(REPO, '.work', 'task-036', 'game-image-unpacked.bin')
EXE_SHA = 'd4a67597a7e1a072679c7b67c91a03a1242eab7aaa635ad8368277dc12a31718'
BASE = 0x400000
OUT = os.path.join(REPO, 'research', 'result', 'stage-readiness', 'forensics', 'T089-NAMESPACE-ID-NAMES.txt')

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


IDS = [
    # Back loader family (0x669397): 0x543,0x544,0x54B first reads; 0x331/0x332
    0x543, 0x544, 0x54B, 0x331, 0x332,
    # coordinates / sizes / alpha / ani / type / flow
    0x545, 0x546, 0x547, 0x548, 0x549, 0x54A, 0x54D, 0x532, 0x53A,
    0x1581, 0xBF0,
    # move attributes (0x66B544 family)
    0x54F, 0x550, 0x551, 0x552, 0x553,
    # tiler per-child property ids
    0x155D, 0x1550, 0x1551,
    # controls / known names for cross-check
    0x31D, 0x819,
    # G39 candidates: delay-ish ids around the 0x43E3A6 / 0x43715C family
    0x15F8, 0x1122, 0x1123, 0x6B0, 0x5C1, 0x6B1, 0x6AF, 0x3C0,
    0x15BA, 0x884, 0x5CE, 0x5CF, 0xEBA,
    # extra loader ids seen: 0x54C, 0x54E, 0x533..0x539, 0x53B..0x542
    0x54C, 0x54E, 0x533, 0x534, 0x535, 0x536, 0x537, 0x538, 0x539,
    0x53B, 0x53C, 0x53D, 0x53E, 0x53F, 0x540, 0x541, 0x542,
]

lines = ["# T089 namespace id -> decrypted name (CMS079 EXE, cipher per C-103)",
         f"# source sha256={EXE_SHA}", "# table=0xBA7B04 key=0xB07640", ""]
ok = 0
for sid in IDS:
    rec = u32(NS_TABLE + sid * 4)
    if rec == 0 or rec - BASE <= 0 or rec - BASE >= len(data):
        lines.append(f"0x{sid:04X}  <no record>")
        continue
    try:
        rtype, plain = decrypt_record(rec)
    except Exception as e:  # pragma: no cover
        lines.append(f"0x{sid:04X}  <error {e}>")
        continue
    printable = all(32 <= b < 127 for b in plain) and len(plain) > 0
    txt = plain.decode('ascii', 'replace') if printable else repr(plain)
    lines.append(f"0x{sid:04X}  rec=0x{rec:08X} type={rtype:3d}  {txt}")
    ok += 1

open(OUT, 'w', newline='\n', encoding='utf-8').write('\n'.join(lines) + '\n')
print(f"wrote {OUT} ({ok}/{len(IDS)} decrypted)")
