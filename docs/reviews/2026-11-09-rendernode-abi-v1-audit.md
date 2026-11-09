# RenderNode ABI v1 逆向证据审计

报告版本：1  
审计日期：2026-11-09  
状态：独立技术审查。本报告不修改已冻结的 ABI。

判定用语：

| 状态 | 含义 |
|---|---|
| CONFIRMED | 本审计在指定位置直接核对到证据 |
| PARTIALLY CONFIRMED | 一部分被直接证据覆盖，其余未复核或只在部分样本成立 |
| INFERRED | 合理推断，没有对应的客户端执行证据 |
| UNVERIFIED | 当前材料不足以判定 |
| CONTRADICTED | 与本审计核对到的证据矛盾 |
| NOT APPLICABLE | 不属于当前 ABI 要表达的客户端事实 |

---

## 1. Executive Summary

本次审计要回答的问题是：当前公共 RenderNode ABI v1 里，哪些字段、数据结构和语义有本地客户端逆向或原始 CMS 数据支持，哪些只是设计推断，哪些与证据冲突。

审计范围是分支 `design/adventure-field-map-scene` 在 `3e83ad43ac8e766ca96af300380e577e9e265c5d` 上的 `components/RENDER-NODE-ABI-V1.md`，六个 MVP 组件设计，以及 LoomRealm gitlink `93648192323bf5f57996b7b54cbae641d8a53fdb` 的 Render Update v1、Web Presentation API v1 和对应实现。逆向证据来自本地 `.work/`，不以 DESIGN.md 证明其自身。

总体可信度：**PARTIALLY VERIFIED**。

协议分层本身站得住。RenderNode 五字段、one-shot key、`replace` / `update` / `emit`、receiver 顺序和资源版本校验，能够在该 pin 的契约和实现里对上。Avatar 遮挡函数的关键指令也在本机未打包映像里复核成功。

地图画面不能获得同样的结论。背景视差、Tile/Obj 排序、`zM` 遮挡、Portal 游戏动画和镜头 1:1 映射，没有在本次审计中找到对应的客户端绘制函数。能对上的是 21 张实质地图样本里的 WZ 字段名。绘制语义主要来自 `.work/task-023/tools/wz-python/wzpy/map.py`，该文件写明自己移植的是 HaCreator，不是游戏客户端。另一份第三方渲染器 WzComparerR2 的背景公式与这份合成器不一致。

最重要的发现：

1. 冻结文件在 `components/RENDER-NODE-ABI-V1.md:221` 被第二次文首截断拼入，`contentVersion` 正则不闭合。这是 commit `010af14ff2979f52719b860ceb8c9ac7905a82ec` 引入的，后续提交没有拆开它。
2. 背景 `rx/ry/type/cx` 在样本中真实存在，但 ABI 把 `rx/ry` 称为视差系数，却没有冻结公式。HaCreator 移植不做镜头视差；WzComparerR2 用镜头中心乘 `(100 + rx) / 100`，滚动类型又改用时间偏移。`cx = 0` 出现在 303 条背景中的 155 条，两套工具都把 0 换成图宽，ABI 没有写这条规则。
3. ABI 把「Obj 先于 Tile、按 `z` / `canvasZ` 排序」写成固定规则。这条规则来自 HaCreator 移植，不是已复核的客户端函数。样本里 Obj 的 `zM` 有 105 个不同值，ABI 明确不拿它做人物前后景。
4. 「已经确认可跳转的类型只有 2」与样本不符。99 个 Portal 里，类型 2 的 16 个都有真实目标图；类型 1 的 20 个里有 15 个同样有真实目标图。游戏 Portal 动画资源不在当前提取结果中。Task 023 合成器画的是 `portal/editor` 图标。
5. 客户端遮挡函数 `0x401C74` 的优先级比较和跳过绘制已经复核。生产适配器 `components/cms-actor/src/real-look-adapter.mjs` 不写 `priority` / `tag`，组件因此按实现契约把这些画布全部画上。

是否建议继续冻结：**不建议以当前文件文本继续保持 Frozen。**  
字段名骨架、协议边界和「逻辑状态留在 Field Runtime」可以保留。继续当作可实施的冻结规范之前，至少要修复文档拼接，并把未经客户端函数证实的绘制公式、排序和 Portal 画面从「已确认」改成未验证或显式的产品选择。本次审计没有修改 ABI。

---

## 2. 审计方法

### 2.1 `.work/` 检查方法

1. 列出 `.work` 全部一级目录，确认任务目录、FSDB、WZ 提取和第三方工具的位置。
2. 排除 `task-023/dotnet` SDK 后统计文件规模，避免把运行时安装包当成游戏证据。
3. 对 `properties.jsonl` 做全文件流式解析，按地图重组 `back`、`tile`、`obj`、`portal`、`foothold`、`ladderRope` 和 `info`。
4. 对 `game-image-unpacked.bin` 解析 PE，按映像基址把研究笔记中的地址换成文件偏移，用 Capstone 5.0.7 反汇编。
5. 阅读本地合成器和 WzComparerR2 源码时，把它们标成第三方/编辑器实现，不升格为客户端执行证据。

`.work` 只读。审计过程中没有改、删或提交其中的文件。

### 2.2 客户端函数分析方式

映像基址 `0x400000`，`SizeOfImage = 0x9DA000`，文件大小 10,330,112 字节，与映像大小一致。文件偏移等于 `VA - 0x400000`。SHA-256：

`d4a67597a7e1a072679c7b67c91a03a1242eab7aaa635ad8368277dc12a31718`

只复核了纸娃娃遮挡和字符串池相关入口。没有找到可复核的地图背景、Tile/Obj 排序、镜头或 Portal 动画函数。Task 060 报告中的「Ghidra 52K 函数、92.7% 语义覆盖」没有在当前 `.work` 里找到可复查的反编译正文，本审计不采用该覆盖率。

### 2.3 原始数据验证方式

数据文件：`.work/task-023/output/maple/properties.jsonl`，93,139,094 字节，558,811 条属性。

Map.wz 只有 29 个 image，其中 21 个不少于 100 条属性，8 个只有 21–29 条，视为截断样本，不进入统计。这 21 张图不是 Task 060 声称的 4,259 张全库。`.work/task-002/server` 是空目录，`extract_maps.py` 指向的 XML 树不在当前工作区，全库 CSV 也没有找到。因此 DESIGN.md 中的全库计数（18,339 个 Portal、359,124 段 foothold、165,125 个 Obj）在本次工作区不可复现。

`canvas.jsonl` 只有图标级记录，没有 Tile、Back、Obj、MapHelper 画布。Tile 的 `canvasZ`、背景 origin 和 Portal 帧无法用这份提取复核。

### 2.4 多样本覆盖

| 对象 | 本次可统计样本 | 覆盖判断 |
|---|---|---|
| 地图 | 21 张实质图，另有 8 张截断图 | 不足以下全库结论 |
| 背景 | 303 条，13 个字段齐全 | 足够否定「这些字段只是猜测」；不足覆盖 type 5/6/7 |
| Tile | 3,607 条 | 足够确认放置字段集合 |
| Obj | 1,529 条 | 足够确认常设字段；`name` / `flow` 在样本中为 0 |
| Portal | 99 个 | 足够否定「只有类型 2 会跳图」的排他说法 |
| Foothold | 2,110 段 | 足够确认样本中的字段集合 |
| Ladder/Rope | 118 条 | 足够确认样本字段 |
| Character 属性 | 13,848 条，不是全库 | 足够看到动作名和 delay 数值，不足统计全部装备 |

### 2.5 LoomRealm 核对方式

对照 submodule `loom-realm` 的 HEAD，确认它就是 pin `93648192323bf5f57996b7b54cbae641d8a53fdb`。阅读契约后再阅读 `web-projector.ts`、`presentation-resource-client.ts`、`resource-client.ts` 和 `packages/subsystem/src/render.ts`。没有用更新的上游文档代替这个 pin。

另外运行了与 AvatarPlan 边界直接相关的单元测试，见第 14 节。没有浏览器集成测试，也没有地图渲染验收。

---

## 3. 逆向资料清单

### 3.1 目录以及各自用来验证什么

| 路径 | 用途 | 本次用法 |
|---|---|---|
| `.work/task-023/output/maple/properties.jsonl` | CMS 属性提取 | 全量扫描，统计地图与人物字段 |
| `.work/task-023/output/maple/canvas.jsonl` | 画布宽高和 RGBA SHA-256 | 确认它几乎只含图标，不能证明地图画布 |
| `.work/task-023/tools/wz-python/wzpy/map.py` | 本地地图合成器 | 核对设计文档所说的 Task 023 `compose` 实际画什么 |
| `.work/task-023/tools/WzComparerR2/WzComparerR2.MapRender/` | 第三方地图渲染器 | 作为对照实现，不作为客户端证据 |
| `.work/task-036/game-image-unpacked.bin` | 客户端映像 | 反汇编 Avatar 遮挡和字符串池入口 |
| `.work/task-060/*.py` | 地图 XML 提取脚本 | 确认脚本期望的 XML 路径；该路径当前为空 |
| `.work/task-002/server/` | 脚本中的 079 XML 根 | 目录存在且为空 |
| `.work/cms-actor/[FSDB]cms/` | 已投影的人物资源和组件脚本 | 目录级确认有 Look PNG 和 ZMap；未把 PNG 当排序证据 |
| `.work/task-001` 至 `task-062` 的其余目录 | 保护、协议、登录、VM | 目录级盘点。协议和保护材料不证明渲染公式 |
| `.work/task-023/dotnet/` | .NET SDK | 排除，不是游戏数据 |

排除 dotnet SDK 后，`.work` 有 5,472 个文件、1,019 个目录。内容级打开或整文件扫描的关键文件是上面表格中的提取结果、合成器、WzComparerR2 的 Back/Obj/Tile/Portal/SceneRendering 源文件，以及客户端映像。没有逐个打开 5,472 个文件。

### 3.2 已反汇编的客户端函数

地址均为映像 VA。文件偏移 = VA - `0x400000`。

| VA | 文件偏移 | 本审计看到的指令 | 与 `research/result/63-avatar-occlusion.md` 的关系 |
|---|---|---|---|
| `0x401C74` | `0x1C74` | MSVC 安全 cookie 序言：`mov eax, 0xA84C5C; call 0xA6FC7C` | 函数入口存在。报告把它当作槽位冲突函数 |
| `0x401D90` | `0x1D90` | `mov eax, [edx+0x20]; mov ecx, [esi+0x20]; mov eax, [eax+0x18]; sub eax, [ecx+0x18]; je; test eax, eax; jge` | 与报告的「已有 priority 减当前 priority，相等走 `je`，已有值更大走 `jge`」一致 |
| `0x401FDF` | `0x1FDF` | 沿链表取包装对象 | 绘制遍历入口存在 |
| `0x401FFE` | `0x1FFE` | `cmp dword ptr [esi+0x14], 0; je 0x402232`；随后比较 `[eax+0x24]` 与 `[0xBD8FAC]` | 可见标志为 0 则跳过；脸层全局被读取 |
| `0x402442` | `0x2442` | 标准序言 | 画布装入函数入口存在 |
| `0x4024DE` | `0x24DE` | `cmp edi, dword ptr [0xBD8FAC]; jne 0x4024F8` | 与 `zmap["face"]` 不入链的比较位置一致 |
| `0x413C6B` | `0x13C6B` | `call 0x402442` | 动作帧枚举调用装入函数，调用关系成立 |
| `0x4011C6` | `0x11C6` | 标准序言 | zmap 初始化入口存在；本次没有逐指令重走枚举 |
| `0x77CE9A` | `0x37CE9A` | 标准序言 | 求交函数入口存在；循环体本次没有逐指令重推 |
| `0x77CF86` | `0x37CF86` | 标准序言，并比较 `[ebp+8]` | 读 z 的函数入口存在 |
| `0x77D236` | `0x37D236` | 标准序言 | priority/tag 填写入口存在 |
| `0x7A48D0` | `0x3A48D0` | 标准序言 | 取字符串入口存在 |
| `0x7A4A5E` | `0x3A4A5E` | 标准序言 | 懒解码入口存在 |
| `0x7A4DA9` | `0x3A4DA9` | 函数体内 `0x7A4DE8: xor byte ptr [esi], al`，`0x7A4E15: ret` | 报告把异或循环记在函数入口。异或指令在入口后 0x3F 字节，方向与报告一致 |

