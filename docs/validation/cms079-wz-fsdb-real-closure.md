# CMS079 WZ → FSDB → LoomRealm Content → cms-actor 真实闭环验证报告

> 状态：Issue #50 验证报告（2026-11-05 起，随轮次更新）。
> 输入：Runner 本地 `/shared/CMS079/怀旧岛079V5客户端/冒险岛online`（只读，未执行任何客户端程序）。
> 本仓库只包含转换器、适配器与测试源码；真实 WZ、FSDB、PNG、音频全部留在 Runner 持久工作区 `/runner/state/lithdoo-labs-org/agent-projects/adventure-island/issue-agent/work/cms079-issue-50/`，不进入 Git。本报告只记录计数、摘要哈希、源路径标识与结论。

## 1. 输入身份复核（复用既有基线，不重复逆向）

- 16 个数据 WZ + `List.wz` 的 SHA-256 在转换前后各核验一次，全部与 `research/result/23-wz-library-cross-validation.md` 基线一致（`input-manifest/sha256-pre.txt` == `sha256-post.txt`，17/17）。
- wz-python checkout：`79344c95774a911adf93a4d43c67e5fc51fa6e76`（MIT，未改动）。
- 区域 EMS、IV `B9 7D 63 E9`、WZ Version 79：转换器打开每个包都断言 `version == 79`；未重设任何密钥学假设。`List.wz` 仅作身份旁证，不写入 FSDB。
- 示例（完整 17 项见 research 基线）：`Base.wz 8040f3ab…aad7d`、`Character.wz d5530358…6074`、`Quest.wz 48716b13…effe`。

## 2. 转换器（历史 PR #1 修复的选择性移植）

- `scripts/wz_fsdb/convert_cms.py` 基于当前 main 重新实现，保留 `phase1`/`all` 语义，新增：
  - `avatar` 范围：五个 Look（00002000/00012000/00020000/00030000/01302000）+ `struct.ZMap/order` + 仅被测动作实际引用的 Canvas（过滤器逐字节镜像生产适配器 `systems/adventure-island/cms079-avatar-plan.mjs` 的遍历，包括 brandish1 → swingOF/stabOF 引用帧、head/hair/weapon 跟随画布动作、face 表情帧、hairShade skin-0）；其余画布计数为 `canvasesOutOfScope`，不从记录中删除。
  - `--batch-state` **崩溃安全**可续接批次（Issue #50 Turn 3 重写）：每次输出写入前先把 intent（身份 + 期望文件 SHA-256）写入 `<batch-state>/manifest/journal.jsonl` 并 flush；输出经临时文件 + `os.replace` 原子落盘；intent 的提交状态即“最终文件存在且哈希一致”。目录名折叠、record remap、alias 候选、resource alias、collision、error 与计数事件同样进 journal，冲突决策可完全重放。启动时重放 journal：最后一个 checkpoint（包完成）之前的 ops 信任，其后的 intent 逐一与磁盘核对——“输出已写、checkpoint 未写”的窗口复用完整输出，“intent 已写、文件未写”直接重做，中断包不会把自己的半成品误判为 key collision，也不会触发 resource-overwrite-refused 或覆盖不同来源的真实冲突数据。每包开始时 journal 一份 `pkgStats` 快照 + 精确写 op 增量，计数跨中断保持精确；遍历类计数（nodes/UOL 四类）在包重解析时重新累计。转换器身份 = 转换器源码哈希（仓库 commit 一并记录）：转换器改动拒绝续接旧状态，而仅文档/测试变更的轮次提交不会强制重转。
  - `--finalize` 关闭一个 `all` 运行（`struct.WzRecordAlias`、元数据、汇总）。
- 维持的修复项：重名/大小写折叠记录生成稳定别名并全部保留来源（`WzRecordAlias`）；非法资源路径用可逆编码并在 `resourceAliases` 保留 `originalParts`/`storedKey`；不覆盖既有文件（journal 模式下未提交的同名残留由同身份原子写替换）；UOL 区分 ok/dangling/cycle/depth_limit；`resource.图`/`resource.音` 分表；未知音频载荷 `bin`；同一逻辑 key 不同扩展名报 `extension-conflict`；String 完整路径 key；Quest 六表；group 元数据符合 content/DESIGN.md（每行 object schema、空 `bS` 不建外键）；异常进入结构化报告。
- 合成测试：`python -m unittest discover -s tests/wz_fsdb` → **54 tests OK**（含 UOL 四状态、别名、资源路径、avatar 过滤器、跨批次 resume、**六项故障注入崩溃恢复测试**：在写输出前/输出完成但 checkpoint 前/checkpoint 后杀死真实转换，重启后与未中断运行逐字节等价，provenance/alias/账目不丢、无重复记录/资源、无虚假 collision，另含损坏文件替换与转换器身份测试）。

