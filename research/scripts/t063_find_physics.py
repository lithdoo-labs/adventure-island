"""Search for Physics.img path strings and WZ property references in the game image
and decompiled code. Also extract Etc.wz contents from the server XML."""
import csv as csv_mod
csv_mod.field_size_limit(50 * 1024 * 1024)
import sys, io, os, re, glob, struct
from xml.etree import ElementTree as ET
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

IMG = '.work/task-036/game-image-unpacked.bin'
img = open(IMG, 'rb').read()
BASE = 0x400000

# ===== 1. Search raw image for "Physics" / "physics" strings =====
print('=== 1. RAW IMAGE: Physics/BASIC EFF/SWIM strings ===')
for term in [b'Physics', b'physics', b'PHYSICS', b'BasicEff', b'Swim', b'swim',
             b'walkForce', b'jumpSpeed', b'gravityAcc', b'swimForce', b'flyJumpDec',
             b'ladder', b'rope', b'Ladder', b'Rope']:
    pos = 0
    hits = []
    while True:
        pos = img.find(term, pos)
        if pos == -1:
            break
        # Get context (null-terminated string)
        end = img.find(b'\x00', pos)
        if end > pos and end - pos < 60:
            s = img[pos:end]
            # Check if it's a clean ASCII string
            if all(32 <= b < 127 for b in s):
                hits.append((pos, s.decode('ascii')))
        pos += len(term)
    if hits:
        print(f'{term.decode()}: {len(hits)} hits')
        for offset, s in hits[:5]:
            print(f'  RVA {hex(offset)}: "{s[:50]}"')

# ===== 2. Search decompiled code for Physics/WZ path references =====
print('\n=== 2. DECOMPILED: Physics path references ===')
fns = {}
with open(r'E:\ghidra-projects\decompiled_v2.csv', encoding='utf-8') as f:
    for row in csv_mod.DictReader(f):
        fns[row['rva'].lower()] = row.get('decompiled', '')

for term in ['Physics', 'physics', 'BasicEff', 'swim', 'Swim']:
    refs = []
    for rva, code in fns.items():
        if term in code:
            refs.append(rva)
    if refs:
        print(f'{term}: {len(refs)} functions')
        for rva in refs[:3]:
            code = fns[rva].replace('\\n', '\n')
            lines = [l.strip() for l in code.split('\n') if term in l]
            print(f'  {rva}: {lines[:2]}')

# ===== 3. Check Etc.wz server XML for anything physics-related =====
print('\n=== 3. ETC.WZ server XML ===')
etc_dir = r'.work\task-002\server\079V5\wz\Etc.wz'
if os.path.exists(etc_dir):
    for fn in sorted(os.listdir(etc_dir)):
        if fn.endswith('.img.xml'):
            print(f'  {fn}')
else:
    print('Etc.wz directory not found')

# ===== 4. Extract actual Physics.img from client WZ (binary) =====
print('\n=== 4. CLIENT WZ: Looking for Physics.img ===')
client_wz = r'.work\task-001\extracted\冒险岛online'
for root_dir, dirs, files in os.walk(client_wz):
    for fn in files:
        if 'physic' in fn.lower() or 'eff' in fn.lower() and 'basic' in fn.lower():
            print(f'  Found: {os.path.join(root_dir, fn)}')

# Check if there's an Etc.wz directory in the server that contains Damage/Physics
for wz_subdir in ['Etc.wz', 'etc']:
    path = os.path.join(r'.work\task-002\server\079V5\wz', wz_subdir)
    if os.path.exists(path):
        print(f'\nServer {wz_subdir} contents:')
        for fn in sorted(os.listdir(path)):
            print(f'  {fn}')

# ===== 5. Search for the WZ property path used to load physics =====
print('\n=== 5. WZ PROPERTY PATH SEARCH ===')
# The physics values are loaded from WZ via property paths like:
# "Physics.img/walkForce" or "Etc.img/Physics/walkForce"
# Search for common WZ path patterns in the string pool
for pat in [rb'Etc\.img/[A-Za-z]+', rb'Physics\.img[A-Za-z/]*', rb'BasicEff\.img[A-Za-z/]*',
            rb'Damage\.img[A-Za-z/]*', rb'Speed\.img[A-Za-z/]*']:
    for m in re.finditer(pat, img):
        end = img.find(b'\x00', m.start())
        if end > m.start() and end - m.start() < 60:
            s = img[m.start():end]
            if all(32 <= b < 127 for b in s):
                print(f'  RVA {hex(m.start())}: "{s.decode()}"')

# ===== 6. Search footholdMgr global +0x70 initialization =====
print('\n=== 6. FOOTHOLD MGR INITIALIZATION ===')
# The footholdMgr is [0xBDD498]+8, its +0x70 is gravityAcc
# Search for who writes to this address
# In Ghidra: DAT_00bdd498 → foothold mgr global
for rva, code in fns.items():
    if 'DAT_00bdd498' in code:
        # Check if this function writes to +8 or +0x70
        lines = [l.strip() for l in code.replace('\\n', '\n').split('\n')
                 if 'bdd498' in l or ('0x70' in l and '=' in l) or ('0x48' in l and '=' in l)]
        if lines:
            print(f'  {rva}:')
            for l in lines[:4]:
                print(f'    {l[:80]}')
