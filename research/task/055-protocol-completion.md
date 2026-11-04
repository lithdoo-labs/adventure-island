# Task 055 — Protocol Completion: Server Source × Synthetic Client

## 0. Mission

Combined campaign merging Direction A (server decompilation) and Direction B
(full synthetic client) into a single interleaved workflow:

- **Phase A**: Decompile the server JAR → complete Java source
- **Phase B**: Extract all packet handlers/writers → map to opcodes
- **Phase C**: Cross-reference server source ↔ client schema database
  (resolve remaining "locator" field names using server variable names)
- **Phase D**: Build full-featured synthetic client
  (login → world select → channel → character select → in-game)
- **Phase E**: End-to-end validation with live server

## 1. Synergy

A feeds B: server source tells us exactly what each packet contains.
B validates A: synthetic client proves protocol understanding is correct.

## 2. Inputs

- Server JAR: .work/task-002/server/079V5/dist/江浩079.jar
- MySQL data: .work/task-002/server/079V5/mysql/
- Client schema DB: result/task050-* (238 inbound + 154 outbound schemas)
- Codec: scripts/maple079_packet.py (validated)
- Syn client: scripts/maple079_syn_client.py (login chain works)
- Credentials: fl1234 / 123456
- c2s names: result/task040-channel-opcodes.csv (137 names)
- s2c names: result/task048-s2c-wire-complete.csv (217 values)

## 3. Rules

- Server source analysis is unrestricted (we own the JAR)
- Synthetic client connects to LOCAL server only
- All findings normalized to result/task055-* artifacts

## 4. Success Criteria

- A: JAR fully decompiled, handler/writer census complete
- B: ≥90% of 217 s2c + 137 c2s opcodes have server-side source mapping
- C: ≥100 client "locator" fields renamed from server variable names
- D: Synthetic client reaches in-game state (PLAYER_LOGGEDIN → first field packet)
- E: At least one complete game loop verified (login → move → logout)

## 5. Artifacts

result/task055-server-handlers.csv
result/task055-field-name-resolution.csv
result/task055-syn-client-v2.py
result/task055-validation-log.md
result/55-protocol-completion.md
