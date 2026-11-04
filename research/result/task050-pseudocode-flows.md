# Task 050 Pseudocode Behavior Flows

Generated from evidence: handler reader sequences (IMG), dispatch/jump-table positions (structural), sendops.properties names (PKT), builder writer-primitive sequences (IMG).
Field writes with unproven meaning are explicitly marked. No fabricated semantics.

Total flows: 372

---

## inbound flows

### IF001 OnMODIFY_INVENTORY_ITEM

evidence: handler@0x6286ec reader-seq

```python
packet = OnMODIFY_INVENTORY_ITEM(0x20)   # handler @0x6286ec
f0 = ReadReadByte()
f1 = ReadReadByte()
f2 = ReadReadByte()
f3 = ReadReadByte()
f4 = ReadReadInt16()
f5 = ReadReadInt32()
f6 = ReadReadInt16()
obj[0x2088] = ...   # field write, meaning unproven
obj[0x208c] = ...   # field write, meaning unproven
obj[0x2944] = ...   # field write, meaning unproven
obj[0x294c] = ...   # field write, meaning unproven
obj[0x2e98] = ...   # field write, meaning unproven
# 28 conditional branches
```

### IF002 OnUPDATE_INVENTORY_SLOT

evidence: handler@0x629024 reader-seq

```python
packet = OnUPDATE_INVENTORY_SLOT(0x21)   # handler @0x629024
f0 = ReadReadByte()
f1 = ReadReadByte()
f2 = ReadReadByte()
obj[0x2088] = ...   # field write, meaning unproven
obj[0x208c] = ...   # field write, meaning unproven
obj[0x2110] = ...   # field write, meaning unproven
obj[0x3568] = ...   # field write, meaning unproven
# loop x1, 19 conditional branches
```

### IF003 OnUPDATE_STATS

evidence: handler@0x6292f5 reader-seq

```python
packet = OnUPDATE_STATS(0x22)   # handler @0x6292f5
f0 = ReadReadByte()
f1 = ReadReadByte()
touch(CWvsContext)
obj[0x13] = ...   # field write, meaning unproven
obj[0x1c] = ...   # field write, meaning unproven
obj[0x33] = ...   # field write, meaning unproven
obj[0x35] = ...   # field write, meaning unproven
obj[0x39] = ...   # field write, meaning unproven
obj[0x3d] = ...   # field write, meaning unproven
# loop x2, 22 conditional branches
```

### IF004 OnGIVE_BUFF

evidence: handler@0x6299ff reader-seq

```python
packet = OnGIVE_BUFF(0x23)   # handler @0x6299ff
f0 = ReadReadInt16()
f1 = ReadReadByte()
obj[0x20] = ...   # field write, meaning unproven
obj[0x2110] = ...   # field write, meaning unproven
# loop x2, 22 conditional branches
```

### IF005 OnCANCEL_BUFF

evidence: handler@0x629e60 reader-seq

```python
packet = OnCANCEL_BUFF(0x24)   # handler @0x629e60
f0 = ReadReadByte()
f1 = ReadReadByte()
f2 = ReadReadByte()
touch(SocketSingleton)
obj[0xbfc] = ...   # field write, meaning unproven
obj[0xc0c] = ...   # field write, meaning unproven
obj[0x2088] = ...   # field write, meaning unproven
obj[0x208c] = ...   # field write, meaning unproven
obj[0x2110] = ...   # field write, meaning unproven
obj[0x2d30] = ...   # field write, meaning unproven
# 10 conditional branches
```

### IF006 OnTEMP_STATS

evidence: handler@0x62a040 reader-seq

```python
packet = OnTEMP_STATS(0x25)   # handler @0x62a040
f0 = ReadReadByte()
f1 = ReadReadByte()
f2 = ReadReadByte()
f3 = ReadReadByte()
f4 = ReadReadInt32()
f5 = ReadReadInt16()
touch(SocketSingleton)
obj[0x2088] = ...   # field write, meaning unproven
obj[0x208c] = ...   # field write, meaning unproven
obj[0x2110] = ...   # field write, meaning unproven
obj[0x2d30] = ...   # field write, meaning unproven
obj[0x32f4] = ...   # field write, meaning unproven
# 11 conditional branches
```

### IF007 OnTEMP_STATS_RESET

evidence: handler@0x62a05d reader-seq

```python
packet = OnTEMP_STATS_RESET(0x26)   # handler @0x62a05d
f0 = ReadReadByte()
f1 = ReadReadByte()
f2 = ReadReadByte()
f3 = ReadReadByte()
f4 = ReadReadInt32()
f5 = ReadReadInt16()
touch(SocketSingleton)
obj[0x2088] = ...   # field write, meaning unproven
obj[0x208c] = ...   # field write, meaning unproven
obj[0x2110] = ...   # field write, meaning unproven
obj[0x2d30] = ...   # field write, meaning unproven
obj[0x32f4] = ...   # field write, meaning unproven
# 13 conditional branches
```

### IF008 OnUPDATE_SKILLS

evidence: handler@0x6280d7 reader-seq

```python
packet = OnUPDATE_SKILLS(0x27)   # handler @0x6280d7
f0 = ReadReadByte()
f1 = ReadReadInt16()
f2 = ReadReadInt32()
f3 = ReadReadInt32()
f4 = ReadReadInt32()
f5 = ReadReadByte()
f6 = ReadReadInt32()
f7 = ReadReadByte()
f8 = ReadReadInt32()
f9 = ReadReadInt32()
f10 = ReadReadByte()
f11 = ReadReadByte()
obj[0x2e7] = ...   # field write, meaning unproven
obj[0x317] = ...   # field write, meaning unproven
obj[0x2088] = ...   # field write, meaning unproven
obj[0x208c] = ...   # field write, meaning unproven
# loop x1, 16 conditional branches
```

### IF009 OnSKILL_USE_RESULT

evidence: handler@0x62a0f3 reader-seq

```python
packet = OnSKILL_USE_RESULT(0x28)   # handler @0x62a0f3
f0 = ReadReadByte()
f1 = ReadReadByte()
f2 = ReadReadByte()
f3 = ReadReadByte()
f4 = ReadReadInt32()
f5 = ReadReadInt16()
f6 = ReadReadInt32()
f7 = ReadReadInt32()
obj[0x2088] = ...   # field write, meaning unproven
obj[0x208c] = ...   # field write, meaning unproven
# 14 conditional branches
```

### IF010 OnFAME_RESPONSE

evidence: handler@0x62bb3c reader-seq

```python
packet = OnFAME_RESPONSE(0x29)   # handler @0x62bb3c
f0 = ReadReadByte()
f1 = ReadReadByte()
f2 = ReadReadByte()
f3 = ReadReadInt32()
f4 = ReadReadInt32()
f5 = ReadReadInt32()
f6 = ReadReadInt16()
f7 = ReadReadInt16()
obj[0x2094] = ...   # field write, meaning unproven
obj[0x2de4] = ...   # field write, meaning unproven
# loop x1, 14 conditional branches
```

### IF011 OnSHOW_STATUS_INFO

evidence: handler@0x62a115 reader-seq

```python
packet = OnSHOW_STATUS_INFO(0x2A)   # handler @0x62a115
f0 = ReadReadByte()
f1 = ReadReadByte()
f2 = ReadReadByte()
f3 = ReadReadInt32()
f4 = ReadReadInt16()
f5 = ReadReadInt32()
f6 = ReadReadInt32()
# 14 conditional branches
```

### IF012 OnSHOW_NOTES

evidence: handler@0x62e85f reader-seq

```python
packet = OnSHOW_NOTES(0x2B)   # handler @0x62e85f
f0 = ReadReadByte()
f1 = ReadReadByte()
f2 = ReadReadByte()
f3 = ReadReadByte()
f4 = ReadReadByte()
f5 = ReadReadInt32()
touch(CWvsContext)
touch(SocketSingleton)
obj[0x3ef] = ...   # field write, meaning unproven
obj[0x403] = ...   # field write, meaning unproven
obj[0x2088] = ...   # field write, meaning unproven
obj[0x208c] = ...   # field write, meaning unproven
obj[0x2094] = ...   # field write, meaning unproven
obj[0x3468] = ...   # field write, meaning unproven
# loop x4, 20 conditional branches
```

### IF013 OnTROCK_LOCATIONS

evidence: handler@0x62ea39 reader-seq

```python
packet = OnTROCK_LOCATIONS(0x2C)   # handler @0x62ea39
f0 = ReadReadByte()
f1 = ReadReadByte()
f2 = ReadReadInt32()
obj[0x3ef] = ...   # field write, meaning unproven
obj[0x403] = ...   # field write, meaning unproven
obj[0x2094] = ...   # field write, meaning unproven
obj[0x34a4] = ...   # field write, meaning unproven
obj[0x34a8] = ...   # field write, meaning unproven
obj[0x34bc] = ...   # field write, meaning unproven
# loop x6, 13 conditional branches
```

### IF014 OnANTI_MACRO_RESULT

evidence: handler@0x62ff74 reader-seq

```python
packet = OnANTI_MACRO_RESULT(0x2D)   # handler @0x62ff74
f0 = ReadReadByte()
f1 = ReadReadByte()
f2 = ReadReadByte()
obj[0x3000] = ...   # field write, meaning unproven
obj[0x34c4] = ...   # field write, meaning unproven
# loop x1, 20 conditional branches
```

### IF015 OnCLAIM_RESULT

evidence: handler@0x631374 reader-seq

```python
packet = OnCLAIM_RESULT(0x2F)   # handler @0x631374
f0 = ReadReadByte()
f1 = ReadReadByte()
f2 = ReadReadInt32()
f3 = ReadReadByte()
f4 = ReadReadByte()
f5 = ReadReadByte()
obj[0x2ff0] = ...   # field write, meaning unproven
obj[0x2ff1] = ...   # field write, meaning unproven
obj[0x2ff4] = ...   # field write, meaning unproven
obj[0x35b0] = ...   # field write, meaning unproven
# 14 conditional branches
```

### IF016 OnCLAIM_STATUS_CHANGED

evidence: handler@0x63161a reader-seq

```python
packet = OnCLAIM_STATUS_CHANGED(0x30)   # handler @0x63161a
f0 = ReadReadByte()
f1 = ReadReadByte()
f2 = ReadReadByte()
f3 = ReadReadByte()
f4 = ReadReadInt32()
f5 = ReadReadByte()
touch(SocketSingleton)
obj[0x8] = ...   # field write, meaning unproven
obj[0x110] = ...   # field write, meaning unproven
obj[0x2ff0] = ...   # field write, meaning unproven
obj[0x2ff1] = ...   # field write, meaning unproven
obj[0x2ff4] = ...   # field write, meaning unproven
obj[0x34cc] = ...   # field write, meaning unproven
# 12 conditional branches
```

### IF017 OnSET_TAMING_MOB_INFO

evidence: handler@0x631643 reader-seq

```python
packet = OnSET_TAMING_MOB_INFO(0x31)   # handler @0x631643
f0 = ReadReadByte()
f1 = ReadReadByte()
f2 = ReadReadInt32()
f3 = ReadReadByte()
touch(SocketSingleton)
obj[0x8] = ...   # field write, meaning unproven
obj[0x110] = ...   # field write, meaning unproven
obj[0x2ff4] = ...   # field write, meaning unproven
obj[0x34cc] = ...   # field write, meaning unproven
obj[0x34d0] = ...   # field write, meaning unproven
obj[0x35b0] = ...   # field write, meaning unproven
# 12 conditional branches
```

### IF018 OnUPDATE_MOUNT

evidence: handler@0x632d3b reader-seq

```python
packet = OnUPDATE_MOUNT(0x32)   # handler @0x632d3b
f0 = ReadReadInt32()
f1 = ReadReadInt32()
f2 = ReadReadInt32()
f3 = ReadReadInt32()
f4 = ReadReadByte()
touch(SocketSingleton)
obj[0x39] = ...   # field write, meaning unproven
obj[0x3d] = ...   # field write, meaning unproven
obj[0x61] = ...   # field write, meaning unproven
obj[0x65] = ...   # field write, meaning unproven
obj[0x88] = ...   # field write, meaning unproven
obj[0x20f8] = ...   # field write, meaning unproven
# 11 conditional branches
```

### IF019 OnSHOW_QUEST_COMPLETION

evidence: handler@0x630827 reader-seq

```python
packet = OnSHOW_QUEST_COMPLETION(0x33)   # handler @0x630827
f0 = ReadReadInt16()
touch(SocketSingleton)
obj[0x578] = ...   # field write, meaning unproven
obj[0x33b0] = ...   # field write, meaning unproven
obj[0x33b8] = ...   # field write, meaning unproven
obj[0x3448] = ...   # field write, meaning unproven
obj[0x344c] = ...   # field write, meaning unproven
# loop x1, 14 conditional branches
```

### IF020 OnSEND_TITLE_BOX

evidence: handler@0x631881 reader-seq

```python
packet = OnSEND_TITLE_BOX(0x34)   # handler @0x631881
f0 = ReadReadByte()
f1 = ReadReadInt32()
f2 = ReadReadByte()
f3 = ReadReadInt32()
f4 = ReadReadByte()
f5 = ReadReadInt32()
f6 = ReadReadInt16()
obj[0x34cc] = ...   # field write, meaning unproven
obj[0x34d0] = ...   # field write, meaning unproven
# 7 conditional branches
```

### IF021 OnUSE_SKILL_BOOK

evidence: handler@0x6281eb reader-seq

```python
packet = OnUSE_SKILL_BOOK(0x35)   # handler @0x6281eb
f0 = ReadReadInt32()
f1 = ReadReadByte()
f2 = ReadReadInt32()
f3 = ReadReadInt32()
f4 = ReadReadByte()
f5 = ReadReadByte()
obj[0x2088] = ...   # field write, meaning unproven
obj[0x208c] = ...   # field write, meaning unproven
# loop x1, 17 conditional branches
```

### IF022 OnFINISH_SORT

evidence: handler@0x62857f reader-seq

```python
packet = OnFINISH_SORT(0x36)   # handler @0x62857f
f0 = ReadReadByte()
f1 = ReadReadByte()
f2 = ReadReadByte()
f3 = ReadReadByte()
f4 = ReadReadByte()
f5 = ReadReadByte()
f6 = ReadReadByte()
f7 = ReadReadByte()
f8 = ReadReadByte()
f9 = ReadReadByte()
f10 = ReadReadInt16()
f11 = ReadReadInt32()
touch(SocketSingleton)
obj[0x2088] = ...   # field write, meaning unproven
obj[0x208c] = ...   # field write, meaning unproven
obj[0x2944] = ...   # field write, meaning unproven
obj[0x294c] = ...   # field write, meaning unproven
obj[0x2e98] = ...   # field write, meaning unproven
obj[0x3318] = ...   # field write, meaning unproven
# 22 conditional branches
```

### IF023 OnFINISH_GATHER

evidence: handler@0x6285a9 reader-seq

```python
packet = OnFINISH_GATHER(0x37)   # handler @0x6285a9
f0 = ReadReadByte()
f1 = ReadReadByte()
f2 = ReadReadByte()
f3 = ReadReadByte()
f4 = ReadReadByte()
f5 = ReadReadByte()
f6 = ReadReadByte()
f7 = ReadReadByte()
f8 = ReadReadInt16()
f9 = ReadReadInt32()
touch(SocketSingleton)
obj[0x2088] = ...   # field write, meaning unproven
obj[0x208c] = ...   # field write, meaning unproven
obj[0x2944] = ...   # field write, meaning unproven
obj[0x294c] = ...   # field write, meaning unproven
obj[0x2e98] = ...   # field write, meaning unproven
obj[0x3318] = ...   # field write, meaning unproven
# 24 conditional branches
```

### IF024 OnCHAR_INFO

evidence: handler@0x62cde5 reader-seq

```python
packet = OnCHAR_INFO(0x3A)   # handler @0x62cde5
f0 = ReadReadInt32()
f1 = ReadReadByte()
f2 = ReadReadInt16()
f3 = ReadReadInt16()
f4 = ReadReadByte()
f5 = ReadReadByte()
f6 = ReadReadByte()
f7 = ReadReadInt32()
f8 = ReadReadInt32()
f9 = ReadReadInt32()
f10 = ReadReadByte()
f11 = ReadReadInt32()
obj[0x4] = ...   # field write, meaning unproven
obj[0x2088] = ...   # field write, meaning unproven
obj[0x208c] = ...   # field write, meaning unproven
obj[0x33bc] = ...   # field write, meaning unproven
obj[0x33c0] = ...   # field write, meaning unproven
# 14 conditional branches
```

### IF025 OnPARTY_OPERATION

evidence: handler@0x648120 reader-seq

```python
packet = OnPARTY_OPERATION(0x3B)   # handler @0x648120
f0 = ReadReadByte()
f1 = ReadReadInt32()
f2 = ReadReadByte()
touch(SocketSingleton)
# loop x1, 14 conditional branches
```

### IF026 OnBUDDYLIST

evidence: handler@0x64915c reader-seq

```python
packet = OnBUDDYLIST(0x3C)   # handler @0x64915c
f0 = ReadReadByte()
f1 = ReadReadInt32()
f2 = ReadReadByte()
f3 = ReadReadInt32()
f4 = ReadReadInt32()
f5 = ReadReadByte()
obj[0x12] = ...   # field write, meaning unproven
obj[0x205c] = ...   # field write, meaning unproven
obj[0x2094] = ...   # field write, meaning unproven
obj[0x2f34] = ...   # field write, meaning unproven
obj[0x2f38] = ...   # field write, meaning unproven
obj[0x33a8] = ...   # field write, meaning unproven
# 13 conditional branches
```

### IF027 OnGUILD_OPERATION

evidence: handler@0x641174 reader-seq

```python
packet = OnGUILD_OPERATION(0x3E)   # handler @0x641174
f0 = ReadReadByte()
f1 = ReadReadByte()
f2 = ReadReadInt32()
touch(SocketSingleton)
# loop x1, 25 conditional branches
```

### IF028 OnALLIANCE_OPERATION

evidence: handler@0x643bba reader-seq

```python
packet = OnALLIANCE_OPERATION(0x3F)   # handler @0x643bba
f0 = ReadReadByte()
f1 = ReadReadInt32()
f2 = ReadReadInt32()
f3 = ReadReadByte()
touch(SocketSingleton)
obj[0x2f7c] = ...   # field write, meaning unproven
obj[0x2fc8] = ...   # field write, meaning unproven
obj[0x2fcc] = ...   # field write, meaning unproven
obj[0x2fd4] = ...   # field write, meaning unproven
obj[0x2fe0] = ...   # field write, meaning unproven
obj[0x33a8] = ...   # field write, meaning unproven
# loop x1, 24 conditional branches
```

### IF029 OnSPAWN_PORTAL

evidence: handler@0x62be06 reader-seq

```python
packet = OnSPAWN_PORTAL(0x40)   # handler @0x62be06
f0 = ReadReadInt32()
f1 = ReadReadInt32()
f2 = ReadReadInt16()
f3 = ReadReadInt16()
f4 = ReadReadByte()
f5 = ReadReadByte()
f6 = ReadReadByte()
f7 = ReadReadByte()
f8 = ReadReadByte()
f9 = ReadReadByte()
f10 = ReadReadByte()
f11 = ReadReadByte()
obj[0x4] = ...   # field write, meaning unproven
obj[0x8] = ...   # field write, meaning unproven
obj[0xc] = ...   # field write, meaning unproven
obj[0x2094] = ...   # field write, meaning unproven
obj[0x2098] = ...   # field write, meaning unproven
obj[0x2110] = ...   # field write, meaning unproven
# 21 conditional branches
```

### IF030 OnSERVERMESSAGE

evidence: handler@0x62bede reader-seq

```python
packet = OnSERVERMESSAGE(0x41)   # handler @0x62bede
f0 = ReadReadByte()
f1 = ReadReadByte()
f2 = ReadReadByte()
f3 = ReadReadByte()
f4 = ReadReadByte()
f5 = ReadReadByte()
f6 = ReadReadByte()
f7 = ReadReadByte()
f8 = ReadReadByte()
f9 = ReadReadInt32()
f10 = ReadReadByte()
f11 = ReadReadByte()
# 25 conditional branches
```

### IF031 OnENGAGE_REQUEST

evidence: handler@0x632c6f reader-seq

