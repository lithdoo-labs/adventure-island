# Source index

This file tracks public references useful for CMS079 cross-version symbol correlation.

## Redistributable upstream sources included here

### Bia10/Maple.Client.V95

- Repository: https://github.com/Bia10/Maple.Client.V95
- Pinned upstream commit: `24bbf0e2cda769e6bcf4791a77b8336dd2cca2aa`
- License: MIT
- Usefulness: GMS v95 struct definitions, singleton pointer addresses, field offsets, login/world/channel structure names, and selected function addresses.
- Included here: selected source material under `upstream/Bia10.Maple.Client.V95/`.

### Bia10/Maple.Enums

- Repository: https://github.com/Bia10/Maple.Enums
- License: MIT
- Usefulness: preserves original spellings from GMS v95 PDB-derived `game_types.h` material, including opcode/enum naming clues.
- Included here: `typos.md` plus license under `upstream/Bia10.Maple.Enums/`.

### zhyonc/MaplePE

- Repository: https://github.com/zhyonc/MaplePE
- License: MIT
- Usefulness: documents classic MapleStory client function families such as `CInPacket::Decode*`, `COutPacket::Encode*`, `CClientSocket::ProcessPacket`, and `CClientSocket::SendPacket`.
- Not mirrored in this first bundle because the project also contains injection/hooking implementation that is not required for passive CMS079 correlation. Only project-local function-family notes are retained under `derived/`.

## Public reports / references not mirrored

### GMS v95 PDB / IDB material

Public community discussions repeatedly describe a GMS v95 client PDB/IDB leak and use it as a source for names such as `CWvsContext::OnPacket`, `CInPacket::Decode*`, and related client classes/functions.

Reference pages:

- https://forum.ragezone.com/threads/getting-packet-structures-and-opcodes-with-ida-after-gms-new-update.872876/
- https://forum.ragezone.com/threads/client-editing-what-am-i-missing.1220721/

Artifact itself is not mirrored here.

### KMST v330 / KMST v1029 PDB references

Community discussions also report KMST v330 and KMST v1029 client binary/PDB material and use them as cross-version references.

Reference pages:

- https://forum.ragezone.com/threads/stable-maple-story-source-for-basing-game-off-of.1174319/
- https://forum.ragezone.com/threads/unnamed-maplestory-emulator-project.929072/

Artifacts are not mirrored here.

### GMS v83 named IDB / client-edit dump

A community-produced v83 IDB is reported to contain thousands of named functions and imported enum/structure information. It is particularly interesting for CMS079 because v83 is temporally close, but its names must be treated as community-derived unless independently corroborated.

Reference page:

- https://forum.ragezone.com/threads/v83-idb-client-edit-dump.1193418/

IDB is not mirrored here.

### Historical client archives

Community archive threads list many historical/unpacked/localhost clients for GMS/KMS/JMS/CMS/TWMS, useful for binary-diff/reference work.

Reference page:

- https://forum.ragezone.com/threads/some-localhost-clients-kms-jms-cms-twms.1225637/

No client binaries are mirrored here.

## Verification rule

A source page that merely says an artifact exists is provenance evidence, not symbol correctness evidence. Symbols imported into CMS079 notes should be independently checked against CMS079-local behavior, strings, RTTI/vtables, protocol constants, WZ use, or call-graph structure.
