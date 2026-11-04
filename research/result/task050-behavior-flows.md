# Task 050 — Equivalent Behavior Flows & Pseudocode

Semantic reconstructions, not original source. Each flow cites RVAs and confidence.

## 1. Network: Connection + Handshake (confirmed)
```c
// CClientSocket::Connect @ 0x947EA
void Connect(sockaddr_in *addr) {
    this->socket = socket(AF_INET, SOCK_STREAM, 0);      // [this+8]
    this->deadline = time() + 5000;                       // [this+0x38]
    if (connect(this->socket, addr, 16) == -1 &&
        WSAGetLastError() != WSAEWOULDBLOCK) Close();
}

// CClientSocket::Handshake @ 0x95C5C
void Handshake() {
    word ver = this->version_word;                        // [this+0x88]
    pkt = COutPacket();                                   // @0x2F5E40
    WriteHeader(0x4F);                                    // @0x661F: push 0x4F
    write(ver); send_wrapper();                           // @0x495C5C
}
```

## 2. Network: Receive + IV Roll (confirmed)
```c
// CClientSocket::ProcessRecv @ 0x9583A
void ProcessRecv() {
    while (true) {
        buf = PoolAlloc(1460);
        n = recv(this->socket, buf->ptr, buf->len, 0);
        if (n == 0) { Close(); return; }
        if (n == -1 && WSAGetLastError() != WSAEWOULDBLOCK) break;
        AppendToStream(this->rx /*[+0x40]*/, buf, n);     // @0x495B36
        u32 next_iv = crypt(buf->iv, 4, NULL);            // @0x659082, seed 0xC65053F2
        ExtractAndDispatch(this->rx);                     // → 0x95F83
    }
}
```

## 3. Dispatch: Three-Layer Routing (confirmed)
```c
// Phase_OnPacket @ 0x95F83
void Phase_OnPacket(u16 opcode, Packet *pkt) {
    switch (opcode) {
        case 0x10: handler_964E0(pkt); break;  // warp-phase
        case 0x17: VersionObj.handle(pkt); break;
        // ... cases 0x10-0x1C ...
    }
    if (0x20 <= opcode <= 0x80)
        Range_OnPacket(opcode, pkt);                    // @0x610CE0
    else if (0x81 <= opcode <= 0x185)
        Field_OnPacket(opcode, pkt);                    // @0x14112E
    else
        Delegate->handle(opcode, pkt);                  // [0xBDF54C]
}

// Range_OnPacket @ 0x610CE0 (97-slot jump table @0x6111A1)
void Range_OnPacket(u16 opcode, Packet *pkt) {
    handler = jump_table[opcode - 0x20];               // 97 entries
    if (handler != default) handler(pkt);
}
```

## 4. Character: WARP_TO_MAP (confirmed)
```c
// Handler @ 0x37E72F, opcode 0x81
void OnWarpToMap(Packet *pkt) {
    CWvsContext *ctx = [0xBD9028];
    u32 old_id = ctx->CharacterId;                      // [+0x205C]
    u32 new_id = ReadInt32(pkt);                        // @0x466FF
    ctx->CharacterId = new_id;
    if (old_id != new_id) ctx->char_changed = 1;       // [+0x2F60]
    ctx->grade_byte = ReadByte(pkt);                    // [+0x2080] @0x466C9
    u16 count = ReadInt16(pkt);                         // @0x4259A2
    for (i = 0; i < count; i++) {
        String s = ReadString(pkt);                     // @0x471D7A
        /* add to map-info list */
    }
    /* field transition: cleanup old field, load new map from WZ */
}
```

## 5. Character: SPAWN_PLAYER identity check (confirmed)
```c
// Handler @ 0x57F6C0, opcode 0xA2
void OnSpawnPlayer(Packet *pkt) {
    CWvsContext *ctx = [0xBD9028];
    u32 spawn_id = ReadInt32(pkt);
    if (spawn_id == ctx->field_2084) {
        /* LOCAL player — update own visible state */
        /* read: appearance, equipment, position */
    } else {
        /* REMOTE player — create/update remote character object */
        /* read: appearance, equipment, position, guild, pet */
    }
}
```

