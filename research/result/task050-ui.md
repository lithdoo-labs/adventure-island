# Subsystem Dossier: UI

## Dispatch coverage
0x16F-0x17E config family; KEYMAP 0x16F; 0xE0/E1 lazy window creation

## Object model
- CKeymapUI [0x3D95C]: live 89x5 table @+4, shadow @+0x1C1, auto-potion @+0x380
- UIWindowHolders [0xBDD8B8] (0x634 obj), [0xBDD870] (0x614 obj)
- CBBSBrowser 0x69C window (0x74)
- RandomEventProvider [0xBD8FE8]: 26-slot wheel

## Wire schemas
KEYMAP: [mode u8]{ 89 x 5-byte entries }; AUTO_HP/MP_POT: [itemid i32]

## Resource links
39 UI refs (ITC auction, UIWindow Maker/Quest,
StatusBar) — richest static resource family; 2 vtable-class ctors confirmed as UI windows

## Open questions
- VClass_709498/70B578 exact window names beyond resource hints: deeper register-level dataflow on existing corpus
- runtime window z-order/state: needs post-login capture: values only observable at runtime (see blockers)
