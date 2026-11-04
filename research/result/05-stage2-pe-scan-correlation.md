# Task 007 — stage-2 PE scan

Client SHA-256 `5d280cf1c5663e925104736e73e5715a5a529d25420babf410cc411b37940f4d`. Existing RVAs stay valid. The rebuilt T2 slice matches Task 006 (`5529577e…c865`). Tools: Capstone 5.0.7, Unicorn 2.1.4, pefile 2024.8.26. No debugger was attached. The client file and the `.raw` tree were not modified.

## Answers

1. ESI is the loader-filled IAT slot of `kernel32!GetLocalTime`, then masked with `0xFFFF0000`. The slot is reached from the host image's import directory at RVA `0x00818040`, FirstThunk `0x0081802B`. See `result/stage2-register-provenance.md`.
2. The scan start is that aligned function address. On this process it is `0x76250000`.
3. The window is 50 addresses, stride `0x10000`: `0x76250000` down to `0x75F40000`.
4. The image it wants is the PE that contains `GetLocalTime`. The import DLL is `kernel32.dll`, and the export is not forwarded.
5. The running process has `kernel32.dll` at `0x76240000`, size `0xF0000`, `MEM_IMAGE`. RVA `0x10000` inside that file is `CC CC`, so the first test misses. The base is the next test and it passes. No other module base lies on an earlier step. `result/stage2-scan-candidates.csv`.
6. Replaying that layout, with the IAT filled and without patching the branch, takes `0x0081CCC6` at instruction 760,723. `result/stage2-offline-replay.md`.
7. The found path stores the base at RVA `0x0081A621` and `0x0081B45D`, then rewrites its own stage-2 bytes. It does not write Tail A or the Ztl slots in the traced prefix.

`0x32` is the maximum number of MZ tests (EAX runs `0 .. 0x31`).

An image enters the found path only when, on one of those 50 addresses:

- `word [esi] == 0x5A4D`
- `dword [esi + dword [esi+0x3C]] == 0x00004550`

Machine, NumberOfSections, OptionalHeader magic, ImageBase, SizeOfImage, the section table, and the data directories are not checked. `result/stage2-pe-validation.csv`.

## Process layout

PID 14496. Module metadata came from `VirtualQueryEx` and `NtQueryVirtualMemory` (`MemoryMappedFilenameInformation`) on a `PROCESS_QUERY_LIMITED_INFORMATION` handle. `PROCESS_VM_READ` and `CreateToolhelp32Snapshot` were denied, so no image bytes were read from the process. Paths under the user profile are stored as `%USERPROFILE%`. 111 `MEM_IMAGE` allocations are in `result/process-layout-snapshot.csv`.

`ws2_32.dll` is loaded at `0x758E0000`, below the scan window. The walk stops at kernel32 and never reaches it.

## Intended target

`kernel32.dll` at `0x76240000`. Confidence: **confirmed**.

The static import, the non-forwarded export, the 64 KB alignment, the `<= 0x80000000` branch, the on-disk header at the second step, and the unpatched replay all name the same image.

## After the hit

| Question | Result |
| --- | --- |
| Tail A written | no |
| Ztl slots written | no |
| New game-code block | no |
| RTTI / `.wz` / `List.wz` | no |
| AES key / IV prefix / IV seed | no |
| `WS2_32` / `connect` / `send` / `recv` | no |
| Next materializer | in-place dword transform, producer `0x0081CE47`, then the loop at `0x0081D594` |

## Route

**Route B.** The scan target is identified. The found path still has to finish later in-place protector rounds before any game image, Tail A block, or Ztl slot appears.

Next useful step is to follow those in-place rounds until they either allocate or write outside `0x00819000`–`0x00911B25`, still without patching a branch. The kernel32 base saved at `0x0081A621` is the value a later round is likely to consume.
