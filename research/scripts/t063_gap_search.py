"""Systematic gap closure using Ghidra decompiled code.
All 8 gaps from user's list, targeting the containing functions found earlier."""
import csv as csv_mod
csv_mod.field_size_limit(50 * 1024 * 1024)
import sys, io, re, struct
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

fns = {}
with open(r'E:\ghidra-projects\decompiled_v2.csv', encoding='utf-8') as f:
    for row in csv_mod.DictReader(f):
        fns[row['rva'].lower()] = row.get('decompiled', '')

def get(rva):
    return fns.get(rva, '').replace('\\n', '\n')

results = {}

# ================================================================
# GAP 1: Swim flag — map field+0x150 → global [0xBDF54C]+0x150
# ================================================================
print('=== GAP 1: SWIM FLAG CONNECTION ===')
# 0x534C60 is map load function (RVA 0x134C60... no, VA 0x534C60 → RVA 0x134C60)
# Actually user said "0x534C86" reads swim. VA 0x534C86 → RVA 0x134C86
# The global [0xBDF54C] is the Delegate singleton

# Search for functions that read DAT_00bdf54c AND have +0x150
swim_conn = []
for rva, code in fns.items():
    if 'DAT_00bdf54c' in code and '150' in code:
        swim_conn.append(rva)
print(f'Functions referencing [0xBDF54C] and containing 150: {len(swim_conn)}')
for rva in swim_conn[:5]:
    code = get(rva)
    # Find the +0x150 access
    lines_150 = [l.strip() for l in code.split('\n') if '150' in l and ('0x' in l or '+' in l)]
    print(f'  {rva}: {lines_150[:3]}')

# Search for functions that write to the global's +0x150
# The global [0xBDF54C] points to a "Delegate" object
# Map load writes field+0x150; something must copy it to the delegate
# Search for 0x150 writes near DAT_00bdf54c references
for rva in swim_conn:
    code = get(rva)
    if re.search(r'DAT_00bdf54c.*0x150|0x150.*DAT_00bdf54c', code, re.DOTALL):
        print(f'  *** DIRECT CONNECTION: {rva}')
        # Show the relevant section
        idx = code.find('DAT_00bdf54c')
        context = code[max(0,idx-200):idx+400]
        print(f'  {context[:300]}')

# ================================================================
# GAP 2: Swim animation — which motion index when swim==1
# ================================================================
print('\n=== GAP 2: SWIM ANIMATION ===')
# Motion table at 0xBDDB10. Look for any reference to swim-related strings
# Check if there's a "swim" string in the decompiled code
swim_str_refs = []
for rva, code in fns.items():
    if re.search(r'"swim"|"Swim"|"SWIM"', code):
        swim_str_refs.append(rva)
print(f'Functions containing "swim" string: {len(swim_str_refs)}')
for rva in swim_str_refs:
    code = get(rva)
    lines = [l.strip() for l in code.split('\n') if 'swim' in l.lower()]
    print(f'  {rva}: {lines[:2]}')

# Check the motion table registration (0x4A87FD area)
motion_reg = get('0xa87fd')  # VA 0x4A87FD → RVA 0xA87FD
if not motion_reg:
    motion_reg = get('0xa7fd')  # try shorter
if motion_reg:
    print(f'\nMotion registration function found')
    # Find all string references
    strings = re.findall(r'FUN_007a48d0\([^)]*"?([^"]*)"?\)', motion_reg)
    print(f'  Strings registered: {strings}')
else:
    # Search for the motion table area
    print('\nSearching for motion table references...')
    for rva, code in fns.items():
        if 'DAT_00bddb10' in code:
            print(f'  {rva}: references motion table')
            # Show context
            lines = [l.strip() for l in code.split('\n') if 'DAT_00bddb10' in l or '0x18' in l]
            print(f'    {lines[:3]}')

# ================================================================
# GAP 3: Jump formula field names
# ================================================================
print('\n=== GAP 3: JUMP FORMULA FIELDS ===')
# The decrypt function 0x6A0545 (RVA 0x2A0545) decrypts WZ doubles
# The source is [move+0x190]+offset and [move+0x198]+offset
# These are WZ Property nodes — the field names would be in WZ, not in the exe
# But we can check what WZ file these come from by looking at how move+0x190 is set

# Search for functions that write to move+0x190 or move+0x198
for target_off in ['0x190', '0x198']:
    writers = []
    for rva, code in fns.items():
        if re.search(rf'\+\s*{target_off}\b.*=', code):
            writers.append(rva)
    print(f'Functions writing +{target_off}: {len(writers)}')
    for rva in writers[:3]:
        code = get(rva)
        lines = [l.strip() for l in code.split('\n') if target_off in l and '=' in l]
        print(f'  {rva}: {lines[:2]}')

