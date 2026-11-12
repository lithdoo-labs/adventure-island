# 怪物技能渲染管线 + MonsterBook（第二十轮）

日期: 2026-11-13。

## MobSkill 效果渲染（FUN_0076fa33, 29K 指令级）

```
WZ 路径方案：Skill/MobSkill.img/%03d/level/%d/{affected, tile}
  %03d = 怪物技能 ID（三位）
  %d   = 技能等级
  affected = 作用区效果（目标区域的视觉表现）
  tile     = 地格效果（地面显示）
```
经 COM 包装链（0x40263b 智能指针 ×22、0x403ac7 WZ 查询 ×22、VARIANT 序列化 ×32）。

### 系统全景（怪物侧技能族）
| WZ | 用途 |
|---|---|
| MobSkill.img | 怪物技能效果（affected/tile）|
| MCSkill.img | MCPQ 技能 |
| MCGuardian.img | MCPQ 守卫 |
| BFSkill.img | 战线技能 |
| ItemSkill.img | 物品技能（/mob 目标效果）|

## MonsterBook（FUN_00871e55, 55K）

- `UI/UIWindow.img/MonsterBook/fullMark` = 卡片收集完成标记
- 标准 COM/VARIANT 屏幕构建器（74× 序列化调用）
- 怪物图鉴 UI = 卡片收集进度系统
