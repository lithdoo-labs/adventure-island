# Sender Coverage

- Sites: 486; classified: 374 (76%)
- Resolution ladder: L0 census -> L1 unique-in-host -> L2 order-pair ->
  L3 arg-const -> L4 BFS(<=8) -> addr-ref -> prologue re-anchor (55 boundary fixes)
- Remaining: 112 sites on vtable-dispatch hosts with zero static
  callers and zero image dword references. Classified populated-state-required
  (see blockers B50-1 and login dossier).
- Depth distribution: {'0-order-paired': 28, 'L2-order-pair': 7, '0-self': 100, '0-existing': 207, 'L1-unique-in-host': 10, 'none-exhausted': 110, 'L4-anchored-bfs': 4, 'arg-const': 6, '1-caller': 4, '2-caller-of-caller': 3, '4-bfs': 1, 'L3-anchored-arg': 3, '1-ambiguous': 2, 'L3-arg-const': 1}
