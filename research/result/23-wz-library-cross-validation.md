# Task 023 — 第三方 WZ 解析库交叉验证

执行对象是 CMS079 客户端里的 16 个 PKG1 归档和 `List.wz`。样本 SHA-256 与 `result/file-manifest.csv` 逐文件一致后，才复用既有结论。第三方源码、构建产物和原始导出留在 `.work/task-023/`，不进入本提交。

多个 MapleStory 社区库共享同一段历史格式知识。下面的一致是工程交叉验证，不是彼此独立的数学证明。

## 1. 起点

| 标记 | SHA | 含义 |
| --- | --- | --- |
| 同步门 HEAD | `cb475f573070b45c8e8b739819161ad433bc203e` | `git pull --ff-only origin main` 之后、Task 012c 提交之前。Task 023 任务书已在树上。 |
| 实验基线 | `190fb7f4a104260581d0a4ff0cd17a312b0d85e9` | 已推送的 Task 012c 提交。本次实验和本结果都从这里继续。 |

完成提交是 `190fb7f` 的子提交。SHA 记在执行报告里，不写进本文件，避免提交哈希引用自身。

## 2. 样本身份

17 个文件的 SHA-256 全部等于 `result/file-manifest.csv`。

| 文件 | 字节 | SHA-256 |
| --- | ---: | --- |
| Base.wz | 8885 | `8040f3ab36d2fb02b31ae04d794f36699c0f6c58e5cd7b87cd81d361da0aad7d` |
| Character.wz | 1238707905 | `d55303588b10a8a5b76f1bd065c238447c708af21c5f55cd319a3ae9db646074` |
| Effect.wz | 142666079 | `46702f06c45a3198c36d810aabc4241ad267ee30346f541b76d802b64078ad82` |
| Etc.wz | 19435393 | `5177d6ac654aeac1e3db83a1f98445df26c80472bc75fb43e3ea41337e25bc6f` |
| Item.wz | 139053911 | `0c58678973dbcdd12e5d936e03a060ee606f80416722dbb530797a8584a182d3` |
| Map.wz | 835954262 | `9e0d2a0fcecac2c99ee3cb15b03c41b5617d7d0637b55fb132f0eeed27155f69` |
| Mob.wz | 421628507 | `6d5503fb78ec5a94f9f714d8712ab36b47257ac0b9ad8640e016e10fe67826ec` |
| Morph.wz | 35707082 | `e9461b90aae1a46e1f41b527a1232974408b8bbb802a5df36868df10f24efe90` |
| Npc.wz | 53772873 | `19562193d7cb93213110f4a54cc62568ec536251e8b7d546bd3915b3a009df65` |
| Quest.wz | 3726297 | `48716b137d84b7e80dc4e6a4ef7e1cf4f908e90370d48ad4cb9aad9052fbeffe` |
| Reactor.wz | 85233536 | `68786bf5d7530eca7519d7bdebd0c3dbd6a13a0193c2e984c2e82d12d4a17e20` |
| Skill.wz | 74821220 | `c23c1409ec801c89b5bbc13308014c202efbfb3002efb4da7f33359f0430323f` |
| Sound.wz | 366212494 | `d1a9fd213173d531d9710d6f568eb5e4d1a7fa390ed50fa7fcbb35b98f981505` |
| String.wz | 9608592 | `76aa28a540296c91633f097c9429caa2f16e0f7d0a8d9d0f449192ec51abc510` |
| TamingMob.wz | 1876 | `64756585542455417e2de696395700e430a2510bd45cc1a4c22677cb273953a4` |
| UI.wz | 33744089 | `f5d804c30a707c968d1d7d1f522935cd7c3fd455e3d02891e996abc7c033848d` |
| List.wz | 65470 | `1a9bed23d87213545e2ce40765ca45e1b5464659c21bb7276d924edc2eb0cc9e` |

## 3. 库、IV 与版本

来源、许可证和构建命令见 `result/wz-third-party-sources.csv`。能力矩阵见 `result/wz-parser-capability-matrix.csv`。记录的是实际 IV 字节，不是枚举名。

