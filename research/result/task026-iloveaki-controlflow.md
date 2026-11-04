# Task 026 — iloveaki repack layer control flow

Annotated control flow of the three repack functions in the 8,192-byte
`ijl15.dll` stub (ImageBase 0x10000000, read-only static analysis; full
disassembly in `.work/task-026/iloveaki/ijl15-stub-disasm.txt`).

## 1. `RepackDllMain` @ RVA 0x10e0 (stdcall, 3 args = hinstDLL/fdwReason/lpReserved)

```text
0x10e0  sub esp, 8                     ; two locals
0x10e3  mov eax, [esp+0x10]            ; fdwReason
0x10e7  sub eax, 1
0x10eb  mov [esp+4], 0 / [esp+8], 0    ; zero locals
0x10fb  jne 0x118d                     ; fdwReason != DLL_PROCESS_ATTACH
        └─> 0x118d: mov al, 1; ret 0xc ; ATTACH-only, all other reasons TRUE

; ---- DLL_PROCESS_ATTACH path ----
0x1101  call LoadRealIjl15 (0x1000)
0x1106  test al, al
0x1108  je   0x113a                    ; iloveaki.dat not loadable
        └─> 0x113a: xor al, al         ; return FALSE → DLL load FAILS
                   0x113c..0x1140: unwind; ret 0xc

0x110a  push 0x10002138                ; "ZwCreateMutant" (stays on stack)
0x110f  push 0x10002148                ; L"ntdll.dll"
0x1114  call [GetModuleHandleW]        ; → hNtdll
0x111a  push eax
0x111b  call [GetProcAddress]          ; → esi = &ntdll!ZwCreateMutant
0x1121  mov esi, eax
0x1123  test esi, esi
0x1125  jne  0x1143                    ; resolve ok → patch
        └─> fail path:
            0x1127 push 0x10                    ; MB_ICONHAND
            0x1129 push 0x1000215c             ; L"iloveaki"
            0x112e push 0x10002170             ; L"iloveaki failed."
            0x1133 push 0                      ; hWnd NULL
            0x1134 call [MessageBoxW]
            0x113a xor al, al ... ret 0xc      ; FALSE

; ---- patch ZwCreateMutant+0x12 with jmp AntiMutexHookStub ----
0x1143  push edi
0x1144  mov edi, [VirtualProtect]
0x114a  lea eax, [esp+8]; push eax     ; &oldProtect
0x114f  push 4                         ; PAGE_READWRITE
0x1151  push 5                         ; size
0x1153  add esi, 0x12                  ; target = ZwCreateMutant + 0x12
0x1156  push esi
0x1157  call edi                       ; VirtualProtect(target,5,RW,&old)
0x1159  mov ecx, 0x100010d0            ; AntiMutexHookStub
0x115e  sub ecx, esi                   ; ecx = stub - target
0x1160  sub ecx, 5                     ; rel32 adjustment
0x1163  lea edx, [esp+0xc]; push edx   ; &oldProtect2
0x1167  mov byte [esi], 0xE9           ; JMP opcode
0x116b  mov [esi+1], ecx               ; rel32
0x116e..0x1176  VirtualProtect(target,5,old,&old2)   ; restore

; ---- success modal (the Task 025 gate) ----
0x1178  push 0x40                      ; MB_ICONINFORMATION
0x117a  push 0x1000215c                ; L"iloveaki"
0x117f  push 0x10002194                ; L"iloveaki success."
0x1184  push 0
0x1186  call [MessageBoxW]             ; BLOCKS here with loader lock held
0x118c  pop edi
0x118d  mov al, 1                      ; return TRUE → load continues
0x118f..0x1193  epilogue; ret 0xc
```

Branch inventory: 2 early exits (non-ATTACH reason; iloveaki.dat load
failure → process-level load abort), 1 mid failure (ntdll/ZwCreateMutant
resolve → "iloveaki failed." + FALSE), success path always ends at the
modal then TRUE. There is **no code after the modal** other than `mov al,1` —
clicking OK cannot trigger any further stub logic by construction.

## 2. `LoadRealIjl15` @ RVA 0x1000

```text
0x1000  push esi
0x1001  push 0x100020d8        ; L"iloveaki.dat"
0x1006  call [LoadLibraryW]
0x100c  mov esi, eax
0x100e  test esi, esi
0x1010  jne 0x1016
0x1012  xor al, al; ret        ; FALSE (caller shows nothing; DllMain shows
                               ;  the generic failure via return FALSE)
0x1016  push edi
0x1017  mov edi, [GetProcAddress]
loop (6×, unrolled):
0x101d  push <"ijlGetLibVersion|ijlInit|ijlFree|ijlRead|ijlWrite|ijlErrorStr">
0x1022  push esi
0x1023  call edi
0x102b  mov [0x10003348..0x1000335c], eax   ; export slot i
0x1067  mov [0x1000335c], eax               ; last slot (ijlErrorStr)
0x106c  mov al, 1; ret                      ; TRUE
```

## 3. `AntiMutexHookStub` @ RVA 0x10d0

```text
0x10d0  add esp, 4      ; discard return address
0x10d3  xor eax, eax    ; STATUS_SUCCESS / FALSE
0x10d5  ret 0x10        ; "return" consuming 16 argument bytes
```

Intended victim: `ZwCreateMutant(PHANDLE, ACCESS_MASK, POBJECT_ATTRIBUTES,
BOOLEAN)` — a 4-arg stdcall, matching `ret 0x10`. Intended effect: report
success without creating the named mutant (single-instance/anti-debug mutex
neutering). Actual effect on the Win7 SP1 x86 guest: **misaligned — see
task026-iloveaki-static.md §3** (patch lands inside the following
`ZwCreateNamedPipeFile` stub; `ZwCreateMutant`'s own `ret 0x10` at +0x0C
exits before the patch site; the E9 byte is swallowed as immediate data).

## 4. Export forwarding

```text
ijlGetLibVersion: 0x1070  jmp dword ptr [0x10003348]
ijlInit:          0x1080  jmp dword ptr [0x1000334c]
ijlFree:          0x1090  jmp dword ptr [0x10003350]
ijlRead:          0x10a0  jmp dword ptr [0x10003354]
ijlWrite:         0x10b0  jmp dword ptr [0x10003358]
ijlErrorStr:      0x10c0  jmp dword ptr [0x1000335c]
```

Slots are written exactly once by `LoadRealIjl15` from
`iloveaki.dat`'s export table. If any slot were left NULL (partial resolve),
calling that export jumps to 0 → crash; the observed stable runtime implies
all six resolve.

## 5. CRT involvement

`0x1530` (entry) → VC9 `__DllMainCRTStartup` → `_CRT_INIT` (0x11f4, standard
lock/init/onexit machinery; the disassembly regions 0x11a7–0x1418 and
0x141a–0x1530 are stock CRT) → calls `RepackDllMain` (0x10e0) with the
attach reason. The repack logic itself is only ~0x100 bytes.
