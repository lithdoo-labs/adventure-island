# Materialization hypotheses

## What the entry writes

T1 and T2 are enough to account for every large write the emulation recorded.

`tpuaozxc` is the packed source. The entry's address math lands on its first byte, T1 decodes the first `0x1000` bytes in place, and T2 reads a compressed stream that starts at RVA `0x00912259` and stops at `0x009D634A`. The bytes from `0x009D634A` to `0x009D8000` were not read.

T2 writes RVA `0x00819014` through `0x00911B25`. That range is inside the `0x00819000` section. The first `0x14` bytes of the section are the original low-entropy file page and were not part of the write. From `0x0081A000` onward the destination has no raw backing. T3 then decrements `0x7000` bytes at RVA `0x0081CB21`, still inside the T2 output. The EBP used for that address is `pop` value `0x00C1C6CF` minus `0x074436BB`.

The block is protector code, not original game code. Entropy is 7.7122, an MSVC prologue occurs three times in about 1 MB, and the known protocol anchors are absent. The first instructions save the stack with `call/pop` and install an SEH frame. They do not look like a MapleStory function.

## Tail A and the export slots

RVA `0x002CE000`–`0x007EA000` received no write. The three export bodies are inside that tail:

```text
ZtlTaskMemAllocImp    0x005FC19F
ZtlTaskMemFreeImp     0x005FC1B0
ZtlTaskMemReallocImp  0x005FC1C1
```

After T2 they are still zeros. Spacing `0x11` is unchanged and unused. There is no evidence of a `jmp` thunk, a forwarder, or a short wrapper. The file-backed slice `0x00001000`–`0x002CE000` is not the source of T1 or T2.

`uvrwsdpb` is not referenced by the entry stub.

## Where emulation stops

The generated stub scans for `MZ` / `PE` and, on failure, returns. This run took the failure return. The success path was not executed and was not patched. Tail A, the export slots, and any original game image are on the far side of that scan. See `loader-emulation-observations.md`.