```python
packet = OnENGAGE_REQUEST(0x45)   # handler @0x632c6f
f0 = ReadReadByte()
f1 = ReadReadByte()
f2 = ReadReadInt32()
f3 = ReadReadInt32()
f4 = ReadReadInt32()
f5 = ReadReadInt32()
f6 = ReadReadByte()
obj[0x39] = ...   # field write, meaning unproven
obj[0x3d] = ...   # field write, meaning unproven
obj[0x61] = ...   # field write, meaning unproven
obj[0x65] = ...   # field write, meaning unproven
obj[0x88] = ...   # field write, meaning unproven
obj[0x1bb4] = ...   # field write, meaning unproven
# 11 conditional branches
```

### IF032 OnSHOW_PREDICT_CARD

evidence: handler@0x611325 reader-seq

```python
packet = OnSHOW_PREDICT_CARD(0x46)   # handler @0x611325
f0 = ReadReadInt32()
f1 = ReadReadInt32()
f2 = ReadReadInt32()
f3 = ReadReadByte()
f4 = ReadReadInt32()
f5 = ReadReadInt32()
obj[0x4] = ...   # field write, meaning unproven
obj[0x8] = ...   # field write, meaning unproven
obj[0x6c] = ...   # field write, meaning unproven
obj[0x70] = ...   # field write, meaning unproven
obj[0x74] = ...   # field write, meaning unproven
obj[0x78] = ...   # field write, meaning unproven
# 8 conditional branches
```

### IF033 OnYELLOW_CHAT

evidence: handler@0x628654 reader-seq

```python
packet = OnYELLOW_CHAT(0x4E)   # handler @0x628654
f0 = ReadReadByte()
f1 = ReadReadByte()
f2 = ReadReadByte()
f3 = ReadReadByte()
f4 = ReadReadByte()
f5 = ReadReadByte()
f6 = ReadReadInt16()
f7 = ReadReadInt32()
f8 = ReadReadInt16()
obj[0x2088] = ...   # field write, meaning unproven
obj[0x208c] = ...   # field write, meaning unproven
obj[0x2944] = ...   # field write, meaning unproven
obj[0x294c] = ...   # field write, meaning unproven
obj[0x2e98] = ...   # field write, meaning unproven
obj[0x3318] = ...   # field write, meaning unproven
# 28 conditional branches
```

### IF034 OnAVATAR_MEGA

evidence: handler@0x63345c reader-seq

```python
packet = OnAVATAR_MEGA(0x56)   # handler @0x63345c
f0 = ReadReadInt32()
f1 = ReadReadInt32()
f2 = ReadReadByte()
touch(CWvsContext)
obj[0xc] = ...   # field write, meaning unproven
obj[0x10] = ...   # field write, meaning unproven
obj[0x347] = ...   # field write, meaning unproven
obj[0x48b] = ...   # field write, meaning unproven
obj[0x2638] = ...   # field write, meaning unproven
obj[0x2640] = ...   # field write, meaning unproven
# loop x1, 13 conditional branches
```

### IF035 OnPLAYER_NPC

evidence: handler@0x611948 reader-seq

```python
packet = OnPLAYER_NPC(0x5A)   # handler @0x611948
obj[0x1b] = ...   # field write, meaning unproven
obj[0x24c] = ...   # field write, meaning unproven
obj[0x254] = ...   # field write, meaning unproven
obj[0x270] = ...   # field write, meaning unproven
obj[0x278] = ...   # field write, meaning unproven
obj[0x594] = ...   # field write, meaning unproven
# loop x2, 21 conditional branches
```

### IF036 OnMONSTERBOOK_ADD

evidence: handler@0x61179e reader-seq

```python
packet = OnMONSTERBOOK_ADD(0x5B)   # handler @0x61179e
f0 = ReadReadByte()
f1 = ReadReadInt32()
f2 = ReadReadInt32()
f3 = ReadReadInt32()
f4 = ReadReadInt16()
f5 = ReadReadInt16()
f6 = ReadReadInt32()
f7 = ReadReadInt32()
f8 = ReadReadByte()
obj[0x1b] = ...   # field write, meaning unproven
obj[0x2088] = ...   # field write, meaning unproven
obj[0x2090] = ...   # field write, meaning unproven
obj[0x2094] = ...   # field write, meaning unproven
obj[0x2f3c] = ...   # field write, meaning unproven
obj[0x2f40] = ...   # field write, meaning unproven
# loop x1, 10 conditional branches
```

### IF037 OnMONSTERBOOK_CHANGE_COVER

evidence: handler@0x6118bb reader-seq

```python
packet = OnMONSTERBOOK_CHANGE_COVER(0x5C)   # handler @0x6118bb
f0 = ReadReadInt32()
f1 = ReadReadInt16()
f2 = ReadReadInt16()
f3 = ReadReadInt32()
f4 = ReadReadInt32()
f5 = ReadReadByte()
obj[0x1b] = ...   # field write, meaning unproven
obj[0x24c] = ...   # field write, meaning unproven
obj[0x254] = ...   # field write, meaning unproven
obj[0x270] = ...   # field write, meaning unproven
obj[0x278] = ...   # field write, meaning unproven
obj[0x594] = ...   # field write, meaning unproven
# loop x2, 13 conditional branches
```

### IF038 OnFAIRY_PEND_MSG

evidence: handler@0x61b999 reader-seq

```python
packet = OnFAIRY_PEND_MSG(0x60)   # handler @0x61b999
f0 = ReadReadByte()
obj[0x2fb8] = ...   # field write, meaning unproven
obj[0x2fbc] = ...   # field write, meaning unproven
obj[0x35c4] = ...   # field write, meaning unproven
obj[0x3668] = ...   # field write, meaning unproven
obj[0x366c] = ...   # field write, meaning unproven
obj[0x3670] = ...   # field write, meaning unproven
# 12 conditional branches
```

### IF039 OnSEND_PEDIGREE

evidence: handler@0x63dff2 reader-seq

```python
packet = OnSEND_PEDIGREE(0x64)   # handler @0x63dff2
f0 = ReadReadInt32()
f1 = ReadReadInt32()
f2 = ReadReadInt32()
f3 = ReadReadInt16()
f4 = ReadReadInt16()
f5 = ReadReadInt16()
f6 = ReadReadInt32()
f7 = ReadReadInt32()
f8 = ReadReadInt32()
f9 = ReadReadInt32()
f10 = ReadReadInt32()
f11 = ReadReadInt32()
obj[0x4] = ...   # field write, meaning unproven
obj[0x8] = ...   # field write, meaning unproven
obj[0xc] = ...   # field write, meaning unproven
obj[0xe] = ...   # field write, meaning unproven
obj[0x10] = ...   # field write, meaning unproven
obj[0x14] = ...   # field write, meaning unproven
# loop x1, 22 conditional branches
```

### IF040 OnOPEN_FAMILY

evidence: handler@0x63e008 reader-seq

```python
packet = OnOPEN_FAMILY(0x65)   # handler @0x63e008
f0 = ReadReadInt32()
f1 = ReadReadInt32()
f2 = ReadReadInt32()
f3 = ReadReadInt16()
f4 = ReadReadInt16()
f5 = ReadReadInt16()
f6 = ReadReadInt32()
f7 = ReadReadInt32()
f8 = ReadReadInt32()
f9 = ReadReadInt32()
f10 = ReadReadInt32()
f11 = ReadReadInt32()
obj[0x4] = ...   # field write, meaning unproven
obj[0x8] = ...   # field write, meaning unproven
obj[0xc] = ...   # field write, meaning unproven
obj[0xe] = ...   # field write, meaning unproven
obj[0x10] = ...   # field write, meaning unproven
obj[0x14] = ...   # field write, meaning unproven
# loop x1, 23 conditional branches
```

### IF041 OnFAMILY_MESSAGE

evidence: handler@0x63e164 reader-seq

```python
packet = OnFAMILY_MESSAGE(0x66)   # handler @0x63e164
f0 = ReadReadInt32()
f1 = ReadReadInt32()
obj[0x361c] = ...   # field write, meaning unproven
# loop x2, 18 conditional branches
```

### IF042 OnFAMILY_INVITE

evidence: handler@0x63e4b3 reader-seq

```python
packet = OnFAMILY_INVITE(0x67)   # handler @0x63e4b3
f0 = ReadReadInt32()
f1 = ReadReadByte()
f2 = ReadReadInt32()
f3 = ReadReadByte()
f4 = ReadReadInt32()
f5 = ReadReadInt32()
obj[0xc] = ...   # field write, meaning unproven
obj[0x10] = ...   # field write, meaning unproven
obj[0x14] = ...   # field write, meaning unproven
obj[0x35c8] = ...   # field write, meaning unproven
# 8 conditional branches
```

### IF043 OnFAMILY_JUNIOR

evidence: handler@0x63e59f reader-seq

```python
packet = OnFAMILY_JUNIOR(0x68)   # handler @0x63e59f
f0 = ReadReadByte()
f1 = ReadReadInt32()
f2 = ReadReadByte()
f3 = ReadReadInt32()
f4 = ReadReadInt32()
obj[0x4] = ...   # field write, meaning unproven
obj[0xc] = ...   # field write, meaning unproven
obj[0x10] = ...   # field write, meaning unproven
obj[0x14] = ...   # field write, meaning unproven
obj[0x18] = ...   # field write, meaning unproven
obj[0x1c] = ...   # field write, meaning unproven
# loop x1, 7 conditional branches
```

### IF044 OnSENIOR_MESSAGE

evidence: handler@0x63e695 reader-seq

```python
packet = OnSENIOR_MESSAGE(0x69)   # handler @0x63e695
f0 = ReadReadInt32()
f1 = ReadReadByte()
f2 = ReadReadInt32()
f3 = ReadReadInt32()
f4 = ReadReadInt32()
obj[0x4] = ...   # field write, meaning unproven
obj[0xc] = ...   # field write, meaning unproven
obj[0x10] = ...   # field write, meaning unproven
obj[0x14] = ...   # field write, meaning unproven
obj[0x18] = ...   # field write, meaning unproven
obj[0x1c] = ...   # field write, meaning unproven
# loop x1, 8 conditional branches
```

### IF045 OnFAMILY

evidence: handler@0x63e723 reader-seq

```python
packet = OnFAMILY(0x6A)   # handler @0x63e723
f0 = ReadReadInt32()
f1 = ReadReadByte()
f2 = ReadReadInt32()
f3 = ReadReadInt32()
f4 = ReadReadInt32()
f5 = ReadReadByte()
obj[0x4] = ...   # field write, meaning unproven
obj[0xc] = ...   # field write, meaning unproven
obj[0x10] = ...   # field write, meaning unproven
obj[0x14] = ...   # field write, meaning unproven
obj[0x18] = ...   # field write, meaning unproven
obj[0x1c] = ...   # field write, meaning unproven
# loop x1, 10 conditional branches
```

### IF046 OnREP_INCREASE

evidence: handler@0x63e8df reader-seq

```python
packet = OnREP_INCREASE(0x6B)   # handler @0x63e8df
f0 = ReadReadInt32()
f1 = ReadReadByte()
f2 = ReadReadByte()
f3 = ReadReadInt32()
f4 = ReadReadInt32()
f5 = ReadReadInt32()
obj[0x4] = ...   # field write, meaning unproven
obj[0x8] = ...   # field write, meaning unproven
obj[0xc] = ...   # field write, meaning unproven
obj[0x10] = ...   # field write, meaning unproven
obj[0x2dcc] = ...   # field write, meaning unproven
obj[0x35cc] = ...   # field write, meaning unproven
# 9 conditional branches
```

### IF047 OnFAMILY_LOGGEDIN

evidence: handler@0x63e9e3 reader-seq

```python
packet = OnFAMILY_LOGGEDIN(0x6C)   # handler @0x63e9e3
f0 = ReadReadByte()
f1 = ReadReadByte()
f2 = ReadReadInt32()
f3 = ReadReadInt32()
f4 = ReadReadInt32()
touch(SocketSingleton)
obj[0x4] = ...   # field write, meaning unproven
obj[0x8] = ...   # field write, meaning unproven
obj[0xc] = ...   # field write, meaning unproven
obj[0x10] = ...   # field write, meaning unproven
obj[0x2dcc] = ...   # field write, meaning unproven
obj[0x35cc] = ...   # field write, meaning unproven
# 7 conditional branches
```

### IF048 OnFAMILY_BUFF

evidence: handler@0x63eaac reader-seq

```python
packet = OnFAMILY_BUFF(0x6D)   # handler @0x63eaac
f0 = ReadReadByte()
f1 = ReadReadInt32()
f2 = ReadReadInt32()
f3 = ReadReadInt32()
touch(SocketSingleton)
obj[0x4] = ...   # field write, meaning unproven
obj[0x8] = ...   # field write, meaning unproven
obj[0xc] = ...   # field write, meaning unproven
obj[0x10] = ...   # field write, meaning unproven
obj[0x2dcc] = ...   # field write, meaning unproven
obj[0x35cc] = ...   # field write, meaning unproven
# loop x2, 8 conditional branches
```

### IF049 OnFAMILY_USE_REQUEST

evidence: handler@0x63ebd0 reader-seq

```python
packet = OnFAMILY_USE_REQUEST(0x6E)   # handler @0x63ebd0
touch(SocketSingleton)
obj[0x4] = ...   # field write, meaning unproven
# loop x2, 5 conditional branches
```

### IF050 OnLEVEL_UPDATE

evidence: handler@0x61c3f7 reader-seq

```python
packet = OnLEVEL_UPDATE(0x6F)   # handler @0x61c3f7
f0 = ReadReadByte()
f1 = ReadReadInt32()
f2 = ReadReadByte()
f3 = ReadReadByte()
f4 = ReadReadInt32()
obj[0x20ac] = ...   # field write, meaning unproven
# 8 conditional branches
```

### IF051 OnMARRIAGE_UPDATE

evidence: handler@0x61c584 reader-seq

```python
packet = OnMARRIAGE_UPDATE(0x70)   # handler @0x61c584
f0 = ReadReadByte()
f1 = ReadReadByte()
f2 = ReadReadInt32()
f3 = ReadReadByte()
obj[0xc] = ...   # field write, meaning unproven
obj[0x20] = ...   # field write, meaning unproven
obj[0x3640] = ...   # field write, meaning unproven
# 10 conditional branches
```

### IF052 OnJOB_UPDATE

evidence: handler@0x61c6af reader-seq

```python
packet = OnJOB_UPDATE(0x71)   # handler @0x61c6af
f0 = ReadReadByte()
f1 = ReadReadInt32()
f2 = ReadReadByte()
obj[0xc] = ...   # field write, meaning unproven
obj[0x20] = ...   # field write, meaning unproven
obj[0x3640] = ...   # field write, meaning unproven
# loop x1, 12 conditional branches
```

### IF053 OnDATA_CRC_CHECK_FAILED

evidence: handler@0x61c7fb reader-seq

```python
packet = OnDATA_CRC_CHECK_FAILED(0x72)   # handler @0x61c7fb
f0 = ReadReadByte()
obj[0xc] = ...   # field write, meaning unproven
obj[0x20] = ...   # field write, meaning unproven
obj[0x3448] = ...   # field write, meaning unproven
obj[0x3640] = ...   # field write, meaning unproven
# loop x4, 19 conditional branches
```

### IF054 OnTOP_MSG

evidence: handler@0x61ca98 reader-seq

```python
packet = OnTOP_MSG(0x73)   # handler @0x61ca98
obj[0x4] = ...   # field write, meaning unproven
obj[0x8] = ...   # field write, meaning unproven
obj[0xc] = ...   # field write, meaning unproven
obj[0x10] = ...   # field write, meaning unproven
obj[0x3448] = ...   # field write, meaning unproven
# 14 conditional branches
```

### IF055 OnBBS_OPERATION

evidence: handler@0x61cb05 reader-seq

```python
packet = OnBBS_OPERATION(0x74)   # handler @0x61cb05
touch(SocketSingleton)
obj[0x4] = ...   # field write, meaning unproven
obj[0x8] = ...   # field write, meaning unproven
obj[0xc] = ...   # field write, meaning unproven
obj[0x10] = ...   # field write, meaning unproven
obj[0x2088] = ...   # field write, meaning unproven
obj[0x208c] = ...   # field write, meaning unproven
# 12 conditional branches
```

### IF056 OnCHAR_CASH

evidence: handler@0x634844 reader-seq

```python
packet = OnCHAR_CASH(0x7D)   # handler @0x634844
f0 = ReadReadInt32()
f1 = ReadReadInt32()
touch(SocketSingleton)
obj[0x18] = ...   # field write, meaning unproven
obj[0x20] = ...   # field write, meaning unproven
obj[0x3db] = ...   # field write, meaning unproven
obj[0x3df] = ...   # field write, meaning unproven
obj[0x2088] = ...   # field write, meaning unproven
obj[0x208c] = ...   # field write, meaning unproven
# loop x2, 14 conditional branches
```

### IF057 OnSKILL_MACRO

evidence: handler@0x632d1e reader-seq

```python
packet = OnSKILL_MACRO(0x80)   # handler @0x632d1e
f0 = ReadReadInt32()
f1 = ReadReadInt32()
f2 = ReadReadInt32()
f3 = ReadReadInt32()
f4 = ReadReadByte()
obj[0x39] = ...   # field write, meaning unproven
obj[0x3d] = ...   # field write, meaning unproven
obj[0x61] = ...   # field write, meaning unproven
obj[0x65] = ...   # field write, meaning unproven
obj[0x88] = ...   # field write, meaning unproven
obj[0x20f8] = ...   # field write, meaning unproven
# 10 conditional branches
```

### IF058 OnWARP_TO_MAP (confirmed)

evidence: handler@0x37e72f reader-seq

```python
packet = OnWARP_TO_MAP (confirmed)(0x81)   # handler @0x37e72f
f0 = ReadReadInt32()
f1 = ReadReadByte()
f2 = ReadReadByte()
f3 = ReadReadByte()
f4 = ReadReadInt16()
f5 = ReadReadInt32()
f6 = ReadReadInt32()
f7 = ReadReadInt32()
f8 = ReadReadInt32()
f9 = ReadReadByte()
f10 = ReadReadInt16()
touch(CWvsContext)
touch(Delegate)
obj[0x4] = ...   # field write, meaning unproven
obj[0x8] = ...   # field write, meaning unproven
obj[0x61] = ...   # field write, meaning unproven
obj[0x65] = ...   # field write, meaning unproven
obj[0xc5] = ...   # field write, meaning unproven
obj[0xd1] = ...   # field write, meaning unproven
# loop x1, 14 conditional branches
```

### IF059 OnMTS_OPEN

evidence: handler@0x37fc9e reader-seq

```python
packet = OnMTS_OPEN(0x82)   # handler @0x37fc9e
touch(Delegate)
obj[0x4] = ...   # field write, meaning unproven
obj[0xc] = ...   # field write, meaning unproven
# 8 conditional branches
```

### IF060 OnCS_OPEN

evidence: handler@0x37f209 reader-seq

```python
packet = OnCS_OPEN(0x83)   # handler @0x37f209
touch(CWvsContext)
touch(Delegate)
obj[0x4] = ...   # field write, meaning unproven
obj[0x2f60] = ...   # field write, meaning unproven
# 16 conditional branches
```

### IF061 OnSPAWN_PLAYER (confirmed)

evidence: handler@0x57f6c0 reader-seq

```python
packet = OnSPAWN_PLAYER (confirmed)(0xA2)   # handler @0x57f6c0
f0 = ReadReadInt32()
f1 = ReadReadInt32()
f2 = ReadReadInt32()
touch(CWvsContext)
obj[0xc] = ...   # field write, meaning unproven
obj[0x10] = ...   # field write, meaning unproven
obj[0x24] = ...   # field write, meaning unproven
obj[0x54] = ...   # field write, meaning unproven
# 12 conditional branches
```

### IF062 OnREMOVE_PLAYER_FROM_MAP

evidence: handler@0x57f64c reader-seq

```python
packet = OnREMOVE_PLAYER_FROM_MAP(0xA3)   # handler @0x57f64c
f0 = ReadReadInt32()
f1 = ReadReadInt32()
touch(CWvsContext)
obj[0xc] = ...   # field write, meaning unproven
obj[0x10] = ...   # field write, meaning unproven
obj[0x24] = ...   # field write, meaning unproven
obj[0x54] = ...   # field write, meaning unproven
# 17 conditional branches
```

