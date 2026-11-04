# CMS079 客户端逆向工程战役总参考
## Campaign Master Reference (Tasks 028-054)

日期：2026-10-20 · HEAD `530be7b`

---

## 1. 战役总览

| 任务 | 主题 | 判定 | 核心成果 |
|---|---|---|---|
| 028-031 | 基础设施 | ✅ | PE/引擎DLL/提取管线 |
| 032 | 服务端协议 | ✅ | 登录链路证明、codec 算法 |
| 033 | 登录→频道链 | ✅ | 完整协议链、s2c 重编号发现 |
| 036 | 游戏体恢复 | ✅ | 10.3MB 物化镜像（QEMU 授权捕获） |
| 038 | 加密家族 | ✅ | AES 标准 S-box 证实（堆驻留） |
| 042 | NIC 分叉 | ✅ | F:/G: 保护器路径分叉 |
| 045 | 密钥搜索 | ✅ | 3 种形式全零（预登录证明） |
| 048 | s2c 重编号 | ✅ | sendops.properties 217 wire 值 |
| 049 | 三层分发 | ✅ | 207 条目全图 |
| **050** | **语义深恢复** | **Stop B** | 44 工件、11 档案、S10×11 |
| **051** | **静态深水** | **Complete** | 装备 21 槽、70 类名、120 出站槽 |
| **052** | **客户端加密** | **Complete** | pump 全解、VM+NIC 上线 |
| **053** | **后登录捕获** | **Blocked** | 26 S-box 物化、保护器边界穷尽 |
| **054** | **总收官** | **本文档** | 战役参考、理论轮询 |

---

## 2. 传输与协议架构（完全解明）

### 2.1 线模型
```
服务器首包 hello (15B)
  c2s word = 0x4F00 + hello[6:10]  (版本 79)
  s2c word = 0xB0FF + hello[10:14] (版本 -80)
客户端必须在 SERVER_IP 重定向后关闭登录 socket
```

### 2.2 读/写原语家族（RVA）
| 原语 | RVA | 说明 |
|---|---|---|
| ReadByte | 0x66C9 | 1 字节 |
| ReadInt16 | 0x259A2 | 2 字节 |
| ReadInt32 | 0x66FF | 4 字节 |
| ReadString | 0x71D7A | 长度前缀字符串 |
| ReadBytes | 0x431E77 | N 字节通用块 |
| WriteByte | 0x661F | 1 字节（即 WriteHeader） |
| WriteInt16 | 0x291B3 | 2 字节 |
| WriteInt32 | 0x667C | 4 字节 |
| EnsureCapacity | 0x663D | 缓冲区扩展 |
| COutPacket ctor | 0x2F5E40 | 包构造 |
| SendWrapper | 0x95C5C | 发送 |

### 2.3 Pump 架构（RVA 0x95E7E 链）
```
recv → [sock+0x40] 队列 → 框架FSM(0x2F5896) → 提取(0x2F5811)
     → 校验(0x95EC2): (counter>>16)^salt == 0xFFB0 ← s2c 线词
     → IV 变换 → 包处理(0x95F83) → opcode 分发(0x610CE0)
     → 三层 handler（范围表 → band → JT）
```

---

## 3. 密码学架构

### 3.1 层次
| 层 | 算法 | 状态 |
|---|---|---|
| 传输 | AES-256-ECB (MapleAESOFB) | ✅ 密钥已知（JAR） |
| 载荷 | 自定义滚动（0xC65053F2 种子） | ✅ 结构已知 |
| 表 | @0xBD4130 (运行时计算) | ⏹ 需连接后捕获 |

### 3.2 AES 密钥（客户端=服务端，对称必须）
```
密钥（32B word-swapped 存储）:
130000000800000006000000b40000001b0000000f0000003300000052000000

理论 AES-256 轮询（240B）:
头部 32B: 130000000800000006000000b40000001b0000000f0000003300000052000000
尾部 32B: df6b11cfbb4e3d191f4ac24f0357087c14462a1f9ab3cb3da03dddcf9546e551
```

### 3.3 密码初始化生命周期（Task 053 实证）
```
客户端启动
  → 物化（AES S-box 表通过 Windows CryptoAPI 计算 ← 26 锚点在系统 DLL）
  → NIC 检查（保护器门：有网卡 → 杀会话）
  → [需无 NIC 通过此点]
  → 游戏窗口 → 连接（AES 轮询在此填充 ← 需握手）
  → 密码完整初始化
```

**物化捕获证据**（t053-mat.elf, 1.74GB）：
- 26 个 S-box 锚点全在系统进程（Windows CryptoAPI）
- 游戏进程内 0 个 S-box（T-table 实现，不含裸 S-box 块）
- 0 个密钥轮询（需服务器连接）
- 表@0xBD4130 全零（需服务器连接）

