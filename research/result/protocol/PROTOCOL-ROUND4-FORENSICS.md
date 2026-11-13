# Protocol Round 4 取证（PROTOCOL-ROUND4-FORENSICS）

日期: 2026-11-13。

## 已闭合维持（不重复）

705 方法全谱（511 s2c + 87 c2s + 107 客户端）+ opcode 连接表 637 行 + environmentChange 类型码 + s2c 100% 覆盖。**全部维持。**

## 本轮增量

### 服务器 opcode 数值依赖澄清

- 467 个 opcode 名字来自 SendPacketOpcode/RecvPacketOpcode 枚举（364 文件 CFR 树）
- **数值不在盘上**：`ExternalCodeTableGetter` 从 properties 文件加载（R24 已证）
- 客户端侧确认值 = 100 个（task044 + ATLAS-PACKET-FORMATS 交叉）
- **不虚构服务器数值**（维持原则）

### 加密与校验维持

AES-256-ECB + 滚动密钥 0xC65053F2 + FUNNY_BYTES（全部 A 级旧档，无改动）。

### 状态机增量

CharacterTransfer.readExternal（103 读，R22）= 完整跨频道状态序列化——**登录→频道切换状态机的数据层终证**。

## PROTOCOL-OPCODE-EVIDENCE.csv

见附件（100 个确认值 + 来源标注；467 名字 vs 值缺口登记）。