### IF063 OnCHATTEXT

evidence: handler@0x57f64c reader-seq

```python
packet = OnCHATTEXT(0xA4)   # handler @0x57f64c
f0 = ReadReadInt32()
f1 = ReadReadInt32()
touch(CWvsContext)
obj[0xc] = ...   # field write, meaning unproven
obj[0x10] = ...   # field write, meaning unproven
obj[0x24] = ...   # field write, meaning unproven
obj[0x54] = ...   # field write, meaning unproven
# 17 conditional branches
```

### IF064 OnCHALKBOARD

evidence: handler@0x57f64c reader-seq

```python
packet = OnCHALKBOARD(0xA6)   # handler @0x57f64c
f0 = ReadReadInt32()
f1 = ReadReadInt32()
touch(CWvsContext)
obj[0xc] = ...   # field write, meaning unproven
obj[0x10] = ...   # field write, meaning unproven
obj[0x24] = ...   # field write, meaning unproven
obj[0x54] = ...   # field write, meaning unproven
# 17 conditional branches
```

### IF065 OnUPDATE_CHAR_BOX

evidence: handler@0x57f64c reader-seq

```python
packet = OnUPDATE_CHAR_BOX(0xA7)   # handler @0x57f64c
f0 = ReadReadInt32()
f1 = ReadReadInt32()
touch(CWvsContext)
obj[0xc] = ...   # field write, meaning unproven
obj[0x10] = ...   # field write, meaning unproven
obj[0x24] = ...   # field write, meaning unproven
obj[0x54] = ...   # field write, meaning unproven
# 17 conditional branches
```

### IF066 OnSHOW_SCROLL_EFFECT

evidence: handler@0x57f64c reader-seq

```python
packet = OnSHOW_SCROLL_EFFECT(0xA9)   # handler @0x57f64c
f0 = ReadReadInt32()
f1 = ReadReadInt32()
touch(CWvsContext)
obj[0xc] = ...   # field write, meaning unproven
obj[0x10] = ...   # field write, meaning unproven
obj[0x24] = ...   # field write, meaning unproven
obj[0x54] = ...   # field write, meaning unproven
# 17 conditional branches
```

### IF067 OnFISHING_CAUGHT

evidence: handler@0x57f64c reader-seq

```python
packet = OnFISHING_CAUGHT(0xAB)   # handler @0x57f64c
f0 = ReadReadInt32()
f1 = ReadReadInt32()
touch(CWvsContext)
obj[0xc] = ...   # field write, meaning unproven
obj[0x10] = ...   # field write, meaning unproven
obj[0x24] = ...   # field write, meaning unproven
obj[0x54] = ...   # field write, meaning unproven
# 17 conditional branches
```

### IF068 OnSPAWN_PET

evidence: handler@0x57f64c reader-seq

```python
packet = OnSPAWN_PET(0xAD)   # handler @0x57f64c
f0 = ReadReadInt32()
f1 = ReadReadInt32()
touch(CWvsContext)
obj[0xc] = ...   # field write, meaning unproven
obj[0x10] = ...   # field write, meaning unproven
obj[0x24] = ...   # field write, meaning unproven
obj[0x54] = ...   # field write, meaning unproven
# 17 conditional branches
```

### IF069 OnMOVE_PET

evidence: handler@0x57f64c reader-seq

```python
packet = OnMOVE_PET(0xAF)   # handler @0x57f64c
f0 = ReadReadInt32()
f1 = ReadReadInt32()
touch(CWvsContext)
obj[0xc] = ...   # field write, meaning unproven
obj[0x10] = ...   # field write, meaning unproven
obj[0x24] = ...   # field write, meaning unproven
obj[0x54] = ...   # field write, meaning unproven
# 17 conditional branches
```

### IF070 OnPET_CHAT

evidence: handler@0x57f64c reader-seq

```python
packet = OnPET_CHAT(0xB0)   # handler @0x57f64c
f0 = ReadReadInt32()
f1 = ReadReadInt32()
touch(CWvsContext)
obj[0xc] = ...   # field write, meaning unproven
obj[0x10] = ...   # field write, meaning unproven
obj[0x24] = ...   # field write, meaning unproven
obj[0x54] = ...   # field write, meaning unproven
# 17 conditional branches
```

### IF071 OnPET_NAMECHANGE

evidence: handler@0x57f64c reader-seq

```python
packet = OnPET_NAMECHANGE(0xB1)   # handler @0x57f64c
f0 = ReadReadInt32()
f1 = ReadReadInt32()
touch(CWvsContext)
obj[0xc] = ...   # field write, meaning unproven
obj[0x10] = ...   # field write, meaning unproven
obj[0x24] = ...   # field write, meaning unproven
obj[0x54] = ...   # field write, meaning unproven
# 17 conditional branches
```

### IF072 OnPET_COMMAND

evidence: handler@0x57f64c reader-seq

```python
packet = OnPET_COMMAND(0xB3)   # handler @0x57f64c
f0 = ReadReadInt32()
f1 = ReadReadInt32()
touch(CWvsContext)
obj[0xc] = ...   # field write, meaning unproven
obj[0x10] = ...   # field write, meaning unproven
obj[0x24] = ...   # field write, meaning unproven
obj[0x54] = ...   # field write, meaning unproven
# 17 conditional branches
```

### IF073 OnSPAWN_SUMMON

evidence: handler@0x57f64c reader-seq

```python
packet = OnSPAWN_SUMMON(0xB4)   # handler @0x57f64c
f0 = ReadReadInt32()
f1 = ReadReadInt32()
touch(CWvsContext)
obj[0xc] = ...   # field write, meaning unproven
obj[0x10] = ...   # field write, meaning unproven
obj[0x24] = ...   # field write, meaning unproven
obj[0x54] = ...   # field write, meaning unproven
# 17 conditional branches
```

### IF074 OnREMOVE_SUMMON

evidence: handler@0x57f64c reader-seq

```python
packet = OnREMOVE_SUMMON(0xB5)   # handler @0x57f64c
f0 = ReadReadInt32()
f1 = ReadReadInt32()
touch(CWvsContext)
obj[0xc] = ...   # field write, meaning unproven
obj[0x10] = ...   # field write, meaning unproven
obj[0x24] = ...   # field write, meaning unproven
obj[0x54] = ...   # field write, meaning unproven
# 17 conditional branches
```

### IF075 OnMOVE_SUMMON

evidence: handler@0x57f64c reader-seq

```python
packet = OnMOVE_SUMMON(0xB6)   # handler @0x57f64c
f0 = ReadReadInt32()
f1 = ReadReadInt32()
touch(CWvsContext)
obj[0xc] = ...   # field write, meaning unproven
obj[0x10] = ...   # field write, meaning unproven
obj[0x24] = ...   # field write, meaning unproven
obj[0x54] = ...   # field write, meaning unproven
# 17 conditional branches
```

### IF076 OnSUMMON_ATTACK

evidence: handler@0x57f64c reader-seq

```python
packet = OnSUMMON_ATTACK(0xB7)   # handler @0x57f64c
f0 = ReadReadInt32()
f1 = ReadReadInt32()
touch(CWvsContext)
obj[0xc] = ...   # field write, meaning unproven
obj[0x10] = ...   # field write, meaning unproven
obj[0x24] = ...   # field write, meaning unproven
obj[0x54] = ...   # field write, meaning unproven
# 17 conditional branches
```

### IF077 OnDAMAGE_SUMMON

evidence: handler@0x57f64c reader-seq

```python
packet = OnDAMAGE_SUMMON(0xB9)   # handler @0x57f64c
f0 = ReadReadInt32()
f1 = ReadReadInt32()
touch(CWvsContext)
obj[0xc] = ...   # field write, meaning unproven
obj[0x10] = ...   # field write, meaning unproven
obj[0x24] = ...   # field write, meaning unproven
obj[0x54] = ...   # field write, meaning unproven
# 17 conditional branches
```

### IF078 OnSUMMON_SKILL

evidence: handler@0x57f64c reader-seq

```python
packet = OnSUMMON_SKILL(0xBA)   # handler @0x57f64c
f0 = ReadReadInt32()
f1 = ReadReadInt32()
touch(CWvsContext)
obj[0xc] = ...   # field write, meaning unproven
obj[0x10] = ...   # field write, meaning unproven
obj[0x24] = ...   # field write, meaning unproven
obj[0x54] = ...   # field write, meaning unproven
# 17 conditional branches
```

### IF079 OnMOVE_PLAYER

evidence: handler@0x57f64c reader-seq

```python
packet = OnMOVE_PLAYER(0xBB)   # handler @0x57f64c
f0 = ReadReadInt32()
f1 = ReadReadInt32()
touch(CWvsContext)
obj[0xc] = ...   # field write, meaning unproven
obj[0x10] = ...   # field write, meaning unproven
obj[0x24] = ...   # field write, meaning unproven
obj[0x54] = ...   # field write, meaning unproven
# 17 conditional branches
```

### IF080 OnCLOSE_RANGE_ATTACK

evidence: handler@0x57f64c reader-seq

```python
packet = OnCLOSE_RANGE_ATTACK(0xBC)   # handler @0x57f64c
f0 = ReadReadInt32()
f1 = ReadReadInt32()
touch(CWvsContext)
obj[0xc] = ...   # field write, meaning unproven
obj[0x10] = ...   # field write, meaning unproven
obj[0x24] = ...   # field write, meaning unproven
obj[0x54] = ...   # field write, meaning unproven
# 17 conditional branches
```

### IF081 OnRANGED_ATTACK

evidence: handler@0x57f64c reader-seq

```python
packet = OnRANGED_ATTACK(0xBD)   # handler @0x57f64c
f0 = ReadReadInt32()
f1 = ReadReadInt32()
touch(CWvsContext)
obj[0xc] = ...   # field write, meaning unproven
obj[0x10] = ...   # field write, meaning unproven
obj[0x24] = ...   # field write, meaning unproven
obj[0x54] = ...   # field write, meaning unproven
# 17 conditional branches
```

### IF082 OnMAGIC_ATTACK

evidence: handler@0x57f64c reader-seq

```python
packet = OnMAGIC_ATTACK(0xBE)   # handler @0x57f64c
f0 = ReadReadInt32()
f1 = ReadReadInt32()
touch(CWvsContext)
obj[0xc] = ...   # field write, meaning unproven
obj[0x10] = ...   # field write, meaning unproven
obj[0x24] = ...   # field write, meaning unproven
obj[0x54] = ...   # field write, meaning unproven
# 17 conditional branches
```

### IF083 OnSKILL_EFFECT

evidence: handler@0x57f64c reader-seq

```python
packet = OnSKILL_EFFECT(0xC0)   # handler @0x57f64c
f0 = ReadReadInt32()
f1 = ReadReadInt32()
touch(CWvsContext)
obj[0xc] = ...   # field write, meaning unproven
obj[0x10] = ...   # field write, meaning unproven
obj[0x24] = ...   # field write, meaning unproven
obj[0x54] = ...   # field write, meaning unproven
# 17 conditional branches
```

### IF084 OnCANCEL_SKILL_EFFECT

evidence: handler@0x57f64c reader-seq

```python
packet = OnCANCEL_SKILL_EFFECT(0xC1)   # handler @0x57f64c
f0 = ReadReadInt32()
f1 = ReadReadInt32()
touch(CWvsContext)
obj[0xc] = ...   # field write, meaning unproven
obj[0x10] = ...   # field write, meaning unproven
obj[0x24] = ...   # field write, meaning unproven
obj[0x54] = ...   # field write, meaning unproven
# 17 conditional branches
```

### IF085 OnDAMAGE_PLAYER

evidence: handler@0x57f64c reader-seq

```python
packet = OnDAMAGE_PLAYER(0xC2)   # handler @0x57f64c
f0 = ReadReadInt32()
f1 = ReadReadInt32()
touch(CWvsContext)
obj[0xc] = ...   # field write, meaning unproven
obj[0x10] = ...   # field write, meaning unproven
obj[0x24] = ...   # field write, meaning unproven
obj[0x54] = ...   # field write, meaning unproven
# 17 conditional branches
```

### IF086 OnFACIAL_EXPRESSION

evidence: handler@0x57f64c reader-seq

```python
packet = OnFACIAL_EXPRESSION(0xC3)   # handler @0x57f64c
f0 = ReadReadInt32()
f1 = ReadReadInt32()
touch(CWvsContext)
obj[0xc] = ...   # field write, meaning unproven
obj[0x10] = ...   # field write, meaning unproven
obj[0x24] = ...   # field write, meaning unproven
obj[0x54] = ...   # field write, meaning unproven
# 17 conditional branches
```

### IF087 OnSHOW_ITEM_EFFECT

evidence: handler@0x57f64c reader-seq

```python
packet = OnSHOW_ITEM_EFFECT(0xC5)   # handler @0x57f64c
f0 = ReadReadInt32()
f1 = ReadReadInt32()
touch(CWvsContext)
obj[0xc] = ...   # field write, meaning unproven
obj[0x10] = ...   # field write, meaning unproven
obj[0x24] = ...   # field write, meaning unproven
obj[0x54] = ...   # field write, meaning unproven
# 17 conditional branches
```

### IF088 OnSHOW_CHAIR

evidence: handler@0x57f64c reader-seq

```python
packet = OnSHOW_CHAIR(0xC6)   # handler @0x57f64c
f0 = ReadReadInt32()
f1 = ReadReadInt32()
touch(CWvsContext)
obj[0xc] = ...   # field write, meaning unproven
obj[0x10] = ...   # field write, meaning unproven
obj[0x24] = ...   # field write, meaning unproven
obj[0x54] = ...   # field write, meaning unproven
# 17 conditional branches
```

### IF089 OnUPDATE_CHAR_LOOK

evidence: handler@0x57f64c reader-seq

```python
packet = OnUPDATE_CHAR_LOOK(0xC7)   # handler @0x57f64c
f0 = ReadReadInt32()
f1 = ReadReadInt32()
touch(CWvsContext)
obj[0xc] = ...   # field write, meaning unproven
obj[0x10] = ...   # field write, meaning unproven
obj[0x24] = ...   # field write, meaning unproven
obj[0x54] = ...   # field write, meaning unproven
# 17 conditional branches
```

### IF090 OnSHOW_FOREIGN_EFFECT

evidence: handler@0x57f64c reader-seq

```python
packet = OnSHOW_FOREIGN_EFFECT(0xC8)   # handler @0x57f64c
f0 = ReadReadInt32()
f1 = ReadReadInt32()
touch(CWvsContext)
obj[0xc] = ...   # field write, meaning unproven
obj[0x10] = ...   # field write, meaning unproven
obj[0x24] = ...   # field write, meaning unproven
obj[0x54] = ...   # field write, meaning unproven
# 17 conditional branches
```

### IF091 OnGIVE_FOREIGN_BUFF

evidence: handler@0x57f64c reader-seq

```python
packet = OnGIVE_FOREIGN_BUFF(0xC9)   # handler @0x57f64c
f0 = ReadReadInt32()
f1 = ReadReadInt32()
touch(CWvsContext)
obj[0xc] = ...   # field write, meaning unproven
obj[0x10] = ...   # field write, meaning unproven
obj[0x24] = ...   # field write, meaning unproven
obj[0x54] = ...   # field write, meaning unproven
# 17 conditional branches
```

### IF092 OnCANCEL_FOREIGN_BUFF

evidence: handler@0x57f64c reader-seq

```python
packet = OnCANCEL_FOREIGN_BUFF(0xCA)   # handler @0x57f64c
f0 = ReadReadInt32()
f1 = ReadReadInt32()
touch(CWvsContext)
obj[0xc] = ...   # field write, meaning unproven
obj[0x10] = ...   # field write, meaning unproven
obj[0x24] = ...   # field write, meaning unproven
obj[0x54] = ...   # field write, meaning unproven
# 17 conditional branches
```

### IF093 OnUPDATE_PARTYMEMBER_HP

evidence: handler@0x57f64c reader-seq

```python
packet = OnUPDATE_PARTYMEMBER_HP(0xCB)   # handler @0x57f64c
f0 = ReadReadInt32()
f1 = ReadReadInt32()
touch(CWvsContext)
obj[0xc] = ...   # field write, meaning unproven
obj[0x10] = ...   # field write, meaning unproven
obj[0x24] = ...   # field write, meaning unproven
obj[0x54] = ...   # field write, meaning unproven
# 17 conditional branches
```

### IF094 OnAnimation_EFFECT

evidence: handler@0x57f64c reader-seq

```python
packet = OnAnimation_EFFECT(0xCE)   # handler @0x57f64c
f0 = ReadReadInt32()
f1 = ReadReadInt32()
touch(CWvsContext)
obj[0xc] = ...   # field write, meaning unproven
obj[0x10] = ...   # field write, meaning unproven
obj[0x24] = ...   # field write, meaning unproven
obj[0x54] = ...   # field write, meaning unproven
# 17 conditional branches
```

### IF095 OnCANCEL_CHAIR

evidence: handler@0x57f64c reader-seq

```python
packet = OnCANCEL_CHAIR(0xCF)   # handler @0x57f64c
f0 = ReadReadInt32()
f1 = ReadReadInt32()
touch(CWvsContext)
obj[0xc] = ...   # field write, meaning unproven
obj[0x10] = ...   # field write, meaning unproven
obj[0x24] = ...   # field write, meaning unproven
obj[0x54] = ...   # field write, meaning unproven
# 17 conditional branches
```

### IF096 OnSHOW_ITEM_GAIN_INCHAT

evidence: handler@0x57f64c reader-seq

```python
packet = OnSHOW_ITEM_GAIN_INCHAT(0xD0)   # handler @0x57f64c
f0 = ReadReadInt32()
f1 = ReadReadInt32()
touch(CWvsContext)
obj[0xc] = ...   # field write, meaning unproven
obj[0x10] = ...   # field write, meaning unproven
obj[0x24] = ...   # field write, meaning unproven
obj[0x54] = ...   # field write, meaning unproven
# 17 conditional branches
```

### IF097 OnUPDATE_QUEST_INFO

evidence: handler@0x57f64c reader-seq

```python
packet = OnUPDATE_QUEST_INFO(0xD6)   # handler @0x57f64c
f0 = ReadReadInt32()
f1 = ReadReadInt32()
touch(CWvsContext)
obj[0xc] = ...   # field write, meaning unproven
obj[0x10] = ...   # field write, meaning unproven
obj[0x24] = ...   # field write, meaning unproven
obj[0x54] = ...   # field write, meaning unproven
# 17 conditional branches
```

### IF098 OnPET_FLAG_CHANGE

evidence: handler@0x57f64c reader-seq

```python
packet = OnPET_FLAG_CHANGE(0xD8)   # handler @0x57f64c
f0 = ReadReadInt32()
f1 = ReadReadInt32()
touch(CWvsContext)
obj[0xc] = ...   # field write, meaning unproven
obj[0x10] = ...   # field write, meaning unproven
obj[0x24] = ...   # field write, meaning unproven
obj[0x54] = ...   # field write, meaning unproven
# 17 conditional branches
```

### IF099 OnPLAYER_HINT

evidence: handler@0x57f64c reader-seq

```python
packet = OnPLAYER_HINT(0xD9)   # handler @0x57f64c
f0 = ReadReadInt32()
f1 = ReadReadInt32()
touch(CWvsContext)
obj[0xc] = ...   # field write, meaning unproven
obj[0x10] = ...   # field write, meaning unproven
obj[0x24] = ...   # field write, meaning unproven
obj[0x54] = ...   # field write, meaning unproven
# 17 conditional branches
```

### IF100 OnCYGNUS_INTRO_DISABLE_UI

evidence: handler@0x57f64c reader-seq

```python
packet = OnCYGNUS_INTRO_DISABLE_UI(0xE3)   # handler @0x57f64c
f0 = ReadReadInt32()
f1 = ReadReadInt32()
touch(CWvsContext)
obj[0xc] = ...   # field write, meaning unproven
obj[0x10] = ...   # field write, meaning unproven
obj[0x24] = ...   # field write, meaning unproven
obj[0x54] = ...   # field write, meaning unproven
# 17 conditional branches
```

### IF101 OnCYGNUS_INTRO_LOCK

evidence: handler@0x57f64c reader-seq

