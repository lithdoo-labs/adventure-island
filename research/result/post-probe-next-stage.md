# Post-probe next stage

The first block after the SoftICE handle test that has a recognizable shape is still a probe cluster, not a game stage.

| Candidate | In the captured window |
| --- | --- |
| Further device probes | `\\.\SIWVID` at `0x00859882`, `\\.\NTICE` at `0x008599BF` |
| Registry probe | `HKCU\Software\WinLicense` at `0x00859D07`, value-name loads through `0x0085A336` |
| New in-place decode | no third round completed; no new xor/add loop identified after `0x00859A61` |
| New decompressor | not present |
| Import-table builder | the walker already ran; no new IAT array appears after the test |
| Relocation / fixup | the wrapper at `0x00821750` relocates one table before the probe, not after it |
| Tail A write | first page still zero |
| ZtlTaskMem write | three slots still 16 zero bytes |
| New executable region | EIP stayed in Tail B until `CreateFileA` |
| MSVC RTTI / `55 8B EC` | none in `0x00856000`–`0x00862000` |
| WZ / Maple crypto / Winsock | none in that window |

## Blocker

Past the registry names, the bytes are the same obfuscated Tail B stream. There is no structural seam that starts a decoder, a materializer, or a game import table. Reaching a later stage by running the `jne` would require a `CreateFileA` handle. That handle is the runtime boundary, and it was not supplied.

The next stage is therefore not identified. The last identified stage is the environment-probe cluster that begins with `\\.\SICE` and continues through the WinLicense registry names.
