# Object Layouts (evidence-backed)

## CWvsContext (singleton 0xBD9028, vtable 0x70D3C8, 53 owned facts)
+0x205C CharacterId | +0x2080 grade | +0x2084 spawn_identity | +0x2088 reset flag
+0x208C stats timestamp | +0x2110 container | +0x28BC spawn-buff container (0x3500 obj)
+0x2D30 temp-stats (buff pairs stride 0x0C) | +0x2E04 party obj | +0x2E08 party struct(298B)
+0x2F38 buddy container (0x27-stride, id@+0x12, channels@+4) | +0x2F44 reset string
+0x2F60 char-changed | +0x2F7C guild container | +0x2FA2 guild gate
+0x2FE8 spawn gate | +0x31F4/+0x32F8 warp tail containers | +0x32F4 last-response ts
+0x2FF4 taming flag | +0x35B0 mount UI state

## CUserRemote (ctor 0x98CC52, size 0x3500)
+0x3B8 display tag | +0xF30 display name(str) | +0x1BB4 pet array(idx*8+4)
+0x1BBC effect map | +0x1BD4 active effect list | +0x2860/64/68 macro skills
+0x28B8 level | +0x28BC buffs | +0x28B0 miniroom(-1/2->0) | +0x34FC job hint
+0x3C0 stance | +0xF04 transformed id

## CCharacterStats (via GetStats 0x26F51)
+0x12 skin +0x13 level +0x17 stat4 +0x1B/23/2B i64 trio +0x33.. short series

## CItem family (factory 0xF2B2F, base ctor 0xF8AF6)
Equip 0xF9 (vtable ~0x7008C8) | Use 0x4D (0x700958) | Setup 0x79 | Type100 0x72 (0x700A50)
identity fields +0x18/+0x1C/+0x20/+0x24; decode = vtable+0x70

## CKeymapUI (0x3D95C)
+4 live table 89x5 | +0x1C1 shadow copy | +0x380 auto-potion itemid

## CShopSession (0xBD9020, size 0x5F4)
+0xB4 npcId | +0xEC session state
