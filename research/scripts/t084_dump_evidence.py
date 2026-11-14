#!/usr/bin/env python3
"""T084: dump all analysis-evidence disassembly windows to
research/result/stage-readiness/forensics/T084-*.txt (regenerable).

Every dump self-describes: binary path, sha256, image model, va range.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
import t084_harness as hr

OUT = os.path.abspath(os.path.join(
    os.path.dirname(__file__), "..", "result", "stage-readiness", "forensics"))
os.makedirs(OUT, exist_ok=True)

EXE_HDR = (
    "# binary=.work/task-036/game-image-unpacked.bin\n"
    f"# sha256={hr.SHA}\n"
    "# image=exe base=0x400000 (fileOffset = VA - 0x400000)\n"
    "# generator=research/scripts/t084_dump_evidence.py (uses t084_harness.capstone)\n\n"
)

# name -> list of (label, va, size)
WINDOWS = {
    "T084-EV64-SLOT13-FORK.txt": [
        ("0x9BCA6F physics-family vtable slot13 body (commit rounded pos + ctx tracker)",
         0x9BCA6F, 0x229),
        ("0x9BCC9A rope-by-index lookup ([field+0xA8], stride 0x1C, index>=1)",
         0x9BCC9A, 0x2A),
        ("0x9BCCC4 adjacent helper (vt+0x24 probe / M+0x14C=1)",
         0x9BCCC4, 0x37),
        ("vtable slot13 sites (imm32 refs 0xB0C4CC..0xB0CCAC = base+0x34 of the 8 physics tables)",
         0xB0C4CC, 0x8),
    ],
    "T084-EV65-RECORD-ID-SIGN.txt": [
        ("0x6B87D1 record setter head (id derivation: [fh+0x48] or neg word)",
         0x6B87D1, 0xA5),
        ("0x6B8A18 record getter head (RNG-walk, id/flags outs)",
         0x6B8A18, 0x9E),
        ("0x6B8A18 id/flag out writes (record+0xC -> id out, record+0xA -> byte out)",
         0x6B8B4B, 0x14),
    ],
    "T084-EV66-ROPE-LOADER.txt": [
        ("field-load 0xA4D303 rope-table build (count via 0x409FFD, 0xA51577 alloc, stride 0x1C, index from 1)",
         0xA4EFCE, 0xD0),
        ("rope record fill loop (props 0x832 l -> +4, 0x833 uf -> +8, 0x331 x -> +0xC, 0x830 y1 -> +0x10, 0x831 y2 -> +0x14, 0x627 page -> +0x18; [rec+0]=index)",
         0xA4F091, 0x25E),
        ("0xA51577 rope-table allocator", 0xA51577, 0x60),
    ],
    "T084-EV67-FOOTHOLD-WRITER.txt": [
        ("0xA4F4B6 foothold record writer (10 args -> fh fields; vtables 0xAFE3F0->0xB0DDA4)",
         0xA4F4B6, 0x8D),
        ("0xA4F54A derived fields (len=sqrt(dx^2+dy^2) -> +0x40; unit dir -> +0x30/+0x38)",
         0xA4F54A, 0x59),
        ("foothold-object alloc + insert call site (0x58-byte alloc pool 0xBE1DE0; hashmap +0x90 insert; spatial +0x44 insert)",
         0xA4E974, 0x91),
        ("0xA513F6 hashmap find-or-insert (hash 5-key % buckets; node {next+4,key+8,value+0xC}, pool [0xBE7A28])",
         0xA513F6, 0xC6),
        ("node-name id parse blocks (layer/platform/fh-id via 0xA70518)",
         0xA4E1BA, 0x1D),
        ("[ebp-0x48] second node-name int (platform)", 0xA4E2E3, 0x1D),
        ("[ebp-0x78] innermost node-name int (foothold id) -> arg1 -> [fh+0x48]",
         0xA4E413, 0x1E),
    ],
    "T084-EV68-FIELD-OBJECT.txt": [
        ("field ctor 0xA4D393 (vtable 0xB0DD98; +0x44 collection; +0x90 hashmap 997 buckets vt 0xB0DD9C; +0xA8=0; [0xBDD498]=this)",
         0xA4D393, 0xC0),
        ("second ctor 0xA546BF (vtable 0xB0DE10; global [0xBE65F8]; same layout)",
         0xA546BF, 0xB0),
        ("field dtor tail clearing [0xBDD498]", 0xA4DDB1, 0x1E),
        ("0x4B6ABE encrypted-pair decrypt (returns decrypted value; used on M+0x124/+0x12C rope handle)",
         0x4B6ABE, 0x4E),
        ("climb body 0x9D80EC (uf top clamp [edi+8], top [edi+0x10], bottom [edi+0x14]; exit vt+0x14(M,0,0,0))",
         0x9D80EC, 0x12A),
        ("rope table readers: 0x9CC081 inline index lookup inside slot1 wrapper 0x9CBE4F",
         0x9CC077, 0x38),
    ],
    "T084-EV69-STANDUP.txt": [
        ("0x6A0ADF encrypted-pair integrity decryptor (NOT a stand-up function)",
         0x6A0ADF, 0x4E),
        ("0x965A09 user vt slot14 stand-up/seat reset (seat->0, chair-stance map 0x965A8F, notify 0x53E95D(M,0xB) gated by arg)",
         0x965A09, 0x84),
        ("0x965A8F chair item-id -> stance code map (0x2DED00-FF..0x2DEE2D)",
         0x965A8F, 0x4C),
        ("user vtable 0xB0BD28 (slot14 = 0x965A09)", 0xB0BD28, 0x40),
        ("reset-ctor call site 0x9500A3 (arg=1 suppresses move notify)", 0x950095, 0x14),
    ],
    "T084-EV70-OPCODE-0081.txt": [
        ("0x97EBC9 map-transition handler (alloc field 0x3048 -> 0x94FDB4 load new map -> 0x980A8C attach -> 0x9507F0 position write)",
         0x97EBC9, 0x96),
        ("0x533EA4 handler-family slot0 head (single caller chain of 0x97EBC9)",
         0x533EA4, 0x98),
        ("call site 0x533FF1 inside 0x533EA4", 0x533FE0, 0x1A),
        ("0x77E6F3 channel-context 0x81/0x82/0x83 dispatch (opcode collision proof)",
         0x77E6F3, 0x3C),
        ("handler-base vtable 0xB01414 (slot0=0x533EA4 slot2=0x666186 slot3=0x5348E8 slot12=0x53465B slot14=0x5346EF slot15=0x53471A)",
         0xB01414, 0xB0),
        ("imm32 refs to 0x5348E8 (33 handler vtables)", 0xB01308, 0x20),
    ],
    "T084-EV71-STACK-PACKAGE.txt": [
        ("0x43286E null-assert ctor (no compare logic)", 0x43286E, 0x1C),
        ("0x44484B attach+AddRef smartptr (no compare logic)", 0x44484B, 0x1B),
        ("0x429411 attach+AddRef smartptr twin (no compare logic)", 0x429411, 0x1B),
        ("0x43E3A6 property-PUT wrapper over 0x427EB3 (VARIANT init/cleanup; no compare logic)",
         0x43E3A6, 0xBE),
    ],
    "T084-EV73-SCENE-CAMERA.txt": [
        ("scene-init 0x5348E8 sequence (WZ load -> info -> reactors/npc/mob -> user attach)",
         0x5348E8, 0xA8),
        ("map-load 0x666186 order: tiles 0x666749 -> objs 0x6670C7 -> backs 0x669203 -> attr 0x66BC81 -> VR fold 0x66E59E -> life",
         0x6662DC, 0x40),
        ("per-tick dispatcher 0x53465B (fieldctx 0xA106C3 -> user tick 0x9533EA) + draw slot14 0x5346EF (0x953AF4)",
         0x53465B, 0x9C),
        ("cull/visibility slot15 0x53471A (args = camera rect; scene+0x1D0/+0x1D4 world bounds)",
         0x534743, 0x10E),
        ("view-size getters 0x66B4F6 (slot11 +0x2C) / 0x66B51D (slot12 +0x30)", 0x66B4F6, 0x48),
    ],
}


def dump(name, entries):
    lines = [EXE_HDR]
    for label, va, size in entries:
        lines.append(f"===== {label} =====")
        for ins in hr.dis(va, size):
            lines.append(f"{ins.address:08X}  {ins.bytes.hex():<22} {ins.mnemonic} {ins.op_str}")
        lines.append("")
    path = os.path.join(OUT, name)
    with open(path, "w", encoding="utf-8", newline="\n") as f:
        f.write("\n".join(lines) + "\n")
    print("wrote", path)


def main():
    for name, entries in WINDOWS.items():
        dump(name, entries)
    # DLL windows (separate image model) for EV72
    dll_dump()


def dll_dump():
    import struct
    import pefile
    from capstone import Cs, CS_ARCH_X86, CS_MODE_32
    dll_rel = os.path.join("..", "..", ".work", "task-001", "extracted",
                           "冒险岛online", "Gr2D_DX8.dll")
    dll = os.path.abspath(os.path.join(os.path.dirname(__file__), dll_rel))
    import hashlib
    digest = hashlib.sha256(open(dll, "rb").read()).hexdigest()
    pe = pefile.PE(dll, fast_load=True)
    base = 0x50400000
    data = open(dll, "rb").read()

    def rva2off(rva):
        for s in pe.sections:
            if s.VirtualAddress <= rva < s.VirtualAddress + max(s.Misc_VirtualSize, s.SizeOfRawData):
                d = rva - s.VirtualAddress
                if d < s.SizeOfRawData:
                    return s.PointerToRawData + d
        raise ValueError(rva)

    md = Cs(CS_ARCH_X86, CS_MODE_32)
    lines = [
        f"# binary=.work/task-001/extracted/冒险岛online/Gr2D_DX8.dll\n",
        f"# sha256={digest}\n",
        "# image=dll ImageBase=0x50400000 (PE section mapping)\n\n",
    ]
    for label, va, size in [
        ("outer 0x5042D204 vtable slots 0-27 (slot25 = +0x64 = 0x50404E85)", 0x5042D204, 0x70),
        ("inner 0x5042D224 vtable slots 0-27 (slot25 = 0x5040418C)", 0x5042D224, 0x70),
        ("mid 0x5042D210 vtable slots 0-27 (slot25 = 0x50403FBE)", 0x5042D210, 0x70),
        ("slot25 candidate body 0x50404E85 (boolean out getter)", 0x50404E85, 0x22),
        ("0x50404EA7 companion", 0x50404EA7, 0x22),
    ]:
        lines.append(f"===== {label} =====")
        off = rva2off(va - base)
        if size <= 0x70 and "vtable" in label:
            for i in range(size // 4):
                w = struct.unpack_from("<I", data, off + 4 * i)[0]
                lines.append(f"[{va + 4 * i:08X}] slot{i:2d} (+{i*4:#04x}) = {w:08X}")
        else:
            for ins in md.disasm(data[off:off + size], va):
                lines.append(f"{ins.address:08X}  {ins.bytes.hex():<20} {ins.mnemonic} {ins.op_str}")
        lines.append("")
    path = os.path.join(OUT, "T084-EV72-GR2D-CLUSTER-SLOT25.txt")
    with open(path, "w", encoding="utf-8", newline="\n") as f:
        f.write("\n".join(lines) + "\n")
    print("wrote", path)


if __name__ == "__main__":
    main()
