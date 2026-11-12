# 未分析盲区发现（4.1MB Frontier）

日期: 2026-11-12。发现反编译语料库**缺失整个尾区**。

## 发现

- `decompiled_v2.csv` 最大 RVA = **0x9d8046**
- 解包镜像 = 0x400000-0xdda000 (9.9MB)
- **盲区 = 0x9d8046-0xdda000 (4.1MB)**，含 5,620 个函数 / 44,035 个调用引用
- 全客户端 8.3% 的调用（21,354 次）指向盲区第一函数 FUN_00a6ef01

## 盲区身份（capstone 反汇编确认）

| 地址 | 引用 | 身份 |
|---|---|---|
| 0xa6ef01 | 21,354 | VARIANT/属性序列化包装 → 0xa6f6e0 |
| 0xa6fc7c | 5,344 | **CxxThrowException**（fs:[0] SEH + RaiseException） |
| 0xa6ef0f | 3,186 | COM IPC 包装（QueryInterface[GUID 0xbd53b0] + call + Release） |
| 0xa6fce0 | 169 | **memcpy**（rep movsd + 对齐跳转表） |
| 0xa70630 | 157 | **memmove**（重叠检测 + 反向拷贝） |
| 0xa70270 | 752 | **_chkstk 栈探测**（0x1000 步进探测） |
| 0xa6efac | — | **VARIANT 序列化器**（VT 标志 0x800/0x2000/0x4002、跳转表 0xa6f3d5/0xa6f415、HRESULT 0x80004003） |

**结论**: 盲区 = 静态链接 MSVC CRT（memcpy/memmove/alloca/异常/内存）+ **从未分析的游戏功能代码**。

## 盲区中的游戏功能（字符串交叉引用确认）

### 新发现子系统
| 功能 | 证据 |
|---|---|
| 宠物自动药水 | e_NOMPPotion/e_NOHPPotion/e_HPAlert/e_rest/e_prelevelup/e_levelup（4 个函数簇） |
| **飞行物理** | Map/Physics.img + fallSpeed/**floatCoefficient**/**floatDrag1**/flyJumpDec（2 函数）——Physics.img 常数不止 19 个！ |
| PartySearch UI | UI/UIWindow.img/PartySearch/icon0/* |
| NewYearsCard UI | backgrnd/BtClose/BtCancel/BtOk/BtSearch（5 函数） |
| Transform UI | backgrnd/BtCancel/BtOk（2 函数） |
| WZ 加载器 | '%s.wz' / 'Base.wz' |
| Monster Carnival (MCPQ) | monsterCarnival/spendCP/mobMassacre/guardian/disableSkill |
| 夏日划船活动 | Map/Obj/summerboating.img/boat%02d/bombEffect + BoatRace + UI/Sboating/Basic/bar |
| ViciousHammer | UI/UIWindow.img/ViciousHammer/EffectE/EffectP |
| Gachapon | CashGachapon/EffectNormal/EffectJackpot + GachaponItemExpiredDate.img |
| 多宠物系统 | tmultipet + autoActive |
| 角色创建数据 | Etc/MakeCharInfo.img/OrientChar{Male,Female} |
| WebBrowserUI | 'Nexon.MapleStory.WebBrowserUI'（COM 类名） |

### UI 窗口清单更新：15 → **18**（+PartySearch/NewYearsCard/Transform）

## 巨函数家族解释

8 个 115-315KB UI 巨函数全部调用 FUN_00a6ef01 74-137 次
= **逐属性读取 WZ VARIANT 的 UI 屏幕构建器**（证实）。
热门助手 0x40263b/0x403ac7/0x4029b7/0x406368 同样在盲区（CSV 键不存在）。

## 函数语料库修正

| 项 | 之前 | 现在 |
|---|---|---|
| 已知函数 | 52,326 | **57,946**（+5,620 盲区） |
| 语料覆盖范围 | 0x400000-0x9d8046 | 0x400000-0xdda000 |
| CRT 样板（无需阅读） | 未知 | ~2K（memcpy 族/异常/内存）已识别 |

## 后续建议

1. 用 Ghidra 重新分析 0x9d8046-0xdda000 补导出（安装位置待寻）
2. capstone 已装：可写轻量反汇编器批量覆盖盲区
3. 飞行物理 floatCoefficient/floatDrag1 应并入 MAP-PHYSICS-FIELDS.md
