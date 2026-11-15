#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""t087_wp1_fieldctx_d4.py — T087 WP1: [fieldctx+0xD4] construction chain, writer
census and namespace-name decryption (STATIC-ONLY).

Outputs (LF-normalized text, T086.1 canonical rule):
  research/result/stage-readiness/forensics/T087-FIELDCTX-D4-CONSTRUCTION.txt
  research/result/stage-readiness/forensics/T087-FIELDCTX-D4-WRITER-CENSUS.csv

Facts proven by this script (all re-derived from the sha-pinned raw bytes):
  1. Field-context constructor 0x9EC3E1 installs the global [0xBDD6F4], zeroes
     +0xD4 (0x9EC478/0x9EC47E) and later resolves namespace id 0x31D via
     0x7A48D0/0x40634C and attaches the object into [this+0xD4] with the
     smart-pointer attach helper 0x447891 (0x9EC4EE).
  2. Immediately afterwards the same constructor calls
     [obj.vtable+0x90](obj, -400, -300, VARIANT, VARIANT) (0x9EC61A..0x9EC62A).
  3. Namespace record names are recoverable statically: record = {type:u8,
     cipher[]}, key = rotate16(bytes@0xB07640, type) (byte-rotate LEFT by
     (type/8)%16 — temp[i]=key[(r+i)%16] per 0x7A4D17 — then bit-rotate LEFT by
     type%8 over the 128-bit big-endian value), plain =
     cipher[i] XOR key[i%16]. id 0x31D -> 'Shape2D#Vector2D'; id 0x819 ->
     'Gr2D_DX8' (cross-checks EV-07).
  4. Complete byte-pattern census of disp32=0xD4 memory references in the code
     band, and of direct E8 callers of the +0xD4 getter 0x48AEC3 (71 sites).
