# 任务/技能/Buff 系统全格式（第二十六轮）

日期: 2026-11-13。

## 任务系统（quests 83→88%）

### c2s
- **QuestAction**（11 读）：{action, questId, npc×9} = NPC 任务交互全参数
- QuestKJ（3 读）/ UseItemQuest（5 读）

### s2c 任务族
| 包 | 格式 |
|---|---|
| updateQuest (SHOW_STATUS_INFO 子1) | {quest, status, customData} |
| updateInfoQuest (子10) | {quest, data} |
| updateQuestMobKills (子1) | {quest, 1, kills 字符串} |
| showQuestMsg (子9) | {msg} |
| updateQuestInfo (UPDATE_QUEST_INFO) | {progress, quest, npc, 0} |
| **updateQuestFinish** | {8, quest, npc, **nextquest**} ← 任务链递进 |
| QuestInfoPacket / addQuestInfo | {started 数, {quest, customData}×n, completed 数, {quest}×n} |

### 完整任务数据流
```
QuestAction(c2s) → 服务器 CheckQuest → updateQuest/MobKills（进度）
→ updateQuestFinish{quest, npc, nextquest}（完成+解锁下一环）
→ addQuestInfo（登录时全量同步：进行中+自定义数据+已完成）
```

## 技能系统（skills_buffs 78→85%）

### 数据同步（登录）
- **addSkillInfo**：{技能数, {skillId, level, masterLevel}×n}
- **addCoolDownInfo**：{cd 数, {skillId, 剩余时间}×n}

### s2c 技能族
| opcode | 包 | 格式 |
|---|---|---|
| 0x5A | skillEffect | {cid, skillId, level, flags, speed, unk} |
| 0x6D | getMacros | {count, {name, shout, skill1-3}×n} |
| 0x4F | useSkillBook | {cid, 1, skillId, maxlevel, canuse, success} |
| COOLDOWN | skillCooldown | {skillId, time} |
| CANCEL_SKILL | skillCancel | {cid, skillId} |

### c2s
- ChangeSkillMacro（6 读：{idx, name, shout, skill1-3}）
- SkillEffect（5 读）/ UseSkillBook（2 读）

## Buff 族

### giveBuff 家族（GIVE_BUFF）
| 变体 | 特征字段 |
|---|---|
| 通用 | {mask(Long×2), statup, buffid, duration} |
| giveMount | +{itemid, skillid} |
| givePirate | MORPH 掩码 +{skillid, duration} |
| giveHoming | HOMING_BEAST 掩码 +{skillid} |
| giveEnergyCharge | 能量条 |
- **掩码机制**：MapleBuffStat 位掩码（Long×2 = 128 位 buff 位图）

### cancelBuff（0x59）子码
- 子3 = 通用取消 / 子 mask = 指定 stat 取消
- cancelForeignBuff（+cid）/ cancelDebuff（mask Long×2）
- HOMING 掩码 = MapleBuffStat.HOMING_BEAST