| 库 | 正样本枚举 | 实际 IV | 打开 | 版本 | 根名可打印率 |
| --- | --- | --- | ---: | ---: | --- |
| wz-python | EMS | `B9 7D 63 E9` | 16/16 | 79 | 16 个归档全部 `1.000000` |
| wz-python | BMS | `00 00 00 00` | 16/16 | 79 | 16 个归档全部 `0.000000` |
| wz-python | GMS | `4D 23 C7 2B` | 16/16 | 79 | 16 个归档全部 `0.000000` |
| MapleLib | EMS | `B9 7D 63 E9` | 16/16 | 79 | 16 个归档全部 `1.000000` |
| MapleLib | BMS | `00 00 00 00` | 16/16 | 79 | 不是全 0。TamingMob.wz `1.000000`，Morph.wz `0.923077`，Skill.wz `0.346667`，Base.wz `0.052632`，其余为 0 |
| MapleLib | GMS | `4D 23 C7 2B` | 16/16 | 79 | 最高 Base.wz `0.052632`，没有归档达到 1 |
| WzComparerR2 | KMS | `B9 7D 63 E9` | 16/16 | 79 | 16 个归档全部 `1.000000` |
| WzComparerR2 | BMS | `00 00 00 00` | 16/16 | 79 | 16 个归档全部 `0.000000`。BMS 在该库里是零密钥流 |
| WzComparerR2 | GMS | `4D 23 C7 2B` | 16/16 | 79 | 16 个归档全部 `0.000000` |

三个库都报告版本 79。错误 IV 下递归 img 数量仍然是 34,760，所以数量本身不能证明密钥。能同时满足“三个库、16 个归档、可打印率恰好为 1”的只有 `B9 7D 63 E9`。wz-python 与 WzComparerR2 的错误 IV 负对照是全 0。MapleLib 的根名过滤器在少数小归档上会把错误 IV 也判成部分可打印，不能单独当负对照。

目录遍历耗时（16 个归档合计，只走目录，不含属性展开）：wz-python EMS 141 ms；MapleLib EMS 75 ms；WzComparerR2 KMS 71 ms。

HaRepacker-resurrected 没有单独克隆。MapleLib 就是它调用的库，本任务直接调用 MapleLib。可选的 wzlib-rs 因本机没有 `rustc` 没有构建，不阻塞结论。

## 4. 目录树与 Base.wz 链接

正样本 IV 下，三个库的递归 img 数量和排序路径 SHA-256 全部相同。`result/wz-tree-digests.csv` 有 48 行（16 归档 × 3 库），16 个归档各自只有一个摘要。`result/wz-tree-crosscheck.csv` 的 48 组成对路径差都是 `only_left_count=0`、`only_right_count=0`，分类 `match`。错误 IV 的路径集合没有导出；负对照用第 3 节的可打印率。

合计 **34,760** 个 `.img`，与 `result/wz-directory-index.csv` 的逐归档计数一致：

| 归档 | img | 归档 | img |
| --- | ---: | --- | ---: |
| Base.wz | 4 | Npc.wz | 1608 |
| Character.wz | 25565 | Quest.wz | 6 |
| Effect.wz | 17 | Reactor.wz | 463 |
| Etc.wz | 28 | Skill.wz | 75 |
| Item.wz | 475 | Sound.wz | 48 |
| Map.wz | 4614 | String.wz | 15 |
| Mob.wz | 1617 | TamingMob.wz | 16 |
| Morph.wz | 182 | UI.wz | 27 |

Base.wz 在三个库里都是 15 个空目录，子节点数都是 0，外加 4 个根 img：`StandardPDD.img`、`zmap.img`、`zmap_cn.img`、`smap.img`。链接名去掉不存在的 `.wz` 后缀后，与另外 15 个归档文件名双向差为空：

`Etc`、`UI`、`Character`、`Effect`、`Skill`、`Mob`、`Morph`、`Reactor`、`Map`、`TamingMob`、`Quest`、`Npc`、`Sound`、`String`、`Item`。

`links-not-files` 与 `files-not-links` 都是空集。这 3 行也在 `wz-tree-crosscheck.csv` 里，分类 `match`。

## 5. 属性样本

样本由排序路径上的固定步长选出，并强制包含 `TamingMob.wz/0001.img`。String.wz 配额 20，归档里只有 15 张 img，实际取满。合计 200 张：

Character 30，Map 30，Mob 25，Npc 20，Item 20，UI 20，String 15，Skill 15，TamingMob 10，Effect 3，Etc 3，Reactor 3，Quest 2，Morph 2，Sound 2。

三个库在每个归档边界上的累计节点数相同，最终都是 **558,811**。展开顺序的累计值：Character 13848，Map 77077，Mob 82152，Npc 83212，Item 113183，String 415337，UI 453327，Skill 486924，TamingMob 486990，Effect 490688，Etc 496272，Quest 558010，Reactor 558286，Morph 558778，Sound 558811。

