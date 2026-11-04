"""Task 053 Phase F: analyze a post-login capture.
Re-runs the Task-052 Phase A/B logic on a new ELF dump:
S-box anchors -> game-process filter -> schedule carve -> key verdict.
"""
import struct, sys, io, csv
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

SBOX = bytes.fromhex(
    '637c777bf26b6fc53001672bfed7ab76ca82c97dfa5947f0add4a2af9ca472c0'
    'b7fd9326363ff7cc34a5e5f171d8311504c723c31896059a071280e2eb27b275'
    '09832c1a1b6e5aa0523bd6b329e32f8453d100ed20fcb15b6acbbe394a4c58cf'
    'd0efaafb434d338545f9027f503c9fa851a3408f929d38f5bcb6da2110fff3d2'
    'cd0c13ec5f974417c4a77e3d645d197360814fdc222a908846eeb814de5e0bdb'
    'e0323a0a4906245cc2d3ac629195e479e7c8376d8dd54ea96c56f4ea657aae08'
    'ba78252e1ca6b4c6e8dd741f4bbd8b8a703eb5664803f60e613557b986c11d9e'
    'e1f8981169d98e949b1e87e9ce5528df8ca1890dbfe6426841992d0fb054bb16')
RCON = [0x01, 0x02, 0x04, 0x08, 0x10, 0x20, 0x40, 0x80, 0x1b, 0x36]

def expand256(key32):
    w = [list(key32[i*4:i*4+4]) for i in range(8)]
    for i in range(8, 60):
        t = list(w[i-1])
        if i % 8 == 0:
            t = t[1:] + t[:1]
            t = [SBOX[b] for b in t]
            t[0] ^= RCON[i//8 - 1]
        elif i % 8 == 4:
            t = [SBOX[b] for b in t]
        w.append([w[i-8][j] ^ t[j] for j in range(4)])
    return bytes(b for word in w for b in word)

SERVER_KEY_WS = bytes((0x13, 0, 0, 0, 0x08, 0, 0, 0, 0x06, 0, 0, 0, 0xB4, 0, 0, 0,
                      0x1B, 0, 0, 0, 0x0F, 0, 0, 0, 0x33, 0, 0, 0, 0x52, 0, 0, 0))

def run(elf_path):
    f = open(elf_path, 'rb')
    hdr = f.read(64)
    phoff = struct.unpack('<Q', hdr[32:40])[0]
    phentsize, phnum = struct.unpack('<HH', hdr[54:58])
    f.seek(phoff)
    segs = []
    for i in range(phnum):
        ph = f.read(phentsize)
        if struct.unpack('<I', ph[0:4])[0] == 1:
            segs.append((struct.unpack('<Q', ph[8:16])[0],
                         struct.unpack('<Q', ph[16:24])[0],
                         struct.unpack('<Q', ph[32:40])[0]))
    anchors = []
    for offset, vaddr, filesz in segs:
        f.seek(offset)
        pos = 0
        prev_tail = b''
        while pos < filesz:
            n = min(0x100000, filesz - pos)
            data = prev_tail + f.read(n)
            start = pos - len(prev_tail)
            p = data.find(SBOX)
            while p != -1:
                anchors.append(vaddr + start + p)
                p = data.find(SBOX, p + 1)
            prev_tail = data[-256:]
            pos += n
    print(f'S-box anchors: {len(anchors)}')
    for a in anchors[:20]:
        print(f'  {a:#x}')
    # schedule scan around each anchor
    found = []
    for a in anchors:
        fo = None
        for offset, vaddr, filesz in segs:
            if vaddr <= a < vaddr + filesz:
                fo = offset + (a - vaddr)
                break
        if fo is None:
            continue
        f.seek(max(0, fo - 0x1000))
        data = f.read(0x2000)
        for off in range(0, len(data) - 240, 4):
            key32 = data[off:off+32]
            if key32 == bytes(32):
                continue
            if data[off:off+240] == expand256(key32):
                found.append((a, key32))
    print(f'self-consistent AES-256 schedules: {len(found)}')
    for a, k in found[:10]:
        verdict = '== SERVER KEY (word-swapped)' if k == SERVER_KEY_WS else 'DIFFERENT KEY'
        print(f'  near {a:#x}: {k.hex()} {verdict}')
    # table 0xBD4130 (client image .data) — read via game segment if present
    # (game image base 0x400000; check segment containing VA 0xBD4130+0x400000)
    target = 0x400000 + 0xBD4130
    for offset, vaddr, filesz in segs:
        if vaddr <= target < vaddr + filesz:
            f.seek(offset + (target - vaddr))
            tbl = f.read(64)
            print(f'table@0xBD4130 first 32B: {tbl[:32].hex()}')
            break
    return anchors, found

if __name__ == '__main__':
    run(sys.argv[1] if len(sys.argv) > 1 else r'.work\task-053\captures\t053-mem.elf')