## 3. Avatar FSDB（独立最小子集）

转换命令：`--scope avatar --out …/fsdb-avatar/[FSDB]cms --report-dir …/reports/avatar`。

| 项 | 值 |
|---|---|
| struct 记录 | 6（5×struct.Look + struct.ZMap/order） |
| `[resource]图` Canvas | 50（wanted==written；`canvasesOutOfScope` = 285，全部属于未测动作） |
| UOL | ok=1033，dangling=0，cycle=0，depth_limit=0 |
| errors / collisions / aliases | 0 / 0 / 0 |
| 转换耗时 | ~2.3 s |

### 3.1 Well-formed（PASS）

`node scripts/wz_fsdb/verify_fsdb.mjs --fsdb …/[FSDB]cms --summary … --deep` 使用当前 pinned `@loomrealm/fsdb`（`openFsdb`/`listFsdbEntries`/`openFsdbObject`）：根名 `[FSDB]cms`、仅规范表目录、必需 `.info.meta`/`.desc.meta` 存在、JSON/JSONL 全部可解析且每行 object、无 BOM、6 struct + 50 resource 计数与转换器账目一致。**Well-formed：PASS，问题清单为空。**

### 3.2 Lossless accounting（PASS）

转换器汇总（`reports/avatar/convert-avatar.json`）与 FSDB 实测计数一致：每个源 IMG/节点/Canvas 都有输出或跳过理由（50 写入 + 285 out-of-scope + 0 错误）；UOL 四类分别计数；无未解释缺失/覆盖。**Lossless：PASS。**

### 3.3 Avatar 所需引用完整性（PASS）

AvabtarPlan 引用的全部 50 个 Canvas 经真实 Content Service 读取并验证（见 §5），MIME/版本/字节全部一致；五份 Look 与 ZMap 完整可读。**Avatar scope Integrity：PASS。**

## 4. 全量 16 包转换（进行中，崩溃安全批次，跨轮次续跑）

- 输出：`…/fsdb-all/[FSDB]cms`；批次状态：`…/batch-state/`（`<Package>.json` 完成状态 + `manifest/journal.jsonl` 写前日志）。
- Turn 3 重写转换器后按规范**重新生成了全部相关输出**：旧的部分 fsdb-all 与 batch-state 已清理（仅清理本 Issue 的这两项；fsdb-avatar、input-manifest、pinned wz-python、venv、Chromium libs 与 /shared 原样保留），avatar FSDB 用新转换器重生成并经 `diff -r` 证明与旧输出逐字节一致（50 Canvas、6 struct、0 错误），随后重新完成 §3/§5/§7 全部验证。
- 本轮已按 `--batch-state` 崩溃安全批次重新启动；每包完成即写 `<Package>.json`（输入 SHA、转换器身份 `src:<hash>@<commit>`、状态、输出摘要），写入级崩溃窗口由 journal 覆盖（见 §2）。**未 finalize 前不宣称全量 Well-formed/Integrity 结论**。
- 全量 Integrity-valid 将如实报告：SOURCE_ANOMALY（客户端原生悬空引用等，保留原始 WZ 路径与值）与 CONVERTER_DEFECT 分开归类；历史报告中出现过的非法路径/重名/悬空 UOL 需以本轮实测为准；任何不可解释缺失均为 FAIL，不粉饰。

## 5. 当前 pinned LoomRealm Content API 闭环（真实 FSDB）

`node scripts/wz_fsdb/verify_content.mjs --fsdb …/[FSDB]cms` 与 `components/cms-actor/test/real-assets.local.test.mjs`（环境变量 `CMS_ACTOR_REAL_FSDB`）使用当前 pin `93648192323bf5f57996b7b54cbae641d8a53fdb` 的正式栈：

`prepareHostraGame`（PREPARE）→ `prepareDesktopContentView`（可信 Content Index，每条目 contentVersion = body SHA-256）→ `createDesktopContentService`（Content HTTP v1 + bearer grant）→ `createBoundContentClient`（`record`/`group`/`resource`）。

| 检查 | 结果 |
|---|---|
| record：五份 struct.Look + struct.ZMap/order | contentVersion 全部等于 body SHA-256（示例：Look/00002000 → `sha256:63a3ca46…b817`；ZMap/order 149 项） |
| resource：AvatarPlan 引用的 50 个 PNG | 50/50 MIME `image/png` 且版本==SHA-256 |
| fail-closed | 缺失资源 → `CONTENT_NOT_FOUND`；未知 namespace → `CONTENT_NOT_FOUND`；无 bearer → HTTP 401 |
| group | avatar 子集无 group 表（如实跳过）；全量 FSDB 的真实 group 样本（`group.Tile/100000000` 或实测存在的等价样本）与 `resource.音` 读取在全量转换完成后执行并记录于此 |