```python
packet = OnCYGNUS_INTRO_LOCK(0xE4)   # handler @0x57f64c
f0 = ReadReadInt32()
f1 = ReadReadInt32()
touch(CWvsContext)
obj[0xc] = ...   # field write, meaning unproven
obj[0x10] = ...   # field write, meaning unproven
obj[0x24] = ...   # field write, meaning unproven
obj[0x54] = ...   # field write, meaning unproven
# 17 conditional branches
```

### IF102 OnSUMMON_HINT

evidence: handler@0x57f64c reader-seq

```python
packet = OnSUMMON_HINT(0xE5)   # handler @0x57f64c
f0 = ReadReadInt32()
f1 = ReadReadInt32()
touch(CWvsContext)
obj[0xc] = ...   # field write, meaning unproven
obj[0x10] = ...   # field write, meaning unproven
obj[0x24] = ...   # field write, meaning unproven
obj[0x54] = ...   # field write, meaning unproven
# 17 conditional branches
```

### IF103 OnTUTORIAL_GUIDE

evidence: handler@0x57f64c reader-seq

```python
packet = OnTUTORIAL_GUIDE(0xE6)   # handler @0x57f64c
f0 = ReadReadInt32()
f1 = ReadReadInt32()
touch(CWvsContext)
obj[0xc] = ...   # field write, meaning unproven
obj[0x10] = ...   # field write, meaning unproven
obj[0x24] = ...   # field write, meaning unproven
obj[0x54] = ...   # field write, meaning unproven
# 17 conditional branches
```

### IF104 OnARAN_COMBO

evidence: handler@0x57f64c reader-seq

```python
packet = OnARAN_COMBO(0xE7)   # handler @0x57f64c
f0 = ReadReadInt32()
f1 = ReadReadInt32()
touch(CWvsContext)
obj[0xc] = ...   # field write, meaning unproven
obj[0x10] = ...   # field write, meaning unproven
obj[0x24] = ...   # field write, meaning unproven
obj[0x54] = ...   # field write, meaning unproven
# 17 conditional branches
```

### IF105 OnCOOLDOWN

evidence: handler@0x57f64c reader-seq

```python
packet = OnCOOLDOWN(0xEC)   # handler @0x57f64c
f0 = ReadReadInt32()
f1 = ReadReadInt32()
touch(CWvsContext)
obj[0xc] = ...   # field write, meaning unproven
obj[0x10] = ...   # field write, meaning unproven
obj[0x24] = ...   # field write, meaning unproven
obj[0x54] = ...   # field write, meaning unproven
# 17 conditional branches
```

### IF106 OnSPAWN_MONSTER

evidence: handler@0x2a6ab0 reader-seq

```python
packet = OnSPAWN_MONSTER(0xEE)   # handler @0x2a6ab0
f0 = ReadReadInt32()
f1 = ReadReadInt32()
f2 = ReadReadByte()
f3 = ReadReadInt32()
obj[0x4] = ...   # field write, meaning unproven
obj[0x8] = ...   # field write, meaning unproven
obj[0x1c] = ...   # field write, meaning unproven
obj[0x28] = ...   # field write, meaning unproven
obj[0x58] = ...   # field write, meaning unproven
obj[0x60] = ...   # field write, meaning unproven
# loop x1, 16 conditional branches
```

### IF107 OnKILL_MONSTER

evidence: handler@0x2a6ab0 reader-seq

```python
packet = OnKILL_MONSTER(0xEF)   # handler @0x2a6ab0
f0 = ReadReadInt32()
f1 = ReadReadInt32()
f2 = ReadReadByte()
f3 = ReadReadInt32()
obj[0x4] = ...   # field write, meaning unproven
obj[0x8] = ...   # field write, meaning unproven
obj[0x1c] = ...   # field write, meaning unproven
obj[0x28] = ...   # field write, meaning unproven
obj[0x58] = ...   # field write, meaning unproven
obj[0x60] = ...   # field write, meaning unproven
# loop x1, 16 conditional branches
```

### IF108 OnSPAWN_MONSTER_CONTROL

evidence: handler@0x2a6ab0 reader-seq

```python
packet = OnSPAWN_MONSTER_CONTROL(0xF0)   # handler @0x2a6ab0
f0 = ReadReadInt32()
f1 = ReadReadInt32()
f2 = ReadReadByte()
f3 = ReadReadInt32()
obj[0x4] = ...   # field write, meaning unproven
obj[0x8] = ...   # field write, meaning unproven
obj[0x1c] = ...   # field write, meaning unproven
obj[0x28] = ...   # field write, meaning unproven
obj[0x58] = ...   # field write, meaning unproven
obj[0x60] = ...   # field write, meaning unproven
# loop x1, 16 conditional branches
```

### IF109 OnMOVE_MONSTER

evidence: handler@0x2a6ab0 reader-seq

```python
packet = OnMOVE_MONSTER(0xF1)   # handler @0x2a6ab0
f0 = ReadReadInt32()
f1 = ReadReadInt32()
f2 = ReadReadByte()
f3 = ReadReadInt32()
obj[0x4] = ...   # field write, meaning unproven
obj[0x8] = ...   # field write, meaning unproven
obj[0x1c] = ...   # field write, meaning unproven
obj[0x28] = ...   # field write, meaning unproven
obj[0x58] = ...   # field write, meaning unproven
obj[0x60] = ...   # field write, meaning unproven
# loop x1, 16 conditional branches
```

### IF110 OnMOVE_MONSTER_RESPONSE

evidence: handler@0x2a6ab0 reader-seq

```python
packet = OnMOVE_MONSTER_RESPONSE(0xF2)   # handler @0x2a6ab0
f0 = ReadReadInt32()
f1 = ReadReadInt32()
f2 = ReadReadByte()
f3 = ReadReadInt32()
obj[0x4] = ...   # field write, meaning unproven
obj[0x8] = ...   # field write, meaning unproven
obj[0x1c] = ...   # field write, meaning unproven
obj[0x28] = ...   # field write, meaning unproven
obj[0x58] = ...   # field write, meaning unproven
obj[0x60] = ...   # field write, meaning unproven
# loop x1, 16 conditional branches
```

### IF111 OnAPPLY_MONSTER_STATUS

evidence: handler@0x2a6ab0 reader-seq

```python
packet = OnAPPLY_MONSTER_STATUS(0xF4)   # handler @0x2a6ab0
f0 = ReadReadInt32()
f1 = ReadReadInt32()
f2 = ReadReadByte()
f3 = ReadReadInt32()
obj[0x4] = ...   # field write, meaning unproven
obj[0x8] = ...   # field write, meaning unproven
obj[0x1c] = ...   # field write, meaning unproven
obj[0x28] = ...   # field write, meaning unproven
obj[0x58] = ...   # field write, meaning unproven
obj[0x60] = ...   # field write, meaning unproven
# loop x1, 16 conditional branches
```

### IF112 OnCANCEL_MONSTER_STATUS

evidence: handler@0x2a6ab0 reader-seq

```python
packet = OnCANCEL_MONSTER_STATUS(0xF5)   # handler @0x2a6ab0
f0 = ReadReadInt32()
f1 = ReadReadInt32()
f2 = ReadReadByte()
f3 = ReadReadInt32()
obj[0x4] = ...   # field write, meaning unproven
obj[0x8] = ...   # field write, meaning unproven
obj[0x1c] = ...   # field write, meaning unproven
obj[0x28] = ...   # field write, meaning unproven
obj[0x58] = ...   # field write, meaning unproven
obj[0x60] = ...   # field write, meaning unproven
# loop x1, 16 conditional branches
```

### IF113 OnMOB_TO_MOB_DAMAGE

evidence: handler@0x2a6ab0 reader-seq

```python
packet = OnMOB_TO_MOB_DAMAGE(0xF7)   # handler @0x2a6ab0
f0 = ReadReadInt32()
f1 = ReadReadInt32()
f2 = ReadReadByte()
f3 = ReadReadInt32()
obj[0x4] = ...   # field write, meaning unproven
obj[0x8] = ...   # field write, meaning unproven
obj[0x1c] = ...   # field write, meaning unproven
obj[0x28] = ...   # field write, meaning unproven
obj[0x58] = ...   # field write, meaning unproven
obj[0x60] = ...   # field write, meaning unproven
# loop x1, 16 conditional branches
```

### IF114 OnDAMAGE_MONSTER

evidence: handler@0x2a6ab0 reader-seq

```python
packet = OnDAMAGE_MONSTER(0xF8)   # handler @0x2a6ab0
f0 = ReadReadInt32()
f1 = ReadReadInt32()
f2 = ReadReadByte()
f3 = ReadReadInt32()
obj[0x4] = ...   # field write, meaning unproven
obj[0x8] = ...   # field write, meaning unproven
obj[0x1c] = ...   # field write, meaning unproven
obj[0x28] = ...   # field write, meaning unproven
obj[0x58] = ...   # field write, meaning unproven
obj[0x60] = ...   # field write, meaning unproven
# loop x1, 16 conditional branches
```

### IF115 OnARIANT_THING

evidence: handler@0x2a6ab0 reader-seq

```python
packet = OnARIANT_THING(0xFB)   # handler @0x2a6ab0
f0 = ReadReadInt32()
f1 = ReadReadInt32()
f2 = ReadReadByte()
f3 = ReadReadInt32()
obj[0x4] = ...   # field write, meaning unproven
obj[0x8] = ...   # field write, meaning unproven
obj[0x1c] = ...   # field write, meaning unproven
obj[0x28] = ...   # field write, meaning unproven
obj[0x58] = ...   # field write, meaning unproven
obj[0x60] = ...   # field write, meaning unproven
# loop x1, 16 conditional branches
```

### IF116 OnSHOW_MONSTER_HP

evidence: handler@0x2a6ab0 reader-seq

```python
packet = OnSHOW_MONSTER_HP(0xFC)   # handler @0x2a6ab0
f0 = ReadReadInt32()
f1 = ReadReadInt32()
f2 = ReadReadByte()
f3 = ReadReadInt32()
obj[0x4] = ...   # field write, meaning unproven
obj[0x8] = ...   # field write, meaning unproven
obj[0x1c] = ...   # field write, meaning unproven
obj[0x28] = ...   # field write, meaning unproven
obj[0x58] = ...   # field write, meaning unproven
obj[0x60] = ...   # field write, meaning unproven
# loop x1, 16 conditional branches
```

### IF117 OnSHOW_MAGNET

evidence: handler@0x2a6ab0 reader-seq

```python
packet = OnSHOW_MAGNET(0xFD)   # handler @0x2a6ab0
f0 = ReadReadInt32()
f1 = ReadReadInt32()
f2 = ReadReadByte()
f3 = ReadReadInt32()
obj[0x4] = ...   # field write, meaning unproven
obj[0x8] = ...   # field write, meaning unproven
obj[0x1c] = ...   # field write, meaning unproven
obj[0x28] = ...   # field write, meaning unproven
obj[0x58] = ...   # field write, meaning unproven
obj[0x60] = ...   # field write, meaning unproven
# loop x1, 16 conditional branches
```

### IF118 OnCYGNUS_CHAR_CREATED

evidence: handler@0x2a6ab0 reader-seq

```python
packet = OnCYGNUS_CHAR_CREATED(0xFF)   # handler @0x2a6ab0
f0 = ReadReadInt32()
f1 = ReadReadInt32()
f2 = ReadReadByte()
f3 = ReadReadInt32()
obj[0x4] = ...   # field write, meaning unproven
obj[0x8] = ...   # field write, meaning unproven
obj[0x1c] = ...   # field write, meaning unproven
obj[0x28] = ...   # field write, meaning unproven
obj[0x58] = ...   # field write, meaning unproven
obj[0x60] = ...   # field write, meaning unproven
# loop x1, 16 conditional branches
```

### IF119 OnCATCH_ARIANT

evidence: handler@0x2a6ab0 reader-seq

```python
packet = OnCATCH_ARIANT(0x100)   # handler @0x2a6ab0
f0 = ReadReadInt32()
f1 = ReadReadInt32()
f2 = ReadReadByte()
f3 = ReadReadInt32()
obj[0x4] = ...   # field write, meaning unproven
obj[0x8] = ...   # field write, meaning unproven
obj[0x1c] = ...   # field write, meaning unproven
obj[0x28] = ...   # field write, meaning unproven
obj[0x58] = ...   # field write, meaning unproven
obj[0x60] = ...   # field write, meaning unproven
# loop x1, 16 conditional branches
```

### IF120 OnCATCH_MONSTER

evidence: handler@0x2a6ab0 reader-seq

```python
packet = OnCATCH_MONSTER(0x103)   # handler @0x2a6ab0
f0 = ReadReadInt32()
f1 = ReadReadInt32()
f2 = ReadReadByte()
f3 = ReadReadInt32()
obj[0x4] = ...   # field write, meaning unproven
obj[0x8] = ...   # field write, meaning unproven
obj[0x1c] = ...   # field write, meaning unproven
obj[0x28] = ...   # field write, meaning unproven
obj[0x58] = ...   # field write, meaning unproven
obj[0x60] = ...   # field write, meaning unproven
# loop x1, 16 conditional branches
```

### IF121 OnSPAWN_NPC

evidence: handler@0x2cb061 reader-seq

```python
packet = OnSPAWN_NPC(0x104)   # handler @0x2cb061
f0 = ReadReadByte()
f1 = ReadReadInt32()
f2 = ReadReadByte()
f3 = ReadReadInt32()
f4 = ReadReadInt32()
f5 = ReadReadInt32()
f6 = ReadReadInt32()
f7 = ReadReadInt32()
obj[0x4] = ...   # field write, meaning unproven
obj[0xc] = ...   # field write, meaning unproven
obj[0x10] = ...   # field write, meaning unproven
obj[0x14] = ...   # field write, meaning unproven
obj[0x18] = ...   # field write, meaning unproven
obj[0x1c] = ...   # field write, meaning unproven
# loop x5, 27 conditional branches
```

### IF122 OnREMOVE_NPC

evidence: handler@0x2cb061 reader-seq

```python
packet = OnREMOVE_NPC(0x105)   # handler @0x2cb061
f0 = ReadReadByte()
f1 = ReadReadInt32()
f2 = ReadReadByte()
f3 = ReadReadInt32()
f4 = ReadReadInt32()
f5 = ReadReadInt32()
f6 = ReadReadInt32()
f7 = ReadReadInt32()
obj[0x4] = ...   # field write, meaning unproven
obj[0xc] = ...   # field write, meaning unproven
obj[0x10] = ...   # field write, meaning unproven
obj[0x14] = ...   # field write, meaning unproven
obj[0x18] = ...   # field write, meaning unproven
obj[0x1c] = ...   # field write, meaning unproven
# loop x5, 27 conditional branches
```

### IF123 OnSPAWN_NPC_REQUEST_CONTROLLER

evidence: handler@0x2cb061 reader-seq

```python
packet = OnSPAWN_NPC_REQUEST_CONTROLLER(0x106)   # handler @0x2cb061
f0 = ReadReadByte()
f1 = ReadReadInt32()
f2 = ReadReadByte()
f3 = ReadReadInt32()
f4 = ReadReadInt32()
f5 = ReadReadInt32()
f6 = ReadReadInt32()
f7 = ReadReadInt32()
obj[0x4] = ...   # field write, meaning unproven
obj[0xc] = ...   # field write, meaning unproven
obj[0x10] = ...   # field write, meaning unproven
obj[0x14] = ...   # field write, meaning unproven
obj[0x18] = ...   # field write, meaning unproven
obj[0x1c] = ...   # field write, meaning unproven
# loop x5, 27 conditional branches
```

### IF124 OnNPC_ACTION

evidence: handler@0x2cb061 reader-seq

```python
packet = OnNPC_ACTION(0x107)   # handler @0x2cb061
f0 = ReadReadByte()
f1 = ReadReadInt32()
f2 = ReadReadByte()
f3 = ReadReadInt32()
f4 = ReadReadInt32()
f5 = ReadReadInt32()
f6 = ReadReadInt32()
f7 = ReadReadInt32()
obj[0x4] = ...   # field write, meaning unproven
obj[0xc] = ...   # field write, meaning unproven
obj[0x10] = ...   # field write, meaning unproven
obj[0x14] = ...   # field write, meaning unproven
obj[0x18] = ...   # field write, meaning unproven
obj[0x1c] = ...   # field write, meaning unproven
# loop x5, 27 conditional branches
```

### IF125 OnSPAWN_HIRED_MERCHANT

evidence: handler@0x11b3a3 reader-seq

```python
packet = OnSPAWN_HIRED_MERCHANT(0x10D)   # handler @0x11b3a3
f0 = ReadReadInt32()
f1 = ReadReadInt32()
f2 = ReadReadInt32()
f3 = ReadReadInt32()
obj[0x4] = ...   # field write, meaning unproven
obj[0x8] = ...   # field write, meaning unproven
obj[0xc] = ...   # field write, meaning unproven
obj[0x10] = ...   # field write, meaning unproven
obj[0x14] = ...   # field write, meaning unproven
obj[0x18] = ...   # field write, meaning unproven
# loop x2, 24 conditional branches
```

### IF126 OnDESTROY_HIRED_MERCHANT

evidence: handler@0x11b3a3 reader-seq

```python
packet = OnDESTROY_HIRED_MERCHANT(0x10E)   # handler @0x11b3a3
f0 = ReadReadInt32()
f1 = ReadReadInt32()
f2 = ReadReadInt32()
f3 = ReadReadInt32()
obj[0x4] = ...   # field write, meaning unproven
obj[0x8] = ...   # field write, meaning unproven
obj[0xc] = ...   # field write, meaning unproven
obj[0x10] = ...   # field write, meaning unproven
obj[0x14] = ...   # field write, meaning unproven
obj[0x18] = ...   # field write, meaning unproven
# loop x2, 24 conditional branches
```

### IF127 OnUPDATE_HIRED_MERCHANT

evidence: handler@0x11b3a3 reader-seq

```python
packet = OnUPDATE_HIRED_MERCHANT(0x10F)   # handler @0x11b3a3
f0 = ReadReadInt32()
f1 = ReadReadInt32()
f2 = ReadReadInt32()
f3 = ReadReadInt32()
obj[0x4] = ...   # field write, meaning unproven
obj[0x8] = ...   # field write, meaning unproven
obj[0xc] = ...   # field write, meaning unproven
obj[0x10] = ...   # field write, meaning unproven
obj[0x14] = ...   # field write, meaning unproven
obj[0x18] = ...   # field write, meaning unproven
# loop x2, 24 conditional branches
```

### IF128 OnDROP_ITEM_FROM_MAPOBJECT

evidence: handler@0x10e6cf reader-seq

```python
packet = OnDROP_ITEM_FROM_MAPOBJECT(0x110)   # handler @0x10e6cf
f0 = ReadReadByte()
f1 = ReadReadInt32()
f2 = ReadReadByte()
f3 = ReadReadInt32()
f4 = ReadReadInt32()
f5 = ReadReadByte()
f6 = ReadReadInt16()
f7 = ReadReadInt16()
f8 = ReadReadInt32()
f9 = ReadReadInt16()
f10 = ReadReadInt16()
f11 = ReadReadInt16()
obj[0x1] = ...   # field write, meaning unproven
obj[0x8] = ...   # field write, meaning unproven
obj[0xc] = ...   # field write, meaning unproven
obj[0x1c] = ...   # field write, meaning unproven
obj[0x1d] = ...   # field write, meaning unproven
obj[0x24] = ...   # field write, meaning unproven
# 18 conditional branches
```

### IF129 OnREMOVE_ITEM_FROM_MAP

evidence: handler@0x10e6cf reader-seq

```python
packet = OnREMOVE_ITEM_FROM_MAP(0x111)   # handler @0x10e6cf
f0 = ReadReadByte()
f1 = ReadReadInt32()
f2 = ReadReadByte()
f3 = ReadReadInt32()
f4 = ReadReadInt32()
f5 = ReadReadByte()
f6 = ReadReadInt16()
f7 = ReadReadInt16()
f8 = ReadReadInt32()
f9 = ReadReadInt16()
f10 = ReadReadInt16()
f11 = ReadReadInt16()
obj[0x1] = ...   # field write, meaning unproven
obj[0x8] = ...   # field write, meaning unproven
obj[0xc] = ...   # field write, meaning unproven
obj[0x1c] = ...   # field write, meaning unproven
obj[0x1d] = ...   # field write, meaning unproven
obj[0x24] = ...   # field write, meaning unproven
# 18 conditional branches
```

