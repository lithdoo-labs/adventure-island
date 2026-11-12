# UI 窗口全地图 + 音效命名方案（第十八轮）

日期: 2026-11-13。全语料 UI 路径引用提取。

## 窗口清单扩展：18 → 26+

### 新增大窗口（按代码量）
| 窗口 | 函数数 | 代码量 | 身份 |
|---|---|---|---|
| **Delivery** | 4 | **113K** | 快递系统（最大 UI 模块） |
| **MonsterBook** | 3 | 84K | 怪物图鉴 |
| **PartySearch** | 2 | 60K | 组队搜索 |
| **UtilDlgEx** | 1 | 50K | 通用扩展对话框 |
| **Radio** | 1 | 45K | 游戏内广播 |
| NewYearsCard | 3 | 10K | 新年卡 |
| PvP | 1 | 1K | PvP 窗口（3 switch） |

### 新 WZ 系统（数据侧发现）
```
Skill/MobSkill.img/%03d/level/%d/{tile,affected}   ← 怪物技能（30K 引用者×2）
Skill/MCSkill.img + Skill/MCGuardian.img            ← MCPQ 技能/守卫
Skill/BFSkill.img                                   ← 战线技能
Skill/ItemSkill.img/%03d/level/%d/mob               ← 物品技能
Quest/PQuest.img + Quest/Exclusive.img + Etc/QuestCategory.img ← 组队/专属任务
UI/CN_Chat.img/roomList/{Marker,Secret,Vip}         ← 聊天室列表（国服特有）
UI/Basic.img/KeyDownBar{,1}/{bar,gauge,graduation}  ← 连击能量条
Effect/BasicEff.img/Combo{,Command}/%d/...          ← 连击系统
Etc/MakeCharInfo.img/OrientChar{Male,Female}        ← 角色创建朝向
StandardPDD.img / EnchantSkill / AranSkillGuide
```

## 🎵 音效命名方案实证（音频最后一块拼图）

**`Sound/field.img/summerboating/bomb`** 引用发现：
```
音效路径方案：Sound/field.img/<地图名>/<事件名>
```
结合 WINMM.dll 动态加载机制（第九轮），音频系统完整：
**Sound.wz 按图分组 → field.img/<map>/<event> 命名 → WINMM waveOut/MCI 播放**。

## 资产
- UI-WINDOW-MAP.csv（58 组 × 函数/代码量/加密/开关统计）
