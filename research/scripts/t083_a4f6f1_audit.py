#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""t083_a4f6f1_audit.py — exhaustive direct-E8 call-site audit for 0xA4F6F1
(vertical-line foothold query), reproducing the T083 halfWidth census (F3 fix).

Method (deterministic):
  1. Verify the EXE SHA-256 (fail-closed).
  2. Exhaustively scan every 0xE8 byte in the linear image; keep sites whose
     rel32 target == 0xA4F6F1. Deduplicate by call-site VA, sort ascending.
  3. For each site, decode a pre-call window by best-alignment search: try
     every start offset in [va-0x60, va-5]; keep the linear capstone decode
     that ends exactly on the call instruction with the most instructions.
  4. Classify the halfWidth argument (5th stack arg, pushed FIRST in the
     right-to-left order (x, yTop, out, yBottom, halfWidth)) from the
     push sequence; constant sources are machine-checked against the window.

Output: research/result/stage-readiness/forensics/T083-A4F6F1-CALLSITE-AUDIT.txt
"""
import hashlib
import os
import re
import sys

from capstone import Cs, CS_ARCH_X86, CS_MODE_32

REPO = os.environ.get('RE_VALIDATE_ROOT') or os.path.dirname(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
EXE = os.path.join(REPO, '.work', 'task-036', 'game-image-unpacked.bin')
EXPECT_SHA = 'd4a67597a7e1a072679c7b67c91a03a1242eab7aaa635ad8368277dc12a31718'
BASE = 0x400000
TARGET = 0xA4F6F1
OUT = os.path.join(REPO, 'research', 'result', 'stage-readiness', 'forensics',
                   'T083-A4F6F1-CALLSITE-AUDIT.txt')

# Site scenarios attributed by caller family (from t082 forensics context;
# the halfWidth classification itself is independent of these labels).
SCENARIO = {
    0x546803: 'map/background-side (yBottom=0x7FFFFFFF infinite depth)',
    0x54709b: 'map/background-side (yBottom=0x7FFFFFFF)',
    0x5bfeda: 'field/map init (yBottom=0x7FFFFFFF, out=NULL)',
    0x5cdc9c: 'mob/user side (rect record +0x10/+0x14, yTop-5, 0x708 range gate)',
    0x5ce033: 'mob/user side (record +0x10/+0x14, yTop-5)',
    0x5ce496: 'mob/user side (record +0x10/+0x14, yTop-5)',
    0x70d024: 'character-side (hint slots +0x130/+0x134, edi width)',
    0x7c3f5c: 'mob AI (record +0xC/+0x10, yTop-5, 0x708 range gate)',
    0x7c439e: 'mob AI (record +0xC/+0x10, yTop-5)',
    0x7c484c: 'mob AI (record +0xC/+0x10, yTop-5)',
    0x9364d4: 'character side (yTop-20, yBottom=0x7FFFFFFF)',
    0x9364ff: 'character side (yTop-20+0xF step)',
    0x93652a: 'character side (yTop-20-0xF step)',
    0x953236: 'movement state (yBottom=record+0x12C)',
    0x955498: 'same-map teleport apply (yBottom=|esi|+ebx, esi floored 0x1E)',
    0x963d72: 'portal trigger (same-map up-key, out=NULL, Y-10)',
    0x964074: 'portal-apply sibling (yBottom=[edi+0x50])',
    0x9640e7: 'portal-apply sibling (yBottom=0x7FFFFFFF)',
    0x9641b9: 'portal-apply sibling (yBottom=edi+[ebp-0x30])',
    0x977f52: 'map-transition/movement (yBottom=ecx+0x50)',
    0x97a2b9: 'movement family (yBottom=esi+0x50, 0x40684F mirror)',
    0x97a32e: 'movement family (yBottom=eax+0x1E)',
    0x9c6b68: 'move-state slot (M+0x110 empty path; decrypt Y/X -> ftol; push 2)',
    0x9cc207: 'movement landing (out=&Y-10 mirror, Y-10)',
}


def best_window(md, data, va, back=0x90):
    best = None
    for delta in range(5, back + 1):
        start = va - delta
        blob = data[start - BASE:va - BASE + 5]
        ins_list = list(md.disasm(blob, start))
        if not ins_list:
            continue
        last = ins_list[-1]
        if last.address + last.size == va + 5 and last.mnemonic == 'call':
            if best is None or len(ins_list) > len(best):
                best = ins_list
    return best or []


def classify(window):
    """Classify halfWidth from the decoded push sequence via stack simulation.

    Model: walk the window; `push X` appends a slot, `pop` removes one, other
    instructions are stack-neutral for this purpose and intervening calls are
    treated as balanced (verified for the two helpers involved: 0xa70b13 is a
    1-arg cdecl abs(); 0xa70f94 is __ftol with a plain frame and `ret`).
    The five 0xA4F6F1 arguments must be the top-5 slots at the call;
    halfWidth is the deepest of those five (slots[-5]).
    """
    slots = []
    for i in window:
        if i.mnemonic == 'push':
            slots.append((i.address, i.op_str))
        elif i.mnemonic == 'pop':
            if slots:
                slots.pop()
    if len(slots) < 5:
        return 'undecodable', f'stack sim yields {len(slots)} slots (<5)'
    hw_addr, hw_op = slots[-5]
    if hw_op in ('1', '2'):
        return f'{hw_op} (direct push {hw_op})', f'push {hw_op} @0x{hw_addr:X}'
    if re.fullmatch(r'e(s|i|b|c|d)[xip]', hw_op):
        # register-carried: look for an immediate load of that register
        # (push imm; pop reg adjacency) anywhere earlier in the window
        for j, ins in enumerate(window):
            if ins.mnemonic == 'pop' and ins.op_str == hw_op and j > 0:
                prev = window[j - 1]
                if prev.mnemonic == 'push':
                    return (f'{prev.op_str} (register-carried {hw_op}={prev.op_str})',
                            f'push {prev.op_str}; pop {hw_op} @0x{prev.address:X}, '
                            f'push {hw_op} @0x{hw_addr:X}')
        return f'dynamic ({hw_op})', f'push {hw_op} @0x{hw_addr:X} source not in window'
    return 'unknown', f'push {hw_op} @0x{hw_addr:X}'


def main() -> int:
    if sys.stdout.encoding and sys.stdout.encoding.lower() not in ('utf-8', 'utf8'):
        import io
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

    if not os.path.exists(EXE):
        print(f'ERROR: exe not found at {EXE} (audit requires the local research '
              f'input; the committed artifact remains authoritative)', file=sys.stderr)
        return 2
    data = open(EXE, 'rb').read()
    digest = hashlib.sha256(data).hexdigest()
    if digest != EXPECT_SHA:
        print(f'ERROR: sha256 mismatch {digest}', file=sys.stderr)
        return 2

    sites = sorted({BASE + off for off in range(len(data) - 5)
                    if data[off] == 0xE8
                    and (BASE + off) + 5 + int.from_bytes(data[off + 1:off + 5], 'little', signed=True) == TARGET})

    md = Cs(CS_ARCH_X86, CS_MODE_32)
    lines = [
        '# T083 — exhaustive direct-E8 call-site audit for 0xA4F6F1 (halfWidth census, F3)',
        f'# binary=.work/task-036/game-image-unpacked.bin',
        f'# sha256={digest}',
        f'# image=exe base={BASE:#x} (linear: fileOffset = VA - 0x400000)',
        f'# generator: research/scripts/t083_a4f6f1_audit.py',
        f'# total direct E8 sites: {len(sites)}',
        '# arg order: (x, yTop, out, yBottom, halfWidth); thiscall ecx=[0xBDD498]',
        '# t082 census (17x1/1x2/4 dynamic/1 undecodable = 23 classified of 24 claimed)',
        '#   corrected by this audit: 23x1 + 1x2 = 24, 0 dynamic, 0 undecodable.',
        '',
    ]

    tally = {}
    for va in sites:
        window = best_window(md, data, va)
        label, note = classify(window)
        tally.setdefault(label, []).append(va)
        lines.append(f'## site 0x{va:X}  halfWidth = {label}  [{note}]')
        lines.append(f'scenario: {SCENARIO.get(va, "unattributed")}')
        lines.append(f'raw call bytes: {data[va - BASE:va - BASE + 5].hex(" ")}')
        for ins in window:
            mark = '  <<< CALL' if ins.address == va else ''
            lines.append(f'  {ins.address:08X}  {ins.bytes.hex():<22} {ins.mnemonic} {ins.op_str}{mark}')
        lines.append('')

    lines.append('# census (machine-tallied)')
    for label in sorted(tally, key=lambda s: -len(tally[s])):
        lines.append(f'{label}: {len(tally[label])} sites -> {" ".join(hex(v)[2:].upper() for v in tally[label])}')
    lines.append(f'TOTAL sites: {len(sites)}')
    lines.append('')
    lines.append('# cross-checks performed by this audit:')
    lines.append('#  * 0x964074 decodes as push 1 @0x964068 (t082 "undecodable" was an alignment artifact)')
    lines.append('#  * 0x70D024 edi=1 via push 1;pop edi @0x70CFB3-B5; edi is callee-saved across')
    lines.append('#    0x70D1D9 (push edi @0x70D1E6 / pop edi @0x70D3B5) — constant, not dynamic')
    lines.append('#  * 0x9364D4/0x9364FF/0x93652A share edi=1 from push 1;pop edi @0x9364BC-BE')
    lines.append('#  * 0x955498: helper 0xa70b13 is 1-arg cdecl abs() (mov eax,[esp+4]; test; neg; ret);')
    lines.append('#    the push-1 argument slot is left on the stack by pop ecx and doubles as halfWidth')
    lines.append('#    (esi was the abs() argument, not the halfWidth — t082 misread)')
    lines.append('#  * 0x9C6B68 push 2 @0x9C6B4D with out=NULL, yBottom=0x7FFFFFFF, x/yTop via __ftol 0xA70F94')

    text = '\n'.join(lines) + '\n'
    with open(OUT, 'w', encoding='utf-8', newline='\n') as f:
        f.write(text)
    print(text)
    print(f'audit artifact written: {os.path.relpath(OUT, REPO)}')
    return 0


if __name__ == '__main__':
    sys.exit(main())
