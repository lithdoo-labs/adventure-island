# CMS079 真实资源闭环：WZ → FSDB → LoomRealm Content API → cms-actor

> 状态：Issue Agent 实施任务书（2026-11-05）
> 执行模型：一个 Owner-authored Issue、一个持久 OpenCode Session、一个 Draft PR；允许在同一 Issue 上通过多轮 /agent revise 完成。
> 基线：Adventure Island 当前 main；LoomRealm gitlink 保持当前 pin。
> 目标：把历史 PR #1 的 WZ→FSDB 转换器修复移植到当前 main，并使用此前已逆向验证的同一套 /shared CMS079 客户端，完成真实 Avatar 内容经当前 LoomRealm Content API 到 cms-actor Chromium 的端到端验收。
> 执行 Issue：[ #50 — CMS079 converter and real avatar closed loop ](https://github.com/lithdoo-labs/adventure-island/issues/50)。

## 1. 最终交付

本任务不是重新识别客户端，也不是重新进行 WZ 密码学逆向。客户端、区域、IV、WZ Version 和解析器已有多库交叉验证；本任务负责把既有结论变成可复现的转换器、Content 读取适配器和真实浏览器验收。

完成后必须同时具备：

1. 历史 PR #1 的转换器修复和合成回归测试已基于当前 main 移植；不直接合并旧分支。
2. 转换器保留完整 16 个数据 WZ 包的 all 能力，并新增 avatar 专用范围；phase1 的既有行为不得回归。
3. 使用 /shared 中同一客户端生成本地 FSDB；完成 16 包全量转换审计和独立 Avatar FSDB 子集。
4. 通过当前 pinned LoomRealm 的真实 FSDB / Content Service 验证 record、group、resource 三类读取和 contentVersion。
5. 游戏侧真实 AvatarPlan 适配器从 ContentClient 读取真实 Look、ZMap 和 PNG 资源版本，不从文件系统路径或私有索引构造渲染计划。
6. 真实素材通过 LoomRealm 正式 Web Presentation bootstrap、WebProjector、PresentationResourceClient 和 Chromium，完成 stand、walk、jump、brandish1、朝向镜像和像素验收。
7. 所有真实客户端、WZ、导出 PNG/音频、FSDB 和大体积中间产物只留在 Runner 本地持久工作区；Git PR 只包含源代码、合成 fixture、测试和不含素材字节的验证报告。

本任务闭环：

~~~text
/shared CMS079 client (read-only)
    ↓ wzpy / EMS / verified IV
WZ → FSDB converter
    ↓ [struct]Look / [struct]ZMap / [resource]图
Local FSDB
    ↓ current LoomRealm FSDB Content Service
ContentClient.record / group / resource
    ↓ production CMS079 AvatarPlan adapter
bounded AvatarPlanV1 + exact contentVersion
    ↓ PresentationResourceClient
cms-actor Web Component
    ↓ bootstrapWebPresentation + WebProjector
real Chromium pixel / animation assertions
~~~

### 不在本任务范围

- 不运行 MapleStory.exe、Launcher、Patcher、Setup、HShield 或任何客户端二进制。
- 不修改 /shared，不解包或重写原始客户端，不把素材上传 GitHub。
- 不实现完整地图运行库、移动物理、怪物/NPC/任务玩法、装备商城或完整 islot/vslot 穿戴冲突算法。
- 不更换根 game.json 的 Smoke Subsystem，不改根 launch manifests，不改变 PWA canonical entry。
- 不升级 LoomRealm、不修改 loom-realm 子模块、不部署 staging/production。
- 不宣称全部 CMS079 数据天然 Integrity-valid；必须区分转换器缺陷与客户端自身缺失引用。

## 2. 已验证的客户端与解析基线（直接复用）

### 2.1 同一客户端

使用 Runner 现有目录：

~~~text
/shared/CMS079/怀旧岛079V5客户端/冒险岛online
~~~

它就是此前 Task 023、Task 057、Task 060、PR #1 本地 WZ→FSDB 验证所使用的同一套 CMS079 候选客户端，不是新来源。Issue #44 的 inventory 也记录了该路径和文件清单。

身份基线：

- 16 个数据 WZ 包均为 PKG1，另有 List.wz。
- WZ Version：79。
- 区域：EMS。
- IV：B9 7D 63 E9。
- 三方解析交叉验证：wz-python、MapleLib、WzComparerR2；错误 IV 的负对照已记录。
- wz-python 主解析器固定 commit：79344c95774a911adf93a4d43c67e5fc51fa6e76。
- wz-python 仓库：https://github.com/Leonana69/wz-python
- wz-python 许可证：MIT；MapleLib / WzComparerR2 仅作为历史正确性 oracle，不作为运行时依赖或 vendored 代码。
- 之前的全量 WZ 目录索引记录 34,760 个递归 IMG。

### 2.2 必须复用的主线证据

以下文件已经在 main，属于受保护研究资料，只读引用，不修改：

- docs/cms079-shared-inventory.md
- research/result/23-wz-library-cross-validation.md
- research/result/wz-third-party-sources.csv
- research/result/wz-parser-capability-matrix.csv
- research/result/wz-directory-index.csv
- research/result/wz-tree-digests.csv
- research/result/57-wz-data-layer.md
- research/result/60-map-extraction-complete.md

历史 PR #1 分支还保留两份转换验证交接资料，供比对，不要把它们直接搬入 main：

- 历史全量报告：PR #1 分支 result/63-wz-fsdb-validation.md
- 修复补丁交接：PR #1 分支 result/65-wz-fsdb-repair-patch.md

历史全量报告证明同一客户端的 16 个数据 WZ 包均由 EMS / IV B9 7D 63 E9 打开、报告 Version 79，且当时完成过全量 FSDB 生成。修复补丁报告明确说明：修复后的代码只通过了 26 项合成测试，尚未重新执行真实 WZ 全量转换。因此，本任务必须完成修复后真实输入的复测，不能把历史全量报告误当作修复后回归通过。

### 2.3 本任务只做输入身份复核，不重复逆向

开始转换前：

1. 确认上述目录存在，列出 16 个数据 WZ 文件和 List.wz。
2. 对照 research/result/23-wz-library-cross-validation.md 中记录的 SHA-256、文件大小和 IMG 数量。
3. 至少核验全部 16 个数据 WZ 文件的 SHA-256；List.wz 作为客户端身份旁证核验。
4. 记录 Runner 上 wz-python 的实际 checkout commit，必须是上面固定 commit；若不存在，从公开 MIT 上游获取该精确 commit，不要改用未固定版本。
5. 记录 Python、Pillow、pycryptodome 版本及磁盘剩余空间。
6. 转换前后再次核验输入文件 SHA-256；任何变化都视为失败并停止。

如果哈希与既有基线不一致，报告 BLOCKED，指出差异文件；不得自动重设 EMS、IV 或 WZ Version。不得把 inventory 中提及的内部加密版本标记 194（0x00C2）误当作 wzpy 已验证的 WZ Version 79。

## 3. Issue Agent 与 Runner 执行规则

### 3.1 唯一工作流

严格使用 docs/issue-agent.md 描述的现有流程：

- Owner（lithdoo）创建一个普通 Issue。
- 在该 Issue 评论 /agent start。
- Agent 在组织 Runner opencode-lithdoo-labs 上执行。
- Publisher 创建唯一 Draft PR，分支名为 agent/issue-N。
- 所有后续工作通过同一 Issue 的 /agent revise 续接同一个 OpenCode Session 和同一个 Draft PR。
- 最后由维护者审核和合并，不自动合并。

不要在历史 PR #1 分支上 revise；不要另建第二个 Issue 拆分本任务。

### 3.2 Runner 工作目录与跨轮次持久化

Issue Agent 每轮会重新 checkout 工作树，不能把 GITHUB_WORKSPACE/.work 当成跨轮次持久存储。

使用 Runner 持久盘：

~~~text
/runner/state/lithdoo-labs-org/agent-projects/adventure-island/issue-agent/work/cms079-issue-N/
├── input-manifest/
├── converter-checkout/
├── fsdb-all/
├── fsdb-avatar/
├── reports/
├── batch-state/
└── logs/
~~~

- 将 N 替换为实际 Issue 编号。
- 该目录只用于本 Issue 的本地数据和断点状态，不得提交到 Git。
- 不得覆盖其他 Issue 的目录。
- 每轮开始先核对 converter commit、输入 manifest 和已完成 batch 状态。
- 如果转换器代码发生变化，之前由旧代码生成的 FSDB 不得继续当作新代码的验收结果；必须重新生成受影响输出。
- 每个 batch 完成后，写入 package 名、输入 SHA、converter commit、结束状态、输出文件数和输出目录摘要。
- 若 Runner 磁盘空间不足，停止并报告 BLOCKED，不删除 /shared 原始输入或其他项目数据。

### 3.3 /shared 安全

Issue Agent 文档说明 /shared 在 Runner 上是 writable，OpenCode 并非强安全沙箱。因此本任务将 /shared 视为只读输入，并以操作约束和 SHA-256 前后核验共同保证：

- 只读取 WZ 文件。
- 所有导出写入上述 /runner/state 工作目录。
- 不执行任何客户端程序。
- 不修改 /shared 下的任何文件、目录、权限或时间戳。
- 不复制原始客户端或导出素材进仓库。
- 不把原始 WZ 路径以外的私密 Runner 信息、凭据、环境变量或密钥写入日志。

## 4. 移植历史 PR #1：转换器和回归测试

以任务开始时 main 的最新 HEAD 为基线。历史 PR #1 只作为代码来源，选择性移植，不 merge、不 cherry-pick 整个旧分支。

需要复用并审核以下文件：

~~~text
scripts/wz_fsdb/README.md
scripts/wz_fsdb/convert_cms.py
scripts/wz_fsdb/requirements.txt
tests/wz_fsdb/synthetic_fixtures.py
tests/wz_fsdb/test_fsdb_layout.py
tests/wz_fsdb/test_key_mapping.py
tests/wz_fsdb/test_resource_names.py
tests/wz_fsdb/test_uol_resolution.py
~~~

保留原有转换语义并补齐：

- struct 重名与大小写折叠冲突：不得丢弃后写记录；生成稳定、可追溯的别名，并由 struct.WzRecordAlias 保留原始 key 和所有候选 source。
- resource 非法路径段：不得 trim 或静默改名；使用明确、确定、可逆或可追溯的编码策略，并在 resourceAliases ledger 中保留 originalParts 与 storedKey。
- Windows 大小写不敏感目录和 leaf 冲突：不得覆盖已有文件。
- UOL：区分成功、dangling、cycle、depth_limit；不能把深度超限伪装成循环，也不能把未解析引用写成正常资源。
- PNG 与音频必须遵守 content/cms_design.md：Canvas 使用 [resource]图，Sound 使用 [resource]音；扩展名匹配实际载荷，未知音频格式只能作为 opaque binary 记录，不能伪称 MP3。
- 同一 ResourceKey 不允许不同扩展名静默共存。
- String 设备保留名和重复 key 必须保留来源，不截断成可能碰撞的末段编号。
- Quest 六个 IMG 分类记录必须按既有设计拆分。
- group 元数据必须符合 content/cms_design.md：每行是 object schema；空 bS 不强行建立无条件外键。
- 纯 link 地图没有 layers 时不得编造空 layers。
- 所有异常都进入结构化报告；禁止 catch 后仅打印错误并继续把该包报告为成功。

特别注意：PR #1 的旧修复说明中有些规则尚未真实数据复测。移植时逐项对照 content/cms_design.md 和当前 LoomRealm FSDB/Content 契约。不得为了让旧测试通过而放宽 FSDB 规范。

### 不得移植

- 不移植 PR #1 中的 .github/workflows/wz-fsdb-synthetic.yml；.github/** 是 Issue Agent 保护路径。
- 不移植历史 result/** 报告到 main。
- 不迁移或修改 research/**。
- 不复制任何真实 FSDB、PNG、音频、WZ 或客户端文件。
- 不修改 loom-realm gitlink、LoomRealm 源码或依赖 pin。

## 5. 转换器命令与范围

必须保留：

- phase1：保持历史语义，不得被 avatar 改写。
- all：处理完整 16 个数据 WZ 包。
- avatar：新增的最小真实角色资源范围。

建议 CLI：

~~~bash
python scripts/wz_fsdb/convert_cms.py --scope avatar --wz-root "$WZ_ROOT" --wzpy "$WZPY_ROOT" --out "$CMS079_WORK/fsdb-avatar" --report-dir "$CMS079_WORK/reports/avatar"
~~~

全量：

~~~bash
python scripts/wz_fsdb/convert_cms.py --scope all --wz-root "$WZ_ROOT" --wzpy "$WZPY_ROOT" --out "$CMS079_WORK/fsdb-all" --report-dir "$CMS079_WORK/reports/all"
~~~

实际参数以实现为准，但输出必须是全新目录，不能对历史 FSDB 做增量覆盖。

### 5.1 Avatar scope 的精确内容

至少导出以下 struct 记录：

| WZ 来源 | FSDB 记录 |
|---|---|
| Character.wz / body | struct.Look / 00002000 |
| Character.wz / head | struct.Look / 00012000 |
| Character.wz / face | struct.Look / 00020000 |
| Character.wz / hair | struct.Look / 00030000 |
| Character.wz / weapon | struct.Look / 01302000 |
| Base.wz / zmap.img | struct.ZMap / order |

并导出上述记录及选定动作实际引用的所有 Canvas PNG 至 resource.图。UOL 目标必须在输出中可定位。不得只按固定路径猜测图片集合，也不得把整个 Character.wz 的 1,170,000+ Canvas 全部放入 avatar 子集。

Avatar 子集至少覆盖当前 real-look-adapter 所需的动作：

- stand1
- walk1
- jump
- brandish1

必须保留画布 width、height、origin、z、map anchors、delay、flip、move、face 和引用帧关系。不得把动作引用帧误当作直接 Canvas 帧。

### 5.2 全量 16 包转换

all 范围必须处理以下 16 个数据 WZ：

Base.wz、Character.wz、Effect.wz、Etc.wz、Item.wz、Map.wz、Mob.wz、Morph.wz、Npc.wz、Quest.wz、Reactor.wz、Skill.wz、Sound.wz、String.wz、TamingMob.wz、UI.wz。

List.wz 用于输入身份核验，不作为上述 16 个数据包之一写入 FSDB。

历史全量转换约耗时数小时，Issue Agent 单轮执行有 90 分钟上限。必须先验证 converter 的 --only 分包行为和跨批次输出安全，再把 all 拆成可续接批次：

- 一个全新 fsdb-all 输出目录。
- 每个 WZ 包最多执行一次，除非明确清空该包对应输出并重新执行。
- 通过 batch-state 记录输入 SHA、converter commit、包名、输出摘要和完成状态。
- 每批不得覆盖前一批数据。
- 跨包资源路径若可能冲突，必须检测并统一分配 alias；不得依赖每个进程内存中的临时冲突表。
- 每轮 /agent revise 只继续未完成的批次，不重新扫描已完成包。
- 最终对全部输出做一次统一扫描和摘要聚合。

如果现有 --only 不能保证这些条件，先实现并测试安全的 resumable batch 驱动；不能直接对同一目录反复运行 --only 并假设它安全。

## 6. FSDB 验证与完整性判定

验证必须区分三个不同结论：

### 6.1 Well-formed（必须 PASS）

使用当前 pinned LoomRealm FSDB 实现验证：

- 根目录 [FSDB]cms。
- 仅允许规范的 struct/group/resource 表。
- 必需 .info.meta、.desc.meta、.extend.meta 完整且 Schema 正确。
- JSON / JSONL 可解析，JSONL 每行是 object。
- NameSegment、扩展名、大小写和 symlink 约束满足 content/cms_design.md。
- openFsdb、listFsdbEntries、openFsdbObject 等实际 API 可正常读取。
- resource.图 与 resource.音 的逻辑 key 和 MIME 正确。
- 同一逻辑 ResourceKey 的 contentVersion 等于对应资源字节 SHA-256。

### 6.2 Lossless accounting（必须 PASS）

- 每个源 IMG、节点、Canvas、Sound 的计数都有来源和输出/跳过理由。
- 冲突记录全部能从 WzRecordAlias 找回候选，不丢后写数据。
- 非法资源路径全部有 resourceAliases 映射；不允许无报告丢弃。
- UOL 的成功、dangling、cycle、depth_limit 分别计数，保存原始来源路径。
- 输出错误数为零；若源自身有异常，必须单独标为 SOURCE_ANOMALY。
- 任何不能解释的缺失、覆盖、转换异常均为 FAIL。

### 6.3 Integrity-valid（如实报告，不准粉饰）

历史全量报告中曾出现 65 个非法资源路径、11 个 struct key 冲突、悬空 UOL、循环 UOL、源文件不存在的图集/Portal 目标等问题。修复后必须重新测量。

- 不能把 FSDB Well-formed PASS 等同于 Integrity-valid PASS。
- 客户端源数据自身缺失的目标必须标 SOURCE_ANOMALY，并保留原始 WZ 路径和值。
- 转换器遗漏、资源覆盖、未记录别名、错误 UOL 解析必须标 CONVERTER_DEFECT。
- 全局 Integrity-valid 仍失败时，报告必须保留 FAIL / PARTIAL，不得声称全量资源完整。
- Avatar scope 所依赖的所有记录、UOL 和 Canvas 必须完整可读；Avatar 所需资源不能以 SOURCE_ANOMALY 为借口跳过。

输出新报告到 docs/validation/cms079-wz-fsdb-real-closure.md。只写计数、摘要 hash、源路径标识、异常分类和测试结果；不得写入 PNG/音频字节或大体积资源清单。

## 7. 当前 LoomRealm Content API 闭环

当前仓库 pin 的 LoomRealm commit 为 93648192323bf5f57996b7b54cbae641d8a53fdb。该版本 packages/subsystem/src/content.ts 已定义：

- ContentClient.record(namespace, key)
- ContentClient.group(namespace, key)
- ContentClient.resource(namespace, key)

历史 2026-10-27 报告中“ContentClient 没有 group()”是旧 pin 的结论，当前 pin 已有 group()，本任务必须按当前源码和当前构建产物验证，不得沿用旧结论。

使用当前 pin 的正式 FSDB Content Service / ContentClient 实现，不得只用 JSON 文件直读或仅凭一个自制 Map 假装 Content API 已通过。

至少验证：

1. record：struct.Look/00002000、00012000、00020000、00030000、01302000 和 struct.ZMap/order。
2. group：全量 FSDB 中一个真实 group 样本，例如 group.Tile/100000000（若源记录存在）；不存在时选择真实存在的 group 并记录选择依据。
3. resource：resource.图 中 AvatarPlan 实际引用的 PNG；同时从全量 FSDB 验证一条 resource.音 读取。
4. 每个响应都必须带真实 contentVersion；记录其 SHA-256、MIME 和长度。
5. 缺失资源、版本冲突、错误 MIME 必须 fail closed。
6. 不修改 LoomRealm 子模块，不更改 Content API 契约或 gitlink。

## 8. 游戏侧 AvatarPlan 适配器

现有 components/cms-actor/test/real-look-adapter.mjs 是测试适配器，不是正式游戏运行时。把可复用逻辑提升为生产模块，例如：

~~~text
systems/adventure-island/cms079-avatar-plan.mjs
~~~

具体目录可由实现者根据现有代码组织，但职责必须清晰：

- 输入是当前 LoomRealm ContentClient 或其正式只读适配层。
- 通过 record() 读取五份 Look 和 ZMap/order。
- 根据 body frame reference 正确跟随动作引用（例如 brandish1 → swingOF/stabOF）。
- 解析 head、face、hair、weapon 的实际帧与 UOL 结果。
- 只收集当前 AvatarPlan 所需的 Canvas resource keys。
- 通过 ContentClient.resource() 获取真实 contentVersion、MIME 和字节长度；验证 MIME 为 image/png，版本与内容 hash 一致。
- 构建符合 validateAvatarPlan 的有界 AvatarPlanV1。
- 计划只包含逻辑 namespace/key/contentVersion，不包含物理路径、URL、bearer、WZ 节点对象或私有 Content Index。
- 不实现未经验证的任意装备 islot/vslot 遮挡规则；本任务只使用已验证的身体、头、脸、头发和 01302000 单手武器样本。
- 测试文件复用生产适配器，不能保留两套行为不同的实现。

必须保留现有 components/cms-actor/src/cms-actor.mjs 的边界：Renderer 只接收渲染就绪的 AvatarPlan，不读取 WZ 或 FSDB。

## 9. 真实 Chromium 验收

扩展现有：

- components/cms-actor/test/real-look-adapter.mjs
- components/cms-actor/test/real-assets.local.test.mjs
- components/cms-actor/test/harness.mjs（仅在确实需要时）

要求：

- 真实测试使用独立 fsdb-avatar 或完整 fsdb-all 的真实记录和 PNG。
- 不扫描并把全量 1.4M resource 文件读入内存；只加载 AvatarPlan 实际引用的资源。
- Content 记录和 resource version 必须先经真实 ContentClient 获取。
- Renderer 资源请求通过正式 PresentationResourceClient / bootstrapWebPresentation / WebProjector 路径。
- Chromium 必须真实启动；不能用 Node canvas 或静态 DOM 检查代替。
- 环境变量 CMS_ACTOR_REAL_FSDB 指向本地 FSDB。
- Agent 本地执行时不能跳过真实测试；skip 只允许发生在没有合法客户端的通用 GitHub CI checkout 中。

必须 PASS：

1. 五份 Look 和 ZMap 记录存在，结构与来源路径一致。
2. body walk1/0 的已知基准：27×32、origin [19,32]、z=body、neck [-4,-32]、navel [-6,-20]。
3. head UOL、head neck/brow anchors、weapon hand anchor、真实 zmap order 正确。
4. AvatarPlan 小于 262,144 UTF-8 bytes，动作集合包含 stand1、walk1、jump、brandish1。
5. 所有资源引用均能通过真实 Content 资源读取，expectedContentVersion 完全匹配。
6. stand1 绘制成功；walk1 四帧像素至少三帧不同；jump 保持帧；brandish1 七帧单次播放结束后回到 locomotion。
7. facing left/right 镜像正确。
8. presentationFailures 为空；data-render-state=ready；没有缺失 Canvas 或跳过必需 layer。
9. 所有测试无 skip、无 fail、无未处理 Promise rejection。

推荐命令：

~~~bash
CMS_ACTOR_REAL_FSDB="$CMS079_WORK/fsdb-avatar" node --test components/cms-actor/test/real-assets.local.test.mjs
~~~

## 10. 回归测试、CI 与维护者职责

Agent 必须执行并报告：

~~~bash
python -m unittest discover -s tests/wz_fsdb -v
node scripts/build.mjs --check
npm test
npm run pwa:bundle
npm run pwa:staging
CMS_ACTOR_REAL_FSDB="$CMS079_WORK/fsdb-avatar" node --test components/cms-actor/test/real-assets.local.test.mjs
~~~

- Python 合成测试覆盖旧 PR #1 的修复项、phase1/all/avatar scope、跨批次 resume、FSDB 路径冲突、record alias、resource alias、UOL 四种状态。
- Node / PWA 原有测试不得回归。
- 真实素材测试必须单独执行，不能由合成测试代替。
- .github/** 是 Issue Agent 保护路径；Agent 不得修改 workflow。
- Draft PR 建立后，由维护者在同一 Issue / PR 评审中补入或更新 GitHub-hosted Python synthetic CI（例如新增 wz-fsdb synthetic job）。CI 只运行合成 fixture，不下载 /shared 客户端，不上传真实 FSDB。
- 组织 Runner 上的真实素材验证只在本地执行，日志不输出素材字节，不上传 artifact。
- 维护者必须核对 main 上的 LoomRealm gitlink、研究 Blob SHA、无素材文件、无 protected path 变更。

## 11. 允许修改与禁止修改的路径

允许（如确有需要）：

~~~text
scripts/wz_fsdb/**
tests/wz_fsdb/**
systems/adventure-island/**
components/cms-actor/test/**
components/cms-actor/IMPLEMENTATION.md
components/cms-actor/DESIGN.md
docs/validation/cms079-wz-fsdb-real-closure.md
package.json
~~~

若需新增适配器或测试，可在上述职责目录内新增文件。尽量控制在 Issue Agent Publisher 的 40 files / 900 KB 限制内。

禁止：

~~~text
.github/**
scripts/issue_agent/**
scripts/agent/**
research/**
.gitmodules
.gitignore
.raw/**
glm-work/opencode.json
glm-work/start-opencode.bat
loom-realm/**
dist/**
.work/**
~~~

此外：

- 不修改 root game.json、launch.pwa.json、launch.hostra.json、presentation.json。
- 不修改 PWA Bundle 的合成内容白名单。
- 不提交客户端、WZ、PNG、音频、FSDB、Content Index、Bearer Token、密钥或 Runner 状态。
- 不将历史 result/** 报告搬到 research/**；研究目录受保护。

## 12. 完成定义（Definition of Done）

同一个 Issue 只有在以下全部满足时才能关闭为 Completed：

- [ ] 使用同一 /shared 客户端，16 个数据 WZ 输入身份与既有 SHA 基线一致；前后哈希一致。
- [ ] wz-python 使用固定 MIT commit 79344c95774a911adf93a4d43c67e5fc51fa6e76，EMS / IV / Version 与既有交叉验证一致。
- [ ] 历史 PR #1 转换器和合成测试已基于当前 main 移植；phase1/all 语义保留。
- [ ] 新增 avatar scope，五份 Look、ZMap 和所需 Canvas 完整导出。
- [ ] 16 个 WZ 的 all 转换已通过安全批次完成；每批输入、输出和转换器版本可追溯。
- [ ] FSDB Well-formed PASS；全量 Lossless accounting PASS；所有 SOURCE_ANOMALY / CONVERTER_DEFECT 明确区分。
- [ ] 全量 Integrity-valid 状态如实报告；若因客户端原生悬空引用仍 FAIL，不能伪报 PASS，但 Avatar 所需引用必须全部 PASS。
- [ ] 当前 LoomRealm ContentClient 的 record/group/resource 都从真实 FSDB Content Service 成功读取，版本和 MIME 正确。
- [ ] 生产 AvatarPlan 适配器通过真实 ContentClient 构建有界计划。
- [ ] 真实 Chromium cms-actor 测试全部 PASS、0 skip、0 fail。
- [ ] Python 合成测试、Node 测试、PWA Bundle/Staging 回归全部通过。
- [ ] 新验证报告已提交，不含素材字节。
- [ ] PR diff 不含真实资源、研究目录修改、受保护路径、LoomRealm gitlink 修改。
- [ ] Draft PR 经过维护者审核并合并；之后历史 PR #1 关闭为 Superseded / Not merged。

若任何真实资源或 Content API 步骤未执行，只能标 BLOCKED / PARTIAL，不得以合成素材通过替代真实闭环。

## 13. 最终 PR 与历史 PR #1 处理

- 本 Issue 只创建一个 Agent Draft PR，基于当前 main。
- 不直接合并历史 PR #1，不保留旧分支作为新实现基线。
- 新 PR 合并后，在历史 PR #1 留下新 PR 链接和替代原因，并关闭为 Superseded / Not merged。
- 本任务不自动部署，也不自动更换 Adventure Island 的 Smoke Game Entry。
