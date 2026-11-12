# CMS079 客户端逆向 — 开发者手册（终版）

日期: 2026-11-12。本文是全部逆向战役的最终交付物。

## 一、你现在可以做什么

拿这份知识库，你可以实现以下游戏系统：

### ✅ 完全可实现（公式/协议/数据全知）
- **登录流程**：协议 + AES 加密 + 滚动密钥全知（合成客户端已验证）
- **移动物理**：陆跳/下跳/游泳跳/爬绳/传送/行走的完整公式
- **聊天**：协议 + 服务器源码全知
- **物品/背包**：WZ 数据 + 协议全知
- **任务系统**：协议 + WZ 数据全知
- **NPC 交互**：数据 + 协议全知
- **社交/组队/公会**：协议 + 服务器源码全知

### 🔶 可实现（架构/数据已知，实现细节需决策）
- **地图渲染**：z 序（zmap.img 149 层）+ 精灵管线（NameSpace→ResMan→Canvas）+ origin/变换全知；用现代图形 API 替代 D3D8
- **战斗系统**：动作选择（swingO1/2/3 随机）+ 命中范围（技能驱动5种公式）+ 伤害公式 + 数字显示全知
- **UI 窗口**：事件模型（switch 命令泵）+ UIWindow.img 数据全知；个别窗口逻辑需补充

## 二、核心公式速查

### 移动物理
```
陆跳: vy = -(DEC(move+0x198+0x48) × jumpSpeed) / DEC(move+0x190+0x24)
水跳: vy = param × swimSpeed × slope × 5.0
下跳: vy = DEC(move+0x190+0x24) / (jumpSpeed × -0.35355339)
爬绳: y = clamp(y ± 3, rope.y1, rope.y2)
行走: x = ENC(base_x + vx_proj × dt × 0.5)   // 梯形积分
速度钳制: vx = min(vx, foothold.maxSpeed)    // 立足点明文限速
```

### Physics.img 常数（19 个，WZ 直读）
```
walkForce=140000, walkSpeed=125, walkDrag=80000, gravityAcc=2000,
jumpSpeed=555, fallSpeed=670, swimForce=120000, swimSpeed=140, ...
```

### 攻击命中范围（技能驱动）
```
3101005(爆炸剑):     range = base + 200
3211003(寒冰剑):     range = base + 120 + hitIdx × 30
3111003(烈火剑):     range = base + 120 + hitIdx × 30
3111004(箭雨):       range = otherBase + 400
5121002(超能力):     range = √(dx² + dy²) + offset（圆形判定）
默认:                range = int(double)otherBase
```

### 伤害公式（服务器源码）
```
maxDamage = (weaponMaxDmgMul × mainstat + secondstat) × watk / 100
```

### 加密体系
```
AES-256-ECB 密钥: 130000000800000006000000b40000001b0000000f0000003300000052000000
滚动密钥种子: 0xC65053F2
加密原语: 写=FUN_006131F4, 读=FUN_00548806（初始密钥 0xBAADF00D）
```

## 三、关键地址表

| 全局 | 内容 |
|---|---|
| 0xBDDB10 | 动作表（149×0x18，名字见 MOTION-SLOT-NAMES.csv） |
| 0xBDD498 | Physics 对象（[+8]→19 个 double） |
| 0xBDF54C | field/地图对象 |
| 0xBE2000 | 字符串表 |
| 0xBA59B8 | 攻击变体表（18×0x10） |

## 四、move 对象槽位表

| 槽对 | 内容 | 加密 |
|---|---|---|
| +0x20 | x 坐标 | ✅ |
| +0x38 | y 坐标 | ✅ |
| +0x50 | vx 速度 | ✅ |
| +0x68 | vy 速度 | ✅ |
| +0x110 | 立足点指针（几何明文） | — |
| +0x150 | 水平键 (-1/0/1) | — |
| +0x190 | 跳分母来源 | ✅ |
| +0x198 | 跳分子来源 | ✅ |

## 五、WZ 数据管线

```
WZ 文件 → NameSpace.dll（内存映射）→ ResMan.dll（缓存）
  → Canvas.dll（精灵: origin/Property/delay）→ Gr2D_DX8.dll（D3D8 渲染）
```

用 wzpy 解析 WZ：
```python
from wzpy import WzFile
wz = WzFile.open('Character.wz', region='EMS')  # 注意是 EMS！
```

## 六、协议速查

- c2s: 365 opcodes 映射 + 104 Java 方法读序
- s2c: 303 writer 写序（MaplePacketCreator）
- 合成客户端：`scripts/t056_client.py`

## 七、实现就绪度

| 系统 | 就绪度 |
|---|---|
| 登录流程 | 98% |
| 移动物理 | 95% |
| 角色选择 | 95% |
| 聊天 | 90% |
| 小地图 | 90% |
| NPC/物品/社交/商店 | 85% |
| 任务 | 80% |
| 技能/宠物 | 75% |
| 战斗 | 70% |
| 地图渲染 | 70% |
| UI 窗口 | 65% |
| 音频 | 60% |

## 八、查询工具

| 需要查什么 | 用什么 |
|---|---|
| 某函数的特征 | FUNCTION-FINGERPRINTS.csv |
| 某函数的类别 | FINAL-CLASSIFICATION.csv |
| 某模块的成员 | WAVE5-MODULES-V2-DETAIL.json |
| 某 handler 的包格式 | ATLAS-PACKET-FORMATS.csv |
| 物理常数 | MAP-PHYSICS-FIELDS.md |
| 地图数据结构 | RENDER-MAP-SCENE-CONTRACT.md |
| 服务器发包格式 | WAVE15-S2C-WRITERS.csv |
| 攻击系统 | HIT-RANGE-SKILL-TABLE.md |
| 综合知识 | KNOWLEDGE-BASE-INDEX.json |

## 九、已知的不可达项（诚实边界，2026-11-12 更新）

| 项 | 原因 |
|---|---|
| ~~DLL 虚表方法~~ | ✅ **已推翻**——虚表静态提取成功（48 表/2,219 槽，见 DLL-VTABLE-ATLAS.md） |
| 逐调用点确定绑定 | 栈变量分组是候选级；确定绑定需数据流/运行时 |
| 字符串表 ID→名 | 访问器经壳混淆，进图转储可解 |
| 部分深层 c2s | 委托链 >4 层，需运行时追踪 |

### 虚表速查（新增）
- Gr2D@0x2f2cc = 132 槽绘制分派（33 图元 × 4 操作）
- NameSpace@0x17548 = WZ 导航接口（槽 7 = 路径解析核心 5.8K 字符）
- ResMan@0x70d0 = 资源管理（槽 7 = 加载器核心 11K 字符）
- exe 8,440 个接口调用点 → EXE-DISPATCH-RESOLVED.csv

### 盲区速查（新增）
- 语料库曾缺失 4.1MB 尾区（0x9d8046-0xdda000）→ 已用 capstone 100% 补齐（FRONTIER-DECOMPILED.csv）
- 盲区 = MSVC CRT + 10 个新子系统（宠物自动药水/飞行物理/MCPQ/划船/ViciousHammer/Gachapon/多宠物/3 个 UI 窗口）
- Physics.img 不止 19 常数：floatCoefficient/floatDrag1/flyJumpDec = 飞行物理

## 十、文件索引

全部 124 个资产文件在 `research/result/atlas/`，索引见 `ATLAS-INDEX.md`。
方法论见 `research/RESEARCH-HOWTO.md`（铁律 5 条 + 全部配方）。
