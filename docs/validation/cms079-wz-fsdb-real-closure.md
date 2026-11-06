# CMS079 WZ → FSDB 真实闭环验收

日期：2026-11-06。集成分支 `feat/cms079-pr1-migration`，基线 `origin/main` `9af28d89e47bf95786464a1bb50714aa833cebcc`。LoomRealm pin 未改：`93648192323bf5f57996b7b54cbae641d8a53fdb`。

本报告只记录源码、合成测试和本次仓库外真实运行的结论。客户端二进制、`.wz`、解码后的 PNG/音频和生成的 FSDB 都不在 Git 里。

## 2026-11-06 收尾复核与有效验收边界（本节优先）

本地一次性转换的源码、生成数据及现场复核保持不变，不因本次文档修订而重新生成素材。`main` 已包含 2026-11-06 复核提交 `89bfeea64fad5277c9aa1eeb16648aa727ceec20`；该提交已存在于远程 GitHub。Issue #50 经用户调整为**仅一次完整转换，以完整 FSDB + Content Index 长期复用**，取消单独 Avatar 导出、分批续接/WAL、额外 Finalize 和原 Issue Agent PR 的验收要求。旧任务书与下文早期过程描述只供溯源，不能再当作当前 DoD。PR #53 已关闭且未合并。

