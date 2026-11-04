# Task 046 — Equivalent Pseudocode (25+ representative flows)

Each block cites RVAs/objects and confidence. Unknown behavior uses
explicit `/* unknown */` placeholders.

## 1. Network: Connection (confirmed)
```c
// RVA: 0x947EA
void CClientSocket::Connect(sockaddr_in *addr) {
    this->socket = socket(AF_INET, SOCK_STREAM, 0);   // [this+8]
    if (this->socket == -1) throw /* WSAGetLastError */;
    setsockopt(this->socket, SOL_SOCKET, /* SO_RCVTIMEO */, this->timeout_ms /* [this+4] */);
    this->deadline = time() + 5000;                    // [this+0x38]
    int r = connect(this->socket, addr, 16);
    if (r == -1 && WSAGetLastError() != WSAEWOULDBLOCK)
        this->Close();
}
```

## 2. Network: Handshake / version announce (confirmed)
```c
// RVA: 0x95C5C
void CClientSocket::Handshake() {
    word ver = this->version_word;                     // [this+0x88]
    if (!validate_version(ver)) /* disconnect */;
    pkt = COutPacket(/* size */);
    WriteHeader(0x4F);                                 // push 0x4F = version 79
    write(ver);
    // cipher: encrypt_full → custom_encrypt(header + body)
    send_wrapper(this->queue, pkt);
}
```

## 3. Network: Send/Flush (confirmed)
```c
// RVA: 0x95D5C
bool CClientSocket::Flush() {
    if (this->socket == -1 || !this->connected) return false;  // [+8],[+0x5C]
    enter_critical(this->lock);
    Queue *q = this->send_queue;                        // [+0x60]
    if (q->size == 0) { leave_critical; return true; }
    int n = send(this->socket, q->data, q->len, 0);
    if (n == q->len) {
        QueueCipherRoll(q, this->cipher);              // 0x49682C: buffer + IV roll
        leave_critical;
        return true;
    } else if (n == -1) { /* handle error */ }
    else { /* partial send: reschedule remainder (0x1C-byte alloc) */ }
}
```

## 4. Network: Receive pump (confirmed)
```c
// RVA: 0x9583A (the pump)
void CClientSocket::ProcessRecv() {
    while (true) {
        buf = PoolAlloc(1460);                          // 0x5B4 = codec chunk size
        int n = recv(this->socket, buf->ptr, buf->len, 0);
        if (n == 0) { Close(); return; }
        if (n == -1 && WSAGetLastError() != WSAEWOULDBLOCK) break;
        AppendToStream(this->rx_stream, buf, n);        // 0x495B36, stream at [+0x40]
        ExtractAndDispatch(this->rx_stream);            // 0x96587 wrapper
    }
}
```

## 5. Network: IV roll (confirmed)
```c
// RVA: 0x95F0D (call site) → crypt(0x659082)
u32 IV_roll(byte *header_iv) {
    u32 result = crypt(header_iv, 4, NULL);  // NULL → uses default seed 0xC65053F2
    return result;  // becomes the next session IV
}
```

## 6. Network: funny_shit (confirmed)
```c
// RVA: 0x6590BD
void funny_shit(byte input, byte block[4]) {
    block[1] -= (T[block[1]] - input);       // T = 256-byte table @ 0x7D4130
    block[2] ^= T[input] ^ block[1];
    block[3] = (block[3] - block[0]) + T[block[3]] + input;
    *(u32*)block = rol32(*(u32*)block, 3);
}
```

## 7. Network: Phase dispatch (confirmed)
```c
// RVA: 0x95F83
void Phase_OnPacket(u16 opcode, Packet *pkt) {
    switch (opcode) {
        case 0x10: handler_964E0(pkt); break;
        case 0x13: handler_960E6(pkt); break;
        case 0x14: handler_960A5(pkt); break;
        case 0x15: handler_961C7(pkt); break;
        case 0x16: handler_96347(pkt); break;
        case 0x17: VersionObject.handle(pkt); break;     // [0xBDD8A8]
        case 0x18: handler_9639D(pkt); break;
        case 0x1C: handler_96477(pkt); break;
    }
    if (0x20 <= opcode <= 0x80 || 0x177 <= opcode <= 0x181)
        RangeDispatcher.handle(opcode, pkt);             // [0xBD9028] → 0x610CE0
    else
        Delegate->vtable[0](opcode, pkt);                // [0xBDF54C] → field dispatcher
}
```

