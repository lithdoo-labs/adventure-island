# Task 056 — Game Actions & Protocol Specification

## 0. Mission

Build on Task 055's in-game breakthrough:
1. **Phase A**: Extend synthetic client with game actions (move, chat, emotion, NPC interact)
2. **Phase B**: Deep-read server handler logic for top-20 packets (actual Java code, not just signatures)
3. **Phase C**: Create definitive protocol specification (all 365 opcodes with wire formats)
4. **Phase D**: Cross-reference client locator fields with server variable names (resolve remaining 347)
5. **Phase E**: End-to-end game loop validation (login → move → chat → logout)

## 1. Success Criteria

- A: ≥3 game actions executed successfully (move packet sent + server response received)
- B: 20 handler methods fully documented with logic
- C: Protocol spec with ≥100 opcodes fully documented (wire format + semantics)
- D: ≥100 locator fields renamed
- E: Complete game session with actions + clean logout

## 2. Artifacts

result/task056-game-actions.md
result/task056-handler-logic.md
result/task056-protocol-spec.md
result/task056-field-resolution.csv
scripts/t056_client.py
result/56-game-actions-spec.md
