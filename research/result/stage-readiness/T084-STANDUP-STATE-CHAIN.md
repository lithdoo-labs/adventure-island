# T084 — Stand-up / Action-Cancel State Chain (Static Forensics)

Round: t084 (2026-11-15). Binary identity as above. Evidence: `forensics/T084-EV69-STANDUP.txt` (regenerable via `research/scripts/t084_dump_evidence.py`).

Related: G41, P3-15, C-057, C-066, C-061, C-065.

---

## 1. Verdict

**CONFIRMED (replacement chain found) + REFUTATION (the recorded target 0x6A0ADF is not a stand-up function).**

## 2. Refutation: 0x6A0ADF

0x6A0ADF (0x6A0ADF–0x6A0B2C, ret) is a **generic encrypted-pair integrity decryptor**, structurally identical to 0x4B6ABE:

```
eax = arg1(pair ptr); ebx = [pair+4]; esi = [pair+0]
edi = 0xA705FB(5, ebx) ^ esi              ; decrypt value
esi ^= 0xBAADF00D ; checksum = 0xA700F4(5, esi) + ebx
if checksum != arg2 -> assert-fail 0xA6FC9B (0xB12650)
return edi
```

It has 55 direct E8 callers (0x69xxxx/0x6Axxxx/0x95xxxx/0xA0xxxx families) precisely because it is the shared `{value,key}` read helper of the encrypted-field family — its frequent appearance near the seat/animation setters (0x6A05FF/0x6A0545) is how the earlier round mis-filed it as the stand-up chain. **No state write, no trigger condition, no animation call exists inside it.** The P3-15 next-work pointer "追 0x6A0ADF 起身/取消链" is therefore void.

## 3. The actual stand-up: 0x965A09 = user-object vtable slot 14 (0xB0BD28+0x38)

Full body (0x965A09–0x965A8C, ret 4, thiscall, this=user, arg1=flag):

```
1. 0x6131B9(0, user+0x2944)          ; encrypted seat-state := 0 (sit flag OFF)
   [user+0x294C] = echo key          ; (C-057's writer, value 0 side)
2. RNG pair roundtrip on user+0x2E90 (0x416E36/0x416DE8) -> [user+0x2E98]/[user+0x2EA4]
3. eax = decrypt(user+0x2E90-pair)
   0x965A8F(eax) -> stance code      ; chair/item-id map (below)
   [user+0xF04] = stance code
4. [user+0x2EB4] = 0
5. 0x943070(user, 0)
6. if (arg1 == 0):
      ecx = [user+0xF28]
      M = (ecx != 0) ? ecx-0xC : 0   ; M = P-0xC transform (same as C-061)
      0x53E95D(M, 0xB)               ; movement notify kind 11 (0xB)
```

**0x965A8F item-id → stance-code map** (0x965A8F–0x965AD7):

| input (decrypted id) | output |
|---|---|
| 0x2DEDED..0x2DEDEF | 1 |
| 0x2DEE15 | 2 |
| 0x2DEE1B | 2 |
| 0x2DEE19 | 3 |
| 0x2DEE16 | 4 |
| 0x2DEE2D | 5 |
| other | 0 |

(`cmp eax,0x2DEDED` / `cmp eax,0x2DEDEF` at 0x965A93/0x965A9A — reviewer D1 correction: the →1 range is these three item ids, not a 0x2DED00–FF block.)

These are CMS079 chair/town item ids; the output is the stand-up pose/stance selector written to `user+0xF04`.

## 4. State semantics (what is and is not proven)

| statement | status |
|---|---|
| 0x965A09 clears the C-057 seat state (user+0x2944 → 0) | CONFIRMED (instruction) |
| it resets chair-derived RNG pair fields (user+0x2E90-family) | CONFIRMED (instruction) |
| it computes a stance code from the held chair item id into user+0xF04 | CONFIRMED (instruction; code meaning of +0xF04 is DERIVED — offset-semantic label from consumer-side context, no second independent reader verified this round) |
| it notifies the move object with record kind 0xB via 0x53E95D | CONFIRMED (instruction; kind feeds the 0x6B87D1/0x6B8A18 record container of C-078) |
| notify is SUPPRESSED when arg1 != 0 | CONFIRMED (branch 0x965A6E) |
| "function called" ⇒ "state transition took effect" | NOT claimed — the effective pose change happens in consumers of user+0xF04/user+0x2944 not read this round |

## 5. Dispatch and callers

- Only ONE direct E8 caller: 0x9500A3 (inside the user-object full-reset path, vtables 0xB0BD28/0xB0BD04/0xB0BD00/0xB0BCEC; the window also zeroes user+0x28CC/0x28F0/0x28C0/0x2908/0x2928 buffers — teleport/seat/portal pending state) — **called with arg1=1 ⇒ notify suppressed** (full reset context).
- State-driven stand-up (arg1=0) goes through the **user vtable slot14** (`call [user-vt+0x38]`); the exact slot14 caller sites (input adjudication: seat-leave key, movement start, damage cancel) were **not enumerated this round** — that enumeration (plus the 0xCF-case-0 writer 0x9658CC sit path already bound by C-066/EV-52) is the remaining static work for P3-15.

## 6. Relationship to sit (0xCF) and to the move object

- Sit side (unchanged, C-066/C-057): opcode 0xCF dispatch (switch 0x9571BF, table 0x95732E, case 0 → 0x957201 → 0x9658CC) writes the seat state 1-side; arrival reuses the 0x963C7D teleport-trigger family.
- Stand-up side (this round): 0x965A09 writes the 0-side and pushes a kind-0xB record into the same M+0x19C container that slot13 (C-078) drains — i.e. sit/stand participate in the same record/context pipeline as foothold/rope.

## 7. Ledger deltas

- NEW C-081 (0x965A09 = user vt slot14 stand-up; 0x6A0ADF refuted as decrypt helper) — EV-69, grade A (stance-code meaning B/DERIVED for +0xF04).
- G41 seat stand-up chain item: addressed (chain located); slot14 caller enumeration remains.
- P3-15 minimum_next_work rewritten (0x6A0ADF pointer removed with correction marker).
