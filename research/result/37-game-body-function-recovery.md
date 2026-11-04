# Task 037 — Game-body function recovery (final report, session 1)

RUN DATE 2026-10-14 · STARTING_HEAD `71a73030a622fccaa7e5f916b66d1ac39455ca47`
· corpus: the Task-036 authorized capture (10.3 MB materialized image +
2 GB dump), static analysis only, nothing binary committed.

## 0. Task 037 complete?

**Stop D (time budget) with F0 fully delivered, F2 core and F3 shape
delivered, F4/F5/F6 open with precise next steps.** The first-ever
reading of the CMS079 game body has begun and its socket layer is
decoded.

## 1. F0 — imports (complete)

- The original import directory is runtime-corrupted → reconstructed
  from the runtime IAT: the **main cluster 0x7E1520-0x7E18D0 (228
  slots)** fully named (kernel32/ntdll/user32/advapi32/gdi32/imm32).
- **ws2_32.dll identified at 0x77830000** (in-memory export dir was
  paged out at capture; the file was extracted from the Win7 ISO's
  install.wim): **33/33 socket imports named** — WSAStartup,
  WSAEventSelect-family (event model), WSASend/WSARecv, socket/connect/
  send/recv/closesocket/select… → `result/task037-imports.csv`.

## 2. F2 — the CClientSocket family (core decoded)

| Member | RVA | Shape |
| --- | --- | --- |
| Connect | **0x947EA** | socket(AF_INET,STREAM); non-blocking connect tolerating WSAEWOULDBLOCK (0x2733); 5000 ms deadline (0x1388) at this+0x38 |
| Handshake/OnHello | **0x95C5C** | validates the version word at this+0x88; builds the response with **push 0x4F (79)** — the version handshake the 032 wire model predicted |
| Send/Flush | **0x95D5C** | send-queue at **this+0x60** guarded by a critical section; full-length `send()`; on success **0x49682C(queue, cipher)** — the buffer and the **cipher object at this+0x54** roll together |
| layout | — | +8 socket · +0x38 deadline · +0x54 **cipher** · +0x5C connected · +0x60 send-queue · +0x88 version word |

The cipher internals (AES/OFB/shuffle behind +0x54) and the recv→decode
path are the next pass (B37-4).

## 3. F3 — the CLogin state machine (shape delivered)

Located at ~0x45EB00: **[this+0x64] = login state (0/1/2 switch)**,
**[this+0x68] = sub-state (9 = charlist phase)**, per-state UI objects
at +0xB0..+0xBC, packet objects allocated by 0x402D66(size).
**Correction recorded (B37-3)**: the "push 0x09/0x0A/0x0B" sites from
Task 036 are CLogin state constants — the wire opcodes are encoded in
the packet-builder family, to be isolated next.

Also: a CWvsContext-family object (~0x3300+ bytes, field-initializer
thunks at 0x6F5F93+) — magnitude-matching the v95 offsets doc.

## 4. Strongest finding / uncertainty / blocker

- **Strongest finding**: the client's network core is read — connect
  model, version handshake (push 0x4F), the queued send path with its
  cipher object — all named with two-evidence (in-image + protocol
  semantics) support.
- **Strongest uncertainty**: the cipher object's method table and the
  recv decode path; the s2c dispatch (F4) untouched.
- **Blocker**: none hard — budget (B37-3/4 define the continuation).

## 5. Next direction (session 2)

(a) decode the cipher: vtable of [socket+0x54], 0x49682C, the
FUNNY-table xrefs (0x7A0630/0x7D4130) → name encrypt/decrypt/IV-roll;
(b) recv path (0x94994/0x95A72 owners) → OnRead → decode → dispatch;
(c) F4 dispatch hunt; (d) F5 CSecurity via the 13 RTTI TDs.

## 6. Artifacts

`result/task037-imports.csv`, `task037-milestones.csv`,
`task037-blockers.csv`, `task037-progression-timeline.csv`, this report.
Disassembly logs in `.work/task-037/logs/`.
