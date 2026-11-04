# Task 038 — The client codec decode record (G1)

All RVAs are module-relative in the materialized image (base 0x400000).
Disassembly: `.work/task-038/logs/g1-*.txt`.

## funny_shit @ 0x6590BD — the per-byte IV transform

```c
void funny_shit(byte input, byte block[4]) {   // [esp+4]=block, [esp+0xC]=input
    block[1] = block[1] - (T[block[1]] - input);        // T @ VA 0xBD4130
    block[2] = block[2] ^ T[input] ^ block[1]/*(via cl)*/;
    block[3] = (block[3] - block[0]) + T[block[3]] + input;  // mixed sub/add/xor
    *(u32*)block = rol32(*(u32*)block, 3);               // shl 3 | shr 29
}
```

## crypt @ 0x659082 — the rolling-IV byte loop

```c
u32 crypt(void* data, int len, u32* pIV) {
    u32 local = 0xC65053F2;              // == bytes F2 53 50 C6 (the seed)
    if (!pIV) pIV = &local;
    for (i = 0; i < len; i++)
        funny_shit(data[i], pIV);
    return *pIV;                          // next IV
}
```

## custom_encrypt @ 0x65911A / custom_decrypt @ 0x659182

```c
for each byte b:
    b = (b << 4) | (b >> 4);                       // nibble rotate
    b = ((b & 0xD5) << 1) | ((b >> 1) & 0x55);     // bit-pair rotate
    b ^= T[IV[0]];                                  // T @ 0xBD4130
    funny_shit(b, IV);                             // decrypt mirrors the order
```

## The AES layer (heap-resident, runtime-computed)

- The module image contains NO AES tables (sbox/Te0/inv-sbox/Rcon all
  absent) and no CryptoAPI usage — the AES state is constructed at
  runtime.
- Two compact-AES instances live in the process heap:
  **VA 0x74F12C00** and **0x756D2000**, each holding the S-box in the
  doubled-byte "Sbox2" form (`8c8c 8f03 a1a1 f859 …` precedes
  `63 7c 77 7b …`) — the send/recv cipher pair.
- Corollary: Task-034's "packet AES key provably absent from every
  static module" is now explained — the key exists only expanded, in
  heap, beside the computed tables.

## Verification status

- funny_shit/crypt/custom forms match `scripts/maple079_packet.py`
  (the Task-002 JAR-validated codec) shape-for-shape — table base,
  default seed, rotation constants, and mixing order all agree.
- The compact-AES block functions (adjacent to 0x658xxx-0x659xxx)
  with their heap instances are the next decode step; expected to
  complete the OFB keystream equivalence with `crypt()`'s aes_block.
