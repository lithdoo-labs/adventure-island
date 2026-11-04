# Probe branch convergence

Static CFG only. `CreateFileA` was not given a success or failure handle.

## The handle test

| Path | Condition | Lands | Immediate behavior |
| --- | --- | --- | --- |
| Device absent | EAX was `0xFFFFFFFF`, `jne` not taken | `0x00859780`, then the gadget at `0x0085979F` | stays in the span that holds `\\.\SIWVID` and `\\.\NTICE` |
| Device present | EAX was any other handle, `jne` taken | `0x00859A61` | handle copied to EBX; first-character slot set to `'C'` |

The absent path is the one that still has device names in front of it. The present path is not a fall-through into those names: its target is after both `lea` instructions. Nothing on the present landing is a `push 0` / `call` into the `MessageBoxExA` slot, and nothing writes an exit code.

## Do they join?

Not inside the gadget, and not by the first conditional after each landing. Both addresses are in Tail B (`0x00819000`–`0x00912000`). The WinLicense registry calls start at `0x00859CF4`, which is after `0x00859A61` in address order. No direct edge from `0x00859779` targets `0x00859CF4`. Whether either path later reaches that block was not simulated, because that would require a handle.

There is no shared error label that both edges jump to. `MessageBoxExA` sits in slot `0x0081A81D` before the probe. Neither immediate edge reads that slot.

## Tail A, Ztl, materializer

The probe window contains no displacement and no immediate for Tail A (`0x002CE000`) or the Ztl slots (`0x005FC19F`, `0x005FC1B0`, `0x005FC1C1`). The replay wrote neither region. No edge of this compare is a materializer.