严格三方类型加值一致：**554,365 / 558,811 = 99.2044%**。不一致的 4,446 行都留在 `result/wz-property-crosscheck.csv`。

| 状态 | 行数 | 含义 |
| --- | ---: | --- |
| `wcr2-empty-property-as-null` | 4445 | wz-python 与 MapleLib 都是空 `subproperty`。WzComparerR2 把 0 个子节点的 Property 存成空值节点，适配层标成 `unknown`。例子：`Character.wz` `Glove/01082472.img` `rope/1`，wz-python 类型是 `WzSubProperty`，子节点数 0。 |
| `mismatch` | 1 | `Quest.wz` `Act.img` `6034/0/skill/0/acquire`。wz-python 是 `WzShortProperty`，值为 `-1`；MapleLib 也是 `-1`；WzComparerR2 是 `1`。该库把标签 `0x0B` 读成 `ReadInt16() != 0`，wz-python 把标签 11 读成 int16。 |

把这 4,445 行只看作类型标签差异后，标量一致率是 **558,810 / 558,811 = 99.999821%**。两边都满足任务书：差异被保留，标量一致率高于 99.9%。没有因为两个库一致就删掉第三方的不同读法。

这 200 张 img 里还有 8,782 个 UOL，`_inlink` 与 `_outlink` 都是 0。这个 0 只描述该样本，不外推到全部 34,760 张 img。

## 6. Canvas 与 Sound

Canvas 从上述属性游走里按图轮转取 50 个节点，比较的是 RGBA8888 像素的宽、高和 SHA-256，不是 PNG 文件字节。三个库 **50/50** 一致，`result/wz-canvas-crosscheck.csv` 没有错误行。WzComparerR2 的新版 Canvas 布局读取器仍然解出了这 50 个 v79 画布，并与另外两个库的像素摘要相同。

可选的 Sound 测试也做了。20 个节点的时长、载荷长度和压缩载荷 SHA-256 三方一致，见 `result/wz-sound-crosscheck.csv`。原始音频没有提交。

## 7. UOL

60 条原始链接字符串三方一致，`raw_match=60`。没有 `_inlink` / `_outlink` 样本。解析目标三方完全一致的是 **54/60**。其余 6 条记在 `result/wz-link-crosscheck.csv`，状态 `mismatch`。不支持计数为 0；失败记为 `broken`，不记成“库不支持”。

| 位置 | 原始串 | wz-python | MapleLib | WzComparerR2 |
| --- | --- | --- | --- | --- |
| Character `Accessory/01003561.img` `alert/0/../../default/default` | `../../default/default` | `default/default` | broken | broken |
| Item `Cash/0528.img` `05281001/effect/25` | `1` | `effect/1` | broken | `effect/1` |
| Item `Pet/5000046.img` `stunned/10` | `2` | `stunned/2` | broken | `stunned/2` |
| Mob `5200000.img` `stand/2` | `0` | `stand/0` | broken | `stand/0` |
| UI `UIWindow.img` `MobGage/Mob/9420544` | `9420542` | `Mob/9420542` | broken | `Mob/9420542` |
| UI `tutorial.img` `29/24` | `23` | broken | 图像根 `23` | 父节点相对 `29/23` |

不含 `..` 的短路径上，wz-python 与 WzComparerR2 按父节点相对路径解析，MapleLib 按图像根绝对路径查找，所以后四条里它失败、前一条它命中了根上的 `23`。`../../default/default` 只有 wz-python 解析成功。

## 8. List.wz

本地解码器 `scripts/maple079_listwz.py` 写出 1,258 条有序路径。有序摘要：

`d8d1b437017610be37b277eccb95c49bdb75be01e42c707ded60966149eb1c4e`

规范化斜杠后的摘要与原始摘要相同。首条是 `dummy`，末条是 `ui/uiwindow.img`。

| 实现 | IV | 条数 | 有序摘要 | 结论 |
| --- | --- | ---: | --- | --- |
| 本地 `maple079_listwz.py` | `B9 7D 63 E9` | 1258 | `d8d1b437…1c4e` | 基线 |
| MapleLib EMS | `B9 7D 63 E9` | 1258 | 与基线相同 | **1258/1258 有序精确匹配** |
| MapleLib BMS | `00 00 00 00` | 1258 | `6194b63e…b470` | 条数相同，内容不同 |
| MapleLib GMS | `4D 23 C7 2B` | 1258 | `5ca23267…6b4f` | 条数相同，内容不同 |
| WzComparerR2 KMS | `B9 7D 63 E9` | 1257 | `4caa5768…6722` | 丢掉首条 `dummy`；其余 1,257 条与 `local[1:]` 逐条同序 |

