#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""t0841_dump_evidence.py — regenerate the T084.1 evidence files EV-74/EV-75/EV-76.

Round t084.1 (slot25 scope reconciliation). Reads ONLY the original binaries:
  EXE: .work/task-036/game-image-unpacked.bin  (flat image, VA = file + 0x400000)
  DLL: .work/task-001/extracted/冒险岛online/Gr2D_DX8.dll (PE, ImageBase 0x50400000)
  PCOM: .work/task-001/extracted/冒险岛online/PCOM.dll (PE)

Outputs (rewrites):
  research/result/stage-readiness/forensics/T0841-EV74-SLOT25-5040418C-FULL.txt
  research/result/stage-readiness/forensics/T0841-EV75-IID-IDENTITY-CHAIN.txt
  research/result/stage-readiness/forensics/T0841-EV76-SLOT25-CANDIDATE-COMPARISON.txt

Method: pefile section mapping (VA<->file offset) + capstone CS_ARCH_X86/CS_MODE_32.
Function extents: linear sweep from the entry VA, collecting in-function jump
targets, extended past the first ret while orphan targets remain (see _function).
"""
import os, sys, io, hashlib, struct
import capstone
import pefile

if sys.stdout.encoding and sys.stdout.encoding.lower() not in ('utf-8', 'utf8'):
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

REPO = os.environ.get('RE_VALIDATE_ROOT') or os.path.dirname(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
EXE = os.path.join(REPO, '.work', 'task-036', 'game-image-unpacked.bin')
DLL = os.path.join(REPO, '.work', 'task-001', 'extracted', '冒险岛online', 'Gr2D_DX8.dll')
PCOM = os.path.join(REPO, '.work', 'task-001', 'extracted', '冒险岛online', 'PCOM.dll')
OUTDIR = os.path.join(REPO, 'research', 'result', 'stage-readiness', 'forensics')

MD = capstone.Cs(capstone.CS_ARCH_X86, capstone.CS_MODE_32)


class Img:
    def __init__(self, path, flat=False, base=None):
        self.path = path
        self.data = open(path, 'rb').read()
        self.sha256 = hashlib.sha256(self.data).hexdigest()
        self.flat = flat
        self.base = base
        if not flat:
            self.pe = pefile.PE(data=self.data)
            self.base = self.pe.OPTIONAL_HEADER.ImageBase if base is None else base
            self.sections = [(s.VirtualAddress, s.Misc_VirtualSize,
                              s.PointerToRawData, s.SizeOfRawData) for s in self.pe.sections]

    def va2off(self, va):
        if self.flat:
            return va - self.base
        rva = va - self.base
        for va0, vsz, raw, rsz in self.sections:
            if va0 <= rva < va0 + max(vsz, rsz):
                return raw + (rva - va0)
        return None

    def off2va(self, off):
        if self.flat:
            return off + self.base
        for va0, vsz, raw, rsz in self.sections:
            if raw <= off < raw + rsz:
                return self.base + va0 + (off - raw)
        return None

    def read(self, va, n):
        off = self.va2off(va)
        return None if off is None else self.data[off:off + n]

    def u32(self, va):
        b = self.read(va, 4)
        return None if b is None or len(b) < 4 else int.from_bytes(b, 'little')


def _function(img, va, max_size=0x2000):
    """Linear sweep function extent: stop after the last ret reachable from
    in-range jump targets (handles multi-block bodies with internal jumps)."""
    code = img.read(va, max_size)
    body, targets = [], set()
    end = None
    for ins in MD.disasm(code, va):
        body.append(ins)
        if ins.mnemonic in ('ret', 'retf'):
            end = ins.address + ins.size
            break
        if ins.mnemonic[0] == 'j' and ins.op_str.startswith('0x'):
            try:
                t = int(ins.op_str, 16)
                if va <= t < va + max_size:
                    targets.add(t)
            except ValueError:
                pass
    if end is None:
        end = va + 0x10
    while targets:
        t = max(targets)
        targets.discard(t)
        if t < end:
            continue
        for ins in MD.disasm(img.read(t, max_size), t):
            if ins.address not in [b.address for b in body]:
                body.append(ins)
            if ins.mnemonic in ('ret', 'retf'):
                end = max(end, ins.address + ins.size)
                break
            if ins.mnemonic[0] == 'j' and ins.op_str.startswith('0x'):
                try:
                    tt = int(ins.op_str, 16)
                    if va <= tt < va + max_size:
                        targets.add(tt)
                except ValueError:
                    pass
    body.sort(key=lambda i: i.address)
    return body, end


def fmt(ins):
    return f"{ins.address:08X}  {ins.bytes.hex():<22} {ins.mnemonic} {ins.op_str}"


def dump_body(out, img, title, va, max_size=0x800):
    body, end = _function(img, va, max_size)
    out.append(f"===== {title} 0x{va:08X} .. 0x{end:08X} ({end - va} bytes, {len(body)} insns) =====")
    for ins in body:
        out.append(fmt(ins))
    out.append("")
    return end


def guid_str(b):
    d1, d2, d3 = struct.unpack('<IHH', b[:8])
    return "{%08X-%04X-%04X-%s-%s}" % (d1, d2, d3, b[8:10].hex().upper(), b[10:16].hex().upper())


def find_all(img, pat):
    idx, hits = 0, []
    while True:
        j = img.data.find(pat, idx)
        if j < 0:
            return hits
        hits.append((j, img.off2va(j)))
        idx = j + 1


def main():
    exe = Img(EXE, flat=True, base=0x400000)
    dll = Img(DLL)          # base 0x50400000
    pcom = Img(PCOM)        # base 0x50C00000

    # ---------------- EV-74: full 0x5040418C ----------------
    out = []
    out.append("# binary=.work/task-001/extracted/冒险岛online/Gr2D_DX8.dll")
    out.append(f"# sha256={dll.sha256}")
    out.append("# image=dll ImageBase=0x50400000 (PE section mapping)")
    out.append("# claim=C-086 (t084.1): inner-vtable (0x5042D224) slot25 = 0x5040418C full body")
    out.append("# boundary/conv: ret 0x3C => 15 stack dwords (this + 14 args); SEH prologue")
    out.append("# arg map (callee view): [ebp+8]=this, +0xC..+0x1C=five dwords,")
    out.append("#   [ebp+0x20]=VARIANT byval #1, [ebp+0x30]=VARIANT byval #2, [ebp+0x40]=VARIANT* out")
    out.append("# guards: [ebp+0x40]==NULL => E_POINTER (0x80004003); [this+0x90]==0 => E_FAIL (0x80004005)")
    out.append("# out write: 0x504045C1-0x504045CB  *arg15 = [ebp+8] (wrapped object pointer)")
    out.append("# success path returns S_OK (xor eax,eax @0x504045E4); E_INVALIDARG 0x80070057 @0x50404614")
    out.append("")
    dump_body(out, dll, "inner slot25 FULL BODY", 0x5040418C, 0x800)
    # [this+0x90] producer cross-ref: slot3 writes it
    out.append("# cross-ref: [this+0x90] is produced by inner slot3 0x504030D3 (device init,")
    out.append("# called by EXE initializer 0xA00E5E as [[0xBE2788]+0xC](0x320,0x258))")
    out.append("")
    dump_body(out, dll, "inner slot3 (device init) head", 0x504030D3, 0x400)
    with open(os.path.join(OUTDIR, 'T0841-EV74-SLOT25-5040418C-FULL.txt'), 'w',
              encoding='utf-8', newline='\n') as f:
        f.write('\n'.join(out) + '\n')

    # ---------------- EV-75: IID identity chain ----------------
    out = []
    out.append(f"# exe=.work/task-036/game-image-unpacked.bin sha256={exe.sha256}")
    out.append(f"# dll=.work/task-001/extracted/冒险岛online/Gr2D_DX8.dll sha256={dll.sha256}")
    out.append(f"# pcom=.work/task-001/extracted/冒险岛online/PCOM.dll sha256={pcom.sha256}")
    out.append("# claim=C-087 (t084.1): factory=[0xBE1FB0]=PCOM!PcCreateObject; IID bytes identical")
    out.append("# in EXE 0xBA0570 and Gr2D 0x50435120; QI(E576EA33) => inner subobject (vtable 0x5042D224)")
    out.append("")
    out.append("===== IID bytes =====")
    b_exe = exe.read(0xBA0570, 16)
    b_dll = dll.read(0x50435120, 16)
    out.append(f"EXE  @0xBA0570   : {b_exe.hex()}  -> {guid_str(b_exe)}")
    out.append(f"DLL  @0x50435120 : {b_dll.hex()}  -> {guid_str(b_dll)}")
    out.append(f"byte-identical: {b_exe == b_dll}")
    iid = b_exe
    out.append(f"EXE occurrences of IID bytes: {[hex(v) for _, v in find_all(exe, iid)]}")
    out.append(f"DLL occurrences of IID bytes: {[hex(v) for _, v in find_all(dll, iid)]}")
    out.append(f"PCOM occurrences of IID bytes: {[hex(v) for _, v in find_all(pcom, iid)]}")
    out.append("")
    out.append("===== PCOM.dll exports =====")
    for e in pcom.pe.DIRECTORY_ENTRY_EXPORT.symbols:
        name = e.name.decode() if e.name else f"ord{e.ordinal}"
        out.append(f"  {name} = 0x{pcom.base + e.address:08X}")
    out.append("")
    out.append("===== EXE factory install (GetProcAddress by name -> [0xBE1FB0]) =====")
    out.append("strings: 0xBA75FC='PcCreateObject' 0xBA75E4='PcFreeUnusedLibraries' "
               "0xBA75D0='PcSerializeObject' 0xBA75BC='PcSerializeString' 0xBA75AC='PcRootNameSpace'")
    out.append("0xBA7588='PcInitModule' 0xBA760C='PcTermModule' 0xBA7598=L'PCOM' (default module name)")
    dump_body(out, exe, "EXE factory resolver 0x79C52F", 0x79C52F, 0x80)
    out.append("===== PCOM PcCreateObject (routing: namespace lookup -> class entry slot3 create+QI) =====")
    dump_body(out, pcom, "PcCreateObject", 0x50C04CD1, 0x400)
    out.append("===== EXE creator 0xA0449B =====")
    dump_body(out, exe, "creator 0xA0449B", 0xA0449B, 0x100)
    out.append("===== EXE initializer 0xA00E5E (creation + first slot calls on [0xBE2788]) =====")
    dump_body(out, exe, "initializer 0xA00E5E", 0xA00E5E, 0x400)
    out.append("===== Gr2D ctor 0x504013E3 (vtable installs) =====")
    dump_body(out, dll, "ctor 0x504013E3", 0x504013E3, 0x80)
    out.append("===== Gr2D QI chain =====")
    dump_body(out, dll, "outer slot0 QI 0x504014A5 (delegates pThis=this+0x10, map 0x5042D1E0)", 0x504014A5, 0x100)
    dump_body(out, dll, "mid slot0 thunk 0x5040184E (this-=4 -> inner QI)", 0x5040184E, 0x40)
    dump_body(out, dll, "inner slot0 QI 0x50401522 (pThis=inner; fallback map walk)", 0x50401522, 0x80)
    dump_body(out, dll, "ATL _InternalQueryInterface 0x50401945", 0x50401945, 0x1B0)
    out.append("===== intmap @0x5042D1E0 (entries {piid, dw, pFunc}) =====")
    for i in range(3):
        va = 0x5042D1E0 + i * 12
        out.append(f"  [{va:08X}] piid=0x{dll.u32(va):08X} dw=0x{dll.u32(va+4):X} pFunc=0x{dll.u32(va+8):08X}")
    out.append("  IID @0x50435120 -> " + guid_str(dll.read(0x50435120, 16)))
    out.append("  IID @0x50435110 -> " + guid_str(dll.read(0x50435110, 16)) + "  (IID_IUnknown)")
    out.append("")
    out.append("===== RAW cluster dwords 0x5042D1E0..0x5042D2C8 (authoritative re-dump) =====")
    out.append("# code-pointer array 0x5042D204..0x5042D2BC = 47 dwords; NULL terminator @0x5042D2C0")
    out.append("# STRUCTURE (t084.1, reviewer-confirmed): class-1 group = outer 3-entry IUnknown")
    out.append("# table 0x5042D204 (QI 0x504014A5/AddRef 0x50410720/Release 0x50401472) + mid 5-entry")
    out.append("# thunk table 0x5042D210 (-4 adjustors into the inner trio, then 0x50404860,")
    out.append("# 0x50404CB2) + inner 36-entry long table 0x5042D224 (0x5042D224..0x5042D2B3) + a")
    out.append("# 3-entry teardown vtable 0x5042D2B4 (dtor 0x504018CD does mov [esi],0x5042D2B4;")
    out.append("# entries 0x504018CD/0x50405FC8/0x50405FC8); 3+5+36+3 = 47.")
    out.append("# PHANTOM-SLOT CORRECTION: EV-72's three windows are byte-accurate dwords, but the")
    out.append("# t084 reading sliced one contiguous block into overlapping 'slot25's:")
    out.append("#   [0x5042D268]=0x50404E85 is inner slot17 (NOT a real 'outer slot25' — outer has 3")
    out.append("#   entries); [0x5042D274]=0x50403FBE is inner slot20 (NOT 'mid slot25' — mid has 5).")
    for va in range(0x5042D1E0, 0x5042D2C8, 4):
        v = dll.u32(va)
        tags = []
        for name, base in (('outer', 0x5042D204), ('inner', 0x5042D224), ('mid', 0x5042D210)):
            off = va - base
            if 0 <= off <= 0xBC and off % 4 == 0:
                tags.append(f"{name}+0x{off:02X}(slot{off//4})")
        out.append(f"  [{va:08X}] = 0x{v:08X}{('   ; ' + ' '.join(tags)) if tags else ''}")
    out.append("")
    out.append("===== RAW class-2 dwords 0x5042D140..0x5042D1E0 (second vtable group) =====")
    out.append("# class-2 ctor fragment 0x50401295: [obj]=0x5042D154 (35-entry long table,")
    out.append("# QI 0x504013CA walking the SHARED intmap 0x5042D1E0 with pThis=this),")
    out.append("# [obj+4]=0x5042D140 (5-entry thunk table, -4 adjustors into the T154 trio).")
    out.append("# BOTH long tables share slot25 = 0x5040418C (T224 @0x5042D288, T154 @0x5042D1B8)")
    out.append("# and slot3 = 0x504030D3 and slot20 = 0x50403FBE.")
    out.append("# PHANTOM-SLOT CORRECTION (cont.): [0x5042D1A4]=0x50403FBE is T154 slot20 —")
    out.append("# the t084/t081 'layer-table 0x5042D140 slot25' label read past the 5-entry table")
    out.append("# into T154; C-005/C-053's '40-slot table at 0x5042D140' is this same mis-slice.")
    for va in range(0x5042D140, 0x5042D1E0, 4):
        v = dll.u32(va)
        tags = []
        for name, base in (('T140', 0x5042D140), ('T154', 0x5042D154)):
            off = va - base
            if 0 <= off <= 0x90 and off % 4 == 0:
                tags.append(f"{name}+0x{off:02X}(slot{off//4})")
        out.append(f"  [{va:08X}] = 0x{v:08X}{('   ; ' + ' '.join(tags)) if tags else ''}")
    out.append("")
    out.append("===== class-2 ctor fragment + QI (verbatim) =====")
    code = dll.read(0x50401289, 0x24)
    for ins in MD.disasm(code, 0x50401289):
        out.append(fmt(ins))
    out.append("")
    dump_body(out, dll, "class-2 QI 0x504013CA (shared intmap 0x5042D1E0, pThis=this)", 0x504013CA, 0x40)
    with open(os.path.join(OUTDIR, 'T0841-EV75-IID-IDENTITY-CHAIN.txt'), 'w',
              encoding='utf-8', newline='\n') as f:
        f.write('\n'.join(out) + '\n')

    # ---------------- EV-76: candidate comparison + production path ----------------
    out = []
    out.append(f"# exe=.work/task-036/game-image-unpacked.bin sha256={exe.sha256}")
    out.append(f"# dll=.work/task-001/extracted/冒险岛online/Gr2D_DX8.dll sha256={dll.sha256}")
    out.append("# claims=C-086;C-082(corrected);G24;G27 (t084.1): three slot25 candidates vs the")
    out.append("# production call site 0x427EB3 (15 pushed dwords) — only 0x5040418C (ret 0x3C) matches;")
    out.append("# slot45/56 calls land on the slot25 RESULT object (0x42944A null-assert), not on [0xBE2788]")
    out.append("")
    out.append("===== candidate 1: dword [0x5042D1A4] = 0x50403FBE (PHANTOM slot25 — see note) =====")
    out.append("# t084/t081 label was 'layer-table 0x5042D140 slot25'; structure correction:")
    out.append("# 0x5042D140 is a 5-entry thunk table; [0x5042D1A4] is class-2 long table 0x5042D154")
    out.append("# slot20. Body facts (trivial setter, ret 8) stand; the slot25 attribution was a")
    out.append("# mis-slice of one contiguous dword block into overlapping windows.")
    dump_body(out, dll, "0x50403FBE", 0x50403FBE, 0x40)
    out.append("===== candidate 2: dword [0x5042D268] = 0x50404E85 (PHANTOM slot25 — see note) =====")
    out.append("# t084 label was 'cluster outer 0x5042D204 slot25'; structure correction:")
    out.append("# 0x5042D204 is a 3-entry IUnknown table; [0x5042D268] is inner 0x5042D224 slot17")
    out.append("# (= beyond the 5-entry mid table's slot22 window). Body facts stand.")
    dump_body(out, dll, "0x50404E85 (+companion 0x50404EA7)", 0x50404E85, 0x60)
    out.append("===== candidate 3: REAL slot25 of BOTH long tables -> 0x5040418C (ret 0x3C) =====")
    out.append("# [0x5042D288] (T224 slot25) and [0x5042D1B8] (T154 slot25) both = 0x5040418C.")
    dump_body(out, dll, "0x5040418C head (full body in EV-74)", 0x5040418C, 0x100)
    out.append("===== EXE production wrapper 0x427EB3 (thiscall; ret 0x20 = 8 wrapper args) =====")
    out.append("# stack at call [eax+0x64] (low->high): this, [ebp+0xC], [ebp+0x10], [ebp+0x14],")
    out.append("# [ebp+0x18], [ebp+0x1C], VARIANT(byval, copy of wrapper [ebp+0x20]),")
    out.append("# VARIANT(byval, copy of wrapper [ebp+0x24]), &[ebp+0x24]  == 15 dwords == ret 0x3C")
    out.append("# after the call: *arg1(out) = [ebp+0x24] first dword (the slot25 out write)")
    dump_body(out, exe, "wrapper 0x427EB3", 0x427EB3, 0x100)
    out.append("===== EXE tile path window 0x666E8C..0x666FBA =====")
    out.append("# 0x666E8C: VARIANT pack (VT_ERROR-missing via 0x40318F/0xBE7330;")
    out.append("# VT_UNKNOWN layer-object via 0x411FE1); 0x666EA6 [0xBE2788] E_POINTER guard;")
    out.append("# 0x666EBC ecx=[0xBE2788]; 0x666ED5 call 0x427EB3;")
    out.append("# 0x666F72 call 0x42944A(&[ebp-0x10]) -> esi = the slot25 RESULT object;")
    out.append("# 0x666F7D call [esi+0xB4] slot45 ON THE RESULT OBJECT; 0x666FD4 call [eax+0xE0] slot56;")
    out.append("# 0x666FAC mov eax,[ebp-0x20]; call [[eax]+8] Release (C-074 slot-reuse model)")
    code = exe.read(0x666E8C, 0x12F)
    for ins in MD.disasm(code, 0x666E8C):
        out.append(fmt(ins))
    out.append("")
    out.append("===== EXE 0x42944A (null-assert getter returning the slot25 out object) =====")
    dump_body(out, exe, "0x42944A", 0x42944A, 0x40)
    out.append("===== VARIANT pack helpers =====")
    dump_body(out, exe, "0x411FE1 (V{VT_UNKNOWN,punk}; conditional AddRef)", 0x411FE1, 0x40)
    out.append("===== [this+0x128] belongs to slots 26/27/28 (NOT to 0x5040418C) =====")
    dump_body(out, dll, "inner slot26 0x50404ECA (collection contains)", 0x50404ECA, 0x30)
    dump_body(out, dll, "inner slot27 0x50404EE9 (collection add)", 0x50404EE9, 0x40)
    with open(os.path.join(OUTDIR, 'T0841-EV76-SLOT25-CANDIDATE-COMPARISON.txt'), 'w',
              encoding='utf-8', newline='\n') as f:
        f.write('\n'.join(out) + '\n')

    for n in ('T0841-EV74-SLOT25-5040418C-FULL.txt', 'T0841-EV75-IID-IDENTITY-CHAIN.txt',
              'T0841-EV76-SLOT25-CANDIDATE-COMPARISON.txt'):
        p = os.path.join(OUTDIR, n)
        print(f"{n} sha256={hashlib.sha256(open(p, 'rb').read()).hexdigest()}")


if __name__ == '__main__':
    main()
