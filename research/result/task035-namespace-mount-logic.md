# Task 035 — NameSpace.dll WZ mount flow (E2, method-level)

Module: `NameSpace.dll` (imgbase 0x50800000). Disassembly logs:
`.work/task-035/logs/e2*.txt`.

## Class inventory (RTTI, proven)

CWzStream · CWzNameSpaceProperty · CWzNameSpace · CWzFileSystem ·
CWzPackage · CWzRawArchive · CArchiveSource · CWzArchive — the archive
mount chain, with 026 vtable candidates 0x1775C (namespace family) /
0x18940 (raw archive family) / 0x13440 (archive).

## Dynamic binding (all imports by name)

NameSpace binds EVERYTHING at runtime — the name strings sit in .rdata:

- `KERNEL32.dll`: InterlockedIncrement/Decrement, GetProcAddress,
  LocalFree, HeapDestroy, FreeLibrary, **LoadLibraryA, SetFilePointer,
  MapViewOfFile, CreateFileMappingA, OpenFileMappingA**
- `USER32.dll`: wsprintfA; `OLEAUT32.dll`; `MSVCRT.dll`: memcpy/sprintf/
  memcmp/memmove/**_lrotl/_lrotr** (rotate ops — the WZ string-decrypt
  shuffles), wcslen/wcscmp
- `PCOM.dll`: the five Pc* functions via BindPCOM @ 0x9A8D (see the E1
  doc)

## Mount mechanics (proven)

- **Memory-mapped file access**: CreateFileMappingA + MapViewOfFile +
  SetFilePointer (+ OpenFileMappingA for shared-memory access) — WZ
  archives are mounted as file mappings, not read loops.
- The namespace tree attaches through **PcRootNameSpace** (the PCOM
  singleton) — archives mount INTO the shared tree.
- The NotifyAlloc xref (string @ 0x1D244, code @ 0x23E9 zone) belongs to
  the small-object/factory plumbing (an object with vtable 0x508024EF is
  constructed and AddRef'd) — allocator-notification glue toward the
  host's memory regime.

## Dead-code finding

The 2002-era plaintext header string
`"Package file v1.0 Copyright 2002 Wizet, ZMS"` (RVA 0x18C98) has **no
code references anywhere** (push/mov/lea/VA-dword all searched, in every
module containing it). The v079 mount path does NOT check the plaintext
header — consistent with the PKG1-encrypted archives that Task 023's
third-party libraries parse. The string is a legacy leftover of the
2002 format.

## The observable mount contract (for the architecture record)

```text
CWzFileSystem → opens .wz via CreateFileMappingA/MapViewOfFile
CWzPackage    → the mounted archive (entry tables)
CWzRawArchive/CArchiveSource → raw stream + source abstraction
CWzArchive    → the parsed archive (node tree)
CWzNameSpace(+Property) → the tree the archive mounts into (root from
                          PCOM's PcRootNameSpace singleton)
CWzStream     → the shared stream base (also in Canvas/PCOM/Shape2D/
                Sound_DX8 — the common serialization substrate)
```
