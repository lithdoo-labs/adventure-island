# Subsystem Dossier: Login / World / Channel

## Transport (confirmed across tasks 033-049)
- server-first hello (15B); c2s word 0x4F00 + hello[6:10]; s2c word 0xB0FF + hello[10:14]
- reader family: ReadByte 0x66C9 / ReadInt16 0x259A2 / ReadInt32 0x66FF / ReadString 0x71D7A / ReadBytes 0x431E77
- writer family: WriteByte 0x661F / WriteInt16 0x291B3 / WriteInt32 0x667C / EnsureCapacity 0x663D / Send 0x95C5C

## Dispatch
Range table (0x00-0x1F login family) + three-layer band architecture

## State machines
SM01 CLogin state(+0x64), SM02 substate, SM03 channel migration (login->redirect->close->connect)

## Senders
LOGIN_PASSWORD/SERVERLIST_REQUEST/CHAR_SELECT fully resolved (task 033/046 lineage)

## Open questions
- S3 tail 112 vtable-dispatched send sites: {OPENQ['populated-state-required']} —
  concrete: hosts have zero static callers AND zero image dword refs; only a runtime
  vtable resolution or a decompiler-grade dataflow can name them