**Content API 验收（record/resource + fail-closed + 版本）：PASS；group/音 项待全量 FSDB 完成后补充。**

## 6. 生产 AvatarPlan 适配器

`systems/adventure-island/cms079-avatar-plan.mjs`：输入为当前 ContentClient；`record()` 读取五份 Look 与 ZMap；跟随引用帧（brandish1 → swingOF/stabOF）；解析 head/face/hair/weapon 实际帧与 UOL 结果；仅收集当前计划所需 Canvas key；每个 key 经 `resource()` 验证 MIME=`image/png`、contentVersion==body SHA-256 后写入计划；输出经 `validateAvatarPlan` 有界校验（本例计划 4 动作、50 资源、< 262,144 字节）。计划只含逻辑 namespace/key/contentVersion。测试复用同一生产模块（旧测试专用适配器已删除），合成单测 6/6 通过。

## 7. 真实 Chromium 验收（PASS）

`CMS_ACTOR_REAL_FSDB=…/fsdb-avatar/[FSDB]cms node --test components/cms-actor/test/real-assets.local.test.mjs` → **5/5 PASS，0 skip，0 fail，无未处理 rejection**：

1. 五份 Look 与 ZMap 经真实 ContentClient 读取，结构/来源与逆向几何一致（body walk1/0：27×32、origin [19,32]、z=body、neck [-4,-32]、navel [-6,-20]；arm 12×17；stand1 三帧、walk1 四帧、jump 单帧 200ms；brandish1 七帧 840ms 且引用 swingOF/stabOF；head walk1 UOL → `Look/00012000/front/head`；weapon hand 锚点；zmap 为完整 149 项表）。
2. 计划有界且可渲染（4 动作 stand1/walk1/jump/brandish1，50 个不同真实画布，体积在冻结上限内）。
3. 渲染路径：`bootstrapWebPresentation` + `WebProjector` + `PresentationResourceClient`，浏览器内每次资源读取携带精确 `expectedContentVersion`，图片字节由 harness 反向代理转发到真实 Content Service（仅 presentation 脚本本地），版本全部精确匹配。
4. 像素/动画：stand1 ready 且绘制；walk1 四帧中 ≥3 帧像素不同；jump 保持帧；brandish1 单次播放后回到 walk1；左右朝向绕身体原点镜像（>500 比较点、>100 不透明点、0 不匹配）；`presentationFailures` 为空；`data-render-state=ready`；无缺失 Canvas/跳过必需 layer。

## 8. 回归测试（全部通过）

| 套件 | 结果 |
|---|---|
| `python -m unittest discover -s tests/wz_fsdb`（venv: Pillow 13.0.0 / numpy 2.4.6 / pycryptodome 4.3.0；Turn 3 重跑） | 54/54 OK（含 6 项故障注入崩溃恢复测试） |
| `node --test systems/adventure-island/test/cms079-avatar-plan.test.mjs` | 6/6 OK |
| `node components/cms-actor/scripts/build.mjs --check` | 产物一致 |
| `node --test components/cms-actor/test/integration.chromium.test.mjs` | 20/20 OK（harness 反向代理为可选参数，未影响合成闭环） |
| `node --test components/cms-actor/test/{avatar-model,browser-artifact}.test.mjs`（CI 集合） | 22/22 通过 |
| `npm test`（含新适配器单测；Turn 3 重跑） | 51/51 OK |
| `npm run pwa:bundle` / `npm run pwa:staging` | OK（frameworkSha `93648192…` 不变；Turn 2 运行，本轮无 Node/PWA 代码变更，`npm test` 与产物检查已重跑） |
| 真实素材测试（本地执行，未 skip；Turn 3 对重生成后的 avatar FSDB 重跑） | 5/5 OK |

## 9. 诚实声明与剩余工作

- 全量 16 包 `all` 转换通过安全批次进行中；finalize 前不宣称全量 Well-formed / Lossless / Integrity 结论；SOURCE_ANOMALY 与 CONVERTER_DEFECT 将按实测分类，客户端原生悬空引用不会使 Avatar 范围（已 PASS）失效，也不会被粉饰为全量 PASS。
- 待全量完成：`--finalize`、全量 `verify_fsdb`/`verify_content`（含真实 group 样本与一条 `resource.音`）、全量异常分类计数并入本报告。
- /shared 全程只读；转换前后 17/17 输入哈希一致；未修改 `.github/**`、`research/**`、`scripts/issue_agent/**`、`loom-realm/**`、gitlink 与 PWA 入口清单。
