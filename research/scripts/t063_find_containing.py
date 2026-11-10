"""Search decompiled code for references to target addresses (as FUN_ calls or fallthrough)."""
import csv as csv_mod
csv_mod.field_size_limit(50 * 1024 * 1024)
import sys, io, re
from collections import defaultdict
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

DECOMP = r'E:\ghidra-projects\decompiled_v2.csv'
fns = {}
with open(DECOMP, encoding='utf-8') as f:
    reader = csv_mod.DictReader(f)
    for row in reader:
        fns[row['rva'].lower()] = row.get('decompiled', '')

# Convert target RVAs to Ghidra VA format (FUN_00XXXXXX)
TARGETS = {
    '0x9bd58f': 'FUN_009bd58f',  # velocity integration
    '0x6a0545': 'FUN_006a0545',  # decrypt double
    '0x9bd0de': 'FUN_009bd0de',  # swim jump
    '0x9bd088': 'FUN_009bd088',  # jump velocity write
    '0x95c5b2': 'FUN_0095c5b2',  # attack dispatcher
    '0x952f1f': 'FUN_00952f1f',  # sit write
    '0x95308c': 'FUN_0095308c',  # fall-down gate
    '0x963ce1': 'FUN_00963ce1',  # same-map teleport
    '0x95a31e': 'FUN_0095a31e',  # swim reader
    '0x9d7d4f': 'FUN_009d7d4f',  # rope rectangle
    '0x4376f2': 'FUN_004376f2',  # GetField singleton
}

# Also search for the DATA addresses as DAT_ references
DATA_TARGETS = {
    '0xbdf54c': 'DAT_00bdf54c',  # Delegate/field global
    '0xbdd498': 'DAT_00bdd498',  # foothold manager
    '0xbddb10': 'DAT_00bddb10',  # motion name table
}

print('Searching for function references...')
for rva, ghidra_name in TARGETS.items():
    # Search for calls to this function
    callers = []
    for fn_rva, code in fns.items():
        if ghidra_name in code:
            callers.append(fn_rva)

    # Check if the function itself exists (it may be a label within a larger function)
    self_code = fns.get(rva, '')

    print(f'\n{rva} ({ghidra_name}):')
    print(f'  self in decompiled: {"YES" if self_code else "NO"} ({len(self_code)} chars)')
    print(f'  referenced by: {len(callers)} functions')
    for c in callers[:5]:
        print(f'    {c}')

    # If not a standalone function, look for the nearest function containing this RVA
    if not self_code:
        rva_val = int(rva, 16)
        # Find the closest function below this RVA
        containing = None
        for fn_rva in fns:
            fn_val = int(fn_rva, 16)
            if fn_val <= rva_val and (containing is None or fn_val > int(containing, 16)):
                # Check if the function is large enough to contain our target
                code = fns[fn_rva]
                if len(code) > (rva_val - fn_val) * 2:  # rough heuristic
                    containing = fn_rva
        if containing:
            dist = rva_val - int(containing, 16)
            code = fns[containing]
            print(f'  likely contained in: {containing} (+0x{dist:x} bytes in)')

print('\n\nSearching for data references...')
for rva, ghidra_name in DATA_TARGETS.items():
    refs = []
    for fn_rva, code in fns.items():
        if ghidra_name in code:
            refs.append(fn_rva)
    print(f'\n{rva} ({ghidra_name}): referenced by {len(refs)} functions')
    for r in refs[:5]:
        print(f'    {r}')