这 11 个函数入口都在映像里。本次完整对上控制流的是 `0x401D90`、`0x401FFE`、`0x4024DE` 和 `0x413C6B -> 0x402442`。求交、zmap 递减赋值和「结果为 0 时把密钥字节写回」没有在本次逐指令重推，保持 PARTIALLY CONFIRMED。

没有分析到的客户端函数：背景绘制、镜头变换、Tile/Obj 排序、`zM` 比较、Portal 动画选择、Foothold 碰撞、Rope 攀爬。这些缺口是地图 ABI 不能升到 CONFIRMED 的原因。

### 3.3 原始数据来源

- 属性：`.work/task-023/output/maple/properties.jsonl`
- 画布索引：同目录 `canvas.jsonl`
- 客户端映像：`.work/task-036/game-image-unpacked.bin`
- 人物 FSDB：`.work/cms-actor/[FSDB]cms/`
- 全库 XML：脚本 `.work/task-060/extract_maps.py:8` 指向 `.work/task-002/server/079V5/wz/Map.wz/Map`。该 server 目录当前为空。

### 3.4 已检查与未检查

已检查：字段存在性、缺省是否真的出现、Portal `pt` 与 `tm` 的关系、Avatar 遮挡关键指令、LoomRealm pin 的投影顺序和资源版本校验。

未检查：动态运行客户端、断点下的绘制顺序、Back/Tile/Obj/MapHelper 二进制画布、4,259 张地图全库、NPC/Reactor/Seat 的画面资源。第 10 节单独列出。

已有研究笔记 `research/result/63-avatar-occlusion.md` 被当作待复核对象。其关键指令复核通过后，才把对应结论标为 CONFIRMED 或 PARTIALLY CONFIRMED。`research/result/60-map-extraction-complete.md` 的全库计数没有可复查的 CSV 或 XML，不作为本次 CONFIRMED 证据。

---

## 4. LoomRealm 协议兼容性审查

Pin 与工作区 submodule HEAD 相同：`93648192323bf5f57996b7b54cbae641d8a53fdb`。

### 4.1 兼容

| 议题 | 证据 | 结论 |
|---|---|---|
| RenderNode 只有 `key/tag/attrs/data/children` | `loom-realm/doc/15-contracts/render-update-v1.md:298-304` | CONFIRMED |
| key 为 Domain 内 Unicode scalar、大小写敏感、不归一化、全树唯一 | 同文件 `:321-335` | CONFIRMED。ABI 前半 `:66` 与此一致 |
| 已发布 key 删除后不得复用 | 同文件 `:337-342`；`packages/subsystem/test/render-manager.test.mjs` 对 reused key 抛错 | CONFIRMED |
| 同一 live key 的 tag 不变 | 同文件 `:350-353`、`:384` | CONFIRMED |
| children 顺序是权威同级顺序 | 同文件 `:319` | CONFIRMED |
| `update` 不能改 key、tag、children | 同文件 `:729`；`packages/subsystem/src/render.ts:38-42` 的接口与 ABI `:86-108` 同形 | CONFIRMED |
| data delta 对组件呈现为完整 data | `web-presentation-api-v1.md:175-177`；`web-projector.ts:346-351` | CONFIRMED |
| Event 不进入 retained tree、不重放 | `render-update-v1.md:20` 的核心原则；`web-presentation-api-v1.md:162` | CONFIRMED |
| 对象键顺序不构成 data 变化，数组顺序构成变化 | `web-presentation-api-v1.md:187-200` | CONFIRMED |
| 新元素顺序是 context、可能 connect、children、attrs、data | `web-presentation-api-v1.md:137-146`；`web-projector.ts:253-355` 先 `receiveRenderContext`，再插入，再 `setAttribute`，最后 `receiveRenderData` | CONFIRMED |
| `connectedCallback` 不能假设 attrs/data 已就绪 | `web-presentation-api-v1.md:151` | CONFIRMED |
| 资源版本格式 `sha256:` 加 64 位小写十六进制 | `presentation-resource-client.ts:6`、`:92` | CONFIRMED。实现会拒绝不匹配的字符串 |
| 返回版本必须等于请求版本 | `resource-client.ts:77` 在不等时抛 `conflict` | CONFIRMED。ABI 还要求组件再校验一次，这是额外应用层检查，不与协议冲突 |
| 返回字节由调用方持有 | `presentation-resource-client.ts:105` 复制出新的 `Uint8Array` | CONFIRMED |
| Context 只有 `resources` 与 `emitCustomEvent` | `web-presentation-api-v1.md:37-44` | CONFIRMED。ABI 前半 `:164` 与契约一致 |
| Render Update v1 没有通用 data 字节上限 | `render-update-v1.md:788`、`:1156` | CONFIRMED。ABI `:698-707` 把 262,144 和 4,096 标成组件级限制，这个区分是对的 |
| `zIndex` 是 signed safe integer，不属于 Node | `render-update-v1.md:403-408`；ABI `:78` | CONFIRMED |

`sceneEpoch` 不放进 attrs/data、只用来生成新 key，符合 one-shot 规则。这是为了满足协议而做的产品策略，不是客户端行为。

### 4.2 部分兼容

| 议题 | 证据 | 结论 |
|---|---|---|
| ABI 对 `update` 的空 delta 没有复述 | 协议 `:731-742` 规定空 `set` / 空 `remove` 非法。ABI `:86-108` 没有写这条 | PARTIALLY CONFIRMED。子系统实现会拒绝，ABI 摘要漏了前提 |
| generation 重置 wire 身份 | 协议 `:141-159`。ABI 只写「wire Domain 生命周期」 | PARTIALLY CONFIRMED。用语能覆盖，但没有明确写出新 DataAuthority generation 可以复用相同 key 字符串 |
| `emitCustomEvent` 的第三参数 | 契约 `:40-43` 只有 `name` 和 `data`。`web-projector.ts:257-260` 还有可选 `options` | PARTIALLY CONFIRMED。不传 options 的组件与契约一致；实现比契约多一个可选参数 |
| 文件前半与后半的类型写法 | 前半 `:128-147` 使用 `DeepReadonly` 和 `InputEventV1["payload"]`，与契约一致。`:349-361` 的重复副本改成了较宽的 `JsonObject` | 见 P0。有效文本应以前半和契约为准 |

### 4.3 不兼容

冻结文件作为一份规范文本是不兼容于「单一 normative 文档」这一要求的。详见 P0-001。协议实现本身没有因此分叉；分叉的是 Adventure Island 这份 ABI 文件。

### 4.4 缺乏证据

本审计没有运行 LoomRealm 的完整 qualification suite，只运行了 cms-actor 的 AvatarPlan 单元测试。协议结论来自 pin 上的契约、实现和该组件测试，不是来自一次新的端到端投影实验。

---

## 5. RenderNode 五字段审查

以下以文件前半 `:39-79` 和协议原文为准。`:283-299` 是被拼进去的旧副本，措辞更弱，不应当作后写的修订。

| 字段 | 当前设计 | 证据 | 结论 | 风险 |
|---|---|---|---|---|
| `key` | 非空 Unicode scalar，大小写敏感，不归一化，Domain 全树唯一，删除后不得复用 | `render-update-v1.md:321-342` | CONFIRMED | LOW |
| `tag` | 非空 Unicode scalar；live key 上不可变；由 `createElement` 创建 | 同文件 `:363-384`；projector `:253` | CONFIRMED | LOW |
| `attrs` | 字符串到字符串；值可为空；协议不限制 UTF-8 长度 | 同文件 `:386-395` | CONFIRMED | LOW。4,096 字节是 cms-actor 的应用限制，不是本字段的协议限制 |
| `data` | 普通 JSON object；组件收到完整对象 | projector `:346-351` | CONFIRMED | LOW |
| `children` | 有序；组件不得重排 light DOM | 协议 `:319`；projector `:328-337` 按身份顺序 `insertBefore` | CONFIRMED | LOW |

附加约束核对：

- key 不是 HTML `id`。协议把它定义为 wire identity。CONFIRMED。
- key 不需要 Subsystem 全局唯一，只需要当前 wire Domain 内唯一。CONFIRMED。
- one-shot 约束存在，而且跨同一 generation 的 carrier 重连继续有效。CONFIRMED。
- tag 不允许在同一 live key 上改变。CONFIRMED。
- attrs 值必须是字符串。CONFIRMED。业务布尔和整数进 attrs 前必须序列化，这是协议要求，不是客户端数据原样。
- data 必须是 JSON object，不能是数组或原始值。CONFIRMED。
- children 顺序权威。CONFIRMED。
- 结构变化，包括插入、删除、移动和 children 变化，走 `replace`。CONFIRMED。
- 已存在节点的 attrs/data 顶层变化走 `update`。CONFIRMED。
- ABI 没有给协议增加「key 全局永久唯一」或「data 有通用字节上限」。前半文本没有错误加严。旧副本删掉了 Unicode scalar 和 signed safe integer，读到后半会得到更弱的规则。这是文档损坏，不是协议本身更严。

`cms-actor` 在 `connectedCallback` 里用缺失属性回退到 0 再画（`components/cms-actor/src/cms-actor.mjs:279-291`）。这与「当时 attrs 可能未到」兼容，因为随后的 `attributeChangedCallback` 会再同步坐标。`disconnectedCallback`（`:160-169`）会中止请求、取消动画帧并清空缓存。这条生命周期在该组件实现里成立。其他五个 MVP 组件还没有对应实现。

---

## 6. 六个 MVP 组件详细审查

### 6.1 `cms-scene-view`

#### 当前设计

根节点。必需 attrs 是 `map`、`x`、`y`。data 只有 `scenePlan`：`formatVersion`、`bounds`，以及可选 `debug.footholds` / `debug.ropes`。`x/y` 被定义为视口左上角世界坐标，Y 向下，无 zoom，世界像素与 CSS 像素 1:1，`screen = world - camera`。ABI `:500-503`。

#### 原始客户端行为

本次没有找到镜头函数。不能从客户端证明左上角、Y 向下或 1:1。

本地两套渲染代码的镜头用法不同：

- `wzpy/map.py:876-877` 把世界点减去矩形左上角再乘 scale。scale 默认 1，但接口允许到 4。
- WzComparerR2 `FrmMapRender2.SceneRendering.cs:849-862` 的背景偏移使用 `Camera.Center`，不是左上角。

因此「左上角」和「1:1」是产品选择。它与 HaCreator 移植的默认导出一致，与 WzComparerR2 的背景镜头点不一致。

#### 原始数据结构

21 张实质图的 `info` 都有 `version`、`cloud`、`town`、`mobRate`、`bgm`、`returnMap`、`forcedReturn`、`mapMark`。`VRLeft/VRTop/VRRight/VRBottom` 四项同时出现在 14 张图。没有 `link`。7 张图有 `fly`，18 张有 `swim`。样本 `info` 里没有 zoom 字段。

`101040000.img` 的 `miniMap` 为 width 4000、height 1533、centerX 1414、centerY -949、mag 4。中心 Y 为负，说明世界原点不在画面上沿，Y 坐标可以穿过 0。这只证明坐标有正有负，不能单独证明轴方向。

Foothold 2,110 段只有 `x1,y1,x2,y2,prev,next`。样本中没有 `force` 和 `forbidFallDown`。Rope 118 条都有 `x,y1,y2,l,uf,page`；`l = 1` 的 24 条，其余 94 条 `l = 0`。

#### 字段逐项验证

