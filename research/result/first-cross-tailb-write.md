# First write outside Tail B

Not observed.

Tail B is RVA `0x00819000`–`0x00912000`. After the found path, image writes stayed inside that range. Tail A (`0x002CE000`–`0x007EA000`) stayed zero. The three Ztl slots stayed 16 zero bytes.

Stack writes were ignored. They are the call frame, not a materialized block. No new allocation was requested. `VirtualAlloc` was not called.

The run stopped on `CreateFileA` before any cross-region write.
