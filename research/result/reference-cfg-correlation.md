# Reference CFG correlation

Compared structures only. No third-party bypass was downloaded or run. Nothing in this file was executed inside MapleStory.

## Device order

| | Public reference | This client |
| --- | --- | --- |
| Order | OpenRCE, 11 March 2006: `\\.\SICE`, `\\.\SIWVID`, `\\.\NTICE` | string loads at `0x00859507`, `0x00859882`, `0x008599BF` |
| Failure test | MeltICE: `cmp eax, 0xFFFFFFFF` / jump if equal means not present. OpenRCE: `cmp eax, -1` / jump if not equal means present | `inc eax; jne 0x00859A61`. Same predicate, different instruction |
| Arguments | MeltICE pushes `0`, `0x80`, `3`, `0`, `3`, `0xC0000000` | the SICE call uses those same seven values |
| After a miss | MeltICE checks the next device, then continues | the miss edge `0x00859780` is the span that holds the next two names |
| After a hit | both public samples treat it as "debugger found" and do not describe a later unpacker | `0x00859A61` saves the handle and writes `'C'` into the walker filter. No terminate was identified |

## Registry

Oreans documents a developer-chosen license key. It does not document this value table. The secondary report that lists `Software\WinLicense` and `Software\WLkt` does not show call order or a post-probe stage. No reference CFG of this registry cluster was found.

## Resolver

No fetched WinLicense or XProtector listing shows the checksum constants `0x5041` / `0x5449` or the wrapper at `0x00821750`. The walker remains a fact about this client, not a matched public routine.

## What a reference may suggest, and what this client has not done

Reference-supported expectation, not an observation in this process: a normal machine fails `\\.\SICE`, continues through `\\.\SIWVID` and `\\.\NTICE`, and only then leaves the device checks. OpenRCE's miss path is "tool not found", after which that sample exits its demo. It does not show an unpacker, Tail A, or a game import table.

This client has not been observed past the first `CreateFileA`. Tail A, the Ztl slots, WZ, AES/IV, and Winsock are still absent. The registry cluster is the next static block in the window. It is still protector state, not a game stage.
