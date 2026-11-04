# Subsystem Dossier: Social (Party/Buddy/Guild)

## Dispatch coverage
PARTY 0x3B (33-case JT), BUDDYLIST 0x3C (16-case JT modes 7-0x16), GUILD 0x3E (binary-search 50+)

## Object model (CWvsContext social block, fully mapped)
+0x2E04 party obj / +0x2E08 party struct(298B) / +0x2F38 buddy container
(0x27-stride entries, id@+0x12, channels@+4) / +0x2F7C guild container / +0x2FA2 guild gate

## Wire schemas
- buddy change (case 8): [pos i32][channel u8][cid i32]
- party case 4: [charid i32][name str][flag u8] -> config singleton 0xBDD494 +0x34/+0x38

## State machines
SM12 party lifecycle, SM17 guild window, SM20 buddy refresh

## Open questions
- guild container deserialize layout (inside 0x4F3CFC): deeper register-level dataflow on existing corpus
- actual buddy list contents: needs post-login capture: values only observable at runtime (see blockers)