### IF130 OnSPAWN_LOVE

evidence: handler@0x288cba reader-seq

```python
packet = OnSPAWN_LOVE(0x113)   # handler @0x288cba
f0 = ReadReadInt32()
f1 = ReadReadInt32()
f2 = ReadReadInt16()
f3 = ReadReadInt16()
obj[0x4] = ...   # field write, meaning unproven
obj[0x1c] = ...   # field write, meaning unproven
obj[0x20] = ...   # field write, meaning unproven
obj[0x24] = ...   # field write, meaning unproven
obj[0x28] = ...   # field write, meaning unproven
obj[0x38] = ...   # field write, meaning unproven
# 16 conditional branches
```

### IF131 OnREMOVE_LOVE

evidence: handler@0x288cba reader-seq

```python
packet = OnREMOVE_LOVE(0x114)   # handler @0x288cba
f0 = ReadReadInt32()
f1 = ReadReadInt32()
f2 = ReadReadInt16()
f3 = ReadReadInt16()
obj[0x4] = ...   # field write, meaning unproven
obj[0x1c] = ...   # field write, meaning unproven
obj[0x20] = ...   # field write, meaning unproven
obj[0x24] = ...   # field write, meaning unproven
obj[0x28] = ...   # field write, meaning unproven
obj[0x38] = ...   # field write, meaning unproven
# 16 conditional branches
```

### IF132 OnSPAWN_MIST

evidence: handler@0x31648 reader-seq

```python
packet = OnSPAWN_MIST(0x115)   # handler @0x31648
f0 = ReadReadInt32()
f1 = ReadReadInt32()
f2 = ReadReadInt32()
f3 = ReadReadInt32()
f4 = ReadReadByte()
f5 = ReadReadInt16()
f6 = ReadReadInt32()
obj[0x8] = ...   # field write, meaning unproven
obj[0x14] = ...   # field write, meaning unproven
# 17 conditional branches
```

### IF133 OnREMOVE_MIST

evidence: handler@0x31648 reader-seq

```python
packet = OnREMOVE_MIST(0x116)   # handler @0x31648
f0 = ReadReadInt32()
f1 = ReadReadInt32()
f2 = ReadReadInt32()
f3 = ReadReadInt32()
f4 = ReadReadByte()
f5 = ReadReadInt16()
f6 = ReadReadInt32()
obj[0x8] = ...   # field write, meaning unproven
obj[0x14] = ...   # field write, meaning unproven
# 17 conditional branches
```

### IF134 OnREACTOR_HIT

evidence: handler@0x341c0b reader-seq

```python
packet = OnREACTOR_HIT(0x11C)   # handler @0x341c0b
f0 = ReadReadInt32()
f1 = ReadReadByte()
f2 = ReadReadInt16()
f3 = ReadReadInt16()
f4 = ReadReadInt16()
f5 = ReadReadByte()
f6 = ReadReadByte()
f7 = ReadReadInt32()
f8 = ReadReadInt32()
f9 = ReadReadByte()
f10 = ReadReadInt16()
f11 = ReadReadInt16()
obj[0x4] = ...   # field write, meaning unproven
obj[0xc] = ...   # field write, meaning unproven
obj[0x10] = ...   # field write, meaning unproven
obj[0x14] = ...   # field write, meaning unproven
obj[0x18] = ...   # field write, meaning unproven
obj[0x24] = ...   # field write, meaning unproven
# 13 conditional branches
```

### IF135 OnREACTOR_SPAWN

evidence: handler@0x341c0b reader-seq

```python
packet = OnREACTOR_SPAWN(0x11E)   # handler @0x341c0b
f0 = ReadReadInt32()
f1 = ReadReadByte()
f2 = ReadReadInt16()
f3 = ReadReadInt16()
f4 = ReadReadInt16()
f5 = ReadReadByte()
f6 = ReadReadByte()
f7 = ReadReadInt32()
f8 = ReadReadInt32()
f9 = ReadReadByte()
f10 = ReadReadInt16()
f11 = ReadReadInt16()
obj[0x4] = ...   # field write, meaning unproven
obj[0xc] = ...   # field write, meaning unproven
obj[0x10] = ...   # field write, meaning unproven
obj[0x14] = ...   # field write, meaning unproven
obj[0x18] = ...   # field write, meaning unproven
obj[0x24] = ...   # field write, meaning unproven
# 13 conditional branches
```

### IF136 OnREACTOR_DESTROY

evidence: handler@0x341c0b reader-seq

```python
packet = OnREACTOR_DESTROY(0x11F)   # handler @0x341c0b
f0 = ReadReadInt32()
f1 = ReadReadByte()
f2 = ReadReadInt16()
f3 = ReadReadInt16()
f4 = ReadReadInt16()
f5 = ReadReadByte()
f6 = ReadReadByte()
f7 = ReadReadInt32()
f8 = ReadReadInt32()
f9 = ReadReadByte()
f10 = ReadReadInt16()
f11 = ReadReadInt16()
obj[0x4] = ...   # field write, meaning unproven
obj[0xc] = ...   # field write, meaning unproven
obj[0x10] = ...   # field write, meaning unproven
obj[0x14] = ...   # field write, meaning unproven
obj[0x18] = ...   # field write, meaning unproven
obj[0x24] = ...   # field write, meaning unproven
# 13 conditional branches
```

### IF137 OnNPC_TALK

evidence: handler@0x353092 reader-seq

```python
packet = OnNPC_TALK(0x145)   # handler @0x353092
f0 = ReadReadByte()
f1 = ReadReadInt32()
f2 = ReadReadByte()
f3 = ReadReadByte()
obj[0x4] = ...   # field write, meaning unproven
# 5 conditional branches
```

### IF138 OnOPEN_NPC_SHOP

evidence: handler@0x36400c reader-seq

```python
packet = OnOPEN_NPC_SHOP(0x146)   # handler @0x36400c
f0 = ReadReadByte()
obj[0x4] = ...   # field write, meaning unproven
obj[0x8] = ...   # field write, meaning unproven
obj[0x3c] = ...   # field write, meaning unproven
obj[0x7c] = ...   # field write, meaning unproven
obj[0x84] = ...   # field write, meaning unproven
obj[0x8c] = ...   # field write, meaning unproven
# loop x1, 27 conditional branches
```

### IF139 OnCONFIRM_SHOP_TRANSACTION

evidence: handler@0x36400c reader-seq

```python
packet = OnCONFIRM_SHOP_TRANSACTION(0x147)   # handler @0x36400c
f0 = ReadReadByte()
obj[0x4] = ...   # field write, meaning unproven
obj[0x8] = ...   # field write, meaning unproven
obj[0x3c] = ...   # field write, meaning unproven
obj[0x7c] = ...   # field write, meaning unproven
obj[0x84] = ...   # field write, meaning unproven
obj[0x8c] = ...   # field write, meaning unproven
# loop x1, 27 conditional branches
```

### IF140 OnMERCH_ITEM_MSG

evidence: handler@0x3a1424 reader-seq

```python
packet = OnMERCH_ITEM_MSG(0x14B)   # handler @0x3a1424
f0 = ReadReadByte()
f1 = ReadReadInt32()
f2 = ReadReadInt32()
f3 = ReadReadByte()
f4 = ReadReadInt32()
f5 = ReadReadInt32()
touch(CWvsContext)
obj[0xb4] = ...   # field write, meaning unproven
# 19 conditional branches
```

### IF141 OnMERCH_ITEM_STORE

evidence: handler@0x3a1424 reader-seq

```python
packet = OnMERCH_ITEM_STORE(0x14C)   # handler @0x3a1424
f0 = ReadReadByte()
f1 = ReadReadInt32()
f2 = ReadReadInt32()
f3 = ReadReadByte()
f4 = ReadReadInt32()
f5 = ReadReadInt32()
touch(CWvsContext)
obj[0xb4] = ...   # field write, meaning unproven
# 19 conditional branches
```

### IF142 OnKEYMAP (confirmed)

evidence: handler@0x1b9e4f reader-seq

```python
packet = OnKEYMAP (confirmed)(0x16F)   # handler @0x1b9e4f
f0 = ReadReadByte()
f1 = ReadReadInt32()
f2 = ReadReadInt32()
touch(SocketSingleton)
obj[0x4] = ...   # field write, meaning unproven
obj[0x5] = ...   # field write, meaning unproven
obj[0x1c1] = ...   # field write, meaning unproven
obj[0x380] = ...   # field write, meaning unproven
obj[0x384] = ...   # field write, meaning unproven
# loop x4, 26 conditional branches
```

### IF143 OnAUTO_HP_POT

evidence: handler@0x1b9f14 reader-seq

```python
packet = OnAUTO_HP_POT(0x170)   # handler @0x1b9f14
touch(SocketSingleton)
obj[0x4] = ...   # field write, meaning unproven
obj[0x5] = ...   # field write, meaning unproven
obj[0x95] = ...   # field write, meaning unproven
obj[0xd6] = ...   # field write, meaning unproven
obj[0x167] = ...   # field write, meaning unproven
obj[0x171] = ...   # field write, meaning unproven
# loop x3, 22 conditional branches
```

### IF144 OnAUTO_MP_POT

evidence: handler@0x1b9f14 reader-seq

```python
packet = OnAUTO_MP_POT(0x171)   # handler @0x1b9f14
touch(SocketSingleton)
obj[0x4] = ...   # field write, meaning unproven
obj[0x5] = ...   # field write, meaning unproven
obj[0x95] = ...   # field write, meaning unproven
obj[0xd6] = ...   # field write, meaning unproven
obj[0x167] = ...   # field write, meaning unproven
obj[0x171] = ...   # field write, meaning unproven
# loop x3, 22 conditional branches
```

### IF145 OnVICIOUS_HAMMER

evidence: handler@0x148034 reader-seq

```python
packet = OnVICIOUS_HAMMER(0x182)   # handler @0x148034
obj[0x4] = ...   # field write, meaning unproven
obj[0x8] = ...   # field write, meaning unproven
obj[0x1e0] = ...   # field write, meaning unproven
# loop x2, 17 conditional branches
```

### BF146 OnSPAWN_PLAYER (confirmed)

evidence: leaf@0x57f6c0 cmp-chain

```python
packet = OnSPAWN_PLAYER (confirmed)(0xA2)   # band leaf @0x57f6c0 via cmp-chain
f0 = Readint32()
f1 = Readint32()
```

### BF147 OnCHATTEXT

evidence: leaf@0x57fa1c jump-table

```python
packet = OnCHATTEXT(0xA4)   # band leaf @0x57fa1c via jump-table
f0 = Readint32()
f1 = Readint32()
f2 = Readint32()
```

### BF148 Onopcode_0xA5

evidence: leaf@0x53d546 jump-table

```python
packet = Onopcode_0xA5(0xA5)   # band leaf @0x53d546 via jump-table
f0 = Readbyte()
f1 = Readstring()
f2 = Readbyte()
f3 = Readstring()
```

### BF149 OnCHALKBOARD

evidence: leaf@0x53da6b jump-table

```python
packet = OnCHALKBOARD(0xA6)   # band leaf @0x53da6b via jump-table
f0 = Readbyte()
f1 = Readstring()
f2 = Readbyte()
f3 = Readint32()
f4 = Readbyte()
f5 = Readbyte()
```

### BF150 OnUPDATE_CHAR_BOX

evidence: leaf@0x53f13d jump-table

```python
packet = OnUPDATE_CHAR_BOX(0xA7)   # band leaf @0x53f13d via jump-table
f0 = Readbyte()
f1 = Readint32()
f2 = Readstring()
f3 = Readbyte()
f4 = Readbyte()
f5 = Readbyte()
f6 = Readbyte()
f7 = Readbyte()
f8 = Readbyte()
f9 = Readint32()
```

### BF151 Onopcode_0xA8

evidence: leaf@0x541202 jump-table

```python
packet = Onopcode_0xA8(0xA8)   # band leaf @0x541202 via jump-table
f0 = Readint32()
```

### BF152 OnSHOW_SCROLL_EFFECT

evidence: leaf@0x539c4a jump-table

```python
packet = OnSHOW_SCROLL_EFFECT(0xA9)   # band leaf @0x539c4a via jump-table
f0 = Readbyte()
f1 = Readbyte()
f2 = Readbyte()
f3 = Readbyte()
```

### BF153 Onopcode_0xAA

evidence: leaf@0x53f125 jump-table

```python
packet = Onopcode_0xAA(0xAA)   # band leaf @0x53f125 via jump-table
f0 = Readint32()
f1 = Readbyte()
f2 = Readint32()
f3 = Readstring()
f4 = Readbyte()
f5 = Readbyte()
f6 = Readbyte()
f7 = Readbyte()
f8 = Readbyte()
f9 = Readbyte()
f10 = Readint32()
```

### BF154 Onopcode_0xAC

evidence: leaf@0x549d70 jump-table

```python
packet = Onopcode_0xAC(0xAC)   # band leaf @0x549d70 via jump-table
f0 = Readint32()
f1 = Readint32()
```

### BF155 OnMOVE_PLAYER

evidence: leaf@0x57fc72 jump-table

```python
packet = OnMOVE_PLAYER(0xBB)   # band leaf @0x57fc72 via jump-table
f0 = Readint32()
```

### BF156 OnCLOSE_RANGE_ATTACK

evidence: leaf@0x57fc97 jump-table

```python
packet = OnCLOSE_RANGE_ATTACK(0xBC)   # band leaf @0x57fc97 via jump-table
f0 = Readint32()
```

### BF157 OnRANGED_ATTACK

evidence: leaf@0x590ec9 jump-table

```python
packet = OnRANGED_ATTACK(0xBD)   # band leaf @0x590ec9 via jump-table
f0 = Readbyte()
f1 = Readbyte()
f2 = Readbyte()
f3 = Readbyte()
f4 = Readint32()
f5 = Readint32()
f6 = Readbyte()
f7 = Readint32()
f8 = Readint32()
f9 = Readbyte()
f10 = Readint32()
f11 = Readint32()
```

### BF158 OnMAGIC_ATTACK

evidence: leaf@0x5910c6 jump-table

```python
packet = OnMAGIC_ATTACK(0xBE)   # band leaf @0x5910c6 via jump-table
f0 = Readshort()
f1 = Readint32()
f2 = Readint32()
f3 = Readstring()
f4 = Readshort()
f5 = Readbyte()
f6 = Readshort()
f7 = Readbyte()
f8 = Readbyte()
f9 = Readbyte()
f10 = Readbyte()
```

### BF159 Onopcode_0xBF

evidence: leaf@0x59118a jump-table

```python
packet = Onopcode_0xBF(0xBF)   # band leaf @0x59118a via jump-table
f0 = Readint32()
f1 = Readint32()
f2 = Readstring()
f3 = Readshort()
f4 = Readbyte()
f5 = Readshort()
f6 = Readbyte()
f7 = Readbyte()
f8 = Readbyte()
f9 = Readbyte()
f10 = Readint32()
f11 = Readint32()
```

### BF160 OnSKILL_EFFECT

evidence: leaf@0x591253 jump-table

```python
packet = OnSKILL_EFFECT(0xC0)   # band leaf @0x591253 via jump-table
f0 = Readint32()
f1 = Readint32()
f2 = Readstring()
f3 = Readshort()
f4 = Readbyte()
f5 = Readshort()
f6 = Readbyte()
f7 = Readbyte()
f8 = Readbyte()
f9 = Readbyte()
f10 = Readint32()
f11 = Readint32()
```

### BF161 OnCANCEL_SKILL_EFFECT

evidence: leaf@0x5912d3 jump-table

```python
packet = OnCANCEL_SKILL_EFFECT(0xC1)   # band leaf @0x5912d3 via jump-table
f0 = Readstring()
f1 = Readshort()
f2 = Readbyte()
f3 = Readshort()
f4 = Readbyte()
f5 = Readbyte()
f6 = Readbyte()
f7 = Readbyte()
f8 = Readint32()
f9 = Readint32()
f10 = Readint32()
f11 = Readint32()
```

### BF162 OnDAMAGE_PLAYER

evidence: leaf@0x59131e jump-table

```python
packet = OnDAMAGE_PLAYER(0xC2)   # band leaf @0x59131e via jump-table
f0 = Readshort()
f1 = Readbyte()
f2 = Readshort()
f3 = Readbyte()
f4 = Readbyte()
f5 = Readbyte()
f6 = Readbyte()
f7 = Readint32()
f8 = Readint32()
f9 = Readint32()
f10 = Readint32()
```

### BF163 OnFACIAL_EXPRESSION

evidence: leaf@0x57fbea jump-table

```python
packet = OnFACIAL_EXPRESSION(0xC3)   # band leaf @0x57fbea via jump-table
f0 = Readint32()
```

### BF164 Onopcode_0xC4

evidence: leaf@0x5916a9 jump-table

```python
packet = Onopcode_0xC4(0xC4)   # band leaf @0x5916a9 via jump-table
f0 = Readint32()
f1 = Readint32()
f2 = Readint32()
f3 = Readstring()
f4 = Readstring()
f5 = Readshort()
f6 = Readshort()
f7 = Readint32()
```

### BF165 OnSHOW_ITEM_EFFECT

evidence: leaf@0x5916fd jump-table

```python
packet = OnSHOW_ITEM_EFFECT(0xC5)   # band leaf @0x5916fd via jump-table
f0 = Readstring()
f1 = Readstring()
f2 = Readshort()
f3 = Readshort()
f4 = Readint32()
```

### BF166 OnSHOW_CHAIR

evidence: leaf@0x57fc72 jump-table

```python
packet = OnSHOW_CHAIR(0xC6)   # band leaf @0x57fc72 via jump-table
f0 = Readint32()
```

### BF167 OnUPDATE_CHAR_LOOK

evidence: leaf@0x57fc72 jump-table

```python
packet = OnUPDATE_CHAR_LOOK(0xC7)   # band leaf @0x57fc72 via jump-table
f0 = Readint32()
```

### BF168 OnSHOW_FOREIGN_EFFECT

evidence: leaf@0x53dc3e jump-table

```python
packet = OnSHOW_FOREIGN_EFFECT(0xC8)   # band leaf @0x53dc3e via jump-table
f0 = Readbyte()
f1 = Readint32()
f2 = Readbyte()
f3 = Readbyte()
f4 = Readbyte()
```

### BF169 OnGIVE_FOREIGN_BUFF

evidence: leaf@0x57fc72 jump-table

```python
packet = OnGIVE_FOREIGN_BUFF(0xC9)   # band leaf @0x57fc72 via jump-table
f0 = Readint32()
```

### BF170 OnCANCEL_FOREIGN_BUFF

evidence: leaf@0x57fc72 jump-table

```python
packet = OnCANCEL_FOREIGN_BUFF(0xCA)   # band leaf @0x57fc72 via jump-table
f0 = Readint32()
```

### BF171 OnUPDATE_PARTYMEMBER_HP

evidence: leaf@0x57fc72 jump-table

```python
packet = OnUPDATE_PARTYMEMBER_HP(0xCB)   # band leaf @0x57fc72 via jump-table
f0 = Readint32()
```

### BF172 Onopcode_0xCC

evidence: leaf@0x57fc72 jump-table

```python
packet = Onopcode_0xCC(0xCC)   # band leaf @0x57fc72 via jump-table
f0 = Readint32()
```

### BF173 Onopcode_0xCD

evidence: leaf@0x57fc72 jump-table

```python
packet = Onopcode_0xCD(0xCD)   # band leaf @0x57fc72 via jump-table
f0 = Readint32()
```

### BF174 OnAnimation_EFFECT

evidence: leaf@0x59142a jump-table

```python
packet = OnAnimation_EFFECT(0xCE)   # band leaf @0x59142a via jump-table
f0 = Readint32()
f1 = Readint32()
f2 = Readint32()
f3 = Readint32()
f4 = Readint32()
f5 = Readint32()
f6 = Readint32()
f7 = Readstring()
```

### BF175 OnSPAWN_MONSTER

evidence: leaf@0x2a6b0f cmp-chain

```python
packet = OnSPAWN_MONSTER(0xEE)   # band leaf @0x2a6b0f via cmp-chain
f0 = Readint32()
f1 = Readint32()
f2 = Readbyte()
f3 = Readint32()
f4 = Readint32()
f5 = Readbyte()
```

### BF176 OnKILL_MONSTER

evidence: leaf@0x2a6b0f cmp-chain