### 3.4 保护器边界（Task 053 五路穷尽）
| 方法 | 结果 |
|---|---|
| PCI e1000 | 客户端静默死 |
| USB-net | 同上 |
| 自定义 MAC | 同上 |
| 物化后热插 | 会话在可靠检测前死亡 |
| 无 NIC | 物化成功但无法连接 |

---

## 4. 对象模型（语义类）

### 4.1 核心类
| 类 | 单例/构造 | 字段数 | 关键字段 |
|---|---|---|---|
| CWvsContext | [0xBD9028] | 53 | +0x205C CharacterId, +0x2D30 buff, +0x2F38 buddy |
| CUserRemote | ctor 0x98CC52 | 17 | +0x1BB4 pet, +0x28BC buff, +0x28B0 miniroom |
| CCharacterStats | via GetStats | 8 | +0x13 level, +0x1B i64 trio |
| CItem 族 | factory 0xF2B2F | 5 类 | Equip 0xF9 / Use 0x4D / Setup 0x79 |
| CShopSession | [0xBD9020] | 0x5F4B | +0xB4 npcId |
| CKeymapUI | [0x3D95C] | 89×5 | +0x4 live / +0x1C1 shadow |
| CClientSocket | [0xBD9024] | 34 | +0x40 queue / +0x68 stream |

### 4.2 语义类总计
- 高置信语义类：24
- 结构 vtable 类：179（其中 70 有上下文标签）
- 定位单例：16

---

## 5. 分发架构（三层）

```
第一层：范围表（0x20-0x80）直接槽位
第二层：band 分发器
  0x57F64C (spawn 0xA2-0xED)
  0x2A6AB0 (mob 0xEE-0x103)
  0x2CB061 (npc 0x104-0x10C)
  0x63E008 (family 0x64-0x72, JT)
第三层：JT 子分发
  0x5571BF (0xCF-0xEC, 30 case)
  0x53F052 (0xD0 外观特效, 27 case)
  0x53DC3E (0xD0, 二分搜索 50+)
```

---

## 6. 包 Schema 精选（手工验证）

| 包 | 方向 | Schema |
|---|---|---|
| CHATTEXT | s2c | [band id i32][type u8][name str][flag u8][self: extra str] |
| SPAWN_PLAYER | s2c | decodeAvatar: u8,str,str,i16,u8,i16,u8,buff,i16,... |
| WARP_TO_MAP | s2c | id i32, grade u8, u8, u8, count i16, {str}, [tail] |
| UPDATE_STATS | s2c | flag u8, mask i32, {bit→field} |
| MODIFY_INVENTORY | s2c | flag u8, op_count u8, {mode,slot,arg} |
| KEYMAP | s2c | mode u8, {5B×89} |
| OPEN_NPC_SHOP | s2c | npcId i32, count i16, {itemId,price,tier} |
| EQUIP decode | item | [itemId i32][flag u8][u8×2][i16×16 stride-8][u8×2] |

---

## 7. 战役约束与边界

### 已穷尽（静态）
- sender 溯源：390/486（80%）——剩余 96 经运行时计算分派
- 字段归因：29 promoted + 347 locator（经 vtable-this 访问）
- 出站槽位：120 语义化（参数/常量/串长）

### 已穷尽（动态）
- 保护器 NIC 检测：5 种方法全部触发
- AES 轮询：预握手不存在（物化捕获证实）

### 需后续战役
- 后登录捕获（需绕过保护器——超出当前授权）
- 96 sender 尾部（需动态或反编译 IR）
- 169 VClass 语义命名（需深度数据流）

---

## 8. 语料与工具

| 资产 | 位置 |
|---|---|
| 客户端样本 | .work/task-001/extracted/冒险岛online/ (SHA-256 5d280cf1...) |
| 游戏体镜像 | .work/task-036/game-image-unpacked.bin (10.3MB) |
| 物化捕获 | .work/task-053/captures/t053-mat.elf (1.74GB) |
| 语义 DB | .work/task-050/db/ (51K 函数, 146K 边) |
| 包 codec | scripts/maple079_packet.py |
| 合成客户端 | scripts/maple079_syn_client.py |
| VM 控制 | scripts/t053_vm_control.py |
| 捕获分析 | scripts/t053_capture_analyze.py |
| VM 存储 | E:\vm-store\ (junction 回链) |

---

*本战役从 2026 年 10 月 13 日（Task 028 基础设施）至 10 月 20 日（Task 054 收官），
共 27 个任务，产出 200+ 归一化工件。*