| 字段 | 结论 |
|---|---|
| `map` | 产品标识。样本 image 路径含地图编号。CONFIRMED 为数据身份，不是客户端镜头字段 |
| `x` / `y` 为视口左上角 | INFERRED。合成器这样用；WzComparerR2 背景使用中心点。无客户端函数 |
| Y 向下 | INFERRED。两套本地渲染器都按屏幕 Y 向下解释。无客户端函数 |
| 无 zoom、1:1 | 产品选择。样本 info 无 zoom 字段，只能算旁证。UNVERIFIED 作为客户端事实 |
| `bounds` | 14/21 有完整 VR，可直接表达。其余 7 张图的回退公式来自 `map.py:383-410`，不是客户端函数。PARTIALLY CONFIRMED |
| `debug.footholds` 四端点 | 与样本字段一致。CONFIRMED 为几何字段。`prev/next` 被 ABI 正确地留给运行时 |
| `debug.ropes` 的 `x,y1,y2,l` | 与样本一致。CONFIRMED。`uf` 和 `page` 没有进入 debug，设计说留给移动。无客户端函数证明它们不影响画面。INFERRED |
| Camera 由 Field Runtime 决定 | 与「组件不拥有权威状态」一致，是架构选择。CONFIRMED 为 ABI 边界，不是客户端结构 |

#### 缺失、不确定与风险

`bounds` 不足以表达「没有 VR 时客户端实际裁剪什么」，因为回退算法未在客户端证实。`mag` 出现在小地图样本中，ABI 没有这个字段；它更像小地图比例而不是世界 zoom，本次未验证。

`cloud`、`swim`、`fly`、`fieldLimit`、`bgm` 在样本 info 中出现。ABI 不把它们放进 scene-view。以「它们不是这张像素画的几何」而言，这个排除是合理的产品边界；`swim` / `fly` 是否改变可移动区域，没有客户端函数。标 UNVERIFIED，不把排除写成已证实的客户端事实。

#### 建议

保持 Camera 在 Runtime。在 ABI 里把 1:1 和左上角写成产品坐标约定，并写明它尚未由客户端镜头函数证实。不要把 HaCreator 的 bounds 回退写成客户端算法。

### 6.2 `cms-back`

#### 当前设计

必需 attrs：`back-set,index,animation,x,y,parallax-x,parallax-y,background-type,tile-step-x,tile-step-y,flip,opacity`。data 只有 `backPlan`。`front` 不进 attrs，只决定树中远景段或近景段。缺省由 Adapter 填：animation 0、视差和步长 0、flip false、opacity 255、type 0。

#### 原始客户端行为

没有客户端背景函数。

HaCreator 移植 `map.py:790-837`：

- `ani != 0` 读 `Back/{bS}.img/ani/{no}`，否则读 `back/{no}`。
- type 1、3、4、6、7 横向重复；2、3、5、6、7 纵向重复。
- type 4、6 把 `rx * time_ms / 200` 加到 x；5、7 对 `ry` 做同样的事。
- 非滚动类型不使用镜头。注释 `:598-601` 写明游戏背景相对移动镜头做视差，而这份导出为了整图合成没有实现该视差。
- `cx` 或 `cy` 为 0 时用图宽或图高。

WzComparerR2 `BackItem.cs:77-90` 的 type 表与上面的平铺/滚动分类一致，并增加了本样本没有的 `spineAni`、`flowX/flowY`、`w/wx/wy`、`screenMode`。`SceneRendering.cs:809-862`：

- `cx` 或 `cy` 为 0 且需要平铺时，用渲染尺寸替换。
- 滚动类型：`offset = rate * referenceDistance * time / 20000`。
- 非滚动类型：`position += Camera.Center * (100 + r) / 100`。

两套工具的 type 分类相同，滚动公式的分母一个是 200、一个是 20000，镜头项一个缺失、一个使用中心点。都不能代替客户端。

#### 原始数据结构

303 条背景全部含有且仅含：`bS,no,x,y,rx,ry,type,cx,cy,f,a,front,ani`。没有缺字段，也没有额外字段。因此 ABI 的缺省表在这 21 张图上不会被触发；它仍可能被其他图需要，本次不能证实缺省值。

| 观测 | 数量 |
|---|---|
| `type` 0 / 1 / 2 / 3 / 4 | 60 / 101 / 34 / 35 / 73 |
| `type` 5 / 6 / 7 | 0 |
| `front` 0 / 1 | 279 / 24 |
| `ani` 0 / 1 | 271 / 32 |
| `f` 0 / 1 | 300 / 3 |
| `a` 255 / 224 | 302 / 1 |
| `cx = 0` | 155 |
| `rx = 0` | 17 |

`101040000.img` 的前三条：

- back/0：`bS=dryRock,no=0,type=3,cx=0,cy=0,rx=0,ry=0,front=0,a=255`
- back/1：`type=0,rx=-2,ry=-5,x=7,y=-438`
- back/2：`type=4,rx=5,ry=-5`

`rx` 可以为负。`y` 可以为负。`f` 和 `a` 在源数据里是整数，不是布尔和 CSS 透明度。

#### 字段逐项验证

| ABI | 源 | 结论 |
|---|---|---|
| `back-set` | `bS` | CONFIRMED，样本全部存在 |
| `index` | `no` | CONFIRMED |
| `animation` | `ani` | CONFIRMED 为 0/1 选择。它不包含帧延迟；帧在 `backPlan` |
| `x` / `y` | `x` / `y` | CONFIRMED 为源整数。它们是锚点还是已经含镜头，无客户端函数。INFERRED 为锚点 |
| `parallax-x` / `parallax-y` | `rx` / `ry` | PARTIALLY CONFIRMED 为同一对整数。一个名字同时覆盖视差系数和滚动速率，公式 UNVERIFIED |
| `background-type` | `type` | CONFIRMED 为源整数。样本只有 0–4。5/6/7 的平铺表 UNVERIFIED |
| `tile-step-x` / `tile-step-y` | `cx` / `cy` | CONFIRMED 为源整数。0 的含义在两套工具里是「改用图尺寸」，ABI 未写。PARTIALLY CONFIRMED |
| `flip` | `f` | 样本只有 0/1。映射到 `"true"/"false"` 是产品编码。方向是水平翻转，来自 `map.py:784-786`，无客户端函数。INFERRED |
| `opacity` | `a` | 样本值在 0..255。除以 255 是工具做法（`map.py:899-902`）。计算方式 UNVERIFIED 作为客户端事实 |
| `front` 只决定树位置 | `front` | 样本 0/1 都存在。合成器先画 0、Portal 和生命体之后再画 1（`map.py:625-710`）。无客户端函数。INFERRED |
| `backPlan.frames` | 预解析帧 | 资源本体不在本次 Map 提取中。UNVERIFIED |
| `loop` | 无同名源字段 | 产品字段。INFERRED |
| `delay` | 未在背景样本中提取到 | 人物 delay 见 6.5。背景帧延迟 UNVERIFIED |
| origin | 画布向量 | 背景画布不在提取中。人物 origin 可为负，见 6.5 |

#### 每个 background type 的映射

| type | 样本条数 | HaCreator 移植 | WzComparerR2 | 客户端 | ABI 现状 |
|---|---|---|---|---|---|
| 0 | 60 | 不重复、不按时间滚动、也不做镜头视差 | 不重复；位置加镜头中心视差 | UNVERIFIED | 只保存类型数字 |
| 1 | 101 | 横向重复 | 横向平铺加镜头视差 | UNVERIFIED | 只保存类型数字 |
| 2 | 34 | 纵向重复 | 纵向平铺加镜头视差 | UNVERIFIED | 只保存类型数字 |
| 3 | 35 | 双向重复 | 双向平铺加镜头视差 | UNVERIFIED | 只保存类型数字 |
| 4 | 73 | 横向重复，并按 `rx * t / 200` 滚动 | 横向滚动，分母 20000，参考距离通常 100 | UNVERIFIED | 只保存类型数字 |
| 5 | 0 | 纵向重复和滚动 | 纵向滚动 | UNVERIFIED | 无样本 |
| 6 | 0 | 双向重复，水平滚动 | 双向平铺加水平滚动 | UNVERIFIED | 无样本 |
| 7 | 0 | 双向重复，垂直滚动 | 双向平铺加垂直滚动 | UNVERIFIED | 无样本 |
| 其他 | 0 | 当 type 0 | 当 None | UNVERIFIED | 无拒绝规则 |

#### 风险与建议

P1。只保存 `rx` 而不冻结公式，两个已有实现会画出不同背景。`cx = 0` 若被当成步长 0，155 条背景的平铺会错。

建议：在未取得客户端函数前，不要把某一套公式写进冻结 ABI 冒充已证实。应把公式标成未验证，并规定 `cx/cy = 0` 的产品解释。若要复刻画面，必须先选定并验证一套公式，再决定它属于 ABI 还是组件实现。

### 6.3 `cms-map-layer`

这是本次重点之一。

#### 当前设计

`layer` 为 `"0"` 到 `"7"`，可选 `tile-set`。data 为 `mapLayerPlan`：`assets`、`tiles`、`objs`。Tile asset 必须有 `canvasZ`，Obj asset 不得有。Obj 放置有 `z`，Tile 放置没有 `z`。排序是 Obj 组先于 Tile 组，Obj 按 `z`，Tile 按 `canvasZ`，同值保持源顺序。`zM` 保留但不参与 MVP 遮挡。`reactor` / `name` 排除。`r` / `flow` 未确认时必须报 unsupported。

#### 原始客户端行为

没有客户端排序函数。

`map.py:631-667` 的排序键是 `(layer, 0, obj.z, order)` 与 `(layer, 1, canvas.z, tileName)`，然后按该元组排序。这就是 ABI 规则的直接来源。文件头 `:1-7` 写明移植 HaCreator 的 `MapLoader` / `BoardItemsManager`。

WzComparerR2 的 `TileItem.cs` 不读取放置项上的 z，`ObjItem.cs` 读取放置项 `z`，但不读取 `zM`。在已搜索的 MapRender 源码中没有 `zM` 标识符。因此「MVP 不按 zM 分带」与这份第三方渲染器一致，仍然不是客户端证据。

#### 原始数据结构

八个层节点在 21 张图上都存在。层 4–7 在 `101040000.img` 里各只有容器节点，没有放置项。ABI「空层不建节点」是产品选择，与「WZ 里仍有空层节点」不冲突。

Tile 3,607 条的字段恰好是 `x,y,u,no,zM`。没有放置级 `z`，没有 `f`。`u` 的分布：`bsc` 1,484，`enH1` 672，`enH0` 646，`enV0` 225，`enV1` 224，`edD` 168，`edU` 157，斜边 `slRU/slLU/slRD/slLD` 共 31。这支持「不是等宽矩阵」的设计判断，该判断来自数据形状，不是来自绘制函数。

Obj 1,529 条全部有 `oS,l0,l1,l2,x,y,z,f,zM`。额外字段只有 `r` 337 条和 `reactor` 221 条。`r` 的值全部是 `"0"`。样本中没有 `name`、`flow`、`rx`、`ry`、`cx`、`cy`。

Obj `zM` 有 105 个不同值。出现最多的是 0（281）、1（68）、2（64）、3（57），并继续分布到至少 12 以上。它不是恒为 0 的占位字段。

`oS/l0/l1/l2` 在样本中是字符串路径分量，例如 `oS=connect,l0=rope,l1=0` 和 `oS=guide,l0=tutorial,l1=suryun,l2=0`。合成器用它们拼 `Obj/{oS}.img/{l0}/{l1}/{l2}`。这是数据路径，资源文件本身不在本次提取中。

#### Tile

| 问题 | 结论 |
|---|---|
| TileSet 结构 | 层 `info/tS` 在有瓦片的层上出现，如 `101040000` 层 1 为 `dryRock`。PARTIALLY CONFIRMED。图集内部结构未提取 |
| Canvas 尺寸 | UNVERIFIED。无 Tile 画布记录 |
| Canvas origin | UNVERIFIED |
| 放置 x/y | CONFIRMED 为整数世界坐标。样本有负 x |
| `u/no` 定位资源 | 合成器如此拼接。PARTIALLY CONFIRMED 为字段；文件是否存在未在本次打开 |
| Tile 的 z | 放置记录没有 z。`canvasZ` 来自合成器读取画布 `z`。UNVERIFIED，因为没有画布样本 |
| foothold 元数据是否影响 Tile 画面 | 样本 foothold 与 tile 是不同节点。无证据表明 foothold 改变 Tile 像素。INFERRED 为不影响画面 |
| 额外绘制状态 | 放置记录没有 flip、alpha 或其他状态。CONFIRMED 于这 3,607 条 |