## 6. Character: UPDATE_STATS (high)
```c
// Range handler @ 0x6292F5, opcode 0x22
void OnUpdateStats(Packet *pkt) {
    u32 mask = ReadInt32(pkt);
    CWvsContext *ctx = [0xBD9028];
    if (mask & SKIN)   ctx->skin = ReadByte(pkt);
    if (mask & FACE)   ctx->face = ReadInt32(pkt);
    if (mask & HAIR)   ctx->hair = ReadInt32(pkt);
    if (mask & STR)    ctx->str = ReadInt16(pkt);
    if (mask & DEX)    ctx->dex = ReadInt16(pkt);
    if (mask & INT)    ctx->int_ = ReadInt16(pkt);
    if (mask & LUK)    ctx->luk = ReadInt16(pkt);
    if (mask & HP)     ctx->hp = ReadInt16(pkt);
    if (mask & MAXHP)  ctx->maxhp = ReadInt16(pkt);
    if (mask & MP)     ctx->mp = ReadInt16(pkt);
    if (mask & MAXMP)  ctx->maxmp = ReadInt16(pkt);
    if (mask & EXP)    ctx->exp = ReadInt32(pkt);
    if (mask & MESO)   ctx->meso = ReadInt32(pkt);
    /* trigger stat recalculation + UI refresh */
}
```

## 7. Skill: GIVE_BUFF (high)
```c
// Range handler @ 0x6299FF, opcode 0x23
void OnGiveBuff(Packet *pkt) {
    u16 mask1 = ReadInt16(pkt);  // stat buff mask
    u16 mask2 = ReadInt16(pkt);  // secondary
    /* for each bit in mask: read value + duration + sourceId */
    /* apply to character: stat boosts, invincibility, etc. */
    /* start buff timers, display buff icons */
}
```

## 8. Skill: CANCEL_BUFF (high)
```c
// Range handler @ 0x629E60, opcode 0x24
void OnCancelBuff(Packet *pkt) {
    u16 mask = ReadInt16(pkt);
    /* for each bit: remove buff effect, stop timer, remove icon */
}
```

## 9. Skill: UPDATE_SKILLS (high)
```c
// Range handler @ 0x6280D7, opcode 0x27
void OnUpdateSkills(Packet *pkt) {
    u16 count = ReadInt16(pkt);
    for (i = 0; i < count; i++) {
        u32 skill_id = ReadInt32(pkt);
        u32 skill_level = ReadInt32(pkt);
        u32 master_level = ReadInt32(pkt);
        u64 expire = ReadInt64(pkt);
        /* update skill table entry */
    }
    /* refresh skill window UI */
}
```

## 10. Inventory: MODIFY_INVENTORY_ITEM (high)
```c
// Range handler @ 0x6286EC, opcode 0x20
void OnModifyInventoryItem(Packet *pkt) {
    u8 flag = ReadByte(pkt);
    u8 inv_type = ReadByte(pkt);         // 1=equip 2=use 3=setup 4=etc 5=cash
    u16 count = ReadInt16(pkt);
    for (i = 0; i < count; i++) {
        u8 mode = ReadByte(pkt);         // 0=add 1=update_qty 2=remove 3=move
        u8 slot = ReadByte(pkt);
        switch (mode) {
        case 0: /* add item: read item_id, qty */ break;
        case 1: /* update quantity: read qty */ break;
        case 2: /* remove */ break;
        case 3: /* move: read dst_slot */ break;
        }
    }
    /* refresh inventory UI */
}
```

## 11. Combat: SPAWN_MONSTER (high)
```c
// MOB band sub-handler, opcode 0xEE
void OnSpawnMonster(Packet *pkt) {
    u32 mob_oid = ReadInt32(pkt);
    /* read: position, mob_type (from WZ), hp, mp, boss flag,
       summon type, direction, then for mob controller:
       control data */
    /* create mob object, register in field, start AI */
}
```

