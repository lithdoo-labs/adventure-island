# Function/class family seeds for CMS079

These names are reference candidates, not CMS079 assignments. They are useful after the CMS079 game image begins to materialize.

## Network / packet core

High priority because Task 002 already recovered server-side protocol and crypto behavior.

- `CClientSocket`
- `CClientSocket::ProcessPacket`
- `CClientSocket::SendPacket`
- `CInPacket::Decode1`
- `CInPacket::Decode2`
- `CInPacket::Decode4`
- `CInPacket::DecodeStr`
- `CInPacket::DecodeBuffer`
- `COutPacket::Encode1`
- `COutPacket::Encode2`
- `COutPacket::Encode4`
- `COutPacket::EncodeStr`
- `COutPacket::EncodeBuffer`
- `COutPacket::MakeBufferList`

A CMS079 candidate should not receive one of these names without local evidence such as packet-header construction/parsing, the known Maple crypto constants, socket IO, or opcode dispatch behavior.

## Application / global context

- `CWvsApp`
- `CWvsContext`
- `CLogin`
- `CStage`
- `CField`
- `CQuestMan`

Useful evidence: singleton-style globals, RTTI/vtables, world/channel/character state, login-stage transitions, WZ access, main-window/thread ownership.

## Login UI / selection flow

- `CUIWorldSelect`
- `CUIChannelSelect`
- `CUICharSelect`
- `CUICharDetail`
- `CUIAvatar`
- `CConnectionNoticeDlg`

Correlate against the known Task 002 flow: `LOGIN_PASSWORD` → server list → character list → character select → channel migration.

## Game-world objects to search later

- `CUser`
- `CUserLocal`
- `CUserPool`
- `CMob`
- `CMobPool`
- `CNpc`
- `CItemInfo`

These should be deferred until stable RTTI/vtable/function clusters are present; do not infer them from isolated strings.

## Reference provenance

The classic packet-function names above are documented in public MapleStory reverse-engineering tooling such as `zhyonc/MaplePE` (MIT). This file is a project-local symbol-family summary; no hooking/injection implementation from that project is copied here.
