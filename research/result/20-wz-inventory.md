# Task 022 — WZ 目录级清单（16× PKG1 归档）

> 执行日期：2026-10-10（glm-work 会话 3）
> 方法：采用成熟解析库 **wz-python**（`wzpy`，MIT，来源 <https://github.com/Leonana69/wz-python>，commit `79344c95774a911adf93a4d43c67e5fc51fa6e76`，2026-10-09；取至 `.work/tools/wz-python`，按仓库政策记录 URL+commit）——替代手写解析器，目录/元数据级使用
> 工具：`glm-work/scripts/maple079_wz_dir.py`
> 产物：`glm-work/result/wz-directory-index.csv`（16 行）
> 边界：仅目录/元数据，未提取内容物；样本只读

## 1. 关键发现

### 1.1 私服 IV 定位（一次试验三选一命中）

内置三区域 IV 逐一开样（判据=根条目名可打印率）：

| 区域 | IV | TamingMob.wz 根名 |
| --- | --- | --- |
| BMS | `00 00 00 00` | 乱码（`\u203aUy4I\xa4:m`） |
| GMS | `4D 23 C7 2B` | 乱码（`\r\xfbF\x90…`） |
| **EMS** | **`B9 7D 63 E9`** | **干净**（`0001.img`…`0016.img`） |

**该私服重打包 WZ 使用 IV `B9 7D 63 E9`**（恰为 wzpy 区域表中的 EMS 值；与其说"EMS 版"不如说私服作者选了这个 IV）。此 IV 即后续任何 WZ 字符串/属性解码的必用参数。

### 1.2 版本独立复核

16 个归档全部解析出 **version = 79**——与客户端握手版本字（Task 002：`4F 00`/79）第三方交叉一致。

### 1.3 目录树规模（Task 022 主体目标达成）

| 归档 | 根 img | 递归 img | 子目录（样例） |
| --- | --- | --- | --- |
| Base.wz | 4 | 4 | 15 个跨文件链接（Etc;UI;Character;Effect;Skill;Mob;Morph;Reactor;Map;TamingMob…） |
| Character.wz | 27 | **25,565** | Cap;Glove;Shield;Shoes;Hair;Face;Longcoat;Cape;Afterimage;Pants…（19 个） |
| Effect.wz | 17 | 17 | — |
| Etc.wz | 28 | 28 | — |
| Item.wz | 0 | 475 | Pet;Special;Etc;Cash;Consume;Install |
| Map.wz | 3 | **4,614** | Tile;Back;Obj;WorldMap;Map |
| Mob.wz | 1,614 | 1,617 | QuestCountGroup |
| Morph.wz | 182 | 182 | — |
| Npc.wz | 1,608 | 1,608 | — |
| Quest.wz | 6 | 6 | — |
| Reactor.wz | 463 | 463 | — |
| Skill.wz | 75 | 75 | — |
| Sound.wz | 48 | 48 | — |
| String.wz | 15 | 15 | — |
| TamingMob.wz | 16 | 16 | — |
| UI.wz | 27 | 27 | — |

合计 **~36,000 张 .img**；总数据量 ≈2.4GB（与 Task 001 基线文件清单一致）。完整字段见 CSV。

## 2. 与 NameSpace/PCOM 追踪线的关系（两套机制辨析）

- **PKG1 归档内**（本表）：字符串/属性用**固定 IV 的 AES 密钥流**（wzpy 路线，`B9 7D 63 E9`）——目录名在正确 IV 下干净解出，说明目录层**未启用**额外按名加密。
- **List.wz**（前节追踪）：非 PKG1 头（`05 00 00 00`）、由 NameSpace/PCOM 直读，其变换为**按名键控序列化**（入口名散列→键字节，最终落点 PCOM `0x7575` 族）——是**独立于标准 WZ 加密的客户端私有机制**，成熟库不覆盖，仍需 `0x7575` 反汇编收口。
- 两线合流点：Base.wz 的 15 个跨文件链接子目录即"命名空间树"在标准 WZ 侧的投影；PCOM `PcRootNameSpace` 消费的很可能就是 Base.wz 这组链接（下一验证点：对比 Base.wz 链接名与 List.wz ~370 条记录数的对应关系）。
- **验证点已核**（同会话）：Base.wz 链接名集合 = 其余 15 个 WZ 文件名集合，**双向零差**（`links-not-files: []` / `files-not-links: []`）——"Base.wz 链接 = 命名空间树投影"成立。List.wz 的 ~370 条记录则对应树内更深层节点（img 级），解码仍待 PCOM `0x7575`。

## 3. WZ 版本差异备注（Task 022 目标之一）

修改时间三组（2010-01 / 2016-05 / 2017-07，Task 001 基线）在目录层未表现出版本分歧：16 文件同为 PKG1/v79/EMS-IV——时间差异是私服历次重打包所致，非格式代差。

## 3.1 Q11 收口：List.wz 完全解码（会话 3 续，2026-10-10）

**格式全部恢复**（`scripts/maple079_listwz.py` → `listwz-entries.csv`）：

- 文件**无独立头**——开头 `05 00 00 00` 就是首记录的长度 dword（首记录名=`dummy` 占位）。
- 记录 = `[0–2 字节类型前缀]（绝大多数 `AC 52`，首条无）[dword 名长][名长×2 字节 UTF-16LE 路径]`。
- 路径加密 = **WZ AES 密钥流（私服 IV `B9 7D 63 E9`）逐串从索引 0 连续异或**（`plain[i] = enc[i] ^ ks[i]`，每条记录复位）。此前 12 种均匀 KPA 失败的根因：①密钥流是 AES 派生而非简单变换；②逐串复位使得跨记录相位不齐。
- **1,258 条记录、零间隙、覆盖 65,468/65,470 字节**；内容 = **外链 img 挂载表**（客户端把独立 .img 文件挂进命名空间）：character 513 / map 297 / mob 184 / npc 104 / item 47 / reactor 25 / skill 22 / etc 17 / string 13 / ui 13 / morph 11 / effect 5 / quest 4 / tamingmob 1。
- 与 NameSpace/PCOM 追踪线互证：`Open` 的宽名散列键走的就是这张表的条目名；PKG1 内嵌条目（~36k）与外链条目（1,258）共同构成完整命名空间。解码由密钥流相位扫描定位（16 字节"常量"块在相位 0 解出宽串 `characte` 而破题）。
- 修正前节两处中间结论：①"~370 条记录"实为 **1,258** 条（早年计数被截断）；②"16 字节固定签名"实为密文前缀（所有 `character/*` 条目共享明文前缀所致）。

## 4. 复现

```text
git clone --depth 1 https://github.com/Leonana69/wz-python .work/tools/wz-python
python glm-work/scripts/maple079_wz_dir.py    # → wz-directory-index.csv
```
