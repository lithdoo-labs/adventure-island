# Task 026 — Offline static characterization of the `iloveaki` repack layer

STARTING_HEAD `f8241f5c38bca54f0a07b3e39b05738bdbf5b594`. All analysis is
offline, read-only, on the on-disk client copy in
`.work/task-001/extracted/冒险岛online/`. No patching, no transformation.

## 0. Executive summary — the `iloveaki` layer is two files, and neither is opaque

The Task 025 "iloveaki boundary" is a **8,192-byte repack loader stub** that
replaced the client's `ijl15.dll`, plus a **renamed genuine Intel JPEG
library** (`iloveaki.dat`). The full loader logic disassembles to ~150
instructions and is now completely understood:

```text
MapleStory.exe (Wizet client wrapped in Oreans/WinLicense-style protector)
  └─ during its reconstructed import resolution loads ijl15.dll
       = repack stub (VC9, author "UFO", built 2012-02-17)
       └─ DllMain(DLL_PROCESS_ATTACH):
           1. LoadLibraryW(L"iloveaki.dat")            ; real Intel JPEG lib
           2. GetProcAddress ×6 → forward all ijl15 exports to it
           3. GetModuleHandleW(L"ntdll.dll")
              GetProcAddress("ZwCreateMutant")          ; ASCII string
           4. VirtualProtect(ZwCreateMutant+0x12, 5, RW)
              write E9 <rel32> → stub `add esp,4; xor eax,eax; ret 0x10`
              VirtualProtect restore                     ; anti-mutex hook
           5. MessageBoxW(0, L"iloveaki success.", L"iloveaki",
                          MB_ICONINFORMATION)            ; ← the modal gate
           (any earlier failure → MessageBoxW "iloveaki failed."
            + return FALSE → DLL/process load aborts)
```

The modal sits **inside DllMain**, i.e. the process holds the loader lock
while the box is up — exactly matching Task 025's "whole process message-idle
at 25 threads, CPU frozen at 2.6–2.7 s" observation. Dismissing the box lets
`DllMain` return TRUE and the protected exe continues.

## 1. `iloveaki.dat` — renamed original library (not repack code)

| Property | Value |
| --- | --- |
| Size | 352,256 bytes |
| SHA-256 | `41d37bfb0a39017497e0aa373dc01f71ac9c5046c75f7cd269bee52112a5f3a1` |
| Type | PE32 I386 DLL, GUI subsystem, characteristics 0x210E |
| ImageBase | `0x60000000` (matches runtime mapping seen in Task 025) |
| Entry RVA | `0x46c8f` |
| Sections | `.text` 0x1000 (0x4b50a, entropy 6.50), `.rdata` 0x4d000, `.data` 0x4e000, `.data1` 0x52000, `.rsrc` 0x54000, `.reloc` 0x55000 (3,458 relocs/61 blocks) |
| Linker | 6.0 (VC6-era); TimeDateStamp 0x3B15682B (2001-05-30) |
| Internal name | `ijl15.dll`; exports `ijlErrorStr@0x2b120, ijlFree@0x291f0, ijlGetLibVersion@0x2b110, ijlInit@0x28a60, ijlRead@0x29be0, ijlWrite@0x2a700` |
| Version info | Intel Corporation, "Intel® JPEG Library - Retail Version", FileVersion 1,51,12,44, copyright 1998–2001 |
| Imports | KERNEL32 only (57 CRT-ish functions), USER32 (MessageBoxA present but this is CRT startup machinery) |

**Identity: this is the genuine Intel JPEG Library 1.51 retail DLL with its
filename changed.** It contains no `iloveaki success.` string, no MapleStory
strings, no repack logic (string inventory: 603 distinct strings, all
JPEG/Intel/CRT). The name `iloveaki.dat` is only a label the stub looks up.

## 2. `ijl15.dll` — the actual repack loader stub

