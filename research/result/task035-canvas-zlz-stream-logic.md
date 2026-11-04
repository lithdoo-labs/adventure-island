# Task 035 — Canvas→ZLZ stream path (E3, method-level)

Modules: `Canvas.dll` (imgbase 0x50000000) statically importing
`ZLZ.dll`. Logs: `.work/task-035/logs/e3*.txt`.

## The static edge, corrected

Canvas's ZLZ import descriptor: INT (names) at RVA 0x2BC74, **real IAT
at RVA 0x270C4** (slot order: 0x270C4 ZLZCreateInflator,
0x270C8 ZLZCreateDeflator, 0x270CC ZLZCloseFilter). All three call
sites live in one class's methods:

| Site | Call | Method role |
| --- | --- | --- |
| 0x22A35 | `ZLZCreateInflator(...)` | stream init (decompress mode) |
| 0x22A1B | `ZLZCreateDeflator(...)` | stream init (compress mode) |
| 0x2294C | `ZLZCloseFilter([this+4])` | destructor |

## The filtered-stream wrapper class (vtable RVA 0x286D4)

```c
struct CanvasZlzStream {          // vtable 0x286D4, first fn 0x22BA0
    void* vtable;                 // [this+0]
    ZIStream* filter;             // [this+4]  — the ZLZ filter object
};

ctor   0x22980  (ret 0x14 — 5 args: source-stream, mode, sizes…) {
    base ctor 0x21350; filter = NULL; vtable = 0x286D4;
    init 0x22A00(this, a1..a5)  // branches by mode:
        //   decompress -> ZLZCreateInflator(h, src, size)
        //   compress   -> ZLZCreateDeflator(h, src, size)
}
dtor   0x22910  { if (filter) ZLZCloseFilter(filter); base dtor 0x213A0; }
read/write 0x22A50 { return this->filter->vt[1](buf, len); }  // thin virtual forward
```

## Semantics

ZLZ.dll exports a **filter-object stream codec**: `ZIStream*` objects
created over an underlying stream handle; the Canvas wrapper owns
exactly one filter at [this+4] and forwards reads/writes through its
first virtual. The FUNTY_BYTES-family shuffle table + WZ key inside ZLZ
(Task 034 G2) serve this filter's transform; `_lrotl/_lrotr`-style
rotates (NameSpace's imports) belong to the same string-crypto family.

**Net:** the image pipeline is
`CWzCanvas-family → ZLZ-filtered stream (inflate/deflate + transform) →
raw archive bytes` — the one place the repack's custom codec is wired
into the Wizet engine, now pinned at instruction level.