```python
packet = OnKILL_MONSTER(0xEF)   # band leaf @0x2a6b0f via cmp-chain
f0 = Readint32()
f1 = Readint32()
f2 = Readbyte()
f3 = Readint32()
f4 = Readint32()
f5 = Readbyte()
```

### BF177 OnSPAWN_MONSTER_CONTROL

evidence: leaf@0x2a6b0f cmp-chain

```python
packet = OnSPAWN_MONSTER_CONTROL(0xF0)   # band leaf @0x2a6b0f via cmp-chain
f0 = Readint32()
f1 = Readint32()
f2 = Readbyte()
f3 = Readint32()
f4 = Readint32()
f5 = Readbyte()
```

### BF178 OnMOVE_MONSTER

evidence: leaf@0x2a6b0f cmp-chain

```python
packet = OnMOVE_MONSTER(0xF1)   # band leaf @0x2a6b0f via cmp-chain
f0 = Readint32()
f1 = Readint32()
f2 = Readbyte()
f3 = Readint32()
f4 = Readint32()
f5 = Readbyte()
```

### BF179 OnMOVE_MONSTER_RESPONSE

evidence: leaf@0x2a6b0f cmp-chain

```python
packet = OnMOVE_MONSTER_RESPONSE(0xF2)   # band leaf @0x2a6b0f via cmp-chain
f0 = Readint32()
f1 = Readint32()
f2 = Readbyte()
f3 = Readint32()
f4 = Readint32()
f5 = Readbyte()
```

### BF180 Onopcode_0xF3

evidence: leaf@0x2a6b0f cmp-chain

```python
packet = Onopcode_0xF3(0xF3)   # band leaf @0x2a6b0f via cmp-chain
f0 = Readint32()
f1 = Readint32()
f2 = Readbyte()
f3 = Readint32()
f4 = Readint32()
f5 = Readbyte()
```

### BF181 OnAPPLY_MONSTER_STATUS

evidence: leaf@0x2a6b0f cmp-chain

```python
packet = OnAPPLY_MONSTER_STATUS(0xF4)   # band leaf @0x2a6b0f via cmp-chain
f0 = Readint32()
f1 = Readint32()
f2 = Readbyte()
f3 = Readint32()
f4 = Readint32()
f5 = Readbyte()
```

### BF182 OnCANCEL_MONSTER_STATUS

evidence: leaf@0x2a6b0f cmp-chain

```python
packet = OnCANCEL_MONSTER_STATUS(0xF5)   # band leaf @0x2a6b0f via cmp-chain
f0 = Readint32()
f1 = Readint32()
f2 = Readbyte()
f3 = Readint32()
f4 = Readint32()
f5 = Readbyte()
```

### BF183 Onopcode_0xF6

evidence: leaf@0x2a6b0f cmp-chain

```python
packet = Onopcode_0xF6(0xF6)   # band leaf @0x2a6b0f via cmp-chain
f0 = Readint32()
f1 = Readint32()
f2 = Readbyte()
f3 = Readint32()
f4 = Readint32()
f5 = Readbyte()
```

### BF184 OnMOB_TO_MOB_DAMAGE

evidence: leaf@0x2a6b0f cmp-chain

```python
packet = OnMOB_TO_MOB_DAMAGE(0xF7)   # band leaf @0x2a6b0f via cmp-chain
f0 = Readint32()
f1 = Readint32()
f2 = Readbyte()
f3 = Readint32()
f4 = Readint32()
f5 = Readbyte()
```

### BF185 OnDAMAGE_MONSTER

evidence: leaf@0x2a6b0f cmp-chain

```python
packet = OnDAMAGE_MONSTER(0xF8)   # band leaf @0x2a6b0f via cmp-chain
f0 = Readint32()
f1 = Readint32()
f2 = Readbyte()
f3 = Readint32()
f4 = Readint32()
f5 = Readbyte()
```

### BF186 Onopcode_0xF9

evidence: leaf@0x2a6b0f cmp-chain

```python
packet = Onopcode_0xF9(0xF9)   # band leaf @0x2a6b0f via cmp-chain
f0 = Readint32()
f1 = Readint32()
f2 = Readbyte()
f3 = Readint32()
f4 = Readint32()
f5 = Readbyte()
```

### BF187 Onopcode_0xFA

evidence: leaf@0x2a6b0f cmp-chain

```python
packet = Onopcode_0xFA(0xFA)   # band leaf @0x2a6b0f via cmp-chain
f0 = Readint32()
f1 = Readint32()
f2 = Readbyte()
f3 = Readint32()
f4 = Readint32()
f5 = Readbyte()
```

### BF188 OnARIANT_THING

evidence: leaf@0x2a6b0f cmp-chain

```python
packet = OnARIANT_THING(0xFB)   # band leaf @0x2a6b0f via cmp-chain
f0 = Readint32()
f1 = Readint32()
f2 = Readbyte()
f3 = Readint32()
f4 = Readint32()
f5 = Readbyte()
```

### BF189 OnSHOW_MONSTER_HP

evidence: leaf@0x2a6b0f cmp-chain

```python
packet = OnSHOW_MONSTER_HP(0xFC)   # band leaf @0x2a6b0f via cmp-chain
f0 = Readint32()
f1 = Readint32()
f2 = Readbyte()
f3 = Readint32()
f4 = Readint32()
f5 = Readbyte()
```

### BF190 OnSHOW_MAGNET

evidence: leaf@0x2a6b0f cmp-chain

```python
packet = OnSHOW_MAGNET(0xFD)   # band leaf @0x2a6b0f via cmp-chain
f0 = Readint32()
f1 = Readint32()
f2 = Readbyte()
f3 = Readint32()
f4 = Readint32()
f5 = Readbyte()
```

### BF191 Onopcode_0xFE

evidence: leaf@0x2a6b0f cmp-chain

```python
packet = Onopcode_0xFE(0xFE)   # band leaf @0x2a6b0f via cmp-chain
f0 = Readint32()
f1 = Readint32()
f2 = Readbyte()
f3 = Readint32()
f4 = Readint32()
f5 = Readbyte()
```

### BF192 OnCYGNUS_CHAR_CREATED

evidence: leaf@0x2a6b0f cmp-chain

```python
packet = OnCYGNUS_CHAR_CREATED(0xFF)   # band leaf @0x2a6b0f via cmp-chain
f0 = Readint32()
f1 = Readint32()
f2 = Readbyte()
f3 = Readint32()
f4 = Readint32()
f5 = Readbyte()
```

### BF193 OnCATCH_ARIANT

evidence: leaf@0x2a6b0f cmp-chain

```python
packet = OnCATCH_ARIANT(0x100)   # band leaf @0x2a6b0f via cmp-chain
f0 = Readint32()
f1 = Readint32()
f2 = Readbyte()
f3 = Readint32()
f4 = Readint32()
f5 = Readbyte()
```

### BF194 Onopcode_0x101

evidence: leaf@0x2a6b0f cmp-chain

```python
packet = Onopcode_0x101(0x101)   # band leaf @0x2a6b0f via cmp-chain
f0 = Readint32()
f1 = Readint32()
f2 = Readbyte()
f3 = Readint32()
f4 = Readint32()
f5 = Readbyte()
```

### BF195 Onopcode_0x102

evidence: leaf@0x2a6b0f cmp-chain

```python
packet = Onopcode_0x102(0x102)   # band leaf @0x2a6b0f via cmp-chain
f0 = Readint32()
f1 = Readint32()
f2 = Readbyte()
f3 = Readint32()
f4 = Readint32()
f5 = Readbyte()
```

### BF196 OnCATCH_MONSTER

evidence: leaf@0x2a6b0f cmp-chain

```python
packet = OnCATCH_MONSTER(0x103)   # band leaf @0x2a6b0f via cmp-chain
f0 = Readint32()
f1 = Readint32()
f2 = Readbyte()
f3 = Readint32()
f4 = Readint32()
f5 = Readbyte()
```

### BF197 OnSPAWN_NPC

evidence: leaf@0x2cb2b4 cmp-chain

```python
packet = OnSPAWN_NPC(0x104)   # band leaf @0x2cb2b4 via cmp-chain
f0 = Readint32()
f1 = Readint32()
f2 = Readint32()
f3 = Readbyte()
f4 = Readint32()
```

### BF198 OnREMOVE_NPC

evidence: leaf@0x2cb2b4 cmp-chain

```python
packet = OnREMOVE_NPC(0x105)   # band leaf @0x2cb2b4 via cmp-chain
f0 = Readint32()
f1 = Readint32()
f2 = Readint32()
f3 = Readbyte()
f4 = Readint32()
```

### BF199 OnSPAWN_NPC_REQUEST_CONTROLLER

evidence: leaf@0x2cb2b4 cmp-chain

```python
packet = OnSPAWN_NPC_REQUEST_CONTROLLER(0x106)   # band leaf @0x2cb2b4 via cmp-chain
f0 = Readint32()
f1 = Readint32()
f2 = Readint32()
f3 = Readbyte()
f4 = Readint32()
```

### BF200 OnNPC_ACTION

evidence: leaf@0x2cb2b4 cmp-chain

```python
packet = OnNPC_ACTION(0x107)   # band leaf @0x2cb2b4 via cmp-chain
f0 = Readint32()
f1 = Readint32()
f2 = Readint32()
f3 = Readbyte()
f4 = Readint32()
```

### BF201 Onopcode_0x108

evidence: leaf@0x2cb2b4 cmp-chain

```python
packet = Onopcode_0x108(0x108)   # band leaf @0x2cb2b4 via cmp-chain
f0 = Readint32()
f1 = Readint32()
f2 = Readint32()
f3 = Readbyte()
f4 = Readint32()
```

### BF202 Onopcode_0x109

evidence: leaf@0x2cb2b4 cmp-chain

```python
packet = Onopcode_0x109(0x109)   # band leaf @0x2cb2b4 via cmp-chain
f0 = Readint32()
f1 = Readint32()
f2 = Readint32()
f3 = Readbyte()
f4 = Readint32()
```

### BF203 Onopcode_0x10A

evidence: leaf@0x2cb2b4 cmp-chain

```python
packet = Onopcode_0x10A(0x10A)   # band leaf @0x2cb2b4 via cmp-chain
f0 = Readint32()
f1 = Readint32()
f2 = Readint32()
f3 = Readbyte()
f4 = Readint32()
```

### BF204 Onopcode_0x10B

evidence: leaf@0x2cb2b4 cmp-chain

```python
packet = Onopcode_0x10B(0x10B)   # band leaf @0x2cb2b4 via cmp-chain
f0 = Readint32()
f1 = Readint32()
f2 = Readint32()
f3 = Readbyte()
f4 = Readint32()
```

### BF205 Onopcode_0x10C

evidence: leaf@0x2cb2b4 cmp-chain

```python
packet = Onopcode_0x10C(0x10C)   # band leaf @0x2cb2b4 via cmp-chain
f0 = Readint32()
f1 = Readint32()
f2 = Readint32()
f3 = Readbyte()
f4 = Readint32()
```

### BF206 OnSPAWN_HIRED_MERCHANT

evidence: leaf@0x11b4d1 cmp-chain

```python
packet = OnSPAWN_HIRED_MERCHANT(0x10D)   # band leaf @0x11b4d1 via cmp-chain
f0 = Readint32()
```

### BF207 OnDESTROY_HIRED_MERCHANT

evidence: leaf@0x11b4d1 cmp-chain

```python
packet = OnDESTROY_HIRED_MERCHANT(0x10E)   # band leaf @0x11b4d1 via cmp-chain
f0 = Readint32()
```

### BF208 OnUPDATE_HIRED_MERCHANT

evidence: leaf@0x11b4d1 cmp-chain

```python
packet = OnUPDATE_HIRED_MERCHANT(0x10F)   # band leaf @0x11b4d1 via cmp-chain
f0 = Readint32()
```

### BF209 OnDROP_ITEM_FROM_MAPOBJECT

evidence: leaf@0x10f385 cmp-chain

```python
packet = OnDROP_ITEM_FROM_MAPOBJECT(0x110)   # band leaf @0x10f385 via cmp-chain
f0 = Readbyte()
f1 = Readint32()
f2 = Readshort()
f3 = Readint32()
f4 = Readbyte()
```

### BF210 OnREMOVE_ITEM_FROM_MAP

evidence: leaf@0x10f385 cmp-chain

```python
packet = OnREMOVE_ITEM_FROM_MAP(0x111)   # band leaf @0x10f385 via cmp-chain
f0 = Readbyte()
f1 = Readint32()
f2 = Readshort()
f3 = Readint32()
f4 = Readbyte()
```

### BF211 OnSPAWN_LOVE

evidence: leaf@0x289303 cmp-chain

```python
packet = OnSPAWN_LOVE(0x113)   # band leaf @0x289303 via cmp-chain
f0 = Readbyte()
f1 = Readint32()
```

### BF212 OnREMOVE_LOVE

evidence: leaf@0x289303 cmp-chain

```python
packet = OnREMOVE_LOVE(0x114)   # band leaf @0x289303 via cmp-chain
f0 = Readbyte()
f1 = Readint32()
```

### BF213 OnSPAWN_MIST

evidence: leaf@0x31fab cmp-chain

```python
packet = OnSPAWN_MIST(0x115)   # band leaf @0x31fab via cmp-chain
f0 = Readint32()
```

### BF214 OnREMOVE_MIST

evidence: leaf@0x31fab cmp-chain

```python
packet = OnREMOVE_MIST(0x116)   # band leaf @0x31fab via cmp-chain
f0 = Readint32()
```

### BF215 OnREACTOR_HIT

evidence: leaf@0x3420ec cmp-chain

```python
packet = OnREACTOR_HIT(0x11C)   # band leaf @0x3420ec via cmp-chain
f0 = Readint32()
f1 = Readbyte()
f2 = Readshort()
f3 = Readshort()
```

### BF216 Onopcode_0x11D

evidence: leaf@0x3420ec cmp-chain

```python
packet = Onopcode_0x11D(0x11D)   # band leaf @0x3420ec via cmp-chain
f0 = Readint32()
f1 = Readbyte()
f2 = Readshort()
f3 = Readshort()
```

### BF217 OnREACTOR_SPAWN

evidence: leaf@0x3420ec cmp-chain

```python
packet = OnREACTOR_SPAWN(0x11E)   # band leaf @0x3420ec via cmp-chain
f0 = Readint32()
f1 = Readbyte()
f2 = Readshort()
f3 = Readshort()
```

### BF218 OnREACTOR_DESTROY

evidence: leaf@0x3420ec cmp-chain

```python
packet = OnREACTOR_DESTROY(0x11F)   # band leaf @0x3420ec via cmp-chain
f0 = Readint32()
f1 = Readbyte()
f2 = Readshort()
f3 = Readshort()
```

## outbound flows

### OF219 Sendopcode_0x41

evidence: builder@0x25053 writer-seq

```python
send opcode_0x41(0x41)   # builder @0x25053
WriteByte(0x41)   # header
Send(socket)
Writebyte(f2)
Writeint32(f3)
Send(socket)
```

### OF220 Sendopcode_0xE9

evidence: builder@0x6b15a writer-seq

```python
send opcode_0xE9(0xE9)   # builder @0x6b15a
WriteByte(0xE9)   # header
Writeint32(f1)
Send(socket)
Writebyte(f3)
Writebyte(f4)
Writeint32(f5)
Writebyte(f6)
Send(socket)
# payload written in a loop
```

### OF221 Sendopcode_0xE9

evidence: builder@0x6b4a2 writer-seq

```python
send opcode_0xE9(0xE9)   # builder @0x6b4a2
WriteByte(0xE9)   # header
Writeint32(f1)
Send(socket)
```

### OF222 Sendopcode_0xE9

evidence: builder@0x6b822 writer-seq

```python
send opcode_0xE9(0xE9)   # builder @0x6b822
WriteByte(0xE9)   # header
Writebyte(f1)
Writebyte(f2)
Writebyte(f3)
Send(socket)
```

### OF223 Sendopcode_0xE9

evidence: builder@0x6bd0b writer-seq

```python
send opcode_0xE9(0xE9)   # builder @0x6bd0b
WriteByte(0xE9)   # header
Writebyte(f1)
Writebyte(f2)
Send(socket)
```

### OF224 Sendopcode_0xE9

evidence: builder@0x6be73 writer-seq

```python
send opcode_0xE9(0xE9)   # builder @0x6be73
WriteByte(0xE9)   # header
Writebyte(f1)
Writeint32(f2)
Send(socket)
# payload written in a loop
```

### OF225 Sendopcode_0xE9

evidence: builder@0x6c02c writer-seq

```python
send opcode_0xE9(0xE9)   # builder @0x6c02c
WriteByte(0xE9)   # header
Writebyte(f1)
Writeint32(f2)
Send(socket)
```

### OF226 SendUSE_CHAIR

evidence: builder@0x6cdbd writer-seq

```python
send USE_CHAIR(0x26)   # builder @0x6cdbd
WriteByte(0x26)   # header
Writeint32(f1)
Send(socket)
Writebyte(f3)
Writebyte(f4)
Writeint32(f5)
Writebyte(f6)
Send(socket)
# payload written in a loop
```

### OF227 Sendopcode_0xE9

evidence: builder@0x6d941 writer-seq

```python
send opcode_0xE9(0xE9)   # builder @0x6d941
WriteByte(0xE9)   # header
Writebyte(f1)
Writeint32(f2)
Send(socket)
# payload written in a loop
```

### OF228 Sendopcode_0xE9

evidence: builder@0x6dd46 writer-seq

```python
send opcode_0xE9(0xE9)   # builder @0x6dd46
WriteByte(0xE9)   # header
Writeint32(f1)
Send(socket)
```

### OF229 Sendopcode_0x04

evidence: builder@0x6e3aa writer-seq

```python
send opcode_0x04(0x04)   # builder @0x6e3aa
WriteByte(0x04)   # header
Writeint32(f1)
Writebyte(f2)
Send(socket)
# payload written in a loop
```

### OF230 Sendopcode_0xE9

evidence: builder@0x6e761 writer-seq

```python
send opcode_0xE9(0xE9)   # builder @0x6e761
WriteByte(0xE9)   # header
Writeint32(f1)
Send(socket)
```

### OF231 Sendopcode_0xE9

evidence: builder@0x6eab7 writer-seq

```python
send opcode_0xE9(0xE9)   # builder @0x6eab7
WriteByte(0xE9)   # header
Writeint32(f1)
Send(socket)
```

### OF232 Sendopcode_0xE9

evidence: builder@0x6f142 writer-seq

```python
send opcode_0xE9(0xE9)   # builder @0x6f142
WriteByte(0xE9)   # header
Writeint32(f1)
Send(socket)
```

### OF233 Sendopcode_0xE9

evidence: builder@0x6f426 writer-seq

```python
send opcode_0xE9(0xE9)   # builder @0x6f426
WriteByte(0xE9)   # header
Writeint32(f1)
Send(socket)
# payload written in a loop
```

### OF234 Sendopcode_0xEB

evidence: builder@0x6f751 writer-seq

```python
send opcode_0xEB(0xEB)   # builder @0x6f751
WriteByte(0xEB)   # header
Writebyte(f1)
Send(socket)
```

### OF235 Sendopcode_0xEB

evidence: builder@0x6fe34 writer-seq

```python
send opcode_0xEB(0xEB)   # builder @0x6fe34
WriteByte(0xEB)   # header
Writebyte(f1)
Send(socket)
```

### OF236 Sendopcode_0xE9

evidence: builder@0x71f34 writer-seq

```python
send opcode_0xE9(0xE9)   # builder @0x71f34
WriteByte(0xE9)   # header
Writebyte(f1)
Writeshort(f2)
Send(socket)
# payload written in a loop
```

### OF237 Sendopcode_0xE9

evidence: builder@0x72142 writer-seq

```python
send opcode_0xE9(0xE9)   # builder @0x72142
WriteByte(0xE9)   # header
Writebyte(f1)
Send(socket)
```

### OF238 Sendopcode_0x20

evidence: builder@0x726b1 writer-seq

```python
send opcode_0x20(0x20)   # builder @0x726b1
WriteByte(0x20)   # header
Writeint32(f1)
Send(socket)
```

### OF239 SendNOTE_ACTION

evidence: builder@0x7866b writer-seq

```python
send NOTE_ACTION(0x7F)   # builder @0x7866b
WriteByte(0x7F)   # header
Writebyte(f1)
Writeint32(f2)
Send(socket)
```

