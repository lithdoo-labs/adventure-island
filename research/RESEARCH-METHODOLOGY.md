# 逆向方法论

## 1. 语料获取

### 1.1 游戏体恢复（Task 036 方式）
- QEMU 虚拟机 + Win7 x86 SP1
- 授权的宿主侧内存捕获（`pmemsave`）
- 10.3MB 游戏体在内存中物化后转储为 raw binary
- RVA == 文件偏移, 基址 0x400000 (PE 标准加载基址)
- 详细: `result/036-*`

### 1.2 服务端源码
- JAR 文件用 CFR 0.152 反编译: `java -jar cfr.jar JAR --outputdir DIR --silent true`
- 产出 364 个 Java 源文件, 7,507 方法
- 关键类: `MaplePacketCreator.java` (265 writer 方法), `MapleServerHandler.java` (159 dispatch cases)

### 1.3 WZ 数据提取
- 服务端已有 XML 格式 WZ: `.work/task-002/server/079V5/wz/`
- 不需要解析二进制 PKG1 格式——直接读 XML
- String.wz → 22,438 条目; Item.wz/Character.wz → 25,491 装备; Map.wz → 4,259 地图

## 2. 协议逆向

### 2.1 传输层
```
服务器首包 hello (15B)
  c2s word = 0x4F00 + hello[6:10]  (版本 79)
  s2c word = 0xB0FF + hello[10:14]
客户端必须在 SERVER_IP 重定向后关闭登录 socket
```

### 2.2 密码学
- AES-256-ECB 用于 OFB 模式, 密钥 32B word-swapped 格式
- 密钥: `130000000800000006000000b40000001b0000000f0000003300000052000000`
- 自定义滚动密码: 种子 0xC65053F2, 表@0xBD4130 (运行时计算)
- 解密原语: ReadByte(0x66C9), ReadInt16(0x259A2), ReadInt32(0x66FF), ReadString(0x71D7A), ReadBytes(0x431E77)
- 加密原语: WriteByte(0x661F), WriteInt16(0x291B3), WriteInt32(0x667C), EnsureCapacity(0x663D)
- 发送: SendPacket(0x95C5C), 构造: COutPacket_ctor(0x2F5E40)

### 2.3 合成客户端验证
- `scripts/maple079_packet.py` — 已验证的 codec
- `scripts/t055_syn_client_v2.py` — 完整登录→进场→聊天→移动
- 凭据: fl1234 / 123456, 登录端口 9555, 频道端口 7575

## 3. 函数语义恢复

### 3.1 Ghidra 反编译（最高效方法）
```bash
# 安装
scoop install ghidra
scoop install temurin-lts-jdk  # Java 21+

# 导入和分析
$env:JAVA_HOME = "$env:USERPROFILE\scoop\apps\temurin-lts-jdk\current"
& "$env:USERPROFILE\scoop\apps\ghidra\current\support\analyzeHeadless.bat" `
    E:\ghidra-projects cms079 `
    -import .work\task-036\game-image-unpacked.bin `
    -processor x86:LE:32:default -loader BinaryLoader `
    -loader-baseAddr 0x400000 -cspec windows
```

### 3.2 关键 VA→RVA 陷阱
⚠️ **用户分析文档用 VA (如 0x9BD58F), Ghidra 输出用 RVA (= VA - 0x400000 = 0x5BD58F)。始终检查你用的是哪种地址！**

### 3.3 Ghidra unicode 字符串标签
Ghidra 自动给 UTF-16LE 字符串起标签: `u_walkForce_00bd40fc`。这些标签名就是 WZ 属性名！搜索反编译代码中的 `[us]_` 模式可以提取所有字段名。

### 3.4 覆盖率提升路径
1. 调用图传播 (Task 058): 26% → 61%
2. 字符串/常量/服务端对齐 (Task 059 ABC): 61% → 71%
3. Ghidra v1 反编译模式匹配 (Task 059 D): 71% → 93%
4. Ghidra v2 + 符号替换 (Task 060): 93% → 95.3%

## 4. 移动物理逆向

### 4.1 关键发现方法
- 搜索反编译代码中的 `FUN_00XXXXXX` 引用找到包含函数
- 从包含函数中提取 WZ 属性名（unicode 标签）
- 追踪加密调用链: `FUN_006131F4`(写) ↔ `FUN_00548806`(读) ↔ `FUN_006A0545`(解密)

### 4.2 已确认的加密调用链
```
速度写入: FUN_006131F4(value, target_ptr) → 解密后写入 target
速度读取: FUN_00548806(cookie_ptr, cookie_val) → 解密后返回 double
WZ 属性解密: FUN_006A0545(property_node) → 返回解密后的 double
```

### 4.3 Physics.img 字段
全部 20 个字段名已从 Ghidra unicode 标签提取:
`flyJumpDec, swimSpeedDec, minFriction, maxFriction, jumpSpeed, fallSpeed, gravityAcc, flySpeed, flyForce, swimSpeed, swimForce, floatCoefficient, floatDrag1, floatDrag2, slipSpeed, slipForce, walkDrag, walkSpeed, walkForce`

加载函数: 0xA4D393 (footholdMgr 构造函数), 路径 "Map/Physics.img"

## 5. 服务端交叉验证

### 5.1 Handler → Writer 对齐
- 客户端 handler 读 s2c 包字段
- 服务端 MaplePacketCreator 写 s2c 包字段
- 匹配两边的 read/write 序列可以对齐字段名

### 5.2 关键服务端文件
| 文件 | 内容 |
|---|---|
| `MapleServerHandler.java` | 159 dispatch cases (所有 opcode 路由) |
| `MaplePacketCreator.java` | 265 writer 方法 (所有出站包构造) |
| `PlayerHandler.java` | 移动/攻击/物品使用 |
| `DamageParse.java` | 伤害计算和验证 |
| `PlayerStats.java` | 属性公式 (calculateMaxBaseDamage) |
| `GameConstants.java` | 经验表/游戏常量 |

## 6. 伤害公式

```
最大伤害 = (主属性 × 5.0 + 副属性) × 武器攻击力 ÷ 100
伤害上限 = 199,999 + VIP等级 × 1,000,000
```

主属性/副属性由武器类型决定:
- 弓/弩: DEX/STR
- 爪/短剑(盗贼): LUK/(DEX+STR)
- 法杖/魔杖: INT/LUK
- 剑/斧/锤(战士): STR/DEX