# ================================================================
# GAP 4: +0x80/+0x98 ladder/rope rectangle
# ================================================================
print('\n=== GAP 4: LADDER/ROPE +0x80/+0x98 ===')
# 0x9D7D4F reads +0x80 and +0x98. VA→RVA: 0x5D7D4F
rope_code = get('0x5d7d4f')
if rope_code:
    print(f'Found rope rectangle function at 0x5D7D4F')
    # Find who writes +0x80 and +0x98
    for target_off in ['0x80', '0x98']:
        writers = []
        for rva, code in fns.items():
            # Look for writes to +0x80/+0x98 in context of position
            if re.search(rf'\(\([^)]*\+\s*{target_off}\)\)\s*=', code):
                if '0x20' in code or '0x38' in code or 'position' in code.lower():
                    writers.append(rva)
        print(f'  Functions writing +{target_off} (near position): {len(writers)}')
        for rva in writers[:3]:
            code = get(rva)
            lines = [l.strip() for l in code.split('\n') if target_off in l and '=' in l]
            print(f'    {rva}: {lines[:2]}')

# ================================================================
# GAP 5: Attack swing/stab
# ================================================================
print('\n=== GAP 5: ATTACK SWING/STAB ===')
# 0x55C5B2 is the attack dispatcher (58KB). Search for 5 and 0x10 as indices
atk_code = get('0x55c5b2')
if atk_code:
    print(f'Attack dispatcher: {len(atk_code)} chars')
    # Search for motion table index patterns
    # Table base is 0xBDDB10, each entry 0x18 bytes
    # Index 5 = swingO1, Index 0x10 = stabO1
    # Look for multiplication by 0x18 and reference to 0xBDDB10
    for pat, label in [
        (r'0xbddb10', 'motion table base ref'),
        (r'0x18.*mult|mult.*0x18|0x18\s*\*', 'entry stride 0x18'),
        (r'\b5\b.*0x18|0x18.*\b5\b', 'index 5 (swing)'),
        (r'0x10.*0x18|0x18.*0x10', 'index 0x10 (stab)'),
    ]:
        matches = re.findall(pat, atk_code, re.IGNORECASE)
        print(f'  {label}: {len(matches)} occurrences')

    # Search for conditional that selects between two paths
    # Look for if/else with different constants
    swing_select = re.findall(
        r'if\s*\([^)]*(?:weapon|attack|type|job|motion)[^)]*\)\s*\{[^}]*?(\d+)[^}]*?\}',
        atk_code, re.IGNORECASE)
    print(f'  Conditional selectors: {len(swing_select)}')
    for s in swing_select[:5]:
        print(f'    -> {s}')

# ================================================================
# GAP 6: Sit/crouch +0x158
# ================================================================
print('\n=== GAP 6: SIT/CROUCH +0x158 ===')
sit_code = get('0x552f1f')
if sit_code:
    print(f'Sit function: {len(sit_code)} chars')
    # Look for +0x158 write and any animation reference
    lines_158 = [l.strip() for l in sit_code.split('\n') if '158' in l or '0x158' in l]
    print(f'  +0x158 writes: {lines_158[:3]}')
    # Look for string references (animation names)
    strings = re.findall(r'FUN_007a48d0\([^)]*"([^"]*)"', sit_code)
    print(f'  String refs: {strings}')
    # Look for DAT_00bddb10 (motion table)
    if 'bddb10' in sit_code:
        print('  References motion table!')

# ================================================================
# GAP 7: field+0x13C bit 17
# ================================================================
print('\n=== GAP 7: FIELD +0x13C BIT 17 ===')
fall_code = get('0x55308c')
if fall_code:
    print(f'Fall-down gate: {len(fall_code)} chars')
    # Find the bit 17 check
    lines_13c = [l.strip() for l in fall_code.split('\n') if '13c' in l or '0x13c' in l]
    print(f'  +0x13C refs: {lines_13c[:3]}')
    # Find 0x20000 (= bit 17)
    lines_20000 = [l.strip() for l in fall_code.split('\n') if '20000' in l or '0x20000' in l]
    print(f'  0x20000 refs: {lines_20000[:3]}')

# ================================================================
# GAP 8: Teleport coordinate write +0x20/+0x38
# ================================================================
print('\n=== GAP 8: TELEPORT COORD WRITE ===')
# Search for functions that write +0x20 and +0x38 (position)
# Using Ghidra decompiled indexing: +0x20 = param[8], +0x38 = param[14]
# (because int* indexing: 0x20/4=8, 0x38/4=14)
pos_writers = []
for rva, code in fns.items():
    # In decompiled code, +0x20 is [param + 8] and +0x38 is [param + 14]
    # Or it could be [param_1 + 0x20] depending on Ghidra's rendering
    has_20 = re.search(r'\[\w+ \+ (?:8|0x20)\]\s*=', code)
    has_38 = re.search(r'\[\w+ \+ (?:14|0x38|0xe)\]\s*=', code)
    if has_20 and has_38:
        # Make sure it's a position write (near ReadInt32 or portal context)
        if 'FUN_004066ff' in code or 'portal' in code.lower() or '0x563' in code:
            pos_writers.append(rva)

print(f'Functions writing position (+0x20/+0x38) near portal context: {len(pos_writers)}')
for rva in pos_writers[:5]:
    code = get(rva)
    lines = [l.strip() for l in code.split('\n')
             if ('+ 8]' in l or '+ 14]' in l or '+ 0x20]' in l or '+ 0x38]' in l) and '=' in l]
    print(f'  {rva}:')
    for l in lines[:4]:
        print(f'    {l[:70]}')