#### Obj

| 问题 | 结论 |
|---|---|
| `oS/l0/l1/l2` | CONFIRMED 为路径分量 |
| `x/y/z/f/zM` | CONFIRMED 为放置字段。`z` 和 `zM` 的绘制含义未由客户端函数证实 |
| 是否必须保留 `r` | 样本中出现 337 次且恒为 0。保留与否对这 21 张图的像素没有可见差异。全库是否出现非 0，UNVERIFIED |
| `reactor` / `name` | `reactor` 在样本中有 221 条，适合留在逻辑数据。`name` 在样本中为 0。设计文档的 3,697 个 `name` 不可复现 |
| `flow` | 样本 0 条。设计文档说未确认，与「不能静默当静态图」不冲突。全库是否存在，UNVERIFIED |
| `rx/ry/cx/cy` | 样本 Obj 上为 0。WzComparerR2 的 `moveType/moveW/moveH/moveP` 在 Obj 资源而不是放置项上，且属于更新客户端字段。CMS 样本未出现。UNVERIFIED |
| 未表达字段 | 样本里视觉候选只剩恒为 0 的 `r` |

#### 绘制顺序

| 规则 | 证据级别 |
|---|---|
| 小 layer 先于大 layer | HaCreator 移植。INFERRED |
| 同层 Obj 整组先于 Tile | 同上。INFERRED |
| Obj 按放置 `z` 升序 | 同上。INFERRED |
| Tile 按画布 `z` 升序 | 同上，且画布 z 未提取。UNVERIFIED |
| 同 z 保持源顺序 | 合成器把枚举序号放进排序键。INFERRED |
| `zM` 影响人物遮挡 | 数值分布说明它携带信息。客户端比较函数未找到。UNVERIFIED |
| 前景物件要拆层 | ABI 明确不拆。这是 MVP 限制，不是已证实的客户端结构 |

人物整层画在八层之后，使 `zM` 无法让人走到物件后面。若客户端确实用 `zM` 做这件事，当前树表达不了。本次不能把「客户端确实这样做」标成 CONFIRMED，也不能把 ABI 的省略标成已经证明无害。

#### 风险与建议

P1。排序被写成冻结事实，证据等级是编辑器移植。

建议：把排序句子改成「当前产品采用 HaCreator 移植的顺序，客户端函数未复核」。`canvasZ` 在拿到 Tile 画布样本前不要当成已测量字段。`zM` 继续保留是对的，因为样本证明它有变化；不要在没有函数时发明分带公式。`r` 恒 0 的样本可以不挡 MVP，但 Adapter 遇到非 0 仍应按现有 unsupported 规则失败。

### 6.4 `cms-avatar-layer`

#### 当前设计

attrs 和 data 都是空对象。MVP 恰好一个 `cms-actor`。不承载 NPC 或怪物。

#### 原始客户端行为

`research/result/task050-field-map.md:4-5` 有一行：`FieldDispatcher` 的 `+0x24` 是 avatar layers，样本 #2。同页没有给出 `GetAvatarLayer` 的反汇编，也没有证明该层画在八个地图层之后、Portal 之前。`components/cms-avatar-layer/DESIGN.md:5` 把这行写成了绘制位置结论。本次没有在映像里复核 `+0x24`。

生命体在 HaCreator 移植里画在八层之后、Portal 之前（`map.py:669-705`），并且先全部 Mob 再全部 NPC。那是编辑器顺序，不是 `+0x24` 的证明。

#### 字段验证

| 项 | 结论 |
|---|---|
| 空 attrs / 空 data | 产品容器。NOT APPLICABLE 于客户端字段 |
| 恰好一个 Actor | MVP 范围。客户端 `+0x24` 若是 layers 复数，则多角色是客户端能力。PARTIALLY CONFIRMED 为 MVP 限制，不是客户端上限 |
| 不放 NPC / Mob | 与样本 `life` 节点分离一致。`101040000` 有 `life/0/type=m`。把它们排除是 MVP 范围，不是「客户端没有这些对象」 |
| 多个 Actor | 当前 ABI 禁止。未来需要新的 children 规则。现有 key 策略可以容纳更多稳定 key，但冻结文本不允许 |

#### 风险与建议

容器本身没有伪造客户端字段，这是干净的。风险是设计文档把未复核的 `+0x24` 当成了绘制顺序证据。建议把该句降为未验证。MVP 单玩家可以维持，但应明确它不表达 `zM` 分带，也不表达 Mob/NPC。

### 6.5 `cms-actor`

#### 当前设计

必需 attrs：`x,y,locomotion,facing,skin,face,hair,expression,equips`。`locomotion` 只有 `stand/walk/jump`，`facing` 只有 `left/right`。data 只有 `avatarPlan`，schema 以 `IMPLEMENTATION.md` 为唯一组件级规范。一次性动作走 `action` Event。每个 attr 值不超过 4,096 UTF-8 字节。AvatarPlan compact JSON 不超过 262,144 字节。

#### 原始客户端行为

遮挡函数已按第 3.2 节复核。报告中的公式是：

```text
priority = max(zmap[token] for token in islot)
tag      = vslot ∩ smap[z]
zIndex   = zmap[z]
```

`components/cms-actor/src/avatar-model.mjs:333-359` 的 `occludedLayers` 实现了「输掉一个槽则整张不画、输掉前占用的槽保留、priority 相等则都留、face 不进这次比较」。单元测试覆盖了这三条。实现与已复核的 `0x401D90` / `0x401FFE` 方向一致。求交函数体和 zmap 递减编号没有在本次逐指令重推。

`real-look-adapter.mjs:6-9` 写明生产 CMS079 计划只保留实际绘制的 z 名，因为 `zOrder` 上限是 64，而客户端 zmap 更长。同文件不写 `priority` 和 `tag`。`IMPLEMENTATION.md:23` 写明没有这两个字段的计划全部照画。因此生产路径不会执行已复核的遮挡函数。

自研 `adventure-adapter.mjs:241-264` 会写这两个字段。两条适配器路径不一致。

#### 原始数据结构

Character.wz 这 13,848 条不是全库。根上能看到的动作名包括 `stand1`、`stand2`、`walk1`、`walk2`、`jump`、`prone`、`fly`、`alert`、`proneStab`，以及多组 `swing*` / `stab*`。`prone` 和 `fly` 各出现在 21 个已提取 image 的根上。

delay 样本：`Face/00020135.img` 的 `blink/0,1,2` 为 60；`vomit/0` 为 120；披风 default 为 90。全部 delay 值只有 60、90、110、120、150、240、1640。数量级符合毫秒，不符合「每帧 1 个 tick」的小整数序列。本次没有找到读取 delay 的客户端定时器，所以单位仍是 PARTIALLY CONFIRMED。

origin 样本含负数：`Cap/01002065.img` 的 `info/icon/origin` 为 `-2,20`，`Accessory/01122003.img` 为 `-1,24`。层名 `z` 是字符串，例如 `cap`、`backCap`，与地图 Obj 的整数 `z` 不是同一个字段。

帧顺序在 WZ 里是数字键。适配器 `numericKeys` 按数值排序。本次没有客户端循环证明数字键顺序就是播放顺序，但提取结构与这个读法一致。PARTIALLY CONFIRMED。

#### 必须回答的问题

1. `locomotion` 枚举不够覆盖已提取动作。`prone`、`fly` 是独立动作根，不是 `action` Event 能自然表达的持续状态。`stand2` / `walk2` 说明武器会改变动作名；这可以由 `avatarPlan.locomotionActions` 吸收，前提是计划里真有这些动作。结论：枚举作为 MVP 移动子集可以成立，作为客户端动作集合则不完整。PARTIALLY CONFIRMED。
2. `facing` 只有 left/right。本次没有复核 stance 字节。DESIGN.md 自己也把它列为未解。UNVERIFIED。
3. `face` / `hair` 的八位路径在提取中存在，例如 `Face/00020135.img`。`skin` 的十进制格式本次没有重推到身体 image。face/hair PARTIALLY CONFIRMED，skin UNVERIFIED。
4. `equips` 逗号字符串是 ABI 编码。客户端没有这个字符串。作为接口编码是稳定的，只要编号集合和顺序规则固定。顺序不参与遮挡已经由 `0x401C74` 的 priority 比较支持：部件数组顺序不决定谁隐藏谁。CONFIRMED 为产品编码；遮挡不看逗号顺序，PARTIALLY CONFIRMED。
5. AvatarPlan 的层级信息在自研适配器里包含 `z`、`priority`、`tag`、anchors、origin、delay。生产 CMS 适配器省略 `priority/tag`。对客户端遮挡而言不完整。PARTIALLY CONFIRMED。
6. 遮挡算法与已复核指令一致，但生产计划不喂给它。算法 PARTIALLY CONFIRMED，生产路径 CONTRADICTED。
7. delay 数值像毫秒。客户端消费者 UNVERIFIED。实现 `frameDuration` 对 delay 取绝对值（`avatar-model.mjs:362-365`），ABI 要求非负。测试名也写 magnitude。
8. 数字帧键按数值排序是适配器行为。PARTIALLY CONFIRMED。
9. `source` 矩形规则在测试里有校验。真实 CMS 图集是否使用 source rect，本次没有画布页样本。UNVERIFIED。
10. 动作切换时，实现把 one-shot 记在私有状态，播完回到当时的 locomotion。这是组件状态机。客户端是否在落地帧有额外混合，UNVERIFIED。
11. `action` Event 适合一次性挥砍，不适合 `prone` / `fly` 这类持续状态。PARTIALLY CONFIRMED。
12. 262,144 是 `avatar-model.mjs:21-23` 的组件常量，测试明确拒绝超过它的计划。协议 `render-update-v1.md:788` 没有这个通用上限。ABI 的区分 CONFIRMED。它不是客户端限制。
13. 4,096 是组件 attr 策略。协议 `:395` 不限制 attrs UTF-8 长度。CONFIRMED 为工程约束。浏览器包 `components/cms-actor/browser/cms-actor.browser.js:248-252` 仍把 262,144 说成 “frozen Render Update v1 cap”，与源码和 ABI 矛盾。

#### 缺失与建议

P1 是生产计划缺少遮挡字段。建议让 CMS 适配器写入 `priority` 和 `tag`，或者让 validator 在声称客户端一致时拒绝缺字段的计划。这是适配器和实现文档的修改；若要把「CMS 计划必须带这两个字段」写成公共 schema，才需要改 ABI 所指向的 AvatarPlan 契约。

`locomotion` 不必为了本次证据立刻加入全部动作，但冻结文本应写明 `prone`、`fly`、`ladder`、`sit` 不在 v1，避免被读成客户端只有三种动作。

### 6.6 `cms-portal`

#### 当前设计

必需 attrs：`portal-name,portal-type,x,y,flip`，可选 `hide-tooltip`。data 只有 `portalPlan`。MVP 只启用「已经确认可跳转」的类型 2。`tm,tn,script,delay,onlyOnce` 和触发范围留在 Field Runtime。

#### 原始客户端行为

没有 Portal 绘制或碰撞函数。

`map.py:855-873` 使用 `MapHelper.img/portal/editor` 的第 `pt` 个子节点当图标。这正是设计文档说不能冒充游戏画面的编辑器图标。合成器的默认 `portals=False`，打开后画的也是 editor。

WzComparerR2 `PortalItem.cs:46` 有一张类型名表，下标 2 是 `pv`，下标 1 是 `pi`，下标 0 是 `sp`。这与「类型 2 对应 pv」的历史说法一致，但是第三方表，不是本客户端函数。当前提取没有 MapHelper，无法核对这些目录是否存在于这套 CMS。

#### 原始数据结构

99 个 Portal。字段出现次数：`pn,pt,x,y,tm,tn` 各 99，`script` 19，`hideTooltip` 9，`delay` 9，`onlyOnce` 5。没有 `f`、`hRange`、`vRange`、`image`。

