# Task 046 — State Machine Atlas

## 1. Login/World/Channel state machine

```text
[DISCONNECTED] ──connect──> [CONNECTING] ──hello──> [CONNECTED]
  [CONNECTED] ──LOGIN_PASSWORD──> [AUTHENTICATING]
  [AUTHENTICATING] ──LOGIN_STATUS ok──> [SERVER_SELECT]
  [SERVER_SELECT] ──SERVERLIST──> [WORLD_SELECT]
  [WORLD_SELECT] ──CHARLIST──> [CHAR_SELECT]
  [CHAR_SELECT] ──CHAR_SELECT(0x0A)──> [REDIRECT_RECEIVED]
  [REDIRECT_RECEIVED] ──close login socket──> [MIGRATING]
  [MIGRATING] ──connect channel──> [CHANNEL_CONNECTED]
  [CHANNEL_CONNECTED] ──PLAYER_LOGGEDIN──> [IN_GAME] (18-packet burst)
```
Evidence: confirmed live (Task 033 chain)
Key object: CLogin [+0x64] = state, [+0x68] = substate

## 2. Field transition state machine

```text
[IN_FIELD] ──portal collision──> [TRANSITIONING]
  [TRANSITIONING] ──CHANGE_MAP(0x21)──> [WAITING_WARP]
  [WAITING_WARP] ──WARP_TO_MAP(0x81)──> [FIELD_TEARDOWN]
  [FIELD_TEARDOWN] ──load new map──> [IN_FIELD]
```
Evidence: high (c2s + s2c both live-named)

## 3. NPC dialog state machine

```text
[IDLE] ──click NPC──> [NPC_TALK_SENT(0x36)]
  [NPC_TALK_SENT] ──dialog received──> [DIALOG_SHOWING]
  [DIALOG_SHOWING] ──user selects──> [NPC_MORE_SENT(0x38)]
  [NPC_MORE_SENT] ──next dialog──> [DIALOG_SHOWING]
  [NPC_MORE_SENT] ──shop opened──> [SHOP_OPEN]
  [NPC_MORE_SENT] ──quest offer──> [QUEST_DIALOG]
  [SHOP_OPEN] ──close──> [IDLE]
  [QUEST_DIALOG] ──accept/decline(0x68)──> [IDLE]
```
Evidence: high (c2s names + odinms protocol semantics)

## 4. Cash shop transition

```text
[IN_FIELD] ──ENTER_CASH_SHOP(0x23)──> [CASH_TRANSITIONING]
  [CASH_TRANSITIONING] ──CHAR_CASH(0x7D)──> [IN_CASH_SHOP]
  [IN_CASH_SHOP] ──browse/buy──> [IN_CASH_SHOP]
  [IN_CASH_SHOP] ──exit──> [CASH_EXITING] ──> [IN_FIELD]
```
Evidence: confirmed (both directions live-observed)

## 5. Skill/buff lifecycle

```text
[SKILL_READY] ──press key──> [SKILL_CASTING]
  [SKILL_CASTING] ──SPECIAL_MOVE(0x58)──> [SKILL_ACTIVE]
  [SKILL_ACTIVE] ──if attack──> [ATTACK_SENT] ──> [SKILL_COOLDOWN]
  [SKILL_ACTIVE] ──if buff──> [BUFF_ACTIVE]
  [BUFF_ACTIVE] ──timer expires──> [CANCEL_BUFF(0x59; reason=0)]──> [SKILL_READY]
  [BUFF_ACTIVE] ──user cancels──> [CANCEL_BUFF(0x59; reason=1)]──> [SKILL_READY]
  [SKILL_COOLDOWN] ──timer──> [SKILL_READY]
```
Evidence: high (c2s names + protocol semantics)

## 6. Combat encounter (simplified)

```text
[MOB_VISIBLE] ──attack key──> [ATTACK_BUILDING]
  [ATTACK_BUILDING] ──CLOSE_RANGE(0x28)/RANGED(0x29)/MAGIC(0x2A)──> [ATTACK_SENT]
  [ATTACK_SENT] ──server damage update──> [DAMAGE_DISPLAY]
  [DAMAGE_DISPLAY] ──timeout──> [MOB_VISIBLE or MOB_DEAD]
  [PLAYER_HIT] ──TAKE_DAMAGE(0x2C)──> [ACK_SENT]
  [ACK_SENT] ──HP_update──> [NORMAL or DEAD]
```
Evidence: high (c2s names + combat semantics)
