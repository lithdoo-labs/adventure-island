# 社交系统全格式（第二十七轮）

日期: 2026-11-13。

## 组队（0x78 PARTY_OPERATION）

| 子码 | 功能 | 格式 |
|---|---|---|
| 4 | 邀请 | {partyId, 邀请者名, 0} |
| 8 | 创建 | {partyId, MAGIC×2, 0} |
| 12 | **updateParty** (16 字段) | {partyId, targetId, op标志, 成员列表...} |
| 35 | **partyPortal** | {townId, targetId, Pos} ← 组队传送门 |
- addPartyStatus（17 字段/成员）：{id, 名(右填充13), job, level, ...}
- **updatePartyMemberHP**：{cid, curhp, maxhp}（队员血条同步）
- MCPQ：CPUpdate{team, curCP, totalCP}

## 公会（0x7A GUILD_OPERATION）— 十六子码

| 子码 | 功能 |
|---|---|
| 5/55 | 邀请/拒绝 |
| 26 | showGuildInfo（含 addMemberData 9 字段/人 + rankTitle×5）|
| 39 / 44/47 | 新成员 / 离开(退/踢) |
| 50 | 解散 |
| 58 / 64 / 66 / 68 | 容量 / 职位变更 / **徽章{bg,bgcolor,logo,logocolor}** / 公告 |
| 60 / 61 / 62 / 72 | 等级职业更新 / 上下线 / 职位称号 / **GP 更新** |
| 73 | 三大排行（GP/等级/金币，NPC 查询）|
- c2s Guild（17 读）全操作

## 同盟（ALLIANCE_OPERATION）— 全子码

1=变更 / 2/25=换盟主 / 3=邀请 / 4=公会进出 / 5/27=职位 / 12/13=信息
/14=成员在线 /15=创建 /16=移除公会 /18=加入 /23=更新 /24=成员更新 /29=解散
- addAllianceInfo{盟名, 职衔×5, 公会数, ...}

## 好友（BUDDYLIST）

- 子7 updateBuddylist（9 字段）+ 子9 requestBuddylistAdd（12 字段含频道）
- c2s BuddyOperation（5 读：op/名×2/int×2）

## 数据细节
- 名字传输 = `StringUtil.getRightPadding(13)` 定长填充（公会/组队成员列表）
- 公会成员结构：{id, 名, job, level, 在线, 贡献, 职位, 加入日期}
- 徽章 = 4 元组 {bg, bgcolor, logo, logocolor}