| pt | 个数 | `tm = 999999999` | 其他 tm |
|---|---|---|---|
| 0 | 56 | 56 | 0 |
| 1 | 20 | 5 | 15 |
| 2 | 16 | 0 | 16 |
| 7 | 7 | 7 | 0 |

类型 0 的名字是 `sp`，目标是哨兵值。类型 2 全部有真实目标，例如结构上就是跨图。类型 1 同样有跨图样本：`101040000` 的 `in00`，`pt=1`，`tm=101040001`，`tn=out00`。类型 1 也有同图传送：`702090203` 的 `st00` 到 `st01`。类型 7 全部是哨兵 tm，并带 `script`，例如 `MD_mushroom`、`raid_stage`。

`hideTooltip` 的样本值是整数 0，不是布尔。`delay` 样本值是 0。`onlyOnce` 样本值是 0。它们的运行语义没有客户端函数。

#### 必须回答的问题

1. `pt` 的意义：0 在样本中是出生点；2 在样本中全部跨图；1 既有跨图也有同图；7 在样本中是脚本入口。其余类型无样本。PARTIALLY CONFIRMED。没有函数说明画面目录。
2. 类型 2 适合作为「一种」可跳转类型。它不是样本中唯一可跳转类型。ABI 的「已经确认」排他表述与数据 CONTRADICTED。
3. 游戏 Portal 资源来源：当前提取和 `[resource]图` 盘点都没有 MapHelper。UNVERIFIED。
4. `portalPlan` 能否表达画面：结构上能表达帧、origin 和资源版本。没有真实帧可填。UNVERIFIED。
5. origin 和动画：无样本。UNVERIFIED。
6. 触发范围：样本没有 `hRange/vRange`。默认矩形没有客户端函数。UNVERIFIED。
7. `delay`：源字段存在，数值 0。不能区分冷却、传送延迟或其他。UNVERIFIED。留在 Runtime 是对的。
8. `onlyOnce`：字段存在，无状态机证据。留在 Runtime 是对的。UNVERIFIED 其生命周期。
9. `tm/tn/script` 留在 Runtime：与「组件不切换地图」一致。样本证明这些字段存在且类型 7 依赖 script。这个排除 CONFIRMED 为正确的架构边界。
10. 视觉字段遗漏：`f` 在 99 个样本中不存在，但 ABI 把 `flip` 列为必需。`image` 在样本中不存在；更新客户端的 WzComparerR2 会读它，这套样本不支持把它加进 v1。`hideTooltip` 有样本，可选 attr 合理。

#### 风险与建议

P1。不要用 editor 图标填 `portalPlan`。不要把类型 2 写成唯一已确认跳转类型。类型 1 至少应被标成「样本中同样携带目标图，画面和碰撞仍未验证」。`flip` 在源字段缺失时不应是无默认值的必需 attr。

### 6.7 组件评级

| 组件 | 评级 | 依据 |
|---|---|---|
| `cms-scene-view` | PARTIALLY VERIFIED | 边界和调试几何的字段集合有样本；镜头约定无客户端函数 |
| `cms-back` | PARTIALLY VERIFIED | 13 个源字段全部对上；公式、`cx=0` 和 type 5/6/7 未证实 |
| `cms-map-layer` | PARTIALLY VERIFIED | 放置字段对上；排序和 `canvasZ` 没有客户端函数，`zM` 有数据但无算法 |
| `cms-avatar-layer` | PARTIALLY VERIFIED | 空容器不伪造字段；客户端层偏移只有一行笔记 |
| `cms-actor` | PARTIALLY VERIFIED | 遮挡关键指令已复核；生产计划不使用它；动作枚举小于提取结果 |
| `cms-portal` | PARTIALLY VERIFIED | 名字、类型、坐标和逻辑字段边界有样本；类型 2 排他说法与样本冲突；游戏画面缺失 |

---

## 7. 跨组件架构审查

### 7.1 场景树

ABI 顺序是：远景 back、layer 0..7、avatar-layer、portal、近景 back。

HaCreator 移植的顺序是：`front=0` back、八层 Obj/Tile、全部 Mob、全部 NPC、Reactor、Portal、`front=1` back，最后才是 foothold/rope 辅助线。

相同部分是远景、八层、Portal、近景的相对大顺序。不同部分是：

- 合成器在人物层的位置画的是 Mob 和 NPC，不是一个空的 avatar-layer。
- 合成器在 Portal 之前还画 Reactor。
- 客户端是否把人物插进 Obj 的 `zM` 带，未知。
- 近景 back 盖住 Portal，只被合成器证实。

当前树表达不了「同一 layer 内，人在某个 Obj 前面、在另一个 Obj 后面」。这是已知结构限制。证据等级：数据证明 `zM` 有变化；算法 UNVERIFIED。

### 7.2 节点身份

`sceneEpoch` 策略与 one-shot key 兼容。稳定的 scene-view、avatar-layer 和 actor key 在换图时不删除，也符合协议。A → B → A 必须使用新 epoch，这个推断正确，因为旧 portal/layer key 已被消耗。

协议还允许新的 DataAuthority generation 重新开始 wire 宇宙。ABI 没有把这句话写出来。若 Runtime 用换 generation 代替换 epoch，key 字符串可以重用；若仍在同一 generation，则必须换 epoch。两者不能混用。这是文档清晰度问题，不是当前策略错误。

### 7.3 权威状态

| 数据 | ABI 归属 | 审计判断 |
|---|---|---|
| Camera | attrs 呈现值，决策在 Runtime | 架构正确。坐标语义本身未证实 |
| Actor 位置、速度、碰撞 | 位置是呈现值，速度和碰撞在 Runtime | 架构正确 |
| Locomotion | 呈现枚举 | 枚举小于客户端动作集合 |
| Foothold / Rope | debug 可选，权威在 Runtime | 与样本字段分工一致 |
| Portal 传送 | Runtime | 正确。类型 1 的目标图也不能交给组件 |
| 动画时钟 | 组件私有 | 与 Event 不进 retained state 一致。delay 单位未完全证实 |
| 遮挡 | AvatarPlan 可选字段 | 客户端函数要求这些字段；可选导致生产路径丢行为 |

组件反向修改游戏状态：契约只给 `emitCustomEvent`，并且要求不在回调栈里重入。ABI 这条与协议一致。本次没有做一次投影测试去观察实际重入。

### 7.4 版本与扩展

每个 plan 有 `formatVersion: 1`，未知字段要求 Adapter 拒绝。这能防止静默漂移。NPC、Reactor、Seat 被明确排除在冻结 schema 之外，扩展路径是新的 tag schema，而不是把字段塞进现有 plan。这个策略足够支持后续组件，前提是不要复用已删除的 key。

资源版本用内容哈希，与 pin 的资源客户端一致。它不能表达「同一 WZ 路径在不同客户端版本的语义变化」，因为语义不在哈希里。哈希只保证字节。

主要版本缺口不是缺一个版本号，而是同一份冻结文件里有两套前言。

---

## 8. ABI 逐字段审查矩阵

证据列使用第 3–6 节的定位。风险按该字段若被实现者照字面使用时的后果。

### 8.1 RenderNode 与协议机制

| 组件 | 字段 | 当前设计 | 逆向证据 | 结论 | 风险 |
|---|---|---|---|---|---|
| RenderNode | `key` | Domain one-shot 身份 | `render-update-v1.md:321-342` | CONFIRMED | LOW |
| RenderNode | `tag` | live key 上不变 | 同文件 `:350-384` | CONFIRMED | LOW |
| RenderNode | `attrs` | 字符串映射 | 同文件 `:386-395` | CONFIRMED | LOW |
| RenderNode | `data` | JSON object，完整投递 | `web-projector.ts:346-351` | CONFIRMED | LOW |
| RenderNode | `children` | 权威顺序 | projector `:328-337` | CONFIRMED | LOW |
| Domain | `zIndex` | signed safe integer，不属于 Node | ABI `:78`；协议 zIndex 条款 | CONFIRMED | LOW |
| Domain | `replace` | 结构变化 | `render.ts:39` | CONFIRMED | LOW |
| Domain | `update` | 只改已存在 attrs/data | `render-update-v1.md:729` | CONFIRMED | LOW |
| Domain | 空 delta | 未复述 | 协议 `:731-742` | PARTIALLY CONFIRMED | LOW |
| Domain | `emit` | transient，不进树 | 协议核心原则 | CONFIRMED | LOW |
| Receiver | `receiveRenderContext` | 插入前一次 | `web-presentation-api-v1.md:137-150` | CONFIRMED | LOW |
| Receiver | `receiveRenderData` | 完整 data，结构变化才再送 | 同文件 `:175-200` | CONFIRMED | LOW |
| Receiver | `receiveRenderEvent` | 不重放 | 同文件 `:162` | CONFIRMED | LOW |
| Receiver | `connectedCallback` | 不能假设 attrs 已到 | 同文件 `:151` | CONFIRMED | LOW |
| Receiver | `disconnectedCallback` | 组件清理资源 | `cms-actor.mjs:160-169` 有实现；协议要求元素移除 | PARTIALLY CONFIRMED | LOW |
| Context | `resources` | 逻辑读取 | `presentation-resource-client.ts:91-106` | CONFIRMED | LOW |
| Context | `emitCustomEvent` | 唯一反向通道 | 契约 `:40-43` | CONFIRMED | LOW |
| Resource | `namespace` | 逻辑命名空间 | 客户端校验段名 | CONFIRMED 为协议 | LOW |
| Resource | `key` | 层级 key | 同上 | CONFIRMED 为协议 | LOW |
| Resource | `contentVersion` | `sha256:` + 64 hex | 实现正则；ABI `:221` 正则被截断 | CONTRADICTED 作为文件文本；规则本身 CONFIRMED | HIGH |
| Resource | 返回 `bytes` | 调用方所有 | 客户端复制 Uint8Array | CONFIRMED | LOW |
| Resource | 返回 `mime` | 组件再校验 | 传输层读取 content-type | CONFIRMED 为协议能力 | LOW |
| Resource | `source` | 非负整数矩形，且等于逻辑宽高 | Avatar 测试有这条；地图画布未提取 | PARTIALLY CONFIRMED | MEDIUM |
| Resource | origin | 有限数，可为负 | 人物样本有负 origin | PARTIALLY CONFIRMED | LOW |
| 版本 | `formatVersion: 1` | 每个 plan 必需 | 产品规则 | NOT APPLICABLE 于客户端 | LOW |
| 版本 | 未知字段拒绝 | Adapter 必须拒绝 | 产品规则 | NOT APPLICABLE 于客户端 | LOW |
| 容量 | 262,144 | cms-actor 应用上限 | `avatar-model.mjs:21-23`；协议无通用上限 | CONFIRMED 为应用限制 | LOW |
| 容量 | attr 4,096 | cms-actor 应用上限 | 协议不限制长度 | CONFIRMED 为应用限制 | LOW |
| 身份 | `sceneEpoch` | 只进 key，不进 data | 符合 one-shot | CONFIRMED 为协议策略 | LOW |
| 身份 | 稳定 actor key | 换图不删除 | 符合协议 | CONFIRMED 为协议策略 | LOW |

### 8.2 `cms-scene-view`

| 组件 | 字段 | 当前设计 | 逆向证据 | 结论 | 风险 |
|---|---|---|---|---|---|
| cms-scene-view | `map` | 地图编号字符串 | image 路径中的编号 | CONFIRMED 为身份 | LOW |
| cms-scene-view | `x` | 视口左上角世界坐标 | 合成器减去矩形左边；WzComparer 背景用中心 | INFERRED | HIGH |
| cms-scene-view | `y` | 同上，Y 向下 | 两套渲染器按屏幕向下解释；无客户端函数 | INFERRED | HIGH |
| cms-scene-view | 1:1 / 无 zoom | 冻结规则 | 样本 info 无 zoom；合成器仍有 scale 参数 | INFERRED，产品选择 | MEDIUM |
| cms-scene-view | `scenePlan.formatVersion` | 1 | 产品 | NOT APPLICABLE | LOW |
| cms-scene-view | `bounds.left/top/right/bottom` | 世界边界 | 14/21 有 VR；其余回退在 `map.py:383-410` | PARTIALLY CONFIRMED | MEDIUM |
| cms-scene-view | `debug.footholds.x1/y1/x2/y2` | 辅助线 | 2,110 段都有这四项 | CONFIRMED 为数据 | LOW |
| cms-scene-view | foothold `prev/next` | 不在 ABI | 样本全部有 | 排除合理，属 Runtime | LOW |
| cms-scene-view | foothold `force/forbidFallDown` | 设计称全库有少数非 0 | 本次 2,110 段没有这两个字段 | UNVERIFIED | LOW |
| cms-scene-view | `debug.ropes.x/y1/y2/l` | 辅助线 | 118 条都有 | CONFIRMED 为数据 | LOW |
| cms-scene-view | rope `uf/page` | 不在 debug | 样本全部有 | INFERRED 为移动字段 | LOW |
| cms-scene-view | children | 五段固定顺序 | HaCreator 移植近似；无客户端函数 | INFERRED | HIGH |

