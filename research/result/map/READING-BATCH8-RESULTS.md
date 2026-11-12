# 逐函数阅读战役 — 第八批成果

日期: 2026-11-12。

## P1: fixedDamage (0x2aa857, 115KB, 3033 行) — 不是纯伤害计算

**重新定性**：这不是伤害公式函数——这是**怪物信息/行为配置巨函数**：

字符串锚：`mbookID`(怪物图鉴), `speak`(NPC对话), `hpTagColor`/`hpTagBgcolor`(血条颜色),
`fixedDamage`(固定伤害配置), `onlyNormalAttack`, `cantPassByTeleport`, `weapon`, `chatBalloon`

**这是怪物属性解析器**——从 WZ 数据读取怪物的全部配置（伤害/攻击方式/传送限制/血条外观等）。
3033 行 = 逐一解析 WZ 属性树的每个字段。

60 次 `FUN_007a48d0` 调用 = 60 个字符串表 ID = 60 个 WZ 属性名。
零 switch = 顺序流（逐字段读取），不分派。

**对实现的直接价值**：这个函数列出了**怪物对象的全部字段清单**。

## P3: move-state-E (行走) — 速度钳制积分验证

```c
// 行25-27: 读取当前速度
current = DEC(param_2)       // 解密某个速度值
vx = DEC(move+0x38)          // 解密 vx 槽对
if (current > 1.0 || vx <= 1.0):
    // 行29: 钳制到立足点限速
    if (foothold[+0x40=maxSpeed] <= current):
        current = foothold[+0x40]  // 钳到明文限速
    // 行38: 写回加密槽
    ENC_WRITE(move+0x3c, foothold[+0x40])
```

**验证完成**：行走的速度钳制 = `min(current_vx, foothold.maxSpeed)`，限速从立足点明文读取。

## 维度推进

| 维度 | 发现 | 进度 |
|---|---|---|
| 对象模型 | 怪物属性解析器=60字段清单 | 40→**43%** |
| 移动物理 | 行走积分指令级验证完成 | 96→**97%** |
| 战斗 | fixedDamage 重定性（怪物配置，非伤害公式） | 57% 稳定 |
| **整体** | | **73.3→73.8%** |
