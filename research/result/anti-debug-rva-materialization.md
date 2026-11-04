# Anti-debug RVAs

Task 003 stopped on `0x00862E76` (`STATUS_ILLEGAL_INSTRUCTION`) and `0x00862FB0` (`STATUS_PRIVILEGED_INSTRUCTION`). Both addresses have no raw backing. They are `0x13A` apart.

## Producer

Both RVAs fall inside the single T2 write `0x00819014`–`0x00911B25`.

| Field | Value |
| --- | --- |
| producer | T2, routine RVA `0x0091210A`, call from `0x0091207E` |
| source | `0x00912259`–`0x009D634A` in `tpuaozxc` |
| destination | `0x00819014`–`0x00911B25` |
| transform | aPLib-style depack, after T1 decoded the stub page |
| classification | runtime-generated protector code |
| confidence | high that both addresses are in this block |

The emulation executed `0x00819014` and later `0x0081C6C5`, then returned from the MZ scan. It did not execute `0x00862E76` or `0x00862FB0`. The bytes are still in the block:

```text
0x00862E76  0F 3F
0x00862FB0  ED
```

Capstone does not decode `0F 3F` as an instruction. `ED` is `in eax, dx`, which is a privileged instruction. That matches the two exception codes from Task 003 without treating the surrounding bytes as a recovered routine. No instruction stream for those sites is claimed here.

They are not in a separate materialization. They are not in tail A, and they are not the Ztl slots.
