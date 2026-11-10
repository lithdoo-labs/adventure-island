"""Task 063: Movement physics deep-dive.
Target the specific gaps the user identified:
1. Swim flag: map+0x150 → global → character
2. 0x9BD58F: velocity integration (walking/swimming/gravity)
3. Jump formula: walkForce/jumpSpeed/gravityAcc
4. +0x80/+0x98: ladder vs rope
5. +0x158: sit/crouch (prone)
6. field+0x13C bit 17: forbidFallDown
7. +0x20/+0x38: teleport coordinate write
8. Swim animation selection
"""
import csv as csv_mod
csv_mod.field_size_limit(50 * 1024 * 1024)
import sys, io, os, re
from collections import Counter
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

DECOMP = r'E:\ghidra-projects\decompiled_v2.csv'

# Load decompiled code
fns = {}
with open(DECOMP, encoding='utf-8') as f:
    reader = csv_mod.DictReader(f)
    for row in reader:
        fns[row['rva'].lower()] = row.get('decompiled', '')
print(f'Loaded {len(fns)} decompiled functions')

# ===== 1. Analyze 0x9BD58F (velocity integration) =====
print('\n' + '='*60)
print('1. VELOCITY INTEGRATION @ 0x9BD58F')
print('='*60)
code = fns.get('0x9bd58f', '')
if code:
    code = code.replace('\\n', '\n')
    # Apply symbol substitutions
    SUBS = {
        'FUN_004066ff': 'ReadInt32', 'FUN_004066c9': 'ReadByte',
        'DAT_00bd9028': 'CWvsContext', 'FUN_00495c5c': 'SendPacket',
        'DAT_00bd9024': 'SocketSingleton',
    }
    for old, new in SUBS.items():
        code = code.replace(old, new)
    print(code[:3000])
else:
    print('NOT FOUND in decompiled output')

# ===== 2. Search for swim-related functions =====
print('\n' + '='*60)
print('2. SWIM FLAG (map+0x150)')
print('='*60)
swim_hits = []
for rva, code in fns.items():
    if '150' in code and ('swim' in code.lower() or '150' in code):
        # Look for +0x150 access patterns
        if re.search(r'\+\s*0x150\b', code):
            swim_hits.append((rva, code))
print(f'Functions accessing +0x150: {len(swim_hits)}')
for rva, code in swim_hits[:5]:
    code_clean = code.replace('\\n', '\n')[:800]
    print(f'\n--- {rva} ---')
    print(code_clean)

# ===== 3. Search for jump/gravity physics =====
print('\n' + '='*60)
print('3. JUMP/PHYSICS (double-precision math near movement)')
print('='*60)
# Jump typically involves: jumpSpeed * jumpCount, gravity accumulation
# Look for functions with floating-point constants near velocity modification
jump_candidates = []
for rva, code in fns.items():
    # Look for double constants commonly used in jump physics
    if any(k in code for k in ['0.25', '0.5', '0.75', '1.5', '2.0', '3.0',
                                 '0x3ff0000000000000',  # 1.0
                                 '0x4000000000000000',  # 2.0
                                 '0x4008000000000000',  # 3.0
                                 ]):
        # And has velocity-like patterns
        if '9bd58f' in code.lower() or '0x9bd58f' in code.lower():
            jump_candidates.append((rva, code))
        # Or is near the known physics address
        try:
            rva_val = int(rva, 16)
            if 0x9BD000 <= rva_val <= 0x9BE000:
                jump_candidates.append((rva, code))
        except ValueError:
            pass

print(f'Physics-related functions near 0x9BD58F: {len(jump_candidates)}')
for rva, code in jump_candidates[:3]:
    code_clean = code.replace('\\n', '\n')[:1200]
    print(f'\n--- {rva} ---')
    print(code_clean)

# ===== 4. Search for ladder/rope (+0x80, +0x98) =====
print('\n' + '='*60)
print('4. LADDER/ROPE (+0x80, +0x98)')
print('='*60)
ladder_hits = []
for rva, code in fns.items():
    if re.search(r'\+\s*0x80\b', code) and re.search(r'\+\s*0x98\b', code):
        ladder_hits.append((rva, code))
print(f'Functions accessing both +0x80 and +0x98: {len(ladder_hits)}')
for rva, code in ladder_hits[:3]:
    code_clean = code.replace('\\n', '\n')[:800]
    print(f'\n--- {rva} ---')
    print(code_clean)

# ===== 5. Search for prone/sit (+0x158) =====
print('\n' + '='*60)
print('5. SIT/CROUCH (+0x158 = prone)')
print('='*60)
prone_hits = []
for rva, code in fns.items():
    if re.search(r'\+\s*0x158\b', code):
        prone_hits.append((rva, code))
print(f'Functions accessing +0x158: {len(prone_hits)}')
for rva, code in prone_hits[:5]:
    code_clean = code.replace('\\n', '\n')[:600]
    print(f'\n--- {rva} ---')
    print(code_clean)

# ===== 6. Search for field+0x13C bit 17 =====
print('\n' + '='*60)
print('6. FIELD +0x13C bit 17 (forbidFallDown)')
print('='*60)
bit17_hits = []
for rva, code in fns.items():
    if re.search(r'\+\s*0x13c\b', code):
        if '0x20000' in code or '131072' in code or '17' in code:
            bit17_hits.append((rva, code))
        elif 'test' in code or 'and' in code.lower() or '&' in code:
            bit17_hits.append((rva, code))
print(f'Functions accessing +0x13C with bit test: {len(bit17_hits)}')
for rva, code in bit17_hits[:5]:
    code_clean = code.replace('\\n', '\n')[:600]
    print(f'\n--- {rva} ---')
    print(code_clean)

# ===== 7. Search for coordinate write (+0x20, +0x38) =====
print('\n' + '='*60)
print('7. TELEPORT COORDINATE WRITE (+0x20, +0x38)')
print('='*60)
coord_hits = []
for rva, code in fns.items():
    # Look for functions that write to both +0x20 and +0x38
    if re.search(r'\+\s*0x20\b.*=\s', code) and re.search(r'\+\s*0x38\b.*=\s', code):
        coord_hits.append((rva, code))
print(f'Functions writing to +0x20 and +0x38: {len(coord_hits)}')
for rva, code in coord_hits[:5]:
    code_clean = code.replace('\\n', '\n')[:600]
    print(f'\n--- {rva} ---')
    print(code_clean)
