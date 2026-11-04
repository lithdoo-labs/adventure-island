# Task 035 — PCOM framework internals (E1, method-level)

Module: `PCOM.dll` (imgbase 0x50C00000). All RVAs are module-relative;
all claims disassembly-proven (`.work/task-035/logs/e1-pcom.txt`).

## The exported API and its logic

### PcInitModule @ 0x104CA — framework registration

```c
HRESULT PcInitModule(HMODULE hSelf /* via global 0x1CB24 */) {
    if (!g_initialized /* 0x1CB84 */) return ...;
    GetModuleFileNameA(hSelf, buf, 0x104);          // IAT 0x210E4
    // scan backward from end for '\\' or '/', truncate -> directory
    // build a string object; store the directory into the module
    // registry singleton at RVA 0x1CB80 (lock-guarded)
    ...
    return 0x800401F9 on failure; // COM-style error
}
```

The registry singleton 0x1CB80 (+ locks 0x1CBAC/0x1CBCC, refcounts
0x1CBB0/0x1CBD0) is the framework's global state.

### PcCreateObject @ 0x4CD1 — the activator

```c
HRESULT PcCreateObject(CLSID rclsid, void** ppv, IUnknown* pOuter /*approx*/) {
    if (!g_initialized) return CO_E_NOTINITIALIZED;   // 0x800401F0
    if (!ppv) return E_POINTER;                        // 0x80004003
    if (local factory map at 0x1CBB4 contains rclsid)  // in-proc factory
        -> use it;
    else for each module record in the registry:
        hr = record->DllGetClassObject(rclsid,
                 IID_IClassFactory /* 00000001-0000-0000-C000-000000000046 @ RVA 0x14860 */,
                 &factory);
        if (ok) { factory->CreateInstance(...); break; }
    return E_INVALIDATTR on exhaustion;                // 0x80070057
}
```

**The GUID at RVA 0x14860 is the canonical `IID_IClassFactory`
(`00000001-0000-0000-C000-000000000046`)** — the engine DLLs implement
genuine COM class factories.

### Module record layout (from PcFreeUnusedLibraries @ 0x10691)

| Offset | Field | Evidence |
| --- | --- | --- |
| +0x00 | HMODULE | freed via IAT `FreeLibrary` (0x13010) when unloaded |
| +0x08 | DllGetClassObject | called by PcCreateObject's loop |
| +0x0C | DllCanUnloadNow | polled (`test eax,eax`; S_OK → unload) |
| +0x10 | factory/class map | iterated (+0x14 begin, +0x18 end) |

PcFreeUnusedLibraries loops the registry, polls DllCanUnloadNow, and on
S_OK releases the factory map, calls FreeLibrary, and erases the record.

### PcRootNameSpace @ 0x63BC

```c
HRESULT PcRootNameSpace(IWzNameSpace** pp) {
    if (!pp) return E_POINTER;
    lock(0x1CB88);
    *pp = g_rootNs /* 0x1CB90 singleton */;  (*pp)->AddRef() /* [vt+4] */;
    return S_OK;
}
```

The WZ namespace tree root is a PCOM-held singleton — every engine
module reaches the tree through this export.

### PcSerializeString @ 0x6411

Serializes a string with a two-tier length scheme: lengths ≥ 0x10000 go
through a wide-marker path (helper 0x64E3 receiving `len` and `len>>8`),
short lengths through 0x64DA7/0x85F5 — the WZ variable-length string
encoding used on stream write.

## The engine-side binding (from NameSpace.dll, E2)

Engine DLLs bind PCOM **by name at runtime** — NameSpace.dll's
`BindPCOM` @ 0x9A8D:

```c
pPcCreateObject        = GetProcAddress(h, "PcCreateObject");        // slot 0x5081EC28
pPcFreeUnusedLibraries = GetProcAddress(h, "PcFreeUnusedLibraries"); // 0x5081EC2C
pPcSerializeObject     = GetProcAddress(h, "PcSerializeObject");     // 0x5081EC30
pPcSerializeString     = GetProcAddress(h, "PcSerializeString");     // 0x5081EC34
pPcRootNameSpace       = GetProcAddress(h, "PcRootNameSpace");       // 0x5081EC38
// returns 1 only if all five resolved
```

**Net:** PCOM is a hand-rolled COM workalike — real COM IIDs and factory
semantics, but a 5-function flat API that every engine DLL resolves
dynamically, plus a registry of module records with unload polling.
