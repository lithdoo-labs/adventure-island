"""Extract the physics loading functions and ALL WZ property names.
The Ghidra decompiled code uses unicode string labels like u_swimForce_00bd4044
which reveal the actual WZ field names."""
import csv as csv_mod
csv_mod.field_size_limit(50 * 1024 * 1024)
import sys, io, re
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

fns = {}
with open(r'E:\ghidra-projects\decompiled_v2.csv', encoding='utf-8') as f:
    for row in csv_mod.DictReader(f):
        fns[row['rva'].lower()] = row.get('decompiled', '')

# ===== 1. Extract the two physics loading functions =====
print('=== PHYSICS LOADING FUNCTIONS ===')
for rva in ['0x64d393', '0x6546bf']:
    code = fns.get(rva, '')
    if not code:
        print(f'\n{rva}: NOT FOUND')
        continue
    code = code.replace('\\n', '\n')
    print(f'\n{"="*60}')
    print(f'PHYSICS LOADER @ {rva}')
    print(f'{"="*60}')

    # Extract ALL string references (u_name_ADDR or s_name_ADDR patterns)
    strings = re.findall(r'[us]_(\w+)_([0-9a-f]+)', code)
    print(f'\nWZ property names referenced:')
    for name, addr in strings:
        print(f'  {name} @ {addr}')

    # Show the function body
    print(f'\nDecompiled code ({len(code)} chars):')
    print(code[:3000])

# ===== 2. Search ALL functions for WZ physics property names =====
print('\n' + '='*60)
print('ALL PHYSICS PROPERTY NAMES IN BINARY')
print('='*60)
# Search for all u_/s_ prefixed strings that could be WZ properties
all_wz_names = {}
for rva, code in fns.items():
    for m in re.finditer(r'[us]_([a-zA-Z_]\w+)_([0-9a-f]{6,8})', code):
        name = m.group(1)
        addr = m.group(2)
        if name not in all_wz_names:
            all_wz_names[name] = {'addr': addr, 'functions': [rva]}
        else:
            if len(all_wz_names[name]['functions']) < 5:
                all_wz_names[name]['functions'].append(rva)

# Filter for physics-related names
physics_keywords = ['walk', 'jump', 'grav', 'swim', 'fly', 'speed', 'force',
                    'acc', 'dec', 'frict', 'climb', 'rope', 'ladder',
                    'spring', 'fall', 'slip', 'move']
print('\nPhysics-related WZ names:')
for name, info in sorted(all_wz_names.items()):
    if any(kw in name.lower() for kw in physics_keywords):
        print(f'  {name:20s} @ {info["addr"]} in {len(info["functions"])} fns: {info["functions"][:3]}')

# Also show ALL names for completeness
print(f'\nTotal unique WZ property names found: {len(all_wz_names)}')
print('\nAll names (first 50):')
for i, (name, info) in enumerate(sorted(all_wz_names.items())[:50]):
    print(f'  {name:30s} @ {info["addr"]}')

# ===== 3. Search for the footholdMgr initialization =====
print('\n' + '='*60)
print('FOOTHOLD MGR GLOBAL INITIALIZATION')
print('='*60)
# DAT_00bdd498 → look for who SETS this value
for rva, code in fns.items():
    if re.search(r'DAT_00bdd498\s*=', code):
        code_clean = code.replace('\\n', '\n')
        lines = [l.strip() for l in code_clean.split('\n') if 'bdd498' in l]
        print(f'\n{rva}:')
        for l in lines[:3]:
            print(f'  {l[:80]}')