## 12. Combat: CLOSE_RANGE_ATTACK sender (confirmed)
```c
// c2s 0x28, builder from sender census
void SendCloseRangeAttack(u32 skill_id, TargetList *targets) {
    pkt = COutPacket();
    WriteHeader(0x28);
    writeShort(skill_id);
    writeByte(targets->count);
    for (i = 0; i < count; i++) {
        writeInt(targets[i].mob_oid);
        writeByte(targets[i].hit_count);
        for (j = 0; j < hit_count; j++) {
            writeByte(targets[i].damage[j]); // damage value
        }
    }
    writeByte(attack_direction);
    writeShort(stance);
    send_wrapper();
}
```

## 13. Quest: NPC_TALK dialog state (high)
```c
// c2s 0x36 (start) / 0x38 (continue)
void SendNPCTalk(u32 npc_oid, u8 action, u32 selection) {
    pkt = COutPacket(); WriteHeader(0x36);
    writeInt(npc_oid); writeByte(action); writeInt(selection);
    send_wrapper();
}
void SendNPCMore(u8 action, u32 last_sentence, u32 selection) {
    pkt = COutPacket(); WriteHeader(0x38);
    writeByte(action); writeInt(last_sentence); writeInt(selection);
    send_wrapper();
}
// s2c NPC_TALK @ 0x353092 (opcode 0x145)
void OnNPCTalk(Packet *pkt) {
    u32 npc_oid = ReadInt32(pkt);
    u8 msg_type = ReadByte(pkt);
    /* type 0=say, 1=say+next, 2=yes/no, 3=text input, 4=select, ... */
    String text = ReadString(pkt);
    /* display dialog UI, track dialog state for NPC_MORE */
}
```

## 14. Field: Map transition (confirmed)
```c
// Outbound: CHANGE_MAP c2s 0x21
void SendChangeMap(u32 map_id, u32 portal_id) {
    pkt = COutPacket(); WriteHeader(0x21);
    writeInt(map_id); writeInt(portal_id);
    send_wrapper();
}
// Inbound: WARP_TO_MAP 0x81 → handler (flow #4 above)
// → field teardown + WZ map load + object re-registration
```

## 15. Login: CLogin state machine (high)
```c
// @ ~0x45EB00
class CLogin {
    int state;      // [+0x64]
    int substate;   // [+0x68]
    void OnPacket(u16 opcode, Packet *pkt) {
        switch (state) {
        case 0: if (opcode == LOGIN_STATUS) { /* parse, transition */ } break;
        case 1: if (opcode == SERVERLIST) { /* build world list */ } break;
        case 2: substate = 9 /* charlist */;
                if (opcode == CHARLIST) { /* populate char slots */ } break;
        }
    }
};
```

## 16. Social: GENERAL_CHAT (confirmed)
```c
// c2s 0x2D
void SendGeneralChat(char *message) {
    pkt = COutPacket(); WriteHeader(0x2D);
    writeString(message); send_wrapper();
}
// s2c CHATTEXT 0xA4: display chat bubble above character
void OnChatText(Packet *pkt) {
    u32 cid = ReadInt32(pkt);
    String name = ReadString(pkt);
    String msg = ReadString(pkt);
    u8 balloon_type = ReadByte(pkt);
    /* display bubble */
}
```

## 17. Social: PARTY_OPERATION (high)
```c
// c2s 0x78
void SendPartyOperation(u8 op, u32 target) {
    pkt = COutPacket(); WriteHeader(0x78);
    writeByte(op); writeInt(target); send_wrapper();
}
// s2c PARTY_OPERATION 0x3B @ 0x648120
void OnPartyOperation(Packet *pkt) {
    u8 mode = ReadByte(pkt);
    /* mode 0x0c=create, 0x0e=leave, 0x0f=join, 0x10=expel, ... */
    /* update party member list, refresh party UI */
}
```

## 18. Inventory: ITEM_MOVE (confirmed)
```c
// c2s 0x44
void SendItemMove(u8 src_tab, u8 src_slot, u16 qty, u8 dst_tab, u8 dst_slot) {
    pkt = COutPacket(); WriteHeader(0x44);
    writeByte(src_tab); writeByte(src_slot); writeShort(qty);
    writeByte(dst_tab); writeByte(dst_slot); send_wrapper();
}
```