### OF240 SendPLAYER_INTERACTION

evidence: builder@0x82ac1 writer-seq

```python
send PLAYER_INTERACTION(0x77)   # builder @0x82ac1
WriteByte(0x77)   # header
Writebyte(f1)
Writeint32(f2)
Writeint32(f3)
Send(socket)
# payload written in a loop
```

### OF241 SendPLAYER_INTERACTION

evidence: builder@0x84fad writer-seq

```python
send PLAYER_INTERACTION(0x77)   # builder @0x84fad
WriteByte(0x77)   # header
Writebyte(f1)
Writeshort(f2)
Writeshort(f3)
Writebyte(f4)
Send(socket)
# payload written in a loop
```

### OF242 SendPLAYER_INTERACTION

evidence: builder@0x85180 writer-seq

```python
send PLAYER_INTERACTION(0x77)   # builder @0x85180
WriteByte(0x77)   # header
Writeint32(f1)
Send(socket)
```

### OF243 SendPLAYER_INTERACTION

evidence: builder@0x8530e writer-seq

```python
send PLAYER_INTERACTION(0x77)   # builder @0x8530e
WriteByte(0x77)   # header
Writebyte(f1)
Writeint32(f2)
Writeint32(f3)
Send(socket)
# payload written in a loop
```

### OF244 SendPLAYER_INTERACTION

evidence: builder@0x122c4b writer-seq

```python
send PLAYER_INTERACTION(0x77)   # builder @0x122c4b
WriteByte(0x77)   # header
Send(socket)
Writebyte(f2)
Writebyte(f3)
Send(socket)
```

### OF245 SendPLAYER_INTERACTION

evidence: builder@0x1240e3 writer-seq

```python
send PLAYER_INTERACTION(0x77)   # builder @0x1240e3
WriteByte(0x77)   # header
Writeint32(f1)
Send(socket)
```

### OF246 SendDENY_GUILD_REQUEST

evidence: builder@0x12a99b writer-seq

```python
send DENY_GUILD_REQUEST(0x7B)   # builder @0x12a99b
WriteByte(0x7B)   # header
Send(socket)
Writebyte(f2)
Send(socket)
Writebyte(f4)
Send(socket)
Writebyte(f6)
Writebyte(f7)
Send(socket)
```

### OF247 SendPARTY_OPERATION

evidence: builder@0x12cf8a writer-seq

```python
send PARTY_OPERATION(0x78)   # builder @0x12cf8a
WriteByte(0x78)   # header
Writeint32(f1)
Writebyte(f2)
Send(socket)
Writebyte(f4)
Writeint32(f5)
Writeint32(f6)
Send(socket)
Writebyte(f8)
Writeint32(f9)
Send(socket)
Writebyte(f11)
Writeint32(f12)
Writeint32(f13)
Send(socket)
Writebyte(f15)
```

### OF248 SendPLAYER_INTERACTION

evidence: builder@0x13f463 writer-seq

```python
send PLAYER_INTERACTION(0x77)   # builder @0x13f463
WriteByte(0x77)   # header
Writebyte(f1)
Writebyte(f2)
Writeint32(f3)
Writeint32(f4)
Send(socket)
Writebyte(f6)
Writebyte(f7)
Writebyte(f8)
Send(socket)
Writebyte(f10)
Writeint32(f11)
Send(socket)
```

### OF249 SendPLAYER_INTERACTION

evidence: builder@0x13f69e writer-seq

```python
send PLAYER_INTERACTION(0x77)   # builder @0x13f69e
WriteByte(0x77)   # header
Writebyte(f1)
Writebyte(f2)
Writeint32(f3)
Writeint32(f4)
Send(socket)
Writebyte(f6)
Writebyte(f7)
Writebyte(f8)
Send(socket)
Writebyte(f10)
Writeint32(f11)
Send(socket)
```

### OF250 SendPARTY_OPERATION

evidence: builder@0x13fa03 writer-seq

```python
send PARTY_OPERATION(0x78)   # builder @0x13fa03
WriteByte(0x78)   # header
Writebyte(f1)
Send(socket)
```

### OF251 SendPARTY_OPERATION

evidence: builder@0x13fccd writer-seq

```python
send PARTY_OPERATION(0x78)   # builder @0x13fccd
WriteByte(0x78)   # header
Writeint32(f1)
Send(socket)
```

### OF252 SendPARTY_OPERATION

evidence: builder@0x13fe32 writer-seq

```python
send PARTY_OPERATION(0x78)   # builder @0x13fe32
WriteByte(0x78)   # header
Writeint32(f1)
Send(socket)
```

### OF253 SendCHANGE_CHANNEL

evidence: builder@0x1401ef writer-seq

```python
send CHANGE_CHANNEL(0x22)   # builder @0x1401ef
WriteByte(0x22)   # header
Writeint32(f1)
Send(socket)
```

### OF254 SendGUILD_OPERATION

evidence: builder@0x1403ff writer-seq

```python
send GUILD_OPERATION(0x7A)   # builder @0x1403ff
WriteByte(0x7A)   # header
Writeint32(f1)
Writebyte(f2)
Send(socket)
```

### OF255 SendGUILD_OPERATION

evidence: builder@0x140679 writer-seq

```python
send GUILD_OPERATION(0x7A)   # builder @0x140679
WriteByte(0x7A)   # header
Writeint32(f1)
Send(socket)
```

### OF256 SendGUILD_OPERATION

evidence: builder@0x1407a6 writer-seq

```python
send GUILD_OPERATION(0x7A)   # builder @0x1407a6
WriteByte(0x7A)   # header
Writeint32(f1)
Send(socket)
Writebyte(f3)
Writeint32(f4)
Writeint32(f5)
Send(socket)
```

### OF257 SendGUILD_OPERATION

evidence: builder@0x140bcf writer-seq

```python
send GUILD_OPERATION(0x7A)   # builder @0x140bcf
WriteByte(0x7A)   # header
Writeint32(f1)
Writebyte(f2)
Send(socket)
```

### OF258 SendGUILD_OPERATION

evidence: builder@0x140d44 writer-seq

```python
send GUILD_OPERATION(0x7A)   # builder @0x140d44
WriteByte(0x7A)   # header
Writeshort(f1)
Writebyte(f2)
Writeshort(f3)
Writebyte(f4)
Send(socket)
```

### OF259 SendBUDDYLIST_MODIFY

evidence: builder@0x140fd0 writer-seq

```python
send BUDDYLIST_MODIFY(0x7E)   # builder @0x140fd0
WriteByte(0x7E)   # header
Writeint32(f1)
Send(socket)
```

### OF260 SendBUDDYLIST_MODIFY

evidence: builder@0x14107c writer-seq

```python
send BUDDYLIST_MODIFY(0x7E)   # builder @0x14107c
WriteByte(0x7E)   # header
Writeint32(f1)
Send(socket)
```

### OF261 Sendopcode_0xCF

evidence: builder@0x1999a6 writer-seq

```python
send opcode_0xCF(0xCF)   # builder @0x1999a6
WriteByte(0xCF)   # header
Writeshort(f1)
Writeshort(f2)
Send(socket)
```

### OF262 Sendopcode_0x11

evidence: builder@0x1d434e writer-seq

```python
send opcode_0x11(0x11)   # builder @0x1d434e
WriteByte(0x11)   # header
Writeint32(f1)
Writeint32(f2)
Writeint32(f3)
Writeint32(f4)
Writebyte(f5)
Writebyte(f6)
Writeint32(f7)
Writebyte(f8)
Writeint32(f9)
Writeint32(f10)
Writeint32(f11)
Writebyte(f12)
Writebyte(f13)
Send(socket)
```

### OF263 SendQUEST_ACTION

evidence: builder@0x1d4556 writer-seq

```python
send QUEST_ACTION(0x68)   # builder @0x1d4556
WriteByte(0x68)   # header
Writebyte(f1)
Writeint32(f2)
Writeint32(f3)
Send(socket)
Send(socket)
```

### OF264 Sendopcode_0xFE

evidence: builder@0x1d494d writer-seq

```python
send opcode_0xFE(0xFE)   # builder @0x1d494d
WriteByte(0xFE)   # header
Writeint32(f1)
Writeint32(f2)
Writeint32(f3)
Writebyte(f4)
Writebyte(f5)
Writeint32(f6)
Send(socket)
```

### OF265 Sendopcode_0xFE

evidence: builder@0x1d4a2c writer-seq

```python
send opcode_0xFE(0xFE)   # builder @0x1d4a2c
WriteByte(0xFE)   # header
Writeint32(f1)
Writeint32(f2)
Writeint32(f3)
Writebyte(f4)
Writebyte(f5)
Writeint32(f6)
Writeint32(f7)
Send(socket)
```

### OF266 Sendopcode_0xFE

evidence: builder@0x1d4b1b writer-seq

```python
send opcode_0xFE(0xFE)   # builder @0x1d4b1b
WriteByte(0xFE)   # header
Writeint32(f1)
Writeint32(f2)
Writeint32(f3)
Writebyte(f4)
Writebyte(f5)
Writeint32(f6)
Send(socket)
```

### OF267 Sendopcode_0xFE

evidence: builder@0x1d4bf8 writer-seq

```python
send opcode_0xFE(0xFE)   # builder @0x1d4bf8
WriteByte(0xFE)   # header
Writeint32(f1)
Writeint32(f2)
Writeint32(f3)
Writebyte(f4)
Writebyte(f5)
Send(socket)
```

### OF268 Sendopcode_0xFE

evidence: builder@0x1d4d4d writer-seq

```python
send opcode_0xFE(0xFE)   # builder @0x1d4d4d
WriteByte(0xFE)   # header
Writeint32(f1)
Send(socket)
```

### OF269 Sendopcode_0xFE

evidence: builder@0x1d4dc0 writer-seq

```python
send opcode_0xFE(0xFE)   # builder @0x1d4dc0
WriteByte(0xFE)   # header
Writeint32(f1)
Send(socket)
```

### OF270 Sendopcode_0xFE

evidence: builder@0x1d4f53 writer-seq

```python
send opcode_0xFE(0xFE)   # builder @0x1d4f53
WriteByte(0xFE)   # header
Writeint32(f1)
Send(socket)
```

### OF271 Sendopcode_0xFE

evidence: builder@0x1d4fc6 writer-seq

```python
send opcode_0xFE(0xFE)   # builder @0x1d4fc6
WriteByte(0xFE)   # header
Writeint32(f1)
Send(socket)
```

### OF272 Sendopcode_0xFE

evidence: builder@0x1d5064 writer-seq

```python
send opcode_0xFE(0xFE)   # builder @0x1d5064
WriteByte(0xFE)   # header
Writeint32(f1)
Send(socket)
```

### OF273 Sendopcode_0xFE

evidence: builder@0x1d50d7 writer-seq

```python
send opcode_0xFE(0xFE)   # builder @0x1d50d7
WriteByte(0xFE)   # header
Writeint32(f1)
Send(socket)
```

### OF274 Sendopcode_0xFE

evidence: builder@0x1d514a writer-seq

```python
send opcode_0xFE(0xFE)   # builder @0x1d514a
WriteByte(0xFE)   # header
Writeint32(f1)
Send(socket)
```

### OF275 Sendopcode_0xFE

evidence: builder@0x1d51e8 writer-seq

```python
send opcode_0xFE(0xFE)   # builder @0x1d51e8
WriteByte(0xFE)   # header
Writeint32(f1)
Send(socket)
```

### OF276 Sendopcode_0xFE

evidence: builder@0x1d525b writer-seq

```python
send opcode_0xFE(0xFE)   # builder @0x1d525b
WriteByte(0xFE)   # header
Writeint32(f1)
Send(socket)
```

### OF277 Sendopcode_0xFE

evidence: builder@0x1d5304 writer-seq

```python
send opcode_0xFE(0xFE)   # builder @0x1d5304
WriteByte(0xFE)   # header
Writeint32(f1)
Send(socket)
```

### OF278 Sendopcode_0xFE

evidence: builder@0x1ebb5f writer-seq

```python
send opcode_0xFE(0xFE)   # builder @0x1ebb5f
Writeint32(f0)
Writeint32(f1)
Writeint32(f2)
Writeint32(f3)
Send(socket)
WriteByte(0xFE)   # header
Writeint32(f6)
Writeint32(f7)
Writeint32(f8)
Writeint32(f9)
Send(socket)
```

### OF279 Sendopcode_0x09

evidence: builder@0x22ac8a writer-seq

```python
send opcode_0x09(0x09)   # builder @0x22ac8a
WriteByte(0x09)   # header
Writebyte(f1)
Writeint32(f2)
Send(socket)
# payload written in a loop
```

### OF280 Sendopcode_0x08

evidence: builder@0x22aeb2 writer-seq

```python
send opcode_0x08(0x08)   # builder @0x22aeb2
WriteByte(0x08)   # header
Writebyte(f1)
Writeint32(f2)
Writeint32(f3)
Send(socket)
# payload written in a loop
```

### OF281 Sendopcode_0x1A

evidence: builder@0x22b14e writer-seq

```python
send opcode_0x1A(0x1A)   # builder @0x22b14e
Writeint32(f0)
Send(socket)
Writeint32(f2)
Send(socket)
WriteByte(0x1A)   # header
Writeint32(f5)
Send(socket)
```

### OF282 Sendopcode_0x1A

evidence: builder@0x22f729 writer-seq

```python
send opcode_0x1A(0x1A)   # builder @0x22f729
WriteByte(0x1A)   # header
Writeint32(f1)
Send(socket)
```

### OF283 Sendopcode_0x1A

evidence: builder@0x22f7f6 writer-seq

```python
send opcode_0x1A(0x1A)   # builder @0x22f7f6
WriteByte(0x1A)   # header
Writeint32(f1)
Send(socket)
```

### OF284 SendNOTE_ACTION

evidence: builder@0x278994 writer-seq

```python
send NOTE_ACTION(0x7F)   # builder @0x278994
WriteByte(0x7F)   # header
Writebyte(f1)
Writebyte(f2)
Writebyte(f3)
Writeint32(f4)
Send(socket)
# payload written in a loop
```

### OF285 SendPLAYER_INTERACTION

evidence: builder@0x27b9b5 writer-seq

```python
send PLAYER_INTERACTION(0x77)   # builder @0x27b9b5
WriteByte(0x77)   # header
Writebyte(f1)
Send(socket)
```

### OF286 SendPLAYER_INTERACTION

evidence: builder@0x27c1e8 writer-seq

```python
send PLAYER_INTERACTION(0x77)   # builder @0x27c1e8
WriteByte(0x77)   # header
Writebyte(f1)
Send(socket)
```

### OF287 SendPLAYER_INTERACTION

evidence: builder@0x27cc1e writer-seq

```python
send PLAYER_INTERACTION(0x77)   # builder @0x27cc1e
WriteByte(0x77)   # header
Writebyte(f1)
Writebyte(f2)
Send(socket)
Writebyte(f4)
Send(socket)
# payload written in a loop
```

### OF288 SendPLAYER_INTERACTION

evidence: builder@0x2815c0 writer-seq

```python
send PLAYER_INTERACTION(0x77)   # builder @0x2815c0
WriteByte(0x77)   # header
Send(socket)
Writebyte(f2)
Send(socket)
```

### OF289 SendPLAYER_INTERACTION

evidence: builder@0x2816f5 writer-seq

```python
send PLAYER_INTERACTION(0x77)   # builder @0x2816f5
WriteByte(0x77)   # header
Send(socket)
Writebyte(f2)
Send(socket)
Writebyte(f4)
Send(socket)
```

### OF290 SendPLAYER_INTERACTION

evidence: builder@0x28c885 writer-seq

```python
send PLAYER_INTERACTION(0x77)   # builder @0x28c885
WriteByte(0x77)   # header
Writeint32(f1)
Writebyte(f2)
Writebyte(f3)
Send(socket)
Writebyte(f5)
Writeint32(f6)
Writebyte(f7)
Send(socket)
```

### OF291 SendPLAYER_INTERACTION

evidence: builder@0x28c93d writer-seq

```python
send PLAYER_INTERACTION(0x77)   # builder @0x28c93d
WriteByte(0x77)   # header
Writebyte(f1)
Writebyte(f2)
Writeint32(f3)
Writeint32(f4)
Writebyte(f5)
Send(socket)
Writebyte(f7)
Writeint32(f8)
Writebyte(f9)
Send(socket)
```

### OF292 SendPLAYER_INTERACTION

evidence: builder@0x28cbbb writer-seq

```python
send PLAYER_INTERACTION(0x77)   # builder @0x28cbbb
WriteByte(0x77)   # header
Writebyte(f1)
Writebyte(f2)
Writeint32(f3)
Writeint32(f4)
Writebyte(f5)
Writeshort(f6)
Writeint32(f7)
Send(socket)
Writebyte(f9)
Writeint32(f10)
Writebyte(f11)
Writebyte(f12)
Writeshort(f13)
Send(socket)
Writebyte(f15)
```

### OF293 SendPLAYER_INTERACTION

evidence: builder@0x28cded writer-seq

```python
send PLAYER_INTERACTION(0x77)   # builder @0x28cded
WriteByte(0x77)   # header
Writebyte(f1)
Writebyte(f2)
Writeint32(f3)
Writeint32(f4)
Writebyte(f5)
Writeshort(f6)
Writeint32(f7)
Send(socket)
```

### OF294 SendPLAYER_INTERACTION

evidence: builder@0x2d48f0 writer-seq

```python
send PLAYER_INTERACTION(0x77)   # builder @0x2d48f0
WriteByte(0x77)   # header
Writebyte(f1)
Send(socket)
```

### OF295 SendPLAYER_INTERACTION

evidence: builder@0x2d51b0 writer-seq

```python
send PLAYER_INTERACTION(0x77)   # builder @0x2d51b0
WriteByte(0x77)   # header
Writebyte(f1)
Send(socket)
```

### OF296 SendPLAYER_INTERACTION

evidence: builder@0x2d5270 writer-seq

```python
send PLAYER_INTERACTION(0x77)   # builder @0x2d5270
WriteByte(0x77)   # header
Writebyte(f1)
Send(socket)
```

### OF297 SendPLAYER_INTERACTION

evidence: builder@0x2d9a8b writer-seq

```python
send PLAYER_INTERACTION(0x77)   # builder @0x2d9a8b
WriteByte(0x77)   # header
Writebyte(f1)
Send(socket)
```

### OF298 SendPLAYER_INTERACTION

evidence: builder@0x2d9e9b writer-seq

```python
send PLAYER_INTERACTION(0x77)   # builder @0x2d9e9b
WriteByte(0x77)   # header
Send(socket)
Writebyte(f2)
Send(socket)
Writebyte(f4)
Send(socket)
```

### OF299 Sendopcode_0xE2

evidence: builder@0x2e474e writer-seq

```python
send opcode_0xE2(0xE2)   # builder @0x2e474e
WriteByte(0xE2)   # header
Writeshort(f1)
Writeint32(f2)
Send(socket)
Writebyte(f4)
Writeshort(f5)
Writeint32(f6)
Send(socket)
# payload written in a loop
```

### OF300 Sendopcode_0xE2

evidence: builder@0x2eab0f writer-seq

```python
send opcode_0xE2(0xE2)   # builder @0x2eab0f
WriteByte(0xE2)   # header
Writeint32(f1)
Send(socket)
```

### OF301 Sendopcode_0xE2

evidence: builder@0x2ebc7d writer-seq

```python
send opcode_0xE2(0xE2)   # builder @0x2ebc7d
WriteByte(0xE2)   # header
Writebyte(f1)
Writebyte(f2)
Send(socket)
# payload written in a loop
```

### OF302 Sendopcode_0xE2

evidence: builder@0x2ede8c writer-seq

```python
send opcode_0xE2(0xE2)   # builder @0x2ede8c
WriteByte(0xE2)   # header
Writeshort(f1)
Writeint32(f2)
Send(socket)
```

### OF303 Sendopcode_0x01

evidence: builder@0x2edf3f writer-seq

```python
send opcode_0x01(0x01)   # builder @0x2edf3f
WriteByte(0x01)   # header
Writeshort(f1)
Send(socket)
```

### OF304 Sendopcode_0xE2

evidence: builder@0x2edfb8 writer-seq