## 8. Character: WARP_TO_MAP (confirmed)
```c
// RVA: 0x37E72F
void OnWarpToMap(Packet *pkt) {
    CWvsContext *ctx = GetSingleton();                  // [0xBD9028]
    u32 old_id = ctx->CharacterId;                      // [+0x205C]
    u32 new_id = ReadInt32(pkt);
    ctx->CharacterId = new_id;
    if (old_id != new_id) ctx->char_changed = 1;       // [+0x2F60]
    ctx->grade_byte = ReadByte(pkt);                    // [+0x2080]
    u16 count = ReadInt16(pkt);
    for (i = 0; i < count; i++) {
        String s = ReadString(pkt);
        /* add to list */
    }
    /* field transition: teardown old map, load new map */
}
```

## 9. Character: SPAWN_PLAYER is-it-me (confirmed)
```c
// RVA: 0x57F6C0
void OnSpawnPlayer(Packet *pkt) {
    CWvsContext *ctx = GetSingleton();
    u32 spawn_id = ReadInt32(pkt);
    if (spawn_id == ctx->field_2084) {
        /* this is the LOCAL player — update own visible state */
    } else {
        /* remote player — create/update remote character object */
    }
}
```

## 10. Field: CHANGE_MAP (confirmed both directions)
```c
// Outbound: c2s 0x21
void SendChangeMap(u32 map_id, u32 portal_id) {
    COutPacket pkt;
    WriteHeader(0x21);
    write(map_id);
    write(portal_id);
    send_wrapper(pkt);
}
// Inbound: the WARP_TO_MAP handler (flow #8) processes the response
```

## 11. Combat: Close-range attack (high)
```c
// c2s 0x28
void SendCloseRangeAttack(u32 skill_id, MobTarget targets[], int n) {
    COutPacket pkt;
    WriteHeader(0x28);
    write(skill_id);            // 0 for normal attack
    write(n);                   // target count
    for (i = 0; i < n; i++) {
        write(targets[i].mob_id);
        write(targets[i].hit_x);
        write(targets[i].hit_y);
    }
    write(attack_type);
    send_wrapper(pkt);
}
```

## 12. Combat: Take damage (high)
```c
// c2s 0x2C (client acknowledges damage)
void SendTakeDamage(i32 damage, u8 attack_type, u32 mob_oid) {
    COutPacket pkt;
    WriteHeader(0x2C);
    write(damage);
    write(attack_type);
    write(mob_oid);             /* obstruction/miss info */
    send_wrapper(pkt);
}
```

## 13. Skill: SP distribution (high)
```c
// c2s 0x57
void SendDistributeSP(u32 skill_id, u32 amount) {
    COutPacket pkt;
    WriteHeader(0x57);
    write(skill_id);
    write(amount);
    write(0);                   /* unknown: amulet */
    send_wrapper(pkt);
}
```

## 14. Skill: Buff lifecycle (high)
```c
// Activate: c2s 0x58 (SPECIAL_MOVE)
void SendSpecialMove(u32 skill_id, u32 skill_level) {
    COutPacket pkt;
    WriteHeader(0x58);
    write(skill_id);
    write(skill_level);
    // if attack skill: delegates to attack builder (flows 11-13)
    send_wrapper(pkt);
}
// Cancel: c2s 0x59 (CANCEL_BUFF)
void SendCancelBuff(u8 reason) {  // 0=expired, 1=manual
    WriteHeader(0x59);
    write(reason);
    send_wrapper(pkt);
}
```

## 15. Quest: NPC dialog state machine (high)
```c
// Start: c2s 0x36
void SendNPCTalk(u32 npc_oid, u8 action, u32 selection) {
    WriteHeader(0x36);
    write(npc_oid);
    write(action);              // 0 = talk start
    write(selection);           // 0 for start
    send_wrapper(pkt);
}
// Continue: c2s 0x38
void SendNPCMore(u8 action, u32 last_sentence, u32 selection) {
    WriteHeader(0x38);
    write(action);              // 1=continue, 2=select, ...
    write(last_sentence);
    write(selection);
    send_wrapper(pkt);
}
```

## 16. Inventory: Item move (confirmed)
```c
// c2s 0x44
void SendItemMove(u8 src_tab, u8 src_slot, u16 qty, u8 dst_tab, u8 dst_slot) {
    WriteHeader(0x44);
    write(src_tab);             // 1=equip 2=use 3=setup 4=etc 5=cash
    write(src_slot);
    write(qty);                 // 0 = move all
    write(dst_tab);
    write(dst_slot);            // 0 = drop
    send_wrapper(pkt);
}
```