## 19. Cash Shop: Enter (confirmed)
```c
// c2s 0x23
void SendEnterCashShop() {
    pkt = COutPacket(); WriteHeader(0x23); send_wrapper();
}
// s2c CHAR_CASH 0x7D: update NX balance
// s2c CS_OPEN 0x83: display cash shop UI overlay
```

## 20. UI: KEYMAP handler (confirmed)
```c
// @ 0x1B9E4F, opcode 0x16F
void OnKeymap(Packet *pkt) {
    for (int i = 0; i < 89; i++) {
        u8 type = ReadByte(pkt);
        u32 key = ReadInt32(pkt);
        if (type == 4 && key <= 3) KeymapTable[i] = key;
    }
    /* refresh keybinding UI */
}
```

## 21. Codec: Custom encrypt/decrypt pair (confirmed)
```c
// @ 0x65911A / 0x659182
void custom_encrypt(byte *data, int len, u32 *iv) {
    for (i = 0; i < len; i++) {
        b = data[i];
        b = (b << 4) | (b >> 4);
        b = ((b & 0xD5) << 1) | ((b >> 1) & 0x55);
        b ^= Table[iv[0]];                               // Table @ 0x7D4130
        data[i] = b; funny_shit(b, iv);                  // @ 0x6590BD
    }
}
```

## 22. State machine: Channel migration (confirmed)
```c
// The complete migration protocol:
// 1. CHAR_SELECT(0x0A, cid) → SERVER_IP(0x0B) {ip, port, cid}
// 2. *** Close login socket ***
// 3. Connect to channel port (e.g., 7575)
// 4. PLAYER_LOGGEDIN(0x0B, cid + 8B)
// 5. 18-packet burst: CHARINFO(658B) + INVENTORY + SKILLS + notices
```

## 23. Social: WHISPER (high)
```c
// c2s 0x75
void SendWhisper(char *target, char *message) {
    pkt = COutPacket(); WriteHeader(0x75);
    writeString(target); writeString(message); send_wrapper();
}
// s2c WHISPER 0x8B: display whisper in chat window
```

## 24. Character: UPDATE_CHAR_LOOK (high)
```c
// SPAWN band, opcode 0xC7
void OnUpdateCharLook(Packet *pkt) {
    u32 cid = ReadInt32(pkt);
    u8 gender = ReadByte(pkt);
    u8 skin = ReadByte(pkt);
    u32 face = ReadInt32(pkt);
    /* read: hair, pet, equipment slots */
    /* update character appearance in field view */
}
```

## 25. Mob: KILL_MONSTER (high)
```c
// MOB band, opcode 0xEF
void OnKillMonster(Packet *pkt) {
    u32 mob_oid = ReadInt32(pkt);
    u8 animation_type = ReadByte(pkt);
    /* remove mob from field, play death animation */
    /* if type==1: show EXP gain effect */
}
```

## 26. Skill: DISTRIBUTE_SP (high)
```c
// c2s 0x57
void SendDistributeSP(u32 skill_id, u32 amount) {
    pkt = COutPacket(); WriteHeader(0x57);
    writeInt(skill_id); writeInt(amount);
    writeInt(0); /* unknown */ send_wrapper();
}
```

## 27. Inventory: USE_UPGRADE_SCROLL (high)
```c
// c2s 0x53
void SendUpgradeScroll(u8 scroll_slot, u8 equip_slot, u8 white_scroll) {
    pkt = COutPacket(); WriteHeader(0x53);
    writeByte(scroll_slot); writeByte(equip_slot);
    writeByte(white_scroll); send_wrapper();
}
```

## 28. Network: funny_shit transform (confirmed)
```c
// @ 0x6590BD — the per-byte IV shuffle
void funny_shit(byte input, byte block[4]) {
    block[1] -= (Table[block[1]] - input);
    block[2] ^= Table[input] ^ block[1];
    block[3] = (block[3] - block[0]) + Table[block[3]] + input;
    *(u32*)block = rol32(*(u32*)block, 3);
}
```