### 8.3 `cms-back`

| 组件 | 字段 | 当前设计 | 逆向证据 | 结论 | 风险 |
|---|---|---|---|---|---|
| cms-back | `back-set` | `bS` | 303/303 | CONFIRMED | LOW |
| cms-back | `index` | `no` | 303/303 | CONFIRMED | LOW |
| cms-back | `animation` | `ani` | 271 个 0，32 个 1 | CONFIRMED | LOW |
| cms-back | `x` | 锚点 | 源整数，可为任意有限数 | PARTIALLY CONFIRMED | MEDIUM |
| cms-back | `y` | 锚点 | 样本含 -438 | PARTIALLY CONFIRMED | MEDIUM |
| cms-back | `parallax-x` | `rx` 视差系数 | 工具一用时间，工具二用镜头中心 | PARTIALLY CONFIRMED | HIGH |
| cms-back | `parallax-y` | `ry` | 同上，且样本含负数 | PARTIALLY CONFIRMED | HIGH |
| cms-back | `background-type` | `type` | 样本 0–4；无 5/6/7 | PARTIALLY CONFIRMED | HIGH |
| cms-back | `tile-step-x` | `cx` | 155 条为 0；工具把 0 当图宽 | PARTIALLY CONFIRMED | HIGH |
| cms-back | `tile-step-y` | `cy` | 与 cx 同时为 0 的样本存在 | PARTIALLY CONFIRMED | HIGH |
| cms-back | `flip` | `f` 转布尔 | 300 个 0，3 个 1；水平方向来自工具 | PARTIALLY CONFIRMED | MEDIUM |
| cms-back | `opacity` | `a`，0..255 | 302 个 255，1 个 224 | PARTIALLY CONFIRMED | LOW |
| cms-back | `front` | 不进 attr，只分树段 | 279 个 0，24 个 1；合成器分两段画 | INFERRED | MEDIUM |
| cms-back | 缺省值 | 缺字段时填 0/false/255 | 这 303 条没有缺字段 | UNVERIFIED | MEDIUM |
| cms-back | `backPlan.formatVersion` | 1 | 产品 | NOT APPLICABLE | LOW |
| cms-back | `backPlan.loop` | 布尔 | 无同名源字段 | INFERRED | LOW |
| cms-back | `frames[]` | 非空 | 背景画布未提取 | UNVERIFIED | HIGH |
| cms-back | `frames[].delay` | 毫秒，缺省为停留 | 背景帧未提取 | UNVERIFIED | MEDIUM |
| cms-back | `frames[].resource` | 逻辑引用 | 协议格式已证实；背景字节未提取 | PARTIALLY CONFIRMED | HIGH |
| cms-back | `frames[].source` | 可选，整页内矩形 | 无背景图集样本 | UNVERIFIED | MEDIUM |
| cms-back | `frames[].width/height` | 正整数 | 无背景画布 | UNVERIFIED | MEDIUM |
| cms-back | `frames[].origin` | 有限点 | 无背景画布；人物 origin 可为负 | UNVERIFIED 于背景 | MEDIUM |
| cms-back | children | 空 | 产品 | NOT APPLICABLE | LOW |

### 8.4 `cms-map-layer`

| 组件 | 字段 | 当前设计 | 逆向证据 | 结论 | 风险 |
|---|---|---|---|---|---|
| cms-map-layer | `layer` | `"0"`..`"7"` | 21 张图都有 8 个层节点 | CONFIRMED 为数据分层 | LOW |
| cms-map-layer | `tile-set` | `info/tS`，可省略 | 有瓦片的层带 tS，如 dryRock | PARTIALLY CONFIRMED | LOW |
| cms-map-layer | `formatVersion` | 1 | 产品 | NOT APPLICABLE | LOW |
| cms-map-layer | `assets[]` | 去重资源 | 产品投影 | NOT APPLICABLE | LOW |
| cms-map-layer | `assets[].id` | plan 内唯一 | 产品 | NOT APPLICABLE | LOW |
| cms-map-layer | `assets[].kind` | `tile` 或 `obj` | 两类源节点确实分开 | CONFIRMED 为分类 | LOW |
| cms-map-layer | `assets[].resource` | 逻辑引用 | Tile/Obj 图像未提取 | UNVERIFIED | HIGH |
| cms-map-layer | `assets[].source` | 可选矩形 | 无画布页 | UNVERIFIED | MEDIUM |
| cms-map-layer | `assets[].width/height` | 正整数 | 无画布 | UNVERIFIED | HIGH |
| cms-map-layer | `assets[].origin` | 有限点 | 无画布；合成器用画布 origin | UNVERIFIED | HIGH |
| cms-map-layer | `canvasZ` | Tile 必需，Obj 禁止 | 合成器读画布 z；提取中无此字段 | UNVERIFIED | HIGH |
| cms-map-layer | `tiles[].assetId` | 引用 tile asset | 产品 | NOT APPLICABLE | LOW |
| cms-map-layer | `tiles[].x/y` | 放置坐标 | 3,607 条都有，含负数 | CONFIRMED | LOW |
| cms-map-layer | `tiles[].zM` | 保留，不参与 MVP 绘制 | 放置记录全部有 zM | CONFIRMED 为数据；绘制 UNVERIFIED | MEDIUM |
| cms-map-layer | Tile `u/no` | 不进放置项，只用于选 asset | 3,607 条都有 u 和 no | CONFIRMED 为定位字段 | LOW |
| cms-map-layer | Tile 放置 `z` | 不存在 | 3,607 条确实没有 | CONFIRMED | LOW |
| cms-map-layer | Tile flip | 不存在 | 样本没有 f | CONFIRMED 于样本 | LOW |
| cms-map-layer | `objs[].assetId` | 由 oS/l0/l1/l2 决定 | 四字段 1,529 条都有 | CONFIRMED 为路径 | MEDIUM |
| cms-map-layer | `objs[].x/y` | 放置坐标 | 全部有 | CONFIRMED | LOW |
| cms-map-layer | `objs[].z` | 排序值 | 全部有；排序来自 HaCreator | PARTIALLY CONFIRMED | HIGH |
| cms-map-layer | `objs[].zM` | 保留但不分带 | 105 个不同值 | CONFIRMED 为数据；算法 UNVERIFIED | HIGH |
| cms-map-layer | `objs[].flip` | `f` 转布尔 | 全部有 f | PARTIALLY CONFIRMED | MEDIUM |
| cms-map-layer | `reactor` | 排除出视觉 ABI | 221 条有该字段 | CONFIRMED 为逻辑关联字段的存在 | LOW |
| cms-map-layer | `name` | 排除 | 样本 0 条 | UNVERIFIED | LOW |
| cms-map-layer | `r` | 未确认则 unsupported | 337 条且全部为 0 | PARTIALLY CONFIRMED | LOW |
| cms-map-layer | `flow` | 未确认则 unsupported | 样本 0 条 | UNVERIFIED | MEDIUM |
| cms-map-layer | Obj 组先于 Tile 组 | 冻结排序 | `map.py:649-664` | INFERRED | HIGH |
| cms-map-layer | 同值保持源顺序 | 冻结 | 合成器把序号放进键 | INFERRED | MEDIUM |
| cms-map-layer | children | 空，整层批量画 | 产品，避免一瓦片一节点 | NOT APPLICABLE | LOW |

### 8.5 `cms-avatar-layer` 与 `cms-actor`

| 组件 | 字段 | 当前设计 | 逆向证据 | 结论 | 风险 |
|---|---|---|---|---|---|
| cms-avatar-layer | attrs | 空 | 无对应客户端字段 | NOT APPLICABLE | LOW |
| cms-avatar-layer | data | 空 | 同上 | NOT APPLICABLE | LOW |
| cms-avatar-layer | children | 恰好一个 cms-actor | `+0x24` 只有一行笔记 | PARTIALLY CONFIRMED 为 MVP | MEDIUM |
| cms-actor | `x` | 身体原点世界坐标 | 无客户端脚点函数；组件把它当 CSS left/top | INFERRED | MEDIUM |
| cms-actor | `y` | 同上 | 同上 | INFERRED | MEDIUM |
| cms-actor | `locomotion` | stand/walk/jump | 提取还有 prone、fly、stand2、walk2 | PARTIALLY CONFIRMED | HIGH |
| cms-actor | `facing` | left/right | stance 拆分未复核 | UNVERIFIED | MEDIUM |
| cms-actor | `skin` | 十进制字符串 | 本次未重推身体编号 | UNVERIFIED | MEDIUM |
| cms-actor | `face` | 八位编号 | `Face/00020135.img` 等路径 | PARTIALLY CONFIRMED | LOW |
| cms-actor | `hair` | 八位编号 | Hair 路径存在于提取 | PARTIALLY CONFIRMED | LOW |
| cms-actor | `expression` | 非空表情名 | `blink`、`vomit` 等节点存在 | PARTIALLY CONFIRMED | LOW |
| cms-actor | `equips` | 逗号分隔 | 产品编码；遮挡不看这个顺序 | CONFIRMED 为编码 | LOW |
| cms-actor | attr ≤ 4096 | 组件策略 | 协议不限制 | CONFIRMED 为工程约束 | LOW |
| cms-actor | `avatarPlan` | 唯一 data | 产品 | NOT APPLICABLE | LOW |
| cms-actor | `priority` | 实现可选 | `0x401D90` 比较 `+0x18` | PARTIALLY CONFIRMED；生产适配器未写 | HIGH |
| cms-actor | `tag` | 实现可选 | `0x77CE9A` 入口存在，循环未重推 | PARTIALLY CONFIRMED | HIGH |
| cms-actor | `z` / `zOrder` | 绘制顺序 | `0x4024DE` 比较脸层全局 | PARTIALLY CONFIRMED | MEDIUM |
| cms-actor | `zOrder` 最多 64 | 组件上限 | 适配器称客户端 zmap 更长，只保留使用到的名字 | PARTIALLY CONFIRMED | MEDIUM |
| cms-actor | anchors / origin | 计划内点 | 样本 origin 可为负 | PARTIALLY CONFIRMED | LOW |
| cms-actor | frame delay | 毫秒 | 数值 60–1640；无定时器函数 | PARTIALLY CONFIRMED | MEDIUM |
| cms-actor | `delay: 0` | 立即推进 | 产品规则 | UNVERIFIED 于客户端 | LOW |
| cms-actor | 缺 delay | 停留 | 产品规则 | UNVERIFIED 于客户端 | LOW |
| cms-actor | source 矩形 | 与宽高相等 | 测试有；真实图集页未证 | UNVERIFIED | MEDIUM |
| cms-actor | 262,144 | 应用上限 | 测试拒绝超限；协议无此上限 | CONFIRMED | LOW |
| cms-actor | 浏览器包错误文案 | 仍称协议上限 | `cms-actor.browser.js:248-252` | CONTRADICTED | MEDIUM |
| cms-actor | Event `action` | 一次性动作 | 提取有 swing/stab 动作根 | PARTIALLY CONFIRMED | MEDIUM |
| cms-actor | children | 空 | 产品 | NOT APPLICABLE | LOW |

### 8.6 `cms-portal`

