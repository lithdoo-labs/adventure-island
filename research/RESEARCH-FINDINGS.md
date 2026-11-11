# 核心发现汇总

## 1. 协议栈（完整解明）

### 1.1 Wire 模型
- 4 字节头: [seq_word(2B)][length(2B)]
- seq_word 是 XOR 校验 (c2s=0x4F00, s2c=0xB0FF)
- 包体经过 AES-OFB + 自定义滚动密码加密

### 1.2 Pump 架构 (RVA)
```
recv → [sock+0x40] 队列 → 框架FSM(0x2F5896) → 提取(0x2F5811)
     → 校验(0x95EC2): (counter>>16)^salt == 0xFFB0
     → IV 变换 → 包处理(0x95F83) → opcode 分发(0x610CE0)
     → 三层 handler（范围表 → band → JT）
```

### 1.3 三层分发架构
```
第一层: 范围表 (0x20-0x80) 直接槽位
第二层: band 分发器
  0x57F64C (spawn 0xA2-0xED)
  0x2A6AB0 (mob 0xEE-0x103)
  0x2CB061 (npc 0x104-0x10C)
第三层: JT 子分发
  0x5571BF (0xCF-0xEC, 30 case)
  0x53F052 (0xD0 外观特效, 27 case)
```

## 2. 密码学

| 层 | 算法 | 状态 |
|---|---|---|
| 传输 | AES-256-ECB (OFB) | 密钥已知, 合成客户端验证 |
| 载荷 | 自定义滚动 (0xC65053F2) | 结构已知 |
| 表 | @0xBD4130 | 运行时计算, 预登录为全零 |

## 3. 对象模型

### 3.1 核心类
| 类 | 单例/构造 | 关键字段 |
|---|---|---|
| CWvsContext | [0xBD9028] | +0x205C CharacterId, +0x2D30 buff, +0x2F38 buddy |
| CUserRemote | ctor 0x98CC52, 0x3500B | +0x1BB4 pet, +0x28BC buff, +0x28B0 miniroom |
| CCharacterStats | via GetStats | +0x13 level, +0x1B/23/2B i64 |
| CItem 族 | factory 0xF2B2F | Equip 0xF9 / Use 0x4D / Setup 0x79 |
| CClientSocket | [0xBD9024] | +0x40 queue, +0x68 stream |
| CKeymapUI | [0x3D95C] | +4 live(89×5), +0x1C1 shadow |

### 3.2 Physics 参数 (footholdMgr)
- 全局: [0xBDD498] → [+8] = 参数对象
- 20 个 WZ 属性从 "Map/Physics.img" 加载 (函数 0xA4D393)
- **+0x70 = jumpSpeed, +0x48 = swimSpeed, +0x58 = flySpeed, +0x60 = gravityAcc**
  （修正：早期版本误标为 gravityAcc/walkForce/walkSpeed，见 MAP-PHYSICS-CORRECTION.md）

## 4. 移动物理

### 4.1 跳跃公式（指令级，MAP-MOTION-REVERSE.md 为准）
```
陆跳 vy = -(decrypt([move+0x198]+0x48) × Physics[+0x70=jumpSpeed]) / decrypt([move+0x190]+0x24)
下跳 vy = decrypt([move+0x190]+0x24) / (Physics[+0x70=jumpSpeed] × -0.35355339)，水平速度写 0
水中跳：指令记录中无式子形状（未解决）
decrypt 两个字段名：未解决
```
注：常数 0.3/0.5/1.3 乘的是移动对象 +0x150（水平键 -1/0/1），不是水中跳参数。

### 4.2 已确认常数
| 地址 | 值 | 含义 |
|---|---|---|
| 0xB0C590 | -0.35355339 | -√2/4，下跳分母系数 |
| 0xB04F40 | 5.0 | 行走力放大 |
| 0xB06458 | 0.7 | 二次跳衰减 |
| 0xB064B0 | 1.3 | 水平键分支乘子 |
| 0xAFEC18 | 0.8 | 速度上限因子 |
| 0xB05538 | 0.3 | 水平键分支乘子 |
| 0xAFEC20 | 0.5 | 水平键分支乘子 |

### 4.3 加密速度读写链
- 写入: `FUN_006131F4(value, target)` → 速度字段 + 校验字段
- 读取: `FUN_00548806(cookie_ptr, cookie_val)` → 返回解密 double
- 槽对起点: x @ +0x20, y @ +0x38, vx @ +0x50, vy @ +0x68（指令级）

## 5. 游戏数据

### 5.1 装备 (25,491 items)
- `result/task057-equipment-stats.csv`
- incSTR ×4,429, incPAD ×6,009, reqLevel ×15,983

### 5.2 字符串 (22,438 entries)
- `result/task057-string-data.csv`
- Consume 12,451, Mob 1,690, Npc 1,564, Skill 596

### 5.3 地图 (4,259 maps)
- `result/task060-map-summary.csv`
- 18,339 portals, 30,827 mob spawns, 3,174 NPC spawns
- 5,505 map graph edges (portal connections)
- 359,124 footholds (collision line segments)

## 6. 伤害公式
```
最大伤害 = (主属性 × 5.0 + 副属性) × 武器攻击力 ÷ 100
伤害上限 = 199,999 + VIP × 1,000,000
MaxMP += INT ÷ 10
```

## 7. 已验证游戏流程
```
login(port 9555) → LOGIN_PASSWORD → LOGIN_STATUS
→ SERVERLIST → CHARLIST → CHAR_SELECT(id=25)
→ SERVER_IP redirect → channel(port 7575)
→ PLAYER_LOGGEDIN → WARP_TO_MAP + SPAWN_PLAYER + KEYMAP + 15种更多
→ chat/move/emotion → PONG keepalive
```

## 8. 已知单例
| 地址 | 名称 |
|---|---|
| 0xBD9028 | CWvsContext |
| 0xBD9024 | SocketSingleton |
| 0xBDD8A8 | VersionObj |
| 0xBDF54C | Delegate |
| 0xBDD4A0 | LocalAvatarHolder |
| 0xBD9020 | CShopSession |
| 0xBDD498 | FootholdManager (物理参数) |
| 0xBE1DE0 | PoolAllocator |