| Property | Value |
| --- | --- |
| Size | 8,192 bytes |
| SHA-256 | `b1bc97dc2913b8f92eeb9f369570202df0fddabcb0d6cc6609504783ac1df0f2` |
| Type | PE32 I386 DLL, GUI, characteristics 0x2102 |
| ImageBase / entry RVA | `0x10000000` / `0x1530` (CRT entry; repack DllMain at `0x10e0`) |
| DllCharacteristics | 0x140 (DYNAMIC_BASE, NX_COMPAT) |
| Linker | 9.0 (VS2008); TimeDateStamp 0x4F3E018B (2012-02-17) |
| Codeview PDB | `C:\Users\UFO\Documents\Visual Studio 2008\Projects\IJL15\Release\IJL15.pdb` |
| Manifest | asInvoker; depends on Microsoft.VC90.CRT 9.0.21022.8 (explains `MSVCR90.dll` at runtime) |
| Sections | `.text` 0x1000 (0xa10 usable), `.rdata` 0x2000, `.data` 0x3000, `.rsrc` 0x4000, `.reloc` 0x5000 (170 relocs) |
| Exports | `ijlGetLibVersion@0x1070, ijlInit@0x1080, ijlFree@0x1090, ijlRead@0x10a0, ijlWrite@0x10b0, ijlErrorStr@0x10c0` — each is `jmp dword ptr [slot]` into `iloveaki.dat` |
| Imports | KERNEL32 (LoadLibraryW, GetProcAddress, GetModuleHandleW, VirtualProtect, IsDebuggerPresent, …), USER32 (**MessageBoxW** — sole user32 import), MSVCR90 (CRT) |

### Key functions (complete inventory — the stub is tiny)

| RVA | Name (provisional) | Role |
| --- | --- | --- |
| `0x1000` | `LoadRealIjl15` | `LoadLibraryW(L"iloveaki.dat")`; `GetProcAddress` ×6 (`ijlGetLibVersion/Init/Free/Read/Write/ErrorStr`) into slots `0x10003348–0x1000335c`; returns TRUE/FALSE |
| `0x10d0` | `AntiMutexHookStub` | `add esp,4; xor eax,eax; ret 0x10` — returns STATUS_SUCCESS(0) with warped stack |
| `0x10e0` | `RepackDllMain` | the whole repack init (see §0 pseudocode); `ret 0xc` |
| `0x1196` | security-cookie check (CRT) | `cmp ecx,[0x10003000]; jne __report_gsfailure` |
| `0x11a7`/`0x11f4`/… | VC9 CRT | `_CRT_INIT`/DllMain wrapper machinery (standard) |
| `0x1530` | entry | CRT startup → calls DllMain(0x10e0) via `__DllMainCRTStartup` |

### Import/IAT slots used by the repack path

| IAT VA | Import | Used at |
| --- | --- | --- |
| `0x10002000` | KERNEL32!GetModuleHandleW | `0x1106` (ntdll handle) |
| `0x10002004` | KERNEL32!LoadLibraryW | `0x1006` (iloveaki.dat) |
| `0x10002008` | KERNEL32!GetProcAddress | `0x1023/0x102a/…/0x111b` |
| `0x1000200c` | KERNEL32!VirtualProtect | `0x1157/0x1176` (patch + restore) |
| `0x10002090` | USER32!MessageBoxW | `0x1134` (failed.), `0x1186` (success.) |

### Strings (complete, UTF-16 unless noted)

| RVA | Value | First xref |
| --- | --- | --- |
| `0x20d8` | `iloveaki.dat` | `0x1001` (push, LoadLibraryW arg) |
| `0x20f4` | `ijlGetLibVersion` (ASCII) | `0x101d` |
| `0x2108` | `ijlInit` (ASCII) | `0x1025` |
| `0x2110` | `ijlFree` (ASCII) | `0x1032` |
| `0x2118` | `ijlRead` (ASCII) | `0x103f` |
| `0x2120` | `ijlWrite` (ASCII) | `0x104c` |
| `0x212c` | `ijlErrorStr` (ASCII) | `0x1059` |
| `0x2138` | `ZwCreateMutant` (ASCII) | `0x110a` (push; consumed by GetProcAddress at `0x111b`) |
| `0x2148` | `ntdll.dll` | `0x110f` (push, GetModuleHandleW arg) |
| `0x215c` | `iloveaki` | `0x1129/0x117a` (MessageBox titles) |
| `0x2170` | `iloveaki failed.` | `0x112e` (body, MB_ICONHAND=0x10) |
| `0x2194` | `iloveaki success.` | `0x117f` (body, MB_ICONINFORMATION=0x40) |

Full annotated disassembly: `.work/task-026/iloveaki/ijl15-stub-disasm.txt`
(scratch); xref tables in `result/task026-iloveaki-xrefs.csv`.

## 3. The `ZwCreateMutant` hook is inert on this guest OS (Win7 SP1 x86)