| 组件 | 字段 | 当前设计 | 逆向证据 | 结论 | 风险 |
|---|---|---|---|---|---|
| cms-portal | `portal-name` | `pn` | 99/99 | CONFIRMED | LOW |
| cms-portal | `portal-type` | `pt`，MVP 只启用已确认的类型 2 | 类型 1 的 15/20 也有真实 tm | 字段 CONFIRMED；排他结论 CONTRADICTED | HIGH |
| cms-portal | `x` | 世界坐标 | 99/99 | CONFIRMED 为源整数 | LOW |
| cms-portal | `y` | 世界坐标 | 99/99，含负数 | CONFIRMED 为源整数 | LOW |
| cms-portal | `flip` | 必需，来自 `f` | 99 个都没有 `f` | CONTRADICTED 作为必需源字段 | MEDIUM |
| cms-portal | `hide-tooltip` | 可选 | 9 个 `hideTooltip`，样本值为 0 | PARTIALLY CONFIRMED | LOW |
| cms-portal | `portalPlan` | 帧动画 | MapHelper 不在提取中 | UNVERIFIED | HIGH |
| cms-portal | `portalPlan.loop` | 布尔 | 无源字段 | INFERRED | LOW |
| cms-portal | `frames[]` | 游戏动画 | 合成器使用 editor 图标 | UNVERIFIED；editor 不能当证据 | HIGH |
| cms-portal | frame delay/origin/source | 同 RasterFrame | 无 Portal 画布 | UNVERIFIED | HIGH |
| cms-portal | `tm` | 留在 Runtime | 类型 0/7 为哨兵，类型 1/2 有目标 | CONFIRMED 为逻辑字段 | LOW |
| cms-portal | `tn` | 留在 Runtime | 99/99 有该字段 | CONFIRMED 为逻辑字段 | LOW |
| cms-portal | `script` | 留在 Runtime | 类型 7 样本带脚本名 | CONFIRMED 为逻辑字段 | LOW |
| cms-portal | `delay` | 留在 Runtime | 9 条，样本值 0 | UNVERIFIED 语义 | LOW |
| cms-portal | `onlyOnce` | 留在 Runtime | 5 条，样本值 0 | UNVERIFIED 语义 | LOW |
| cms-portal | `hRange/vRange` | 留在 Runtime | 样本没有 | UNVERIFIED | MEDIUM |
| cms-portal | `image` | 不在 v1 | 样本没有；更新客户端渲染器有 | NOT APPLICABLE 于这套样本 | LOW |
| cms-portal | children | 空 | 产品 | NOT APPLICABLE | LOW |
| cms-portal | Render Event | MVP 无 | 传送不应由组件发出 | CONFIRMED 为架构 | LOW |

---

## 9. 问题与风险清单

### P0

#### P0-001 冻结 ABI 文件被截断并拼接了第二份前言

- 涉及：`components/RENDER-NODE-ABI-V1.md:220-221` 与 `:434-435`
- 当前设计：一份 Frozen normative 文本，`contentVersion` 必须匹配 `^sha256:[0-9a-f]{64}$`。
- 证据：commit `010af14ff2979f52719b860ceb8c9ac7905a82ec` 的 diff 在替换第 212 行附近时，把第二次文首插进了正则中间。`:221` 在 `` `^sha256:[0-9a-f]{64} `` 处直接接上 `# Adventure Island RenderNode ABI v1`。`:435` 以中文逗号开头，才是被拆开的后半句。`git blame` 显示 `:1-220` 含后续身份和 DeepReadonly 修订，`:221-435` 仍是这次插入的旧副本。
- 影响：正则不能被实现；第 2–4 节有两套措辞。旧副本丢掉了 Unicode scalar、不归一化、`zIndex` signed safe integer、`DeepReadonly` 和 InputEvent payload。
- 修复：删掉插入的第二份第 1–4 节，把 `:221` 与 `:435` 恢复成一句完整规则。保留 `:221` 之后真正新增的 source 非负整数和 canvasZ 约束。
- 是否需要改变 ABI：需要改变文件文本。这是修复损坏，不是改字段语义。在此之前不应继续称该文件为单一冻结规范。

### P1

#### P1-001 背景公式未证实，且两个本地实现互相不一致

- 涉及：`parallax-x`、`parallax-y`、`background-type`、`tile-step-x`、`tile-step-y`
- 当前设计：`rx/ry` 是视差系数，`cx/cy` 是平铺步长，缺省 0。
- 证据：303 条字段齐全；155 条 `cx=0`；type 只有 0–4。`map.py:813-837` 对非滚动类型不做镜头视差，滚动分母是 200，0 步长换成图尺寸。`SceneRendering.cs:809-862` 使用镜头中心和分母 20000。无客户端函数。
- 影响：按任一现有工具实现都会和另一工具不同；把 0 当步长 0 会错画一半以上的样本背景。
- 修复：先不要把公式升格为已证实。选定一套前，用客户端函数或动态画面对照验证。明确写出 `cx/cy=0` 的解释。
- 是否需要改变 ABI：若继续只保存整数、不保存公式，可以不改字段；必须改规范句子，避免「视差系数」被当成已经证实的唯一含义。把公式写死则是 ABI 或实现文档的实质变更，当前证据不够。

#### P1-002 地图排序被冻结，但证据是 HaCreator 移植

- 涉及：`cms-map-layer` 排序、`canvasZ`、`z`、`zM`、场景树
- 当前设计：Obj 组先于 Tile，分别按 `z` 和 `canvasZ`；`zM` 不参与人物分带；人物层在全部地图层之后。
- 证据：`map.py:1-7`、`:649-667`。Tile 画布不在提取中，`canvasZ` 无法测量。Obj `zM` 有 105 个值。WzComparerR2 的已搜索源码不读 `zM`。无客户端排序函数。
- 影响：若客户端把人物插在 Obj 之间，MVP 树画不出「走到物件后面」。排序本身可能对，也可能只是编辑器习惯。
- 修复：把该段标成未验证的产品顺序。取得客户端函数前，不要写「固定」来表示客户端事实。`zM` 继续保留。
- 是否需要改变 ABI：字段可以保留。规范性句子需要改成证据等级相符的说法。是否把人物拆进 zM 带，是后续 ABI 结构变更，现在没有函数足以设计它。

#### P1-003 Portal 类型 2 的排他结论与样本冲突，且游戏画面缺失

- 涉及：`portal-type`、`portalPlan`
- 当前设计：只启用已经确认可跳转的类型 2；`portalPlan` 表达游戏动画。
- 证据：类型 2 的 16/16 有真实 `tm`；类型 1 的 15/20 也有。类型 0 和 7 在样本中不跳图。`map.py:855-873` 画 editor 图标。properties 和 FSDB 都没有 MapHelper。
- 影响：按「只有类型 2」会漏掉样本中更多的类型 1 出口。用 editor 图标会把编辑器标记当成游戏画面。
- 修复：改写「已经确认」这句。类型 2 可保留为 MVP 画面试验类型，同时记录类型 1 也有目标图。`portalPlan` 在 MapHelper 游戏目录被提取并核对前保持未验证，禁止用 editor 填充。
- 是否需要改变 ABI：需要改这句规范性文字。不一定要立刻把类型 1 放进 MVP 画面。

#### P1-004 已复核的遮挡函数没有进入 CMS 生产计划

- 涉及：AvatarPlan 的 `priority`、`tag`；`real-look-adapter.mjs`；`IMPLEMENTATION.md:23`
- 当前设计：没有这两个字段就全画。
- 证据：`0x401D90` 的减法与条件跳转；`0x401FFE` 在标志为 0 时跳到 `0x402232`。生产适配器不写字段。自研适配器写字段。
- 影响：真实 CMS 人物会画出客户端会隐藏的帽子、头发和衣服层。
- 修复：CMS 适配器按 `research/result/63-avatar-occlusion.md` 已复核的部分写入 `priority` 和 `tag`。求交函数体仍应再逐指令复核一次。
- 是否需要改变 ABI：公共 ABI 把 schema 委托给 IMPLEMENTATION。可以只改适配器和实现文档。若要让「缺字段即全画」不再适用于声称客户端一致的计划，需要收紧 AvatarPlan 契约。

### P2

#### P2-001 Portal `flip` 是必需 attr，样本没有源字段

- 涉及：`cms-portal.attrs.flip`
- 证据：99/99 没有 `f`。
- 影响：Adapter 必须发明 `"false"`，否则校验失败。
- 修复：改成可选，缺省 false；或写明缺省来自「样本没有该字段」。
- 是否需要改变 ABI：需要，若必需集合要和数据一致。

#### P2-002 `locomotion` 小于已提取的动作集合

- 涉及：`locomotion`，以及未列入的 `prone`、`fly`、`stand2`、`walk2`
- 证据：Character 提取的动作根。
- 影响：梯子、趴下、飞行不能用当前枚举表达。`action` Event 覆盖不了持续状态。
- 修复：在 ABI 写明这些动作不在 v1。不要把它读成客户端只有三种。
- 是否需要改变 ABI：需要一句范围声明。加入新枚举值会改变冻结枚举，应等动作选择函数。

#### P2-003 浏览器包仍把 262,144 称作协议上限

- 涉及：`components/cms-actor/browser/cms-actor.browser.js:248-252`
- 证据：源码 `avatar-model.mjs:242` 已经改成应用层上限；协议 `:788` 没有通用上限。
- 影响：运行浏览器包的人会得到与 ABI 相反的错误文本。
- 修复：重新生成浏览器包。
- 是否需要改变 ABI：不需要。ABI 文本是对的。

#### P2-004 全库统计不可复现

- 涉及：DESIGN.md 中的 4,259 图、18,339 Portal、359,124 foothold、165,125 Obj、类型分布。
- 证据：`extract_maps.py:8` 的目录是空的；当前提取只有 21 张实质图。
- 影响：设计里的缺省频率和类型占比不能被另一位工程师复查。
- 修复：把 XML 或统计产物重新放进可复查的本地证据，或从设计句子里去掉不可复查的精确计数。
- 是否需要改变 ABI：不需要改字段。需要改引用这些计数的设计句子。

#### P2-005 画面资源样本不足

- 涉及：`canvasZ`、背景/Tile/Obj/Portal 的 origin、宽高、source、MapHelper。
- 证据：`canvas.jsonl` 只有图标；properties 没有 Back/Tile/Obj/MapHelper image。
- 影响：资源计划的几何字段还没有被这套提取证实。
- 修复：提取这些 image 的画布元数据后再冻结几何约束的「已测量」说法。
- 是否需要改变 ABI：现在不改字段。不要把未测量字段写成已验证。

#### P2-006 镜头 1:1 与 bounds 回退是产品算法

- 涉及：`cms-scene-view` 的 `x/y` 和 `bounds`
- 证据：见 6.1。样本无 zoom 字段，只是旁证。
- 影响：实现者会把产品约定当成客户端测量结果。
- 修复：在规范里标明坐标约定的证据等级。
- 是否需要改变 ABI：需要改说明，不需要改字段名。

#### P2-007 delay 单位没有客户端定时器证据

- 涉及：`RasterFrameV1.delay`，以及 Avatar 帧。
- 证据：数值集合 `{60,90,110,120,150,240,1640}`。
- 影响：若客户端用另一时钟基准，动画会整体变快或变慢。
- 修复：找到读取 delay 的函数后再把「毫秒」从推断改成确认。
- 是否需要改变 ABI：现在不改。保持「毫秒」为当前产品解释，并在审计状态里留成部分证实。

#### P2-008 Avatar `zOrder` 上限与完整 zmap 的关系只在适配器注释里

- 涉及：`maxZOrderEntries: 64`
- 证据：`real-look-adapter.mjs:6-9`。本次没有重新导出 zmap 计数。
- 影响：若一帧使用的 z 名超过 64，计划会被拒绝。适配器打算只放使用到的名字，这条路可能可行，但没有用全量 zmap 复核。
- 修复：用本地 zmap 记录数一次实际帧的 z 名数量。
- 是否需要改变 ABI：不需要，除非 64 被证明不够。

### P3

#### P3-001 `update` 空 delta 规则没有复述

- 证据：`render-update-v1.md:731-742`
- 影响：按 ABI 摘要构造空 update 会在子系统被拒绝。
- 修复：在 ABI 的写入语义下补一句。
- 是否需要改变 ABI：只补说明。