## 17. Cash shop: Enter (confirmed)
```c
// c2s 0x23
void SendEnterCashShop() {
    COutPacket pkt;
    WriteHeader(0x23);
    send_wrapper(pkt);          // server transitions session to port 8600
}
```

## 18. Social: General chat (confirmed)
```c
// c2s 0x2D
void SendGeneralChat(char *message) {
    COutPacket pkt;
    WriteHeader(0x2D);
    write_string(message);
    send_wrapper(pkt);
}
```

## 19. Social: Party operation (high)
```c
// c2s 0x78
void SendPartyOperation(u8 op, u32 target) {
    WriteHeader(0x78);
    write(op);                  // create/invite/leave/kick/expel
    write(target);              // player ID or name hash
    send_wrapper(pkt);
}
```

## 20. UI: Keymap handler (confirmed)
```c
// RVA: 0x1B9E4F → walker 0x1B9F47
void OnKeymap(Packet *pkt) {
    for (int i = 0; i < 89; i++) {
        u8 type = pkt->data[i*5];
        u32 key = *(u32*)&pkt->data[i*5+1];
        if (type == 4 && key >= 0 && key <= 3) {
            KeymapTable[i] = key;
        }
    }
}
```

## 21. Login: State machine (high)
```c
// RVA: ~0x45EB00
void CLogin::OnPacket(u16 opcode, Packet *pkt) {
    switch (this->state) {                             // [this+0x64]
    case 0: /* initial login */
        if (opcode == LOGIN_STATUS) { /* parse + transition */ }
        break;
    case 1: /* server select */
        if (opcode == SERVERLIST) { /* build world list */ }
        break;
    case 2: /* character select */
        this->substate = 9;                           // [this+0x68] → charlist phase
        if (opcode == CHARLIST) { /* populate char slots */ }
        break;
    }
}
```

## 22. Network: Range dispatch (confirmed)
```c
// RVA: 0x610CE0
void Range_OnPacket(u16 opcode, Packet *pkt) {
    u8 idx = opcode - 0x20;
    if (idx > 0x60) return;
    u32 handler_va = jump_table_0x7111A1[idx];        // 97 entries
    if (handler_va != default_stub)
        call(handler_va)(pkt);                         // thunk: push pkt; call handler
}
```

## 23. Codec: Custom encrypt (confirmed)
```c
// RVA: 0x65911A
void custom_encrypt(byte *data, int len, u32 *iv) {
    u32 local_iv = 0xC65053F2;
    if (!iv) iv = &local_iv;
    for (int i = 0; i < len; i++) {
        byte b = data[i];
        b = (b << 4) | (b >> 4);                       // nibble rotate
        b = ((b & 0xD5) << 1) | ((b >> 1) & 0x55);   // bit-pair rotate
        b ^= T[iv[0]];                                 // T = table @0x7D4130
        data[i] = b;
        funny_shit(b, iv);
    }
}
```

## 24. Security: Threat detection throw (high)
```c
// RVA: throw-site cluster 0x7934xx
void CSecurity_Throw(CSecurityExceptionType type) {
    // construct the specific exception object
    void *ex = operator new(sizeof_specific);
    vtable_store(ex, vtable_for(type));  // e.g., CSecurityThreatDetected vtable
    // throw via the exception dispatcher
    throw_dispatch(ex);
    // → the caller catches and terminates the client
}
```

## 25. Field: Channel migration protocol (confirmed)
```c
// Client-side migration sequence (proven live in Task 033):
// 1. CHAR_SELECT(0x0A, charid) → server responds SERVER_IP(0x0B)
//    with {ip, port, charid, flag, key}
// 2. Client MUST close the login socket (the session-close resets
//    the account state required by the channel's entry check)
// 3. Connect to the channel port (e.g., 7575)
// 4. Send PLAYER_LOGGEDIN(0x0B, charid + 8B) on the new connection
// 5. Receive the 18-packet in-channel burst
```

## 26. Inventory: Scroll upgrade (high)
```c
// c2s 0x53
void SendUpgradeScroll(u8 scroll_slot, u8 equip_slot, u8 white_scroll) {
    WriteHeader(0x53);
    write(scroll_slot);
    write(equip_slot);
    write(white_scroll);        // 1 = white scroll used
    send_wrapper(pkt);
}
```

## 27. Social: Whisper (high)
```c
// c2s 0x75
void SendWhisper(char *target, char *message) {
    WriteHeader(0x75);
    write_string(target);
    write_string(message);
    send_wrapper(pkt);
}
```