```python
send opcode_0xE2(0xE2)   # builder @0x2edfb8
WriteByte(0xE2)   # header
Writeint32(f1)
Send(socket)
```

### OF305 Sendopcode_0xE2

evidence: builder@0x2ee12d writer-seq

```python
send opcode_0xE2(0xE2)   # builder @0x2ee12d
WriteByte(0xE2)   # header
Writeint32(f1)
Send(socket)
Send(socket)
Writebyte(f4)
Send(socket)
Writebyte(f6)
Send(socket)
Writebyte(f8)
Send(socket)
# payload written in a loop
```

### OF306 SendDUEY_ACTION

evidence: builder@0x2fa2a8 writer-seq

```python
send DUEY_ACTION(0x3E)   # builder @0x2fa2a8
WriteByte(0x3E)   # header
Writeint32(f1)
Send(socket)
```

### OF307 SendDUEY_ACTION

evidence: builder@0x2fa3e9 writer-seq

```python
send DUEY_ACTION(0x3E)   # builder @0x2fa3e9
WriteByte(0x3E)   # header
Writeint32(f1)
Send(socket)
```

### OF308 SendDUEY_ACTION

evidence: builder@0x2fb454 writer-seq

```python
send DUEY_ACTION(0x3E)   # builder @0x2fb454
WriteByte(0x3E)   # header
Writebyte(f1)
Writeshort(f2)
Writeshort(f3)
Writeint32(f4)
Writebyte(f5)
Writeint32(f6)
Send(socket)
```

### OF309 SendDUEY_ACTION

evidence: builder@0x2fccb6 writer-seq

```python
send DUEY_ACTION(0x3E)   # builder @0x2fccb6
WriteByte(0x3E)   # header
Writebyte(f1)
Writeshort(f2)
Writeshort(f3)
Writeint32(f4)
Writebyte(f5)
Send(socket)
```

### OF310 SendDUEY_ACTION

evidence: builder@0x2fec45 writer-seq

```python
send DUEY_ACTION(0x3E)   # builder @0x2fec45
WriteByte(0x3E)   # header
Writeint32(f1)
Writeint32(f2)
Send(socket)
```

### OF311 SendPLAYER_INTERACTION

evidence: builder@0x3061b5 writer-seq

```python
send PLAYER_INTERACTION(0x77)   # builder @0x3061b5
WriteByte(0x77)   # header
Writebyte(f1)
Writebyte(f2)
Writeint32(f3)
Send(socket)
Writebyte(f5)
Writebyte(f6)
Send(socket)
# payload written in a loop
```

### OF312 Sendopcode_0x0B

evidence: builder@0x306c0a writer-seq

```python
send opcode_0x0B(0x0B)   # builder @0x306c0a
WriteByte(0x0B)   # header
Writebyte(f1)
Writeshort(f2)
Writeint32(f3)
Send(socket)
```

### OF313 SendPLAYER_INTERACTION

evidence: builder@0x30752e writer-seq

```python
send PLAYER_INTERACTION(0x77)   # builder @0x30752e
WriteByte(0x77)   # header
Writeshort(f1)
Send(socket)
# payload written in a loop
```

### OF314 SendPLAYER_INTERACTION

evidence: builder@0x3075e2 writer-seq

```python
send PLAYER_INTERACTION(0x77)   # builder @0x3075e2
WriteByte(0x77)   # header
Writebyte(f1)
Send(socket)
Writebyte(f3)
Writebyte(f4)
Send(socket)
```

### OF315 SendPLAYER_INTERACTION

evidence: builder@0x31fd3b writer-seq

```python
send PLAYER_INTERACTION(0x77)   # builder @0x31fd3b
WriteByte(0x77)   # header
Writebyte(f1)
Send(socket)
```

### OF316 SendPLAYER_INTERACTION

evidence: builder@0x323903 writer-seq

```python
send PLAYER_INTERACTION(0x77)   # builder @0x323903
WriteByte(0x77)   # header
Send(socket)
Writebyte(f2)
Send(socket)
Writebyte(f4)
Send(socket)
```

### OF317 SendQUEST_ACTION

evidence: builder@0x3285c1 writer-seq

```python
send QUEST_ACTION(0x68)   # builder @0x3285c1
WriteByte(0x68)   # header
Writeshort(f1)
Writeint32(f2)
Writeshort(f3)
Writeshort(f4)
Send(socket)
Writebyte(f6)
Writeshort(f7)
Writeint32(f8)
Writeshort(f9)
Writeshort(f10)
Send(socket)
Writebyte(f12)
Writeshort(f13)
Writeint32(f14)
Writeshort(f15)
# payload written in a loop
```

### OF318 SendRPS_GAME

evidence: builder@0x34d058 writer-seq

```python
send RPS_GAME(0x84)   # builder @0x34d058
WriteByte(0x84)   # header
Writebyte(f1)
Send(socket)
```

### OF319 SendNPC_TALK_MORE

evidence: builder@0x353250 writer-seq

```python
send NPC_TALK_MORE(0x38)   # builder @0x353250
WriteByte(0x38)   # header
Writebyte(f1)
Send(socket)
```

### OF320 Sendopcode_0x01

evidence: builder@0x3533d1 writer-seq

```python
send opcode_0x01(0x01)   # builder @0x3533d1
Writebyte(f0)
WriteByte(0x01)   # header
Send(socket)
```

### OF321 SendNPC_TALK_MORE

evidence: builder@0x353530 writer-seq

```python
send NPC_TALK_MORE(0x38)   # builder @0x353530
WriteByte(0x38)   # header
Writebyte(f1)
Writebyte(f2)
Send(socket)
```

### OF322 SendNPC_TALK_MORE

evidence: builder@0x3536eb writer-seq

```python
send NPC_TALK_MORE(0x38)   # builder @0x3536eb
WriteByte(0x38)   # header
Writebyte(f1)
Writebyte(f2)
Send(socket)
```

### OF323 SendNPC_TALK_MORE

evidence: builder@0x3538a4 writer-seq

```python
send NPC_TALK_MORE(0x38)   # builder @0x3538a4
WriteByte(0x38)   # header
Writebyte(f1)
Writeint32(f2)
Writebyte(f3)
Send(socket)
```

### OF324 SendNPC_TALK_MORE

evidence: builder@0x353a52 writer-seq

```python
send NPC_TALK_MORE(0x38)   # builder @0x353a52
WriteByte(0x38)   # header
Writebyte(f1)
Writebyte(f2)
Writeint32(f3)
Send(socket)
```

### OF325 SendNPC_TALK_MORE

evidence: builder@0x353be2 writer-seq

```python
send NPC_TALK_MORE(0x38)   # builder @0x353be2
WriteByte(0x38)   # header
Writebyte(f1)
Writebyte(f2)
Writebyte(f3)
Send(socket)
# payload written in a loop
```

### OF326 SendNPC_TALK_MORE

evidence: builder@0x353f2f writer-seq

```python
send NPC_TALK_MORE(0x38)   # builder @0x353f2f
WriteByte(0x38)   # header
Writebyte(f1)
Writebyte(f2)
Writebyte(f3)
Writebyte(f4)
Send(socket)
# payload written in a loop
```

### OF327 SendNPC_TALK_MORE

evidence: builder@0x3541f2 writer-seq

```python
send NPC_TALK_MORE(0x38)   # builder @0x3541f2
WriteByte(0x38)   # header
Writebyte(f1)
Writebyte(f2)
Writebyte(f3)
Writebyte(f4)
Send(socket)
# payload written in a loop
```

### OF328 SendNPC_TALK_MORE

evidence: builder@0x3544f4 writer-seq

```python
send NPC_TALK_MORE(0x38)   # builder @0x3544f4
WriteByte(0x38)   # header
Writebyte(f1)
Writebyte(f2)
Send(socket)
# payload written in a loop
```

### OF329 SendNPC_SHOP

evidence: builder@0x36395b writer-seq

```python
send NPC_SHOP(0x3A)   # builder @0x36395b
WriteByte(0x3A)   # header
Writeshort(f1)
Writeint32(f2)
Writeshort(f3)
Writeint32(f4)
Send(socket)
```

### OF330 SendNPC_SHOP

evidence: builder@0x363d86 writer-seq

```python
send NPC_SHOP(0x3A)   # builder @0x363d86
WriteByte(0x3A)   # header
Writeshort(f1)
Writeint32(f2)
Writeshort(f3)
Send(socket)
```

### OF331 SendNPC_SHOP

evidence: builder@0x363e93 writer-seq

```python
send NPC_SHOP(0x3A)   # builder @0x363e93
WriteByte(0x3A)   # header
Writeshort(f1)
Send(socket)
```

### OF332 SendNPC_SHOP

evidence: builder@0x36490b writer-seq

```python
send NPC_SHOP(0x3A)   # builder @0x36490b
WriteByte(0x3A)   # header
Writeint32(f1)
Send(socket)
```

### OF333 SendMERCH_ITEM_STORE

evidence: builder@0x3a1424 writer-seq

```python
send MERCH_ITEM_STORE(0x3D)   # builder @0x3a1424
WriteByte(0x3D)   # header
Writeint32(f1)
Send(socket)
```

### OF334 Sendopcode_0xFE

evidence: builder@0x3ac9ec writer-seq

```python
send opcode_0xFE(0xFE)   # builder @0x3ac9ec
Writeint32(f0)
WriteByte(0xFE)   # header
Writeint32(f2)
Writebyte(f3)
Writeint32(f4)
Writeint32(f5)
Writebyte(f6)
Send(socket)
```

### OF335 SendPLAYER_INTERACTION

evidence: builder@0x3c8beb writer-seq

```python
send PLAYER_INTERACTION(0x77)   # builder @0x3c8beb
WriteByte(0x77)   # header
Writebyte(f1)
Writeint32(f2)
Writeint32(f3)
Send(socket)
# payload written in a loop
```

### OF336 Sendopcode_0xEF

evidence: builder@0x3cab40 writer-seq

```python
send opcode_0xEF(0xEF)   # builder @0x3cab40
WriteByte(0xEF)   # header
Writebyte(f1)
Writeshort(f2)
Writeshort(f3)
Writebyte(f4)
Send(socket)
```

### OF337 SendPLAYER_INTERACTION

evidence: builder@0x3cad6b writer-seq

```python
send PLAYER_INTERACTION(0x77)   # builder @0x3cad6b
WriteByte(0x77)   # header
Writeint32(f1)
Send(socket)
```

### OF338 SendPLAYER_INTERACTION

evidence: builder@0x3caef9 writer-seq

```python
send PLAYER_INTERACTION(0x77)   # builder @0x3caef9
WriteByte(0x77)   # header
Writebyte(f1)
Writeint32(f2)
Writeint32(f3)
Send(socket)
# payload written in a loop
```

### OF339 SendSTORAGE

evidence: builder@0x3cf958 writer-seq

```python
send STORAGE(0x3B)   # builder @0x3cf958
WriteByte(0x3B)   # header
Writebyte(f1)
Writebyte(f2)
Send(socket)
```

### OF340 SendSTORAGE

evidence: builder@0x3cfc02 writer-seq

```python
send STORAGE(0x3B)   # builder @0x3cfc02
WriteByte(0x3B)   # header
Writeshort(f1)
Writeint32(f2)
Writeshort(f3)
Send(socket)
# payload written in a loop
```

### OF341 SendSTORAGE

evidence: builder@0x3cfe30 writer-seq

```python
send STORAGE(0x3B)   # builder @0x3cfe30
WriteByte(0x3B)   # header
Writeint32(f1)
Send(socket)
```

### OF342 SendSTORAGE

evidence: builder@0x3cfee7 writer-seq

```python
send STORAGE(0x3B)   # builder @0x3cfee7
WriteByte(0x3B)   # header
Writeint32(f1)
Send(socket)
```

### OF343 SendSTORAGE

evidence: builder@0x3cfff5 writer-seq

```python
send STORAGE(0x3B)   # builder @0x3cfff5
WriteByte(0x3B)   # header
Send(socket)
Writebyte(f2)
Writeint32(f3)
Send(socket)
```

### OF344 Sendopcode_0x41

evidence: builder@0x3d774a writer-seq

```python
send opcode_0x41(0x41)   # builder @0x3d774a
WriteByte(0x41)   # header
Writeint32(f1)
Send(socket)
```

### OF345 SendMESSENGER

evidence: builder@0x45c1a8 writer-seq

```python
send MESSENGER(0x76)   # builder @0x45c1a8
WriteByte(0x76)   # header
Writeint32(f1)
Send(socket)
Writebyte(f3)
Send(socket)
```

### OF346 SendMESSENGER

evidence: builder@0x45c9f0 writer-seq

```python
send MESSENGER(0x76)   # builder @0x45c9f0
WriteByte(0x76)   # header
Send(socket)
Writebyte(f2)
Send(socket)
# payload written in a loop
```

### OF347 SendMESSENGER

evidence: builder@0x45f6ab writer-seq

```python
send MESSENGER(0x76)   # builder @0x45f6ab
WriteByte(0x76)   # header
Writebyte(f1)
Send(socket)
```

### OF348 Sendquest_KJ

evidence: builder@0x48c858 writer-seq

```python
send quest_KJ(0x6A)   # builder @0x48c858
Writeshort(f0)
Writeint32(f1)
Writeshort(f2)
Writeint32(f3)
Writeint32(f4)
Send(socket)
WriteByte(0x6A)   # header
Writeshort(f7)
Writeint32(f8)
Send(socket)
# payload written in a loop
```

### OF349 Sendopcode_0x01

evidence: builder@0x4a20b0 writer-seq

```python
send opcode_0x01(0x01)   # builder @0x4a20b0
Writeint32(f0)
WriteByte(0x01)   # header
Send(socket)
```

### OF350 Sendopcode_0xF7

evidence: builder@0x4a3b03 writer-seq

```python
send opcode_0xF7(0xF7)   # builder @0x4a3b03
WriteByte(0xF7)   # header
Writeshort(f1)
Writeint32(f2)
Send(socket)
# payload written in a loop
```

### OF351 SendPARTYCHAT

evidence: builder@0x4e3cd5 writer-seq

```python
send PARTYCHAT(0x74)   # builder @0x4e3cd5
WriteByte(0x74)   # header
Writebyte(f1)
Writeint32(f2)
Send(socket)
# payload written in a loop
```

### OF352 Sendopcode_0x93

evidence: builder@0x51baaf writer-seq

```python
send opcode_0x93(0x93)   # builder @0x51baaf
WriteByte(0x93)   # header
Writeint32(f1)
Writeint32(f2)
Send(socket)
# payload written in a loop
```

### OF353 Sendopcode_0x93

evidence: builder@0x51bc56 writer-seq

```python
send opcode_0x93(0x93)   # builder @0x51bc56
WriteByte(0x93)   # header
Writeint32(f1)
Writebyte(f2)
Send(socket)
```

### OF354 Sendopcode_0x93

evidence: builder@0x51c57f writer-seq

```python
send opcode_0x93(0x93)   # builder @0x51c57f
WriteByte(0x93)   # header
Writeint32(f1)
Send(socket)
```

### OF355 Sendopcode_0xFE

evidence: builder@0x55199a writer-seq

```python
send opcode_0xFE(0xFE)   # builder @0x55199a
Writeint32(f0)
WriteByte(0xFE)   # header
Writebyte(f2)
Writeint32(f3)
Writeshort(f4)
Send(socket)
Writeint32(f6)
Writebyte(f7)
Writebyte(f8)
Writeint32(f9)
Writeshort(f10)
Send(socket)
# payload written in a loop
```

### OF356 SendPLAYER_INTERACTION

evidence: builder@0x5564ee writer-seq

```python
send PLAYER_INTERACTION(0x77)   # builder @0x5564ee
WriteByte(0x77)   # header
Writeint32(f1)
Writebyte(f2)
Writebyte(f3)
Send(socket)
```

### OF357 SendPLAYER_INTERACTION

evidence: builder@0x5568cc writer-seq

```python
send PLAYER_INTERACTION(0x77)   # builder @0x5568cc
Send(socket)
WriteByte(0x77)   # header
Writeint32(f2)
Writebyte(f3)
Writebyte(f4)
Send(socket)
Send(socket)
# payload written in a loop
```

### OF358 SendPLAYER_INTERACTION

evidence: builder@0x556ac3 writer-seq

```python
send PLAYER_INTERACTION(0x77)   # builder @0x556ac3
WriteByte(0x77)   # header
Writeint32(f1)
Send(socket)
```

### OF359 Sendopcode_0x89

evidence: builder@0x5e2271 writer-seq

```python
send opcode_0x89(0x89)   # builder @0x5e2271
WriteByte(0x89)   # header
Writeshort(f1)
Writeint32(f2)
Writeshort(f3)
Send(socket)
```

### OF360 Sendopcode_0x89

evidence: builder@0x5e3d0e writer-seq

```python
send opcode_0x89(0x89)   # builder @0x5e3d0e
WriteByte(0x89)   # header
Writebyte(f1)
Writebyte(f2)
Send(socket)
```

### OF361 Sendopcode_0x08

evidence: builder@0x612c05 writer-seq

```python
send opcode_0x08(0x08)   # builder @0x612c05
WriteByte(0x08)   # header
Writeint32(f1)
Writeshort(f2)
Writeint32(f3)
Send(socket)
```

### OF362 SendPLAYER_INTERACTION

evidence: builder@0x6270ef writer-seq

```python
send PLAYER_INTERACTION(0x77)   # builder @0x6270ef
WriteByte(0x77)   # header
Writebyte(f1)
Writebyte(f2)
Writebyte(f3)
Writebyte(f4)
Send(socket)
```

### OF363 SendPLAYER_INTERACTION

evidence: builder@0x627ceb writer-seq

```python
send PLAYER_INTERACTION(0x77)   # builder @0x627ceb
WriteByte(0x77)   # header
Writebyte(f1)
Writebyte(f2)
Writeshort(f3)
Writeint32(f4)
Send(socket)
```

### OF364 SendTROCK_ADD_MAP

evidence: builder@0x62fb71 writer-seq

```python
send TROCK_ADD_MAP(0x63)   # builder @0x62fb71
WriteByte(0x63)   # header
Writebyte(f1)
Writeint32(f2)
Send(socket)
```

### OF365 SendQUEST_ACTION

evidence: builder@0x63098a writer-seq

```python
send QUEST_ACTION(0x68)   # builder @0x63098a
WriteByte(0x68)   # header
Writeshort(f1)
Send(socket)
# payload written in a loop
```

### OF366 Sendopcode_0x67

evidence: builder@0x630c7f writer-seq

```python
send opcode_0x67(0x67)   # builder @0x630c7f
WriteByte(0x67)   # header
Writebyte(f1)
Send(socket)
# payload written in a loop
```

### OF367 SendPLAYER_INTERACTION

evidence: builder@0x631881 writer-seq

```python
send PLAYER_INTERACTION(0x77)   # builder @0x631881
WriteByte(0x77)   # header
Writebyte(f1)
Writebyte(f2)
Writeint32(f3)
Writeint32(f4)
Writebyte(f5)
Writeshort(f6)
Send(socket)
```

### OF368 Sendopcode_0x93

evidence: builder@0x641174 writer-seq

```python
send opcode_0x93(0x93)   # builder @0x641174
WriteByte(0x93)   # header
Send(socket)
Writebyte(f2)
Send(socket)
# payload written in a loop
```

### OF369 Sendopcode_0x93

evidence: builder@0x643bba writer-seq

```python
send opcode_0x93(0x93)   # builder @0x643bba
WriteByte(0x93)   # header
Send(socket)
Writebyte(f2)
# payload written in a loop
```

### OF370 SendPARTY_OPERATION

evidence: builder@0x648120 writer-seq

```python
send PARTY_OPERATION(0x78)   # builder @0x648120
WriteByte(0x78)   # header
Writeint32(f1)
Writebyte(f2)
Send(socket)
Writebyte(f4)
Send(socket)
```

### OF371 Sendopcode_0x15

evidence: builder@0x65ab5f writer-seq

```python
send opcode_0x15(0x15)   # builder @0x65ab5f
WriteByte(0x15)   # header
Writeshort(f1)
Send(socket)
```

### OF372 Sendopcode_0xA1

evidence: builder@0x65fe8c writer-seq

```python
send opcode_0xA1(0xA1)   # builder @0x65fe8c
WriteByte(0xA1)   # header
Writeshort(f1)
Writeint32(f2)
Send(socket)
```

