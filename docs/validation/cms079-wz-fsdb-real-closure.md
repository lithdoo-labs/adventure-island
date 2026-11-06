# CMS079 WZ → FSDB 真实闭环验收

日期：2026-11-06。集成分支 `feat/cms079-pr1-migration`，基线 `origin/main` `9af28d89e47bf95786464a1bb50714aa833cebcc`。LoomRealm pin 未改：`93648192323bf5f57996b7b54cbae641d8a53fdb`。

本报告只记录源码、合成测试和本次仓库外真实运行的结论。客户端二进制、`.wz`、解码后的 PNG/音频和生成的 FSDB 都不在 Git 里。

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

**Lossless accounting：PASS。** PNG、struct、group、声音文件数分别等于转换摘要。11 处重名都留在 `struct.WzRecordAlias`，两侧来源都在。非法资源路径记在 `resourceAliases`。

**Integrity-valid：不是全量 PASS。** 客户端里本来就缺的引用保持为 SOURCE_ANOMALY。没有发现需要改转换器的 CONVERTER_DEFECT。

SOURCE_ANOMALY：

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

本次本地任务要求的转换、账本、Content API 和真实 Chromium 都有退出码和报告。Issue 文档里的 Definition of Done 还不能因此关闭：

- 没有新增 `--scope avatar`。五份 Look 和所需 Canvas 来自同一次 `--scope all`，不是单独的导出开关。
- 没有分批续跑。一次前台全量转换退出码为 0。
- 按本次授权，没有推送 `main`，没有开 PR，也没有关闭 Issue #50 或 PR #1。

因此 Issue #50 保持打开。本地 `main` 只包含已验证的源码、合成测试和本报告。

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
