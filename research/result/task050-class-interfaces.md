# Class Interfaces (method-level, evidence-backed)

## CUserRemote
- ctor 0x98CC52(id) [size 0x3500, pool 0xBE1DE0]
- decodeAvatar 0x58CDF6(pkt, tag)
- OnChatText-family leaves: 0x53D546(is_self), 0x53DA6B, 0x53F13D, ...
- vtable+0x24/0x28/0x2C = OnPacket vmethods (0xAD/0xAE/0xB4)
- pet handlers 0x30E006 family (5)

## CItem (polymorphic)
- factory 0xF2B2F(typeByte) -> {Equip,Use,Setup,Type100}
- shared ctor 0xF8AF6; decode = vtable+0x70(pkt)
- equality 0xF2ACD (+0x18/1C/20/24, vtable+0x18==1 cash check)

## CWvsContext (496-slot vtable)
- OnWarpToMap 0x37E72F | OnUpdateStats 0x6292F5 (mask 0xF2674)
- OnModifyInventory 0x6286EC | social: 0x648120/0x64915C/0x641174
- GetStats 0x26F51

## CShopSession
- alloc 0x5F4 | decode 0x36026F | vtbl+0x4C query

## Buff codec family
- apply 0x3848B7 | reset 0x38453C | spawn-deserialize 0x38FABE | combiner 0x416E36