#### P3-002 generation 重置没有写明

- 证据：`render-update-v1.md:141-159`
- 影响：换 generation 与换 sceneEpoch 可能被重复使用或被错误禁止。
- 修复：写明 one-shot 历史属于 generation 内的 wire Domain。
- 是否需要改变 ABI：只补说明。

#### P3-003 `frameDuration` 对 delay 取绝对值

- 证据：`avatar-model.mjs:362-365`；测试名 “uses WZ delay magnitude”。
- 影响：负 delay 会被当成正时间，而 ABI 要求非负。
- 修复：与 validator 对齐，拒绝负数，而不是取绝对值。
- 是否需要改变 ABI：不需要。

#### P3-004 `r`、`name`、`flow` 的全库说法超出当前样本

- 证据：`r` 恒 0；`name` 和 `flow` 为 0。
- 影响：设计文档中的大计数不能指导 unsupported 频率。
- 修复：把这些计数标成当前不可复现。
- 是否需要改变 ABI：不需要。现有 unsupported 规则可以留着。

#### P3-005 `FieldDispatcher+0x24` 被设计文档写成绘制结论

- 证据：`research/result/task050-field-map.md:4-5` 只有一行，没有指令。
- 影响：avatar-layer 的位置会被误认为已经由客户端证实。
- 修复：改 DESIGN.md 的措辞。
- 是否需要改变 ABI：不需要。

---

## 10. 未验证事项

以下各项不能从本次材料升格为事实：

1. 背景绘制函数，以及 `type` 0–7 的客户端分支。
2. `rx/ry` 在非滚动类型上是不是镜头视差，滚动时的时间分母是不是 200 或 20000。
3. `cx/cy = 0` 在客户端是不是替换成图尺寸。
4. 镜头是左上角还是中心，Y 轴方向的实际变换，是否存在 zoom。
5. Tile/Obj 的组间顺序、同 z 稳定性，以及 `zM` 与人物的比较。
6. Tile 画布上的 `z`、origin、宽高。Obj 资源上的 `moveType` 是否存在于这套 CMS。
7. `r` 非 0 是否在其他地图出现，以及它是否改变画面。
8. Portal 游戏动画目录、`pt` 到 `pv/ph/psh` 的客户端映射、默认触发矩形。
9. `delay`、`onlyOnce` 的状态机。
10. Foothold 的 `force`、`forbidFallDown` 全库出现率，以及 Rope 的 `uf/page` 是否影响画面。
11. `info/link` 的 1,152 张图说法。当前 21 张实质图里没有 link。
12. stance 字节如何分成动作和左右。
13. `skin` 十进制到身体 image 的映射。
14. 字符串池「异或结果为 0 则写回密钥字节」的完整分支，以及 `0x77CE9A` 的完整求交循环。
15. `FieldDispatcher+0x24` 的绘制时机。
16. 动态运行中的实际像素，包括换图、A→B→A、异步资源返回时组件已销毁。
17. Task 060 的 4,259 张地图全库计数。源 XML 不在当前 `.work`。

推断而不是测量的规则：场景树大顺序、`front` 只影响层级、flip 为水平镜像、opacity 除以 255、数字帧键即播放顺序、delay 为毫秒、1:1 像素映射。

---

## 11. ABI 修订建议

### A. 必须修改 ABI 文本

1. 修复 P0-001 的拼接，恢复完整的 `contentVersion` 正则和单一前言。理由：文件现在不是一份规范。证据：`:221` 与 commit `010af14f`。
2. 改写 Portal 类型 2「已经确认」的排他句。理由：样本中类型 1 也有目标图。证据：`101040000` 的 `in00`。
3. 把背景「视差系数」和地图「绘制顺序固定」改成与证据等级相符的句子：字段来自 WZ，公式和排序尚未由客户端函数证实。理由：P1-001、P1-002。
4. 写明 `cx/cy = 0` 尚未在客户端证实；若产品暂时采用「0 表示使用图尺寸」，应标成产品规则。理由：155/303。
5. 将 Portal `flip` 改为可选或写明缺省。理由：99 个样本没有 `f`。

这些是文本修订。本次没有改 ABI 文件。

### B. 应修改组件实现文档

1. `cms-back/DESIGN.md` 不要把 HaCreator 移植写成客户端平铺规则的最终权威，或同时写上它自己承认没有做镜头视差。
2. `cms-portal/DESIGN.md` 保留「editor 不是游戏画面」，并修正类型 2 为唯一样本跳转类型的说法。
3. `cms-avatar-layer/DESIGN.md` 把 `+0x24` 降为未复核笔记。
4. `cms-actor/IMPLEMENTATION.md` 写明 CMS 生产适配器当前不写遮挡字段，因此不会执行 `0x401C74`。
5. `cms-scene-view/DESIGN.md` 把 VR 回退和 1:1 标成产品算法。全库计数在 XML 恢复前不要当作可复查事实。

### C. 应修改 Adapter 或 Validator

1. CMS Avatar 适配器写入 `priority` 和 `tag`，或在缺失时失败，而不是全画。
2. 重新生成 `cms-actor.browser.js`，去掉 “Render Update v1 cap” 文案。
3. `frameDuration` 拒绝负 delay。
4. 背景 Adapter 在公式未验证前，不要把一种工具公式当成已通过的画面验收。
5. Obj `r` 非 0 或出现 `flow` 时维持 unsupported。当前样本没有触发它。
6. Portal 缺 `f` 时不要把校验失败伪装成数据错误。

### D. 应由 Field Runtime 负责

1. Camera 决策、缩放策略和边界夹取。
2. 速度、碰撞、Foothold `prev/next`、Rope `uf/page`。
3. Portal `tm/tn/script/delay/onlyOnce` 和触发范围，包括类型 1 的目标图。
4. 类型 7 的脚本入口。
5. Obj `reactor` 和可能的 `name`。
6. `sceneEpoch` 与 DataAuthority generation 的选择，二者不能同时被当成另一套身份。

### E. 可以维持现有设计

1. RenderNode 五字段和 one-shot key。证据是 pin 上的协议和测试。
2. 262,144 与 4,096 属于组件、不属于 Render Update v1。ABI 这段是对的。
3. `front` 不进 back attrs，而由树位置表达。字段分离是合理的；树位置的客户端证明仍缺，所以维持的是数据模型，不是绘制已证实。
4. Tile 放置不带 `z` 和 flip。样本支持。
5. Obj 放置保留 `z` 和 `zM`，不把 `reactor` 放进视觉 plan。
6. Portal 的 `tm/tn/script` 不进视觉组件。
7. Foothold / Rope 的权威几何不进正式画面，只留可选 debug。
8. 空 avatar-layer 作为 MVP 单玩家容器。
9. 未知字段拒绝、`formatVersion`、NPC/Reactor/Seat 另立 schema。
10. 资源引用使用 namespace、key、SHA-256，不使用 WZ 路径。

---

## 12. 最终结论

### 12.1 LoomRealm 协议兼容性

意图上的 ABI 与 pin `93648192` 兼容。五字段、key 生命周期、投影顺序、完整 data、transient event 和资源版本校验都能在契约和实现里对上。发布中的文件文本不兼容于「一份冻结规范」，因为第 1–4 节被拼接了两次，正则被截断。

### 12.2 原始游戏客户端行为一致性

Avatar 遮挡的关键比较和跳过绘制与映像一致。地图、背景、镜头、Portal 画面和 `zM` 没有客户端函数。WZ 字段名在 21 张实质图上大多对得上，但字段存在不等于绘制语义已经明确。类型 2 的排他跳转结论与 Portal 样本矛盾。

### 12.3 公共 ABI 完整性

作为组件边界，它分清了呈现与权威状态，也没有把协议容量和产品容量混成一件事。作为「已经能稳定复刻客户端画面」的接口，它还不完整：背景公式、`cx=0`、排序、Portal 帧、持续动作和图集几何都没有被当前证据闭合。场景树也不能表达尚未证实、但数据上可能存在的人物/物件交错。

### 12.4 整体评级

**PARTIALLY VERIFIED**

评级依据：协议骨架和 Avatar 遮挡入口有直接证据；地图公共 ABI 的核心绘制句子仍依赖 HaCreator 移植和未复现的全库笔记；冻结文件自身还有一处阻断阅读的拼接。还没有发现「字段模型必须全部推翻」的证据，所以不是 REJECTED。也没有达到 VERIFIED WITH LIMITATIONS，因为背景、排序和 Portal 画面属于核心画面，不只是边角未验证。

不建议继续冻结当前文本。

---

## 13. 下一阶段执行计划

依赖顺序如下。未实现的部分保持未实现。

1. 修订 ABI 文本：先修 P0 拼接，再改 P1 中证据等级不符的句子。不在同一次修订里发明新的绘制公式。
2. 恢复或重新提取可复查的地图画布：Back、Tile、Obj、MapHelper 的 origin、z、宽高和帧 delay。没有这些，Schema Validator 只能检查形状，不能检查几何。
3. 继续反汇编地图绘制、镜头和 Portal 选择。在此之前，Validator 应把「公式已验证」保持为失败或未启用。
4. Schema Validator：按修订后的文本拒绝未知字段、错误枚举、损坏的 contentVersion，以及 Portal 缺省 flip 的最终规则。
5. Adapter：CMS Avatar 写遮挡字段；背景和 Portal 在公式未验证时返回明确的 unsupported，而不是画 editor 图标。
6. 组件实现：当前只有 cms-actor 有实现。cms-scene-view、cms-back、cms-map-layer、cms-avatar-layer、cms-portal 仍是设计。浏览器包需要与源码重新对齐。
7. 浏览器集成测试：证明 projector 的 attrs、children、完整 data 和 transient event。本次没有做。
8. 地图渲染验收：至少用本次 21 张图里的一张远景、一张含 type 4 的背景、一张含 `zM != 0` 的 Obj、一个类型 1 和一个类型 2 Portal，对照客户端画面。本次没有画面对照。
9. Field Runtime：持有 Camera、碰撞和 Portal 传送。视觉组件继续不拥有这些状态。

---

## 14. 审计可复现信息

| 项 | 值 |
|---|---|
| 审计日期 | 2026-11-09 |
| 仓库 | `C:/Users/lithd/Documents/GitHub/adventure-island` |
| 分支 | `design/adventure-field-map-scene` |
| 审计开始时 HEAD | `3e83ad43ac8e766ca96af300380e577e9e265c5d` |
| 审计开始时工作区 | 干净。从 `main` `554494452933b19de67db44dd8a0f38190df7d25` 切换到目标分支前，`git status` 无未提交修改 |
| LoomRealm pin | `93648192323bf5f57996b7b54cbae641d8a53fdb` |
| 客户端映像 SHA-256 | `d4a67597a7e1a072679c7b67c91a03a1242eab7aaa635ad8368277dc12a31718` |
| 映像大小 | 10,330,112 字节，`SizeOfImage = 0x9DA000`，基址 `0x400000` |
| 属性提取 | `.work/task-023/output/maple/properties.jsonl`，558,811 行，93,139,094 字节 |
| 报告版本 | 1 |

检查命令：

- `git rev-parse HEAD`、`git status -sb`、`git submodule status`
- 目录盘点 `.work` 一级目录
- Python 流式解析 `properties.jsonl`
- Capstone 反汇编 `game-image-unpacked.bin` 的第 3.2 节地址
- 阅读 pin 上的 `render-update-v1.md`、`web-presentation-api-v1.md`、`web-projector.ts`、`presentation-resource-client.ts`、`resource-client.ts`、`packages/subsystem/src/render.ts`

测试命令：

```text
node --test components/cms-actor/test/avatar-model.test.mjs
```

结果：20 项通过，0 项失败，耗时约 109 ms。该测试证明 AvatarPlan 应用层上限、source 约束和遮挡辅助函数的当前实现行为。它不证明地图 ABI，也不证明生产 CMS 适配器已经写入遮挡字段。

没有运行根目录 `npm test`。没有浏览器测试，没有地图合成对照。

本次交付只新增本报告。未修改 `components/RENDER-NODE-ABI-V1.md`，未修改 `.work/`。