MapleLib 的公开 `ListFileParser` 没有被改。它按 `[int32 长度][UTF-16][uint16]` 读取，然后把最后一条的最后一个字符改成 `g`。本文件的 2 字节类型前缀正好落在它期待的 uint16 位置上，文件末尾还剩 2 字节（65,470 中的 65,468 已被本地解码覆盖），所以对齐成立。末条 `ui/uiwindow.img` 本来就以 `g` 结尾，改写是空操作。因此这是一次真实的 1,258 条确认，同时依赖这两个库行为。若末条不以 `g` 结尾，公开 API 会改掉它。

WzComparerR2 的 `LoadListWz` 丢掉字面量 `dummy`，并自动选择 KMS。它不是 1258/1258。去掉首条之后的有序内容与本地表一致，说明密钥流是对的，接口少了一条占位记录。

错误 IV 仍返回 1,258 条，摘要不同。这是 List.wz 的负对照。BMS/GMS 的逐条差异保留在 `result/listwz-library-crosscheck.csv`。

## 9. 对既有结果的核对

`scripts/maple079_listwz.py` 与 MapleLib EMS 的有序摘要相同，没有发现解码错误。`scripts/maple079_wz_dir.py` 的版本 79 和逐归档 img 计数与三个新库一致，没有发现目录计数错误。

`result/20-wz-inventory.md` 第 2 节写过“List.wz 是成熟库不覆盖的私有机制”。本任务用未修改的 MapleLib 公开 API 得到了 1258/1258 匹配，这句话被本次实验取代。本地解码器本身没有因此被判错。

解析器核心没有打补丁。WzComparerR2 样本打开时设置了 `ImgCheckDisabled=true`，这是适配层开关。校验和开启时，`TamingMob.wz/0001.img` 的默认 `TryExtract` 返回成功。

## 10. 角色选择

**Primary automation：wz-python `79344c9`。** Python 可直接编排，16 个归档、34,760 条路径、558,811 个属性节点、50 个 Canvas 和 20 个 Sound 都与 MapleLib 对齐。UOL 相对路径也与 WzComparerR2 在 4 条短路径上一致。它不解析本客户端的 `List.wz`。

**Correctness oracle：MapleLib `580146f`。** 它在标量 `-1`、List.wz 1,258 条有序路径、Canvas 像素和 Sound 载荷上给出了独立确认。UOL 默认按图像根解析，不能把它的解析结果当成相对路径真值。构建需要 net10.0-windows，比 wz-python 重。

**Secondary oracle：WzComparerR2.WzLib `6212518`。** 目录、版本、IV 字节、路径摘要、Canvas 和 Sound 与前两个库一致。保留两处差异，不把它当成标量或 List.wz 的最终真值：标签 `0x0B` 被收成布尔值；`LoadListWz` 丢掉 `dummy`。空 Property 在节点值上表现为 null。

**仍需项目自己的代码：**

- `List.wz` 的 0–2 字节类型前缀和逐条重置的密钥流。MapleLib 对本文件匹配，是因为前缀落进它的 uint16 槽，且末条已经以 `g` 结尾。显式解码仍由 `scripts/maple079_listwz.py` 负责。
- UOL 相对路径策略。三个库的解析函数并不等价。
- 不要用 WzComparerR2 的 `0x0B` 结果作为 short/int 真值。

## 11. 永久产物

```text
result/23-wz-library-cross-validation.md
result/wz-third-party-sources.csv
result/wz-parser-capability-matrix.csv
result/wz-tree-crosscheck.csv
result/wz-tree-digests.csv
result/wz-property-crosscheck.csv
result/wz-canvas-crosscheck.csv
result/wz-link-crosscheck.csv
result/wz-sound-crosscheck.csv
result/listwz-library-crosscheck.csv
scripts/maple079_wz_crosscheck.py
```

`scripts/maple079_wz_crosscheck.py` 只读取 `.work/task-023/output/` 里的导出并写上述 CSV。它不包含第三解析器。重新生成表格：

```text
python scripts/maple079_wz_crosscheck.py
```