**已实测成功：** 16 包本地前台 `--scope all` 退出码 0；独立文件计数与输出摘要匹配；当前 pin 的 ContentClient 能读取真实 record、group、PNG 与音频；真实 Chromium 播放 stand1、walk1、jump、brandish1 和左右朝向（本地 2026-11-06 复核退出码 0）；GitHub Actions [PWA CI #42150011248](https://github.com/lithdoo-labs/adventure-island/actions/runs/42150011248) PASS。**远程 CI 不持有本地 FSDB，也未重新执行这次真实 WZ 转换或真实素材 Chromium 验收。**

### 异常溯源及影响界限

| 现象 | 可直接验证的事实 | 归因 / 范围 / 处理 |
| --- | --- | --- |
| UOL dangling 1,948、cycle 1 | 本次转换统计与历史报告 63 一致；`uol_depth_limit=0`；未解析关系仍留在结构记录中 | **SOURCE_REFERENCE_ANOMALY（有历史对照）**。属于不能正常解引用的源引用现象，尚无证据证明全量 Integrity-valid；只对引用这些目标的功能有影响。本次被测 Avatar 所用帧已成功读取/渲染，不代表其他装备、地图引用也正常。 |
| `Look/01702267` 的 `icon`、`iconRaw` | Canvas 在调用 pinned `wz-python` 解码时抛出 `ValueError`；记录中有 `decodeError`，所需图像未成功导出 | **UNRESOLVED_DECODE**（尚不能判定 SOURCE_ANOMALY 或 CONVERTER_DEFECT）。报告未包含独立原始字节/其他解析器复测，不能证明 WZ 数据损坏。两处图像不可用；没有发现它们属于已验证的五份 Avatar Look。 |
| `Look/01702359` 的 `43/jump/0/weapon` | 读取时抛出 `IndexError`，同一原始路径记录两次 `decodeError` | **UNRESOLVED_DECODE**。这是一个出现两次的失败路径，不能按两张独立源图推断；相关武器帧不可用，原因尚待独立对照。 |
| `Character.wz/01102670 .img`（末尾空格） | `stem_of` 保留尾随空格；`valid_segment` 拒绝该键；`Store.write_struct` 调用 `note_error("key", …, "invalid-name")` 后**直接返回 False**。四张相关 PNG 在编码资源路径 `Look/wz~MDExMDI2NzAg/`，但 struct JSON **没有落盘** | **CONFIRMED_CONVERTER_OMISSION**：原始名称确有不规范空格，但当前转换器没有对 struct key 做别名/可逆编码。不是“原始数据中本来没有记录”；下游无法正常通过 `struct.Look` 读取该装备。由于全量库已固定且当前需求不依赖此装备，作为**已知例外保留**，不得把它算作无损输出；若日后需要该装备，应在隔离的新输出上制定修复及迁移方案，而不是覆盖现有 FSDB。 |
| `Look/01092090` 图标资源键冲突 | 两侧资源都保存，`resourceAliases` 中有 `resource-key-conflict` 的存储键映射 | **COLLISION_HANDLED**。按最终存储键访问别名；不能假设两个来源共用同一物理资源键。 |
| `stats.images=34,472` vs 34,760 源 IMG | 差额 288，代码 `convert_item` 在 288 条 `ItemImg` 分支没有增加 `images` 统计；对应 `ItemImg` 文件已计数 | **COUNTER_LIMITATION**，目前没有证据显示这 288 个 IMG 漏文件；不应把 `stats.images` 原值误当作已经解析的唯一源 IMG 数。 |

**验收结论必须精确定义：**

- **Well-formed / 可读性：PASS（按已提交的本地复核证据）。** 当前 FSDB 能由正式 Content Service 建索引和按键读取；不表示每一条源数据有效。
- **输出账目一致性：PASS（限定范围）。** PNG/音频/struct/group 文件数量与转换器已成功写出项的汇总一致，已报告的资源冲突保留了别名。**此判断不涵盖被拒绝的 `01102670 .img` struct 和解码失败的画布。**
- **源到目标逐项无损：NOT ESTABLISHED / PARTIAL。** 至少存在一条已确认的 struct 输出遗漏；`decodeError` 尚未独立归因。因此不能以“输出文件数相等”证明 34,760 个 IMG 都完成了语义级无损转换，也不能宣称 `CONVERTER_DEFECT=0`。
- **全客户端 Integrity-valid：PARTIAL（不是 PASS）。** 已验证的 Avatar / Content / Chromium 纵向闭环通过，其余角色装备与地图等未做逐资源运行验证。

以上是**现有源码与已提交报告的静态复核**；没有重新读取 `E:` 盘上的 140 万文件，也没有替用户执行新的独立 WZ 解码。今后若需要补证据，应在本地对明确的异常路径进行**点状核验**，无需重跑整个转换。

### 一次性数据保存 / 备份状态

唯一正式 FSDB：`E:\cms079-pr1-work\fsdb-all\[FSDB]cms`。本地报告目录：`E:\cms079-pr1-work\reports`，其中包含源身份、`all/convert-all.json`、`all/accounting.json`、`content-avatar-2026-11-06-session.json` 等证据。不可把数据字节提交到 Git。

仓库提供 `scripts/wz_fsdb/backup_artifacts.py`，用于把 `fsdb-all/` 与 `reports/` 完整复制到**另一块物理磁盘**，并生成逐文件 SHA-256 清单和独立验证结果。具体运行命令、恢复中断及拒绝覆盖策略见 [README](../../scripts/wz_fsdb/README.md)。这一步属于**机器本地实际操作**：本会话无法访问 Windows 的 `E:` 盘，所以**备份未在本会话中执行，副本存在性与校验状态尚未确认**。只有 `backup` 和 `verify` 在存放数据的机器上实际返回 `VERIFIED`，才允许勾选 Issue #50 的备份项；工具单测通过不能替代真实备份。

---

## 历史转换及测试记录（发生时的陈述，以上述收尾口径为准）

## 代码来源

| 提交 | 作用 |
| --- | --- |
| `bf7fdebd6aaef60819ecb8f3a758aa08e6f74445` | PR #1 固定源。转换器只从这里取 |
| `9df179147047168a57d5d93a59f07c59f47fe00d` | 原样迁入 8 个文件。`scripts/wz_fsdb/convert_cms.py` blob 仍是 `c3951951aecbfe720e19c43e495043c2e2ddd293` |
| `d0c0f3c639d995a89b84fb919e61c26ecd926e1c` | 兼容补丁：三份诊断夹具从 PR #1 的 `result/` 原样挪到 `tests/wz_fsdb/fixtures/`。转换器逻辑没有改 |
| `360eaeeeb12003cee5c07dfbb381cd738dccec83` | 新增 Content/Avatar 读取：`real-look-adapter.mjs`、`real-cms079-closure.mjs`、`audit_accounting.py` |
| `b3a079d126d35be41a2f518e73330badefc7a3a4` | 适配真实脸型：`Face/00020000` 的 `default` 是单张画布，不是编号帧 |

没有合并 PR #1 分支，没有 cherry-pick 它的历史，也没有使用已废弃 PR #53 或 `agent/issue-50` 的 WAL、转换器、测试和报告。

当前 `convert_cms.py` 与 PR #1 源 blob 相同。`requirements.txt`、`synthetic_fixtures.py`、`test_fsdb_layout.py` 的 blob 也相同。README 和三个测试文件只改了夹具路径。

## 输入身份

WZ 根目录：`F:\shared\CMS079\怀旧岛079V5客户端\冒险岛online`。

`wz-python`：`E:\新建文件夹 (2)\.work\tools\wz-python`，commit `79344c95774a911adf93a4d43c67e5fc51fa6e76`。区域 EMS，IV `B9 7D 63 E9`，数据文件 Version 79。

`E:\cms079-pr1-work\reports\input-identity.json`：17/17 与 Task 023 基线一致，`ok: true`。16 个数据 WZ 的 IMG 合计 34,760。`List.wz` 只做身份核验，不是 PKG1。

| 文件 | 字节 | SHA-256 | IMG |
| --- | ---: | --- | ---: |
| Base.wz | 8885 | `8040f3ab36d2fb02b31ae04d794f36699c0f6c58e5cd7b87cd81d361da0aad7d` | 4 |
| Character.wz | 1238707905 | `d55303588b10a8a5b76f1bd065c238447c708af21c5f55cd319a3ae9db646074` | 25565 |
| Effect.wz | 142666079 | `46702f06c45a3198c36d810aabc4241ad267ee30346f541b76d802b64078ad82` | 17 |
| Etc.wz | 19435393 | `5177d6ac654aeac1e3db83a1f98445df26c80472bc75fb43e3ea41337e25bc6f` | 28 |
| Item.wz | 139053911 | `0c58678973dbcdd12e5d936e03a060ee606f80416722dbb530797a8584a182d3` | 475 |
| Map.wz | 835954262 | `9e0d2a0fcecac2c99ee3cb15b03c41b5617d7d0637b55fb132f0eeed27155f69` | 4614 |
| Mob.wz | 421628507 | `6d5503fb78ec5a94f9f714d8712ab36b47257ac0b9ad8640e016e10fe67826ec` | 1617 |
| Morph.wz | 35707082 | `e9461b90aae1a46e1f41b527a1232974408b8bbb802a5df36868df10f24efe90` | 182 |
| Npc.wz | 53772873 | `19562193d7cb93213110f4a54cc62568ec536251e8b7d546bd3915b3a009df65` | 1608 |
| Quest.wz | 3726297 | `48716b137d84b7e80dc4e6a4ef7e1cf4f908e90370d48ad4cb9aad9052fbeffe` | 6 |
| Reactor.wz | 85233536 | `68786bf5d7530eca7519d7bdebd0c3dbd6a13a0193c2e984c2e82d12d4a17e20` | 463 |
| Skill.wz | 74821220 | `c23c1409ec801c89b5bbc13308014c202efbfb3002efb4da7f33359f0430323f` | 75 |
| Sound.wz | 366212494 | `d1a9fd213173d531d9710d6f568eb5e4d1a7fa390ed50fa7fcbb35b98f981505` | 48 |
| String.wz | 9608592 | `76aa28a540296c91633f097c9429caa2f16e0f7d0a8d9d0f449192ec51abc510` | 15 |
| TamingMob.wz | 1876 | `64756585542455417e2de696395700e430a2510bd45cc1a4c22677cb273953a4` | 16 |
| UI.wz | 33744089 | `f5d804c30a707c968d1d7d1f522935cd7c3fd455e3d02891e996abc7c033848d` | 27 |
| List.wz | 65470 | `1a9bed23d87213545e2ce40765ca45e1b5464659c21bb7276d924edc2eb0cc9e` | 身份核验 |

## 转换

输出在仓库外：`E:\cms079-pr1-work\fsdb-phase1\[FSDB]cms` 与 `E:\cms079-pr1-work\fsdb-all\[FSDB]cms`。一次前台 `--scope all`，没有 `--batch-state`、`--finalize` 或 `--scope avatar`。

| 步骤 | 退出码 | 结果位置 |
| --- | ---: | --- |
| `--scope phase1` | 0 | `reports/phase1/convert-phase1.json` |
| `--scope all` | 0 | `reports/all/convert-all.json`。耗时 7,804,776 ms，结束于 2026-11-05T19:07:23.202Z |
| 文件账本 | 0 | `reports/all/accounting.json`。耗时 1,245,863 ms |

phase1：23 个 struct、4,073 张 PNG 且往返全部成功、5 条声音、357 个 UOL 全部 `ok`、错误 0。官方 `openFsdb` 能打开这份 phase1 树。

全量计数器与磁盘文件一致：

| 项 | 数量 |
| --- | ---: |
| 源 IMG | 34,760 |
| struct 文件 | 145,045 |
| group 文件 / 行 | 25,157 / 1,090,963 |
| `resource.图` PNG | 1,399,931 |
| `resource.音` | 3,601（3,551 mp3 + 50 bin） |
| 声音字节 | 368,565,813 |
| UOL ok / dangling / cycle / depth_limit | 5,848,940 / 1,948 / 1 / 0 |
| `struct.WzRecordAlias` | 11 |
| 资源别名 | 287（285 非法或大小写段，2 个资源键冲突） |

Quest 六类：QuestInfo 2,134，Check 2,131，Act 2,118，Say 2,110，PQuest 10，Exclusive 1。String 十五张 Text 表合计 86,790 条，其中 TextItem 28,242。Look 25,544，Afterimage 20，Item 14,543，ItemImg 288，Skill 531，SkillBook 74。

`stats.images` 打印为 34,472。差额 288 是 `convert_item` 在 ItemImg 分支没有递增该计数器。ItemImg 文件就是 288 个，Item 记录数 14,831 = 14,543 + 288。IMG 没有漏转换。

历史报告 63 的 Canvas 节点数是 1,399,680。本次 PNG 文件数是 1,399,931，与本次转换器自己的 `canvases` 计数相同。多出来的文件是修复后保留的非法路径编码，不是静默覆盖。悬空 UOL 1,948、环 1、声音 3,601 与报告 63 一致。

## 判定

**Well-formed：PASS。** 全量树经当前 pin 的 `openFsdb` 打开。`prepareDesktopContentView` 对每个条目做了内容哈希，随后 ContentClient 读到了真实记录、分组和资源。

**输出账目一致性：PASS（仅指转换器写出的文件数）；源到目标无损性：PARTIAL / NOT ESTABLISHED。** PNG、struct、group、声音文件数分别等于转换摘要。11 处重名都留在 `struct.WzRecordAlias`，两侧来源都在。非法资源路径记在 `resourceAliases`。但 `01102670 .img` 的 struct 未写入，且另有解码失败画布；不能称为源数据全部无损。

**Integrity-valid：不是全量 PASS。** 未解析 UOL 有历史对照；其他 Canvas 解码问题尚未证实源损坏。另有一条确定未写出的 struct 记录属于已确认的转换器表示缺口，见上方收尾复核，不应断言 CONVERTER_DEFECT 为零。

历史异常列表（按上方分类重新解释）：

- UOL dangling 1,948，cycle 1。
- `Look/01702267` 的 icon、iconRaw：`wz-python` `ValueError`，记录里带 `decodeError`。
- `Look/01702359` 的 `43/jump/0/weapon`：`IndexError`，记录里有两处 `decodeError`（同一路径被访问两次）。
- `Character.wz` 里 `01102670 .img` 的 stem 带尾随空格。NameSegment 拒绝该 struct 键并记了 `invalid-name`。4 张 PNG 写在 `Look/wz~MDExMDI2NzAg/` 下，struct JSON 没有落盘。
- `Look/01092090` 的 icon、iconRaw 与另一侧武器撞键。两侧都保留，别名原因是 `resource-key-conflict`。

## Content 与 Chromium

命令：

```text
node --max-old-space-size=8192 components/cms-actor/test/real-cms079-closure.mjs \
  --fsdb E:\cms079-pr1-work\fsdb-all\[FSDB]cms \
  --out E:\cms079-pr1-work\reports\content-avatar.json
```

第一次在索引完成后失败：脸型 `default` 没有编号帧。退出码 1，耗时 3,249,540 ms。`b3a079d126d35be41a2f518e73330badefc7a3a4` 修正后重跑，退出码 0，耗时 3,607,763 ms，结束于 2026-11-05T21:26:21.524Z。证据在 `content-avatar.json`。

`ContentClient.record` 读到五份 Look，islot 分别为 Bd、Hd、Fc、Hr、Wp。`struct.ZMap/order` 149 个名字，从 `mobEquipFront` 到 `Bd`。`ContentClient.group("group.Tile", "100000000")` 有 815 行。`ContentClient.resource("resource.音", "Sound/Bgm00/FloralLife")` 为 `audio/mpeg`，1,376,392 字节，`sha256:c19f549e33dfba0b470e21e26fa018b87e161a5ef2caa37c78c1f0bdb17a5c3e`，与 body SHA-256 一致。

生产 AvatarPlan 使用这五份真实记录，拉取 49 个 `resource.图`。每个响应都核过 PNG 魔数，body SHA-256 等于 `contentVersion`。身体层是 `Look/00002000/stand1/0/body`，版本 `sha256:f7662b81399994c1683aaf2174c7056994de9a7886ef81d24edb9ccbae1b58c3`。动作帧数：stand1 3、walk1 4、jump 1、brandish1 7。

失败关闭：缺失记录 `CONTENT_NOT_FOUND`，只有 records 权限时读资源 `CONTENT_UNAVAILABLE`，错误版本 `conflict`，缺失资源 `not-found`。

真实 Chromium 经 `bootstrapWebPresentation`、`WebProjector`、`PresentationResourceClient` 跑完。stand1 有不透明像素；`facing=left` 的像素哈希从 1964834133 变为 -842389792；walk1、jump、brandish1 都出现；18 次资源请求，0 次呈现失败。

## 回归

| 命令 | 结果 |
| --- | --- |
| `python -m unittest discover -s tests/wz_fsdb -v` | 26 通过，0 失败 |
| `npm test` | 42 通过，3 跳过，0 失败。跳过的是 Windows 上无法创建符号链接的路径测试 |
| `node components/cms-actor/scripts/build.mjs --check` | 通过。浏览器包与源一致 |
| `npm run pwa:bundle` | 退出码 0 |
| `npm run pwa:staging` | 退出码 0。framework SHA 仍是 pin |
| `node --test` 合成 Chromium 套件与适配器 | 修复前 21 通过、0 跳过。脸型修复后适配器 2 通过 |
| 真实素材闭环 | 第二次运行退出码 0 |

## Issue #50

本段记录原任务书尚未修改时的历史状态；Issue #50 现已取消独立 Avatar 导出及断点续跑要求，详见上方收尾复核。转换、账本、Content API 与 Chromium 当时均有退出码和报告。

- 原任务书要求 `--scope avatar`；**现已明确取消该要求**，五份 Look 与 Canvas 直接由完整 FSDB 读取。
- 原任务书要求分批续跑；**现已明确取消该要求**，一次前台全量转换退出码为 0。
- 当时尚未推送 `main`；**此历史状态已过期**。2026-11-06 的提交 `89bfeea...` 现已在远程 main；Issue #50 仍 Open，PR #1 未合并。

本段为当时的状态快照。当前 Issue #50 的完成定义及备份状态见本报告顶部收尾复核。

## 2026-11-06 复核

同一棵本地 `main`（当时 `38dddfb273653b9ed077301dabe9fcf7eee68067`）上重新执行了身份、测试和真实 Chromium。`scripts/wz_fsdb/convert_cms.py` 的 blob 仍是 PR #1 的 `c3951951aecbfe720e19c43e495043c2e2ddd293`，所以没有另起一份全量 FSDB。

| 检查 | 结果 |
| --- | --- |
| 17 个 WZ 重新计算 SHA-256 | 与 Task 023 基线 17/17 一致 |
| `wzpy.crypto.WZ_IV["EMS"]` | `B9 7D 63 E9`。`TamingMob.wz` 以 EMS 打开，version 79，16 个 IMG |
| FSDB 抽查 | `Look/00002000` 的 islot 为 Bd；`body.png` 魔数 `89 50 4E 47`；`FloralLife.mp3` 1,376,392 字节；`WzRecordAlias` 11 个文件；`ZMap/order` 149 个键；`[struct]Look/.info.meta` 存在 |
| `python -m unittest discover -s tests/wz_fsdb -v` | 26 通过 |
| `npm test` | 42 通过，3 跳过，0 失败 |
| `node components/cms-actor/scripts/build.mjs --check` | 通过 |
| `node --test` cms-actor 模型、浏览器包与合成 Chromium | 44 通过，0 跳过 |
| `npm run pwa:bundle` 与 `npm run pwa:staging` | 退出码 0。framework SHA 仍是 `93648192323bf5f57996b7b54cbae641d8a53fdb` |
| 真实 Content + Chromium | 退出码 0，耗时 3,809,910 ms，结束于 2026-11-06T02:20:03.423Z。证据：`E:\cms079-pr1-work\reports\content-avatar-2026-11-06-session.json` |

这次 Chromium 的 Look 版本、声音 SHA-256、Tile 分组、49 个资源和左右镜像哈希与上一份 `content-avatar.json` 相同。`prepareDesktopContentView` 再次打开了全量 FSDB。没有发现新的 CONVERTER_DEFECT。