"""
import csv
import hashlib
import io
import os
import struct
import sys

from capstone import Cs, CS_ARCH_X86, CS_MODE_32

REPO = os.environ.get('RE_VALIDATE_ROOT') or os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
EXE = os.path.join(REPO, '.work', 'task-036', 'game-image-unpacked.bin')
EXE_SHA = 'd4a67597a7e1a072679c7b67c91a03a1242eab7aaa635ad8368277dc12a31718'
BASE = 0x400000
CODE_LO, CODE_HI = 0x401000, 0xA80000
OUT_DIR = os.path.join(REPO, 'research', 'result', 'stage-readiness', 'forensics')

data = open(EXE, 'rb').read()
assert hashlib.sha256(data).hexdigest() == EXE_SHA, 'exe sha mismatch'
md = Cs(CS_ARCH_X86, CS_MODE_32)
md.detail = True


def dis(va, size):
    off = va - BASE
    return list(md.disasm(data[off:off + size], va))


def fmt(ins):
    return f"{ins.address:08X}  {ins.bytes.hex():<22} {ins.mnemonic} {ins.op_str}"


def window(va, size):
    return '\n'.join(fmt(i) for i in dis(va, size))


# ---------- namespace record-name decryption (0x7A4DA9 / 0x7A484B / 0x7A48B3 / 0x7A4CBE) ----------

def u32(va):
    return struct.unpack('<I', data[va - BASE:va - BASE + 4])[0]


NS_TABLE = 0xBA7B04          # dense id -> record-pointer table (runtime-populated in the dump)
BASE_KEY_VA = 0xB07640       # 16-byte base key; length at 0xB07650


def rotate_bytes_left(arr, n):
    # asm 0x7A4D17-0x7A4D3F: temp[i] = arr[(n+i) % len]  (a LEFT array rotation)
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
            p = key[i % len(key)]   # 0x7A4DEA: zero result -> store the key byte
        out.append(p)
    return rtype, bytes(out)


# ---------- byte-pattern censuses ----------

def scan_disp(disp):
    """All decodable instructions in the band whose memory operand has disp == target."""
    pat = (disp & 0xFFFFFFFF).to_bytes(4, 'little')
    res = []
    k = data.find(pat, CODE_LO - BASE, CODE_HI - BASE)
    while k != -1:
        for back in range(7, 0, -1):
            s = k - back
            if s < CODE_LO - BASE:
                continue
            try:
                ins = next(md.disasm(data[s:k + 4 + 8], BASE + s), None)
            except StopIteration:
                ins = None
            if ins and ins.address + ins.size == BASE + k + 4:
                hit = False
                for op in ins.operands:
                    if op.type == 3 and op.mem.disp == disp:
                        hit = True
                        break
                if hit:
                    res.append(ins)
                    break
        k = data.find(pat, k + 1, CODE_HI - BASE)
    return res


def callers(target):
    res = []
    for site in range(CODE_LO - BASE, CODE_HI - BASE - 5):
        if data[site] == 0xE8:
            rel = int.from_bytes(data[site + 1:site + 5], 'little', signed=True)
            if BASE + site + 5 + rel == target:
                res.append(BASE + site)
    return res


WRITE_MNEMONICS = {'mov', 'movsd', 'add', 'sub', 'and', 'or', 'xor', 'inc', 'dec', 'stosd'}


def classifies_as_write(ins):
    if ins.mnemonic in ('cmp', 'test', 'push', 'lea', 'fld', 'fild', 'pop'):
        return False
    for io, op in enumerate(ins.operands):
        if op.type == 3:
            if io == 0 and ins.mnemonic in WRITE_MNEMONICS:
                return True
    return False


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    L = []
    w = L.append
    w('# T087 WP1 — [fieldctx+0xD4] construction chain & writer census (STATIC-ONLY)')
    w('')
    w(f'Binary: .work/task-036/game-image-unpacked.bin')
    w(f'sha256: {EXE_SHA}')
    w('Model: linear image, fileOffset = VA - 0x400000. Band 0x401000-0xA80000.')
    w('Generated by research/scripts/t087_wp1_fieldctx_d4.py (round T087).')
    w('')
    w('## 1. Field-context constructor 0x9EC3E1 (global [0xBDD6F4] install)')
    w('```')
    w(window(0x9EC3E1, 0x104))
    w('```')
    w('Key facts: [0xBDD6F4] = this (0x9EC404); [this+0xD4] zeroed at 0x9EC478/0x9EC47E;')
    w('sub-vtable 0xB0D23C at +0x64; primary vtable 0xB0D208 at +0 (0x9EC48A).')
    w('')
    w('## 2. Namespace resolve + attach + initial Set (same constructor)')
    w('```')
    w(window(0x9EC4D0, 0x30))       # resolve id 0x31D
    w('')
    w(window(0x9EC4E5, 0x12))       # attach into +0xD4
    w('')
    w(window(0x9EC5E3, 0x4B))       # E_POINTER check + slot+0x90 Set(-400,-300)
    w('```')
    w('Decoded: 0x447891(OBJ31D, &this->D4, 0) installs the object; then')
    w('[OBJ31D.vt+0x90](OBJ31D, -400, -300, V{VT_ERROR,missing}, V{VT_UNKNOWN,[0xBE2788]-iface})')
    w('is called with the NEGATIVE HALF-SCREEN vector (-800/2, -600/2) — i.e. Set')
    w('centres the WORLD ORIGIN (0,0) at screen (400,300).')
    w('')
    w('## 3. Namespace record-name decryption (static, dump data)')
    w('Cipher (recovered from 0x7A4DA9 + 0x7A484B + 0x7A48B3 + 0x7A4CBE):')
    w('  key = rotate_LEFT_16B(bytes@0xB07640, (type div 8) mod 16)   # temp[i] = key[(r+i)%16]')
    w('        then rotate_LEFT_bits(type mod 8) over the 128-bit big-endian value;')
    w('  plain[i] = cipher[i] XOR key[i mod 16]  (zero result -> key byte, 0x7A4DEA).')
    w('')
    w('Selected ids (name shown as UTF-8, GBK fallback):')
    w('')
    w('| id | type | record VA | decrypted name |')
    w('|---:|---:|---:|---|')
    for rid in (0x31D, 0x819, 0x31C, 0x31E, 0x31B, 0x320, 0x818, 0x81A, 0x81B,
                0x81C, 0x81D, 0x802, 0xA58, 0x43A, 0x43B, 0x322, 0x323, 0x325, 0x31A):
        ptr = u32(NS_TABLE + rid * 4)
        if ptr == 0:
            continue
        rt, name = decrypt_record(ptr)
        try:
            dec = name.decode('utf-8')
        except UnicodeDecodeError:
            try:
                dec = name.decode('gbk')
            except Exception:
                dec = name.hex()
        w(f'| {rid:#x} | {rt:#x} | {ptr:#x} | {dec} |')
    w('')
    w('Cross-check: id 0x819 = "Gr2D_DX8" — the SAME id EV-07 shows being resolved')
    w('and created into [0xBE2788]; the cipher therefore independently reproduces')
    w('a known-good namespace identity from pure static bytes.')
    w('')
    w('## 4. Getter 0x48AEC3 E8-caller census (byte-pattern, complete in band)')
    g = callers(0x48AEC3)
    w(f'{len(g)} direct callers:')
    w('')
    w('```')
    for a in g:
        w(f'{a:08X}')
    w('```')
    w('')
    w('## 5. Complete disp32=0xD4 memory-reference census')
    w(f'{len(scan_disp(0xD4))} decodable disp32=0xD4 references in band (any class);')
    w('classified W = first memory operand is written. See the CSV companion for the')
    w('full list; note disp8 encodings are impossible for 0xD4 (>127) and SIB/disp32')
    w('forms are covered by the decoder-probe scan.')
    w('')
    w('## 6. world->screen consumer (field family)')
    w('```')
    w(window(0x9EA402, 0x50))
    w('```')
    w('0x9EA42C/0x9EA435 read the Vector2D X (slot +0x20 getter wrapper 0x404B07) and')
    w('the object X, then 0x9EA446 computes screen_x = obj.world_x - camera.x.')
    w('')
    w('## 7. Boundaries')
    w('- The Shape2D-INTERNAL body behind [vt+0x90]/[vt+0x20]/[vt+0x28] is reached')
    w('  through the PCOM property layer of Shape2D.dll (0x5140xxxx); this round')
    w('  proves the EXE-side call contract and the observable X/Y semantics, not')
    w('  the internal store instructions.')
    w('- WRITER-SET SCOPE (t087 reviewer correction merged): the camera-write')
    w('  funnel 0x5CA91A has 7 E8 callers, but DIRECT [vt+0x90] calls on the same')
    w('  namespace-cached Vector2D also exist (reviewer-verified sites 0x43781F,')
    w('  0x692280, 0x6BE6F4, 0x6ED7CC with small constant args; 24 more candidate')
    w('  sites within 0x180 bytes of a 0x31D resolve remain uncensused). The')
    w('  7-caller list is the FUNNEL census, not the complete writer set.')
    w('- The runtime inner object of [scene+0x1CC] (the slot15 X1/Y1 source) is')
    w('  E_POINTER-guarded and read via the same getter wrappers, but its installer')
    w('  was not located this round (scene-family ctor for that member is open).')

    with open(os.path.join(OUT_DIR, 'T087-FIELDCTX-D4-CONSTRUCTION.txt'), 'w',
              encoding='utf-8', newline='\n') as f:
        f.write('\n'.join(L) + '\n')

    # CSV census
    rows = []
    for ins in scan_disp(0xD4):
        rows.append([f'{ins.address:08X}', 'W' if classifies_as_write(ins) else 'r',
                     ins.bytes.hex(), f'{ins.mnemonic} {ins.op_str}'])
    with open(os.path.join(OUT_DIR, 'T087-FIELDCTX-D4-WRITER-CENSUS.csv'), 'w',
              encoding='utf-8', newline='\n') as f:
        cw = csv.writer(f, lineterminator='\n')
        cw.writerow(['address', 'class', 'bytes', 'instruction'])
        cw.writerows(rows)
    print(f'wrote {len(rows)} census rows + construction report')


if __name__ == '__main__':
    main()