Verified against the guest's actual `ntdll.dll` (extracted read-only from the
install ISO used to build the VM, `install.wim` index 4; SHA of layout source
recorded in `.work/task-026/preflight/ntdll/`):

```text
ntdll!ZwCreateMutant (=NtCreateMutant) RVA 0x45648:
  +0x00  b8 4a 00 00 00   mov eax, 0x4a
  +0x05  ba 00 03 fe 7f   mov edx, 0x7FFE0300
  +0x0A  ff 12            call dword ptr [edx]     ; the syscall
  +0x0C  c2 10 00         ret 0x10                 ; ← exits before +0x12!
  +0x0F  90               nop
  +0x10                   ZwCreateNamedPipeFile:   ; b8 4b 00 00 00 ...
```

- The stub's 5-byte `E9` write at `+0x12` lands **inside the following
  syscall stub** (`ZwCreateNamedPipeFile` at `+0x10`), 2 bytes into its
  `mov eax, imm32`.
- `ZwCreateMutant` itself returns at `+0x0C` and **never reaches +0x12** —
  on Win7 the mutant is created normally; the intended "return 0 without
  creating the mutex" neutering does not happen.
- The corrupted neighbor swallows the `E9` opcode byte as immediate data, so
  even calls to `ZwCreateNamedPipeFile` decode into garbage rather than a
  clean jump. (Mailslot/pipe creation is absent from every observed run, so
  this corruption has no visible effect.)
- Intended semantics (from the hook stub `xor eax,eax; ret 0x10`): make
  `ZwCreateMutant` report `STATUS_SUCCESS` without creating the object —
  the classic private-server multi-instance / anti-single-instance patch.
  The mis-offset suggests the stub was authored against a different ntdll
  layout (repack era ≈ 2012, likely XP target). `+0x12` matches no
  XP/Vista/Win7 standard Zw layout we checked (all place `ret 0x10` at
  +0x0C).

Evidence tag: **confirmed-static** (patch target/bytes, guest ntdll layout);
behavioral inertness = **confirmed-runtime** (Task 025 module/window traces
showed no mailslot/pipe anomalies).

## 4. Relation to the F:/G: fork and the exe-side protector

- The stub contains **no drive/volume/path logic** — its only inputs are the
  two file/module names. The Task 025 F:/G: fork therefore happens in
  `MapleStory.exe`'s own protector stage (upstream of loading `ijl15.dll`;
  in the G: layout the stub never loads at all).
- The exe (on-disk) imports exactly one API (`kernel32!GetLocalTime`); its
  import of `ijl15.dll` is reconstructed by the protector at runtime —
  consistent with the static chain (Tasks 004–012c) where the stage-2 PE
  scan locates kernel32 via `GetLocalTime` and the resolver rebuilds imports.
- `MapleStory.exe` exports exactly 3 symbols:
  `ZtlTaskMemAllocImp @0x5fc19f`, `ZtlTaskMemFreeImp @0x5fc1b0`,
  `ZtlTaskMemReallocImp @0x5fc1c1` (the 0x11-byte spacing noted in Task
  012c). These are the Wizet `ztl` allocator exports (see ZLZ.dll PDB
  `D:\ACGAME_CN\ztl\ZLZ\...`) — useful future anchors for exe-side heap
  attribution.

## 5. What this predicts for the post-modal path

Clicking 确定 merely lets `MessageBoxW` return → `DllMain` returns TRUE →
the loader completes `ijl15.dll` import resolution → the protected exe
continues its startup (next expected stages: more protector work or the
Wizet runtime/PCOM boundary). Nothing in the stub gates or redirects the
client after the box — there is no second dialog, no teardown, no exit call
in the stub after the MessageBox. The stub's only persistent footprint is
the export-forwarding table and the (inert) ntdll byte corruption.

Predictions to validate against the T26F2 runtime run:
1. post-OK CPU resumes (loader burst continues past 2.6 s);
2. no new dialog originates from the stub itself;
3. either the protector continues (more system modules / game DLLs), or the
   exe hits its next internal boundary (possible new modal from the exe).

## 6. Artifacts

- `result/task026-iloveaki-static.md` (this file)
- `result/task026-iloveaki-xrefs.csv` (string/API xref table)
- `result/task026-iloveaki-controlflow.md` (annotated control flow of the
  three repack functions)
- scratch: `.work/task-026/iloveaki/{pe_static.py,disasm_stub.py,rdata_dump.py,
  ntdll_check.py,iloveaki-strings.txt,ijl15-stub-disasm.txt}`
