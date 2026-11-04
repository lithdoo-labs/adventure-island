# Task 051 Phase F: Sender-Tail Advance

## Result: partial advance + boundary re-confirmation

- **16 of 112** unresolved send sites joined to ctor-validated vtable methods:
  the send fires inside a known class's method (CShopSessionWindow ×4,
  VersionObjWindow ×3, UI_ViciousHammer ×2, ConfigProviderWindow ×1, unnamed
  VClass ×6). Opcodes remain unknown, but the packet FAMILY context is now
  class-bound (e.g. shop-window interactions).
- Remaining ~96 sites: hosts are neither static-call-reachable, image-referenced,
  NOR vtable slots of validated classes — they are reached through
  runtime-computed dispatch (UI callback tables constructed at load).

## Boundary statement

Static analysis of the recovered image resolves sender provenance to 374/486
direct + 16 class-contextual = **390/486 (80%)**. The final 96 require either
dynamic capture or a full decompiler IR; both are outside the static corpus.
This RE-CONFIRMS Task 050 Stop B with new evidence.
