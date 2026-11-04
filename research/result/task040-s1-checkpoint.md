# Task 040 — Session 1 checkpoint (pump + dispatch mechanism)

RUN DATE 2026-10-14 · HEAD `2ac1ebb…` · corpus: the Task-036 capture;
static only; nothing binary committed.

## Delivered (S1)

**The receive path is now decoded end-to-end at the mechanism level:**

```c
CClientSocket::ProcessRecv() /* 0x95A0B */:
    while (true) {
        buf = PoolAlloc(0x5B4);              // 1460 = the codec chunk size
        n = recv(this->socket /*[+8]*/, buf->ptr, buf->len, 0);
        if (n == 0)            -> Close();
        if (n == -1 && WSAGetLastError() != WSAEWOULDBLOCK) break;
        AppendToStream(this->rx /*[+0x40]*/, buf, n);        // 0x495B36
        ExtractAndDispatch(this->rx /*[+0x40]*/, &packet);   // 0x496587
    }
```

- The 1460-byte pool chunk **cross-confirms the codec's chunking
  constant** (crypt()'s llength) from the client side.
- The extract/dispatch (0x496587, thiscall on the rx stream object at
  socket+0x40) flows through an **opcode-keyed handler map**
  (`0x997B0F(map, key)` lookups + handler virtual calls).
- Honest note: the region's pushed constants (0x27/0x28/0xA/0xD/0xAF/
  0x8C) are a MIXED set (field inits + lookups) — not a clean opcode
  list; the containing function's full decode (EH-prologue start) is
  the precisely-defined S1 continuation and will settle the
  login-band dispatcher question (B39-1).

## Next (S1 continuation, then S2)

1. Full decode of the function containing 0x496587 (locate its EH
   start precisely; extract its complete map-install/lookup list) →
   the login-band dispatcher verdict.
2. S2: band-internal tables (inventory band 0x97F64C first).

## Artifacts

`result/task040-s1-milestones.csv`, this checkpoint; logs in
`.work/task-040/logs/`.
