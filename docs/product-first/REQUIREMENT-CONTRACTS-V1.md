# P0–P4 65 项产品需求卡（V1）

> 状态：全部 PROPOSED / NOT-APPROVED。本文件是工程化细化，不代表需求已获批准、功能已实现或 CMS079 原版等价。历史 Claim/Evidence/Gap 保持原样。

## 全局合同

- 地图闭包：222000000, 222000001, 230030200, 230030100, 230030000, 230020300, 230020200, 230020100, 230020000, 230000000, 230000001, 230000002, 230000003。
- OpenMS 参考锚点：`07994de02756356e3e025e3aca9e79433898d2c8`（GMS083）；每项使用 pinned commit 的具体文件/行引用，路径仅作行为参考，不构成复制源码许可。
- ABI：冻结 RenderNode v1 五字段及现有标签/attrs/data/event/key/sceneEpoch 不变；无法表达的动态行为走新 Plan/tag 版本 ADR。
- 权威：Field Runtime / Subsystem / Shared State；输入经 InputGate；Web Component 只绘制。
- 错误：构建期 fail-closed；运行期保留 last-good；传送失败不改变源状态。
- 资源组缺失必须分类 SOURCE-EMPTY / SOURCE-ABSENT / RESOURCE-MISSING。

## 需求卡

### P0-01 — Map.info与13图allowlist
- **用户目标：** 读取并严格限制 13 个 mapId；filename、mapId、info 与层记录必须一致，未知地图拒绝进入本发布闭包。
- **地图范围：** 222000000;222000001;230030200;230030100;230030000;230020300;230020200;230020100;230020000;230000000;230000001;230000002;230000003
- **模块 / 权威所有者：** Content/Map Adapter；构建期 Content index 与 MapBundle 是权威；Web Component 不参与
- **输入 → 输出：** MapDescriptor + WZ-derived FSDB struct/group + Resource manifest; 关联源字段：Map/Info：version、cloud、town、swim、returnMap、forcedReturn、mobRate、bgm、mapMark、hideMinimap、fieldLimit；VR/miniMap/layers。 → typed MapDescriptor / MapScenePlanV1 / MapBundleManifest; 可观察验收：map descriptor 唯一、13/13 allowlist、mapId 与 Portal graph 节点一致。
- **资源字段依赖：** Map.Info/Back/Tile/Obj/Foothold/Rope/Seat/Portal/Physics + LogicalResourceRefV1; Map/Info：version、cloud、town、swim、returnMap、forcedReturn、mobRate、bgm、mapMark、hideMinimap、fieldLimit；VR/miniMap/layers。
- **正常行为：** 读取并严格限制 13 个 mapId；filename、mapId、info 与层记录必须一致，未知地图拒绝进入本发布闭包。 map descriptor 唯一、13/13 allowlist、mapId 与 Portal graph 节点一致。
- **边界行为：** 13 个 Map struct 文件全部存在；mapId/filename 不一致、info 缺失或 mapId 重复时构建失败。；不把 SOURCE-ABSENT 当成 SOURCE-EMPTY，不静默补默认值。
- **错误 / 回滚：** 构建期 fail-closed 并输出稳定 diagnostic code；运行期保留 last-good RenderDomain tree 与 FieldRuntime state；跨图 prepare/replace 失败不得提交新 mapId、Actor、Camera 或 sceneEpoch。
- **OpenMS 参考：** https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/content/src/map-definition.js ; https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/content/src/compile-map.js；commit 07994de02756356e3e025e3aca9e79433898d2c8
- **CMS079 历史状态：** RE-GAP-STATIC；Gaps=—。只引用既有 research/source-of-truth 与 P0-P4-REQUIREMENT-EVIDENCE-MATRIX；不新增、不升级、不关闭 Claim/Evidence/Gap；历史 readiness 不等于产品批准或实现。
- **079/083 差异：** OpenMS pinned GMS083 是行为/算法候选，不是 CMS079 证明；本需求按 Adventure Island 产品规则实施，差异必须在 ADR/测试中明示，不声明原版等价。
- **ABI / 接口影响：** 不修改 Frozen RenderNode ABI v1 五字段、现有标签/attrs/data/event/key/sceneEpoch；可在 Field Runtime/Subsystem 内新增状态。当前 v1 无法表达的动态背景/Obj flow/Portal phase 必须走新 Plan/tag 版本 ADR。
- **性能目标：** 有界解析；每个逻辑引用一次索引；13 图构建必须可重复；未测量前不设虚假 wall-clock SLO
- **确定性单测：** P0-01 正常/边界/错误/回放纯函数测试；map descriptor 唯一、13/13 allowlist、mapId 与 Portal graph 节点一致。；同一输入 state hash 一致。
- **集成测试：** P0-01 集成测试：R1 三图垂直切片与 R2 全 13 图；验证 Content API、Field Runtime、InputGate、Render Projection 责任边界。
- **13 图验收：** map descriptor 唯一、13/13 allowlist、mapId 与 Portal graph 节点一致。；13 图逐张执行适用项；SOURCE-EMPTY/SOURCE-ABSENT/RESOURCE-MISSING 分别断言。
- **依赖 / 未决：** P0-02、P0-11、P0-12、P4-09；待需求卡审批；P0-02、P0-11、P0-12、P4-09；未获批前保持 PROPOSED。
- **批准状态：** PROPOSED / NOT-APPROVED

### P0-02 — Info字段映射/ignored审计
- **用户目标：** 把已知 Info 字段映射到 typed descriptor；未知字段进入 ignored-field ledger，禁止静默丢弃。
- **地图范围：** 222000000;222000001;230030200;230030100;230030000;230020300;230020200;230020100;230020000;230000000;230000001;230000002;230000003
- **模块 / 权威所有者：** Content/Map Adapter；构建期 Content index 与 MapBundle 是权威；Web Component 不参与
- **输入 → 输出：** MapDescriptor + WZ-derived FSDB struct/group + Resource manifest; 关联源字段：Map.Info 全字段及原始 presence 位；所有数值类型和字符串字段。 → typed MapDescriptor / MapScenePlanV1 / MapBundleManifest; 可观察验收：同一输入重复构建产生字节一致 descriptor；ignored ledger 能定位原始字段。
- **资源字段依赖：** Map.Info/Back/Tile/Obj/Foothold/Rope/Seat/Portal/Physics + LogicalResourceRefV1; Map.Info 全字段及原始 presence 位；所有数值类型和字符串字段。
- **正常行为：** 把已知 Info 字段映射到 typed descriptor；未知字段进入 ignored-field ledger，禁止静默丢弃。 同一输入重复构建产生字节一致 descriptor；ignored ledger 能定位原始字段。
- **边界行为：** 可选 fly/noMapCmd/onFirstUserEnter/onUserEnter/effect/decHP/protectItem 缺失时保留缺失；0 与缺失不等价。；不把 SOURCE-ABSENT 当成 SOURCE-EMPTY，不静默补默认值。
- **错误 / 回滚：** 构建期 fail-closed 并输出稳定 diagnostic code；运行期保留 last-good RenderDomain tree 与 FieldRuntime state；跨图 prepare/replace 失败不得提交新 mapId、Actor、Camera 或 sceneEpoch。
- **OpenMS 参考：** https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/content/src/map-definition.js ; https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/content/src/compile-map.js；commit 07994de02756356e3e025e3aca9e79433898d2c8
- **CMS079 历史状态：** RE-GAP-STATIC；Gaps=G40。只引用既有 research/source-of-truth 与 P0-P4-REQUIREMENT-EVIDENCE-MATRIX；不新增、不升级、不关闭 Claim/Evidence/Gap；历史 readiness 不等于产品批准或实现。
- **079/083 差异：** OpenMS pinned GMS083 是行为/算法候选，不是 CMS079 证明；本需求按 Adventure Island 产品规则实施，差异必须在 ADR/测试中明示，不声明原版等价。
- **ABI / 接口影响：** 不修改 Frozen RenderNode ABI v1 五字段、现有标签/attrs/data/event/key/sceneEpoch；可在 Field Runtime/Subsystem 内新增状态。当前 v1 无法表达的动态背景/Obj flow/Portal phase 必须走新 Plan/tag 版本 ADR。
- **性能目标：** 有界解析；每个逻辑引用一次索引；13 图构建必须可重复；未测量前不设虚假 wall-clock SLO
- **确定性单测：** P0-02 正常/边界/错误/回放纯函数测试；同一输入重复构建产生字节一致 descriptor；ignored ledger 能定位原始字段。；同一输入 state hash 一致。
- **集成测试：** P0-02 集成测试：R1 三图垂直切片与 R2 全 13 图；验证 Content API、Field Runtime、InputGate、Render Projection 责任边界。
- **13 图验收：** 同一输入重复构建产生字节一致 descriptor；ignored ledger 能定位原始字段。；13 图逐张执行适用项；SOURCE-EMPTY/SOURCE-ABSENT/RESOURCE-MISSING 分别断言。
- **依赖 / 未决：** P0-01、P0-13；待需求卡审批；P0-01、P0-13；未获批前保持 PROPOSED。
- **批准状态：** PROPOSED / NOT-APPROVED

### P0-03 — info/link继承规则
- **用户目标：** 将 info.link 作为显式引用解析；不在 13 图样本中推断继承，通用解析必须拒绝环和悬空引用。
- **地图范围：** 222000000;222000001;230030200;230030100;230030000;230020300;230020200;230020100;230020000;230000000;230000001;230000002;230000003
- **模块 / 权威所有者：** Content/Map Adapter；构建期 Content index 与 MapBundle 是权威；Web Component 不参与
- **输入 → 输出：** MapDescriptor + WZ-derived FSDB struct/group + Resource manifest; 关联源字段：info.link、mapId、被引用 map descriptor。 → typed MapDescriptor / MapScenePlanV1 / MapBundleManifest; 可观察验收：链路 A→B→C 解析终点 C；A→B→A 报 LINK_CYCLE；不存在目标报 LINK_TARGET_MISSING。
- **资源字段依赖：** Map.Info/Back/Tile/Obj/Foothold/Rope/Seat/Portal/Physics + LogicalResourceRefV1; info.link、mapId、被引用 map descriptor。
- **正常行为：** 将 info.link 作为显式引用解析；不在 13 图样本中推断继承，通用解析必须拒绝环和悬空引用。 链路 A→B→C 解析终点 C；A→B→A 报 LINK_CYCLE；不存在目标报 LINK_TARGET_MISSING。
- **边界行为：** 无 link 时直接使用本图；link 指向已存在终点时按 ADR 约定处理；循环/多义/目标缺失失败。；不把 SOURCE-ABSENT 当成 SOURCE-EMPTY，不静默补默认值。
- **错误 / 回滚：** 构建期 fail-closed 并输出稳定 diagnostic code；运行期保留 last-good RenderDomain tree 与 FieldRuntime state；跨图 prepare/replace 失败不得提交新 mapId、Actor、Camera 或 sceneEpoch。
- **OpenMS 参考：** https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/content/src/map-definition.js ; https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/content/src/compile-map.js；commit 07994de02756356e3e025e3aca9e79433898d2c8
- **CMS079 历史状态：** PRODUCT-READY；Gaps=—。只引用既有 research/source-of-truth 与 P0-P4-REQUIREMENT-EVIDENCE-MATRIX；不新增、不升级、不关闭 Claim/Evidence/Gap；历史 readiness 不等于产品批准或实现。
- **079/083 差异：** OpenMS pinned GMS083 是行为/算法候选，不是 CMS079 证明；本需求按 Adventure Island 产品规则实施，差异必须在 ADR/测试中明示，不声明原版等价。
- **ABI / 接口影响：** 不修改 Frozen RenderNode ABI v1 五字段、现有标签/attrs/data/event/key/sceneEpoch；可在 Field Runtime/Subsystem 内新增状态。当前 v1 无法表达的动态背景/Obj flow/Portal phase 必须走新 Plan/tag 版本 ADR。
- **性能目标：** 有界解析；每个逻辑引用一次索引；13 图构建必须可重复；未测量前不设虚假 wall-clock SLO
- **确定性单测：** P0-03 正常/边界/错误/回放纯函数测试；链路 A→B→C 解析终点 C；A→B→A 报 LINK_CYCLE；不存在目标报 LINK_TARGET_MISSING。；同一输入 state hash 一致。
- **集成测试：** P0-03 集成测试：R1 三图垂直切片与 R2 全 13 图；验证 Content API、Field Runtime、InputGate、Render Projection 责任边界。
- **13 图验收：** 链路 A→B→C 解析终点 C；A→B→A 报 LINK_CYCLE；不存在目标报 LINK_TARGET_MISSING。；13 图逐张执行适用项；SOURCE-EMPTY/SOURCE-ABSENT/RESOURCE-MISSING 分别断言。
- **依赖 / 未决：** P0-01；link 继承策略；P0-01；未获批前保持 PROPOSED。
- **批准状态：** PROPOSED / NOT-APPROVED

### P0-04 — Tile source与Canvas解析
- **用户目标：** 按 TileSet/u/no 解析 Tile Canvas；画布 z、尺寸、origin 和资源版本必须真实存在。
- **地图范围：** 222000000;222000001;230030200;230030100;230030000;230020300;230020200;230020100;230020000;230000000;230000001;230000002;230000003
- **模块 / 权威所有者：** Content/Map Adapter；构建期 Content index 与 MapBundle 是权威；Web Component 不参与
- **输入 → 输出：** MapDescriptor + WZ-derived FSDB struct/group + Resource manifest; 关联源字段：map.Tile、map.TileFrame、struct.map.Tileset、Canvas.z/origin、resource.Map/tile。 → typed MapDescriptor / MapScenePlanV1 / MapBundleManifest; 可观察验收：同一 source record 的 asset/placement 引用闭合；sourceOrder 保留；缺 z 拒绝该 Plan。
- **资源字段依赖：** Map.Info/Back/Tile/Obj/Foothold/Rope/Seat/Portal/Physics + LogicalResourceRefV1; map.Tile、map.TileFrame、struct.map.Tileset、Canvas.z/origin、resource.Map/tile。
- **正常行为：** 按 TileSet/u/no 解析 Tile Canvas；画布 z、尺寸、origin 和资源版本必须真实存在。 同一 source record 的 asset/placement 引用闭合；sourceOrder 保留；缺 z 拒绝该 Plan。
- **边界行为：** canvasZ 缺失时报告 tile-canvas-z-absent，不以 0 补齐；无 Tile 组需由 manifest 明确 SOURCE-EMPTY。；不把 SOURCE-ABSENT 当成 SOURCE-EMPTY，不静默补默认值。
- **错误 / 回滚：** 构建期 fail-closed 并输出稳定 diagnostic code；运行期保留 last-good RenderDomain tree 与 FieldRuntime state；跨图 prepare/replace 失败不得提交新 mapId、Actor、Camera 或 sceneEpoch。
- **OpenMS 参考：** https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/client/src/online/scene.js ; https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/content/src/map-definition.js ; https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/content/src/compile-map.js；commit 07994de02756356e3e025e3aca9e79433898d2c8
- **CMS079 历史状态：** RE-READY；Gaps=G02。只引用既有 research/source-of-truth 与 P0-P4-REQUIREMENT-EVIDENCE-MATRIX；不新增、不升级、不关闭 Claim/Evidence/Gap；历史 readiness 不等于产品批准或实现。
- **079/083 差异：** OpenMS pinned GMS083 是行为/算法候选，不是 CMS079 证明；本需求按 Adventure Island 产品规则实施，差异必须在 ADR/测试中明示，不声明原版等价。
- **ABI / 接口影响：** 不修改 Frozen RenderNode ABI v1 五字段、现有标签/attrs/data/event/key/sceneEpoch；可在 Field Runtime/Subsystem 内新增状态。当前 v1 无法表达的动态背景/Obj flow/Portal phase 必须走新 Plan/tag 版本 ADR。
- **性能目标：** 有界解析；每个逻辑引用一次索引；13 图构建必须可重复；未测量前不设虚假 wall-clock SLO
- **确定性单测：** P0-04 正常/边界/错误/回放纯函数测试；同一 source record 的 asset/placement 引用闭合；sourceOrder 保留；缺 z 拒绝该 Plan。；同一输入 state hash 一致。
- **集成测试：** P0-04 集成测试：R1 三图垂直切片与 R2 全 13 图；验证 Content API、Field Runtime、InputGate、Render Projection 责任边界。
- **13 图验收：** 同一 source record 的 asset/placement 引用闭合；sourceOrder 保留；缺 z 拒绝该 Plan。；13 图逐张执行适用项；SOURCE-EMPTY/SOURCE-ABSENT/RESOURCE-MISSING 分别断言。
- **依赖 / 未决：** P0-11、P1-07、P1-09；待需求卡审批；P0-11、P1-07、P1-09；未获批前保持 PROPOSED。
- **批准状态：** PROPOSED / NOT-APPROVED

### P0-05 — Obj source及flow遗漏
- **用户目标：** 解析 Obj 的 oS/l0/l1/l2 与放置字段；普通 Obj 可进 v1，flow/r 非零不得静默省略。
- **地图范围：** 222000000;222000001;230030200;230030100;230030000;230020300;230020200;230020100;230020000;230000000;230000001;230000002;230000003
- **模块 / 权威所有者：** Content/Map Adapter；构建期 Content index 与 MapBundle 是权威；Web Component 不参与
- **输入 → 输出：** MapDescriptor + WZ-derived FSDB struct/group + Resource manifest; 关联源字段：map.Obj、map.ObjFrame、struct.map.Obj、Canvas z/origin、flow/r/z/zM/f。 → typed MapDescriptor / MapScenePlanV1 / MapBundleManifest; 可观察验收：同一 map 记录中普通 Obj 可绘制；unsupported Obj 阻断完整 Plan 发布。
- **资源字段依赖：** Map.Info/Back/Tile/Obj/Foothold/Rope/Seat/Portal/Physics + LogicalResourceRefV1; map.Obj、map.ObjFrame、struct.map.Obj、Canvas z/origin、flow/r/z/zM/f。
- **正常行为：** 解析 Obj 的 oS/l0/l1/l2 与放置字段；普通 Obj 可进 v1，flow/r 非零不得静默省略。 同一 map 记录中普通 Obj 可绘制；unsupported Obj 阻断完整 Plan 发布。
- **边界行为：** r 缺省或 0 进入 v1；r 非零或 flow 存在时输出 obj-visual-field-unsupported。；不把 SOURCE-ABSENT 当成 SOURCE-EMPTY，不静默补默认值。
- **错误 / 回滚：** 构建期 fail-closed 并输出稳定 diagnostic code；运行期保留 last-good RenderDomain tree 与 FieldRuntime state；跨图 prepare/replace 失败不得提交新 mapId、Actor、Camera 或 sceneEpoch。
- **OpenMS 参考：** https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/client/src/rendering/animation.js#L315-L395 ; https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/client/src/rendering/animation.js#L419-L465 ; https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/content/src/map-definition.js ; https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/content/src/compile-map.js；commit 07994de02756356e3e025e3aca9e79433898d2c8
- **CMS079 历史状态：** RE-GAP-STATIC；Gaps=G37。只引用既有 research/source-of-truth 与 P0-P4-REQUIREMENT-EVIDENCE-MATRIX；不新增、不升级、不关闭 Claim/Evidence/Gap；历史 readiness 不等于产品批准或实现。
- **079/083 差异：** OpenMS pinned GMS083 是行为/算法候选，不是 CMS079 证明；本需求按 Adventure Island 产品规则实施，差异必须在 ADR/测试中明示，不声明原版等价。
- **ABI / 接口影响：** 不修改 Frozen RenderNode ABI v1 五字段、现有标签/attrs/data/event/key/sceneEpoch；可在 Field Runtime/Subsystem 内新增状态。当前 v1 无法表达的动态背景/Obj flow/Portal phase 必须走新 Plan/tag 版本 ADR。
- **性能目标：** 有界解析；每个逻辑引用一次索引；13 图构建必须可重复；未测量前不设虚假 wall-clock SLO
- **确定性单测：** P0-05 正常/边界/错误/回放纯函数测试；同一 map 记录中普通 Obj 可绘制；unsupported Obj 阻断完整 Plan 发布。；同一输入 state hash 一致。
- **集成测试：** P0-05 集成测试：R1 三图垂直切片与 R2 全 13 图；验证 Content API、Field Runtime、InputGate、Render Projection 责任边界。
- **13 图验收：** 同一 map 记录中普通 Obj 可绘制；unsupported Obj 阻断完整 Plan 发布。；13 图逐张执行适用项；SOURCE-EMPTY/SOURCE-ABSENT/RESOURCE-MISSING 分别断言。
- **依赖 / 未决：** P0-11、P1-08、P1-13；待需求卡审批；P0-11、P1-08、P1-13；未获批前保持 PROPOSED。
- **批准状态：** PROPOSED / NOT-APPROVED

### P0-06 — Back与Canvas资源解析
- **用户目标：** 解析 Back set/index/animation 与 Canvas 帧，保留每帧 delay presence、origin、尺寸和资源版本。
- **地图范围：** 222000000;222000001;230030200;230030100;230030000;230020300;230020200;230020100;230020000;230000000;230000001;230000002;230000003
- **模块 / 权威所有者：** Content/Map Adapter；构建期 Content index 与 MapBundle 是权威；Web Component 不参与
- **输入 → 输出：** MapDescriptor + WZ-derived FSDB struct/group + Resource manifest; 关联源字段：map.Back、map.BackFrame、struct.map.Back、Canvas delay/origin、resource.Map/back。 → typed MapDescriptor / MapScenePlanV1 / MapBundleManifest; 可观察验收：type0 资源闭包完整；sourceOrder 和 front 保留。
- **资源字段依赖：** Map.Info/Back/Tile/Obj/Foothold/Rope/Seat/Portal/Physics + LogicalResourceRefV1; map.Back、map.BackFrame、struct.map.Back、Canvas delay/origin、resource.Map/back。
- **正常行为：** 解析 Back set/index/animation 与 Canvas 帧，保留每帧 delay presence、origin、尺寸和资源版本。 type0 资源闭包完整；sourceOrder 和 front 保留。
- **边界行为：** 空帧、资源缺失、非有限坐标拒绝；缺 delay 不补 0；type 1–7 不进 v1。；不把 SOURCE-ABSENT 当成 SOURCE-EMPTY，不静默补默认值。
- **错误 / 回滚：** 构建期 fail-closed 并输出稳定 diagnostic code；运行期保留 last-good RenderDomain tree 与 FieldRuntime state；跨图 prepare/replace 失败不得提交新 mapId、Actor、Camera 或 sceneEpoch。
- **OpenMS 参考：** https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/client/src/rendering/animation.js#L315-L395 ; https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/client/src/rendering/animation.js#L419-L465 ; https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/client/src/rendering/animation-timing.js#L2-L60 ; https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/client/src/rendering/animation-timing.js#L94-L135；commit 07994de02756356e3e025e3aca9e79433898d2c8
- **CMS079 历史状态：** RE-GAP-STATIC；Gaps=G35;G36。只引用既有 research/source-of-truth 与 P0-P4-REQUIREMENT-EVIDENCE-MATRIX；不新增、不升级、不关闭 Claim/Evidence/Gap；历史 readiness 不等于产品批准或实现。
- **079/083 差异：** OpenMS pinned GMS083 是行为/算法候选，不是 CMS079 证明；本需求按 Adventure Island 产品规则实施，差异必须在 ADR/测试中明示，不声明原版等价。
- **ABI / 接口影响：** 不修改 Frozen RenderNode ABI v1 五字段、现有标签/attrs/data/event/key/sceneEpoch；可在 Field Runtime/Subsystem 内新增状态。当前 v1 无法表达的动态背景/Obj flow/Portal phase 必须走新 Plan/tag 版本 ADR。
- **性能目标：** 有界解析；每个逻辑引用一次索引；13 图构建必须可重复；未测量前不设虚假 wall-clock SLO
- **确定性单测：** P0-06 正常/边界/错误/回放纯函数测试；type0 资源闭包完整；sourceOrder 和 front 保留。；同一输入 state hash 一致。
- **集成测试：** P0-06 集成测试：R1 三图垂直切片与 R2 全 13 图；验证 Content API、Field Runtime、InputGate、Render Projection 责任边界。
- **13 图验收：** type0 资源闭包完整；sourceOrder 和 front 保留。；13 图逐张执行适用项；SOURCE-EMPTY/SOURCE-ABSENT/RESOURCE-MISSING 分别断言。
- **依赖 / 未决：** P0-11、P1-01、P1-06；待需求卡审批；P0-11、P1-01、P1-06；未获批前保持 PROPOSED。
- **批准状态：** PROPOSED / NOT-APPROVED

### P0-07 — Back未投影字段
- **用户目标：** 完整保留 rx/ry/type/cx/cy/front/flip/opacity 等未投影字段，供 V2 Adapter 使用。
- **地图范围：** 222000000;222000001;230030200;230030100;230030000;230020300;230020200;230020100;230020000;230000000;230000001;230000002;230000003
- **模块 / 权威所有者：** Content/Map Adapter；构建期 Content index 与 MapBundle 是权威；Web Component 不参与
- **输入 → 输出：** MapDescriptor + WZ-derived FSDB struct/group + Resource manifest; 关联源字段：Back 放置记录：rx/ry/type/cx/cy/front/f/a；不把字段值转成未经批准的公式。 → typed MapDescriptor / MapScenePlanV1 / MapBundleManifest; 可观察验收：输出字段逐项可追溯到源路径；未支持 type 明确 unsupported。
- **资源字段依赖：** Map.Info/Back/Tile/Obj/Foothold/Rope/Seat/Portal/Physics + LogicalResourceRefV1; Back 放置记录：rx/ry/type/cx/cy/front/f/a；不把字段值转成未经批准的公式。
- **正常行为：** 完整保留 rx/ry/type/cx/cy/front/flip/opacity 等未投影字段，供 V2 Adapter 使用。 输出字段逐项可追溯到源路径；未支持 type 明确 unsupported。
- **边界行为：** cx/cy=0 保持 0；opacity 仅允许 0..255 整数；front 非 0/1 拒绝。；不把 SOURCE-ABSENT 当成 SOURCE-EMPTY，不静默补默认值。
- **错误 / 回滚：** 构建期 fail-closed 并输出稳定 diagnostic code；运行期保留 last-good RenderDomain tree 与 FieldRuntime state；跨图 prepare/replace 失败不得提交新 mapId、Actor、Camera 或 sceneEpoch。
- **OpenMS 参考：** https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/client/src/rendering/animation.js#L315-L395 ; https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/client/src/rendering/animation.js#L419-L465 ; https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/client/src/rendering/animation-timing.js#L2-L60 ; https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/client/src/rendering/animation-timing.js#L94-L135；commit 07994de02756356e3e025e3aca9e79433898d2c8
- **CMS079 历史状态：** RE-GAP-STATIC；Gaps=G36;G39。只引用既有 research/source-of-truth 与 P0-P4-REQUIREMENT-EVIDENCE-MATRIX；不新增、不升级、不关闭 Claim/Evidence/Gap；历史 readiness 不等于产品批准或实现。
- **079/083 差异：** OpenMS pinned GMS083 是行为/算法候选，不是 CMS079 证明；本需求按 Adventure Island 产品规则实施，差异必须在 ADR/测试中明示，不声明原版等价。
- **ABI / 接口影响：** 不修改 Frozen RenderNode ABI v1 五字段、现有标签/attrs/data/event/key/sceneEpoch；可在 Field Runtime/Subsystem 内新增状态。当前 v1 无法表达的动态背景/Obj flow/Portal phase 必须走新 Plan/tag 版本 ADR。
- **性能目标：** 有界解析；每个逻辑引用一次索引；13 图构建必须可重复；未测量前不设虚假 wall-clock SLO
- **确定性单测：** P0-07 正常/边界/错误/回放纯函数测试；输出字段逐项可追溯到源路径；未支持 type 明确 unsupported。；同一输入 state hash 一致。
- **集成测试：** P0-07 集成测试：R1 三图垂直切片与 R2 全 13 图；验证 Content API、Field Runtime、InputGate、Render Projection 责任边界。
- **13 图验收：** 输出字段逐项可追溯到源路径；未支持 type 明确 unsupported。；13 图逐张执行适用项；SOURCE-EMPTY/SOURCE-ABSENT/RESOURCE-MISSING 分别断言。
- **依赖 / 未决：** P1-02 至 P1-06、ADR-005；待需求卡审批；P1-02 至 P1-06、ADR-005；未获批前保持 PROPOSED。
- **批准状态：** PROPOSED / NOT-APPROVED

### P0-08 — Foothold原始字段
- **用户目标：** 规范化 Foothold ID、端点、layer/platform、prev/next、force 与 forbidFallDown。
- **地图范围：** 222000000;222000001;230030200;230030100;230030000;230020300;230020200;230020100;230020000;230000000;230000001;230000002;230000003
- **模块 / 权威所有者：** Content/Map Adapter；构建期 Content index 与 MapBundle 是权威；Web Component 不参与
- **输入 → 输出：** MapDescriptor + WZ-derived FSDB struct/group + Resource manifest; 关联源字段：map.Foothold：id/x1/y1/x2/y2/layer/platform/prev/next/force/forbidFallDown。 → typed MapDescriptor / MapScenePlanV1 / MapBundleManifest; 可观察验收：每个连接引用都指向本 Plan ID；sourceOrder 稳定；保留有符号 force。
- **资源字段依赖：** Map.Info/Back/Tile/Obj/Foothold/Rope/Seat/Portal/Physics + LogicalResourceRefV1; map.Foothold：id/x1/y1/x2/y2/layer/platform/prev/next/force/forbidFallDown。
- **正常行为：** 规范化 Foothold ID、端点、layer/platform、prev/next、force 与 forbidFallDown。 每个连接引用都指向本 Plan ID；sourceOrder 稳定；保留有符号 force。
- **边界行为：** 重复 ID、非有限/超界坐标、悬空 prev/next 拒绝；竖直段保留但不可作为站立面。；不把 SOURCE-ABSENT 当成 SOURCE-EMPTY，不静默补默认值。
- **错误 / 回滚：** 构建期 fail-closed 并输出稳定 diagnostic code；运行期保留 last-good RenderDomain tree 与 FieldRuntime state；跨图 prepare/replace 失败不得提交新 mapId、Actor、Camera 或 sceneEpoch。
- **OpenMS 参考：** https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/client/src/physics/geometry.js#L15-L51 ; https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/client/src/physics/geometry.js#L106-L156 ; https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/client/src/physics/contacts.js#L11-L37 ; https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/client/src/physics/contacts.js#L99-L168 ; https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/client/src/physics/contacts.js#L209-L285；commit 07994de02756356e3e025e3aca9e79433898d2c8
- **CMS079 历史状态：** MapScenePlan原字段保留；Gaps=G40。只引用既有 research/source-of-truth 与 P0-P4-REQUIREMENT-EVIDENCE-MATRIX；不新增、不升级、不关闭 Claim/Evidence/Gap；历史 readiness 不等于产品批准或实现。
- **079/083 差异：** OpenMS pinned GMS083 是行为/算法候选，不是 CMS079 证明；本需求按 Adventure Island 产品规则实施，差异必须在 ADR/测试中明示，不声明原版等价。
- **ABI / 接口影响：** 不修改 Frozen RenderNode ABI v1 五字段、现有标签/attrs/data/event/key/sceneEpoch；可在 Field Runtime/Subsystem 内新增状态。当前 v1 无法表达的动态背景/Obj flow/Portal phase 必须走新 Plan/tag 版本 ADR。
- **性能目标：** 有界解析；每个逻辑引用一次索引；13 图构建必须可重复；未测量前不设虚假 wall-clock SLO
- **确定性单测：** P0-08 正常/边界/错误/回放纯函数测试；每个连接引用都指向本 Plan ID；sourceOrder 稳定；保留有符号 force。；同一输入 state hash 一致。
- **集成测试：** P0-08 集成测试：R1 三图垂直切片与 R2 全 13 图；验证 Content API、Field Runtime、InputGate、Render Projection 责任边界。
- **13 图验收：** 每个连接引用都指向本 Plan ID；sourceOrder 稳定；保留有符号 force。；13 图逐张执行适用项；SOURCE-EMPTY/SOURCE-ABSENT/RESOURCE-MISSING 分别断言。
- **依赖 / 未决：** P3-02、P3-03、P3-06、ADR-006；待需求卡审批；P3-02、P3-03、P3-06、ADR-006；未获批前保持 PROPOSED。
- **批准状态：** PROPOSED / NOT-APPROVED

### P0-09 — Rope/Seat source
- **用户目标：** 导入 Rope 与 Seat 的坐标和标志，空组显式表示，不在组件层绘制。
- **地图范围：** 222000000;222000001;230030200;230030100;230030000;230020300;230020200;230020100;230020000;230000000;230000001;230000002;230000003
- **模块 / 权威所有者：** Content/Map Adapter；构建期 Content index 与 MapBundle 是权威；Web Component 不参与
- **输入 → 输出：** MapDescriptor + WZ-derived FSDB struct/group + Resource manifest; 关联源字段：map.Rope：x/y1/y2/l/uf/page/id；map.Seat：index/x/y。 → typed MapDescriptor / MapScenePlanV1 / MapBundleManifest; 可观察验收：绳和座位仅进入 Field Runtime；不产生 RenderNode；目标地图缺失记录可用空数组但需显式来源状态。
- **资源字段依赖：** Map.Info/Back/Tile/Obj/Foothold/Rope/Seat/Portal/Physics + LogicalResourceRefV1; map.Rope：x/y1/y2/l/uf/page/id；map.Seat：index/x/y。
- **正常行为：** 导入 Rope 与 Seat 的坐标和标志，空组显式表示，不在组件层绘制。 绳和座位仅进入 Field Runtime；不产生 RenderNode；目标地图缺失记录可用空数组但需显式来源状态。
- **边界行为：** Rope 缺组仅在 manifest 声明 SOURCE-EMPTY 时接受；l/uf/page 不猜测；Seat index 保留数字或字符串类型。；不把 SOURCE-ABSENT 当成 SOURCE-EMPTY，不静默补默认值。
- **错误 / 回滚：** 构建期 fail-closed 并输出稳定 diagnostic code；运行期保留 last-good RenderDomain tree 与 FieldRuntime state；跨图 prepare/replace 失败不得提交新 mapId、Actor、Camera 或 sceneEpoch。
- **OpenMS 参考：** https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/client/src/physics/ladders.js#L2-L6 ; https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/client/src/physics/ladders.js#L55-L125 ; https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/client/src/physics/simulation.js#L24-L28 ; https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/client/src/physics/simulation.js#L275-L312 ; https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/client/src/physics/simulation.js#L325-L466；commit 07994de02756356e3e025e3aca9e79433898d2c8
- **CMS079 历史状态：** RE-READY；Gaps=G41。只引用既有 research/source-of-truth 与 P0-P4-REQUIREMENT-EVIDENCE-MATRIX；不新增、不升级、不关闭 Claim/Evidence/Gap；历史 readiness 不等于产品批准或实现。
- **079/083 差异：** OpenMS pinned GMS083 是行为/算法候选，不是 CMS079 证明；本需求按 Adventure Island 产品规则实施，差异必须在 ADR/测试中明示，不声明原版等价。
- **ABI / 接口影响：** 不修改 Frozen RenderNode ABI v1 五字段、现有标签/attrs/data/event/key/sceneEpoch；可在 Field Runtime/Subsystem 内新增状态。当前 v1 无法表达的动态背景/Obj flow/Portal phase 必须走新 Plan/tag 版本 ADR。
- **性能目标：** 有界解析；每个逻辑引用一次索引；13 图构建必须可重复；未测量前不设虚假 wall-clock SLO
- **确定性单测：** P0-09 正常/边界/错误/回放纯函数测试；绳和座位仅进入 Field Runtime；不产生 RenderNode；目标地图缺失记录可用空数组但需显式来源状态。；同一输入 state hash 一致。
- **集成测试：** P0-09 集成测试：R1 三图垂直切片与 R2 全 13 图；验证 Content API、Field Runtime、InputGate、Render Projection 责任边界。
- **13 图验收：** 绳和座位仅进入 Field Runtime；不产生 RenderNode；目标地图缺失记录可用空数组但需显式来源状态。；13 图逐张执行适用项；SOURCE-EMPTY/SOURCE-ABSENT/RESOURCE-MISSING 分别断言。
- **依赖 / 未决：** P3-13、P3-14、P3-15；待需求卡审批；P3-13、P3-14、P3-15；未获批前保持 PROPOSED。
- **批准状态：** PROPOSED / NOT-APPROVED

### P0-10 — Portal字段与MapHelper
- **用户目标：** 规范化 Portal pn/pt/x/y/tm/tn 与脚本/范围/视觉字段，逻辑记录与视觉帧分离。
- **地图范围：** 222000000;222000001;230030200;230030100;230030000;230020300;230020200;230020100;230020000;230000000;230000001;230000002;230000003
- **模块 / 权威所有者：** Content/Map Adapter；构建期 Content index 与 MapBundle 是权威；Web Component 不参与
- **输入 → 输出：** MapDescriptor + WZ-derived FSDB struct/group + Resource manifest; 关联源字段：map.Portal、MapHelper portal pv/ph/psh、image/default、delay/onlyOnce/hideTooltip/hRange/vRange。 → typed MapDescriptor / MapScenePlanV1 / MapBundleManifest; 可观察验收：目标解析只读 Field Runtime PortalRecord；组件只接收 portalPlan。
- **资源字段依赖：** Map.Info/Back/Tile/Obj/Foothold/Rope/Seat/Portal/Physics + LogicalResourceRefV1; map.Portal、MapHelper portal pv/ph/psh、image/default、delay/onlyOnce/hideTooltip/hRange/vRange。
- **正常行为：** 规范化 Portal pn/pt/x/y/tm/tn 与脚本/范围/视觉字段，逻辑记录与视觉帧分离。 目标解析只读 Field Runtime PortalRecord；组件只接收 portalPlan。
- **边界行为：** tm=999999999 表示无目标；tn 空值不推导目标；pt 9/12/13 按 unsupported 规则拒绝发布视觉记录。；不把 SOURCE-ABSENT 当成 SOURCE-EMPTY，不静默补默认值。
- **错误 / 回滚：** 构建期 fail-closed 并输出稳定 diagnostic code；运行期保留 last-good RenderDomain tree 与 FieldRuntime state；跨图 prepare/replace 失败不得提交新 mapId、Actor、Camera 或 sceneEpoch。
- **OpenMS 参考：** https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/client/src/world/portal-system.js#L20-L128 ; https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/client/src/world/portal-system.js#L412-L560 ; https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/client/src/world/portal-presentation.js#L2-L20；commit 07994de02756356e3e025e3aca9e79433898d2c8
- **CMS079 历史状态：** RE-GAP-STATIC；Gaps=G38;G39。只引用既有 research/source-of-truth 与 P0-P4-REQUIREMENT-EVIDENCE-MATRIX；不新增、不升级、不关闭 Claim/Evidence/Gap；历史 readiness 不等于产品批准或实现。
- **079/083 差异：** OpenMS pinned GMS083 是行为/算法候选，不是 CMS079 证明；本需求按 Adventure Island 产品规则实施，差异必须在 ADR/测试中明示，不声明原版等价。
- **ABI / 接口影响：** 不修改 Frozen RenderNode ABI v1 五字段、现有标签/attrs/data/event/key/sceneEpoch；可在 Field Runtime/Subsystem 内新增状态。当前 v1 无法表达的动态背景/Obj flow/Portal phase 必须走新 Plan/tag 版本 ADR。
- **性能目标：** 有界解析；每个逻辑引用一次索引；13 图构建必须可重复；未测量前不设虚假 wall-clock SLO
- **确定性单测：** P0-10 正常/边界/错误/回放纯函数测试；目标解析只读 Field Runtime PortalRecord；组件只接收 portalPlan。；同一输入 state hash 一致。
- **集成测试：** P0-10 集成测试：R1 三图垂直切片与 R2 全 13 图；验证 Content API、Field Runtime、InputGate、Render Projection 责任边界。
- **13 图验收：** 目标解析只读 Field Runtime PortalRecord；组件只接收 portalPlan。；13 图逐张执行适用项；SOURCE-EMPTY/SOURCE-ABSENT/RESOURCE-MISSING 分别断言。
- **依赖 / 未决：** P4-01 至 P4-09、P1-14；待需求卡审批；P4-01 至 P4-09、P1-14；未获批前保持 PROPOSED。
- **批准状态：** PROPOSED / NOT-APPROVED

### P0-11 — 资源Bundle闭包
- **用户目标：** 构建 13 图的显式资源闭包，逐项验证逻辑引用、SHA-256、MIME、尺寸、source rect 和引用者。
- **地图范围：** 222000000;222000001;230030200;230030100;230030000;230020300;230020200;230020100;230020000;230000000;230000001;230000002;230000003
- **模块 / 权威所有者：** Content/Map Adapter；构建期 Content index 与 MapBundle 是权威；Web Component 不参与
- **输入 → 输出：** MapDescriptor + WZ-derived FSDB struct/group + Resource manifest; 关联源字段：LogicalResourceRefV1、ContentVersion、resource.Map/back/tile/obj/helper/minimap、Builder manifest。 → typed MapDescriptor / MapScenePlanV1 / MapBundleManifest; 可观察验收：闭包完整才可签发 ready bundle；资源清单可复算且无私有 locator。
- **资源字段依赖：** Map.Info/Back/Tile/Obj/Foothold/Rope/Seat/Portal/Physics + LogicalResourceRefV1; LogicalResourceRefV1、ContentVersion、resource.Map/back/tile/obj/helper/minimap、Builder manifest。
- **正常行为：** 构建 13 图的显式资源闭包，逐项验证逻辑引用、SHA-256、MIME、尺寸、source rect 和引用者。 闭包完整才可签发 ready bundle；资源清单可复算且无私有 locator。
- **边界行为：** 缺失/冲突/版本不符/解码尺寸不符均阻断对应地图 Plan；失败不得发布部分树。；不把 SOURCE-ABSENT 当成 SOURCE-EMPTY，不静默补默认值。
- **错误 / 回滚：** 构建期 fail-closed 并输出稳定 diagnostic code；运行期保留 last-good RenderDomain tree 与 FieldRuntime state；跨图 prepare/replace 失败不得提交新 mapId、Actor、Camera 或 sceneEpoch。
- **OpenMS 参考：** https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/content/src/scene-assets.js ; https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/client/src/rendering/visual-resources.js ; https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/client/src/rendering/stream-scene.js；commit 07994de02756356e3e025e3aca9e79433898d2c8
- **CMS079 历史状态：** DESIGN-DECISION；Gaps=G36;G37。只引用既有 research/source-of-truth 与 P0-P4-REQUIREMENT-EVIDENCE-MATRIX；不新增、不升级、不关闭 Claim/Evidence/Gap；历史 readiness 不等于产品批准或实现。
- **079/083 差异：** OpenMS pinned GMS083 是行为/算法候选，不是 CMS079 证明；本需求按 Adventure Island 产品规则实施，差异必须在 ADR/测试中明示，不声明原版等价。
- **ABI / 接口影响：** 不修改 Frozen RenderNode ABI v1 五字段、现有标签/attrs/data/event/key/sceneEpoch；可在 Field Runtime/Subsystem 内新增状态。当前 v1 无法表达的动态背景/Obj flow/Portal phase 必须走新 Plan/tag 版本 ADR。
- **性能目标：** 有界解析；每个逻辑引用一次索引；13 图构建必须可重复；未测量前不设虚假 wall-clock SLO
- **确定性单测：** P0-11 正常/边界/错误/回放纯函数测试；闭包完整才可签发 ready bundle；资源清单可复算且无私有 locator。；同一输入 state hash 一致。
- **集成测试：** P0-11 集成测试：R1 三图垂直切片与 R2 全 13 图；验证 Content API、Field Runtime、InputGate、Render Projection 责任边界。
- **13 图验收：** 闭包完整才可签发 ready bundle；资源清单可复算且无私有 locator。；13 图逐张执行适用项；SOURCE-EMPTY/SOURCE-ABSENT/RESOURCE-MISSING 分别断言。
- **依赖 / 未决：** P0-04 至 P0-10、P4-08；资源缺失的阻断规则；P0-04 至 P0-10、P4-08；未获批前保持 PROPOSED。
- **批准状态：** PROPOSED / NOT-APPROVED

### P0-12 — VR/bounds及回退
- **用户目标：** 按 VR→miniMap→Foothold 的确定顺序生成 BoundsRecord；VR 四边缺一项不得套用 VR inset。
- **地图范围：** 222000000;222000001;230030200;230030100;230030000;230020300;230020200;230020100;230020000;230000000;230000001;230000002;230000003
- **模块 / 权威所有者：** Content/Map Adapter；构建期 Content index 与 MapBundle 是权威；Web Component 不参与
- **输入 → 输出：** MapDescriptor + WZ-derived FSDB struct/group + Resource manifest; 关联源字段：VRLeft/Top/Right/Bottom、miniMap width/height/centerX/centerY、Foothold bbox。 → typed MapDescriptor / MapScenePlanV1 / MapBundleManifest; 可观察验收：13 图每图都产出 source/adjustment/sourceBounds/effectiveBounds；Camera 不二次内缩。
- **资源字段依赖：** Map.Info/Back/Tile/Obj/Foothold/Rope/Seat/Portal/Physics + LogicalResourceRefV1; VRLeft/Top/Right/Bottom、miniMap width/height/centerX/centerY、Foothold bbox。
- **正常行为：** 按 VR→miniMap→Foothold 的确定顺序生成 BoundsRecord；VR 四边缺一项不得套用 VR inset。 13 图每图都产出 source/adjustment/sourceBounds/effectiveBounds；Camera 不二次内缩。
- **边界行为：** VR 轴收敛时向零截断中点；miniMap 尺寸/中心缺项转 foothold；三者皆不可用时报 bounds-unavailable。；不把 SOURCE-ABSENT 当成 SOURCE-EMPTY，不静默补默认值。
- **错误 / 回滚：** 构建期 fail-closed 并输出稳定 diagnostic code；运行期保留 last-good RenderDomain tree 与 FieldRuntime state；跨图 prepare/replace 失败不得提交新 mapId、Actor、Camera 或 sceneEpoch。
- **OpenMS 参考：** https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/client/src/rendering/camera.js#L7-L16 ; https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/client/src/rendering/camera.js#L39-L64 ; https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/client/src/rendering/camera.js#L67-L129 ; https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/client/src/physics/bounds.js；commit 07994de02756356e3e025e3aca9e79433898d2c8
- **CMS079 历史状态：** PRODUCT-READY；Gaps=G10。只引用既有 research/source-of-truth 与 P0-P4-REQUIREMENT-EVIDENCE-MATRIX；不新增、不升级、不关闭 Claim/Evidence/Gap；历史 readiness 不等于产品批准或实现。
- **079/083 差异：** OpenMS pinned GMS083 是行为/算法候选，不是 CMS079 证明；本需求按 Adventure Island 产品规则实施，差异必须在 ADR/测试中明示，不声明原版等价。
- **ABI / 接口影响：** 不修改 Frozen RenderNode ABI v1 五字段、现有标签/attrs/data/event/key/sceneEpoch；可在 Field Runtime/Subsystem 内新增状态。当前 v1 无法表达的动态背景/Obj flow/Portal phase 必须走新 Plan/tag 版本 ADR。
- **性能目标：** 有界解析；每个逻辑引用一次索引；13 图构建必须可重复；未测量前不设虚假 wall-clock SLO
- **确定性单测：** P0-12 正常/边界/错误/回放纯函数测试；13 图每图都产出 source/adjustment/sourceBounds/effectiveBounds；Camera 不二次内缩。；同一输入 state hash 一致。
- **集成测试：** P0-12 集成测试：R1 三图垂直切片与 R2 全 13 图；验证 Content API、Field Runtime、InputGate、Render Projection 责任边界。
- **13 图验收：** 13 图每图都产出 source/adjustment/sourceBounds/effectiveBounds；Camera 不二次内缩。；13 图逐张执行适用项；SOURCE-EMPTY/SOURCE-ABSENT/RESOURCE-MISSING 分别断言。
- **依赖 / 未决：** P2-01 至 P2-03；待需求卡审批；P2-01 至 P2-03；未获批前保持 PROPOSED。
- **批准状态：** PROPOSED / NOT-APPROVED

### P0-13 — Physics表19字段和真实数值
- **用户目标：** 从 physics.Default 读取 19 个已定义数值，按字段名和单位建型，不在代码中硬编码猜测值。
- **地图范围：** 222000000;222000001;230030200;230030100;230030000;230020300;230020200;230020100;230020000;230000000;230000001;230000002;230000003
- **模块 / 权威所有者：** Content/Map Adapter；构建期 Content index 与 MapBundle 是权威；Web Component 不参与
- **输入 → 输出：** MapDescriptor + WZ-derived FSDB struct/group + Resource manifest; 关联源字段：struct.physics.Default 与地图/foothold 覆盖项；20 个历史字段名中本契约使用已核对的 19 个物理值。 → typed MapDescriptor / MapScenePlanV1 / MapBundleManifest; 可观察验收：同一 ContentVersion 解析出完全相同 physics config；版本变化需重新构建。
- **资源字段依赖：** Map.Info/Back/Tile/Obj/Foothold/Rope/Seat/Portal/Physics + LogicalResourceRefV1; struct.physics.Default 与地图/foothold 覆盖项；20 个历史字段名中本契约使用已核对的 19 个物理值。
- **正常行为：** 从 physics.Default 读取 19 个已定义数值，按字段名和单位建型，不在代码中硬编码猜测值。 同一 ContentVersion 解析出完全相同 physics config；版本变化需重新构建。
- **边界行为：** 缺字段、非有限值、单位/范围不符拒绝物理配置；不得把未知字段默认为 0。；不把 SOURCE-ABSENT 当成 SOURCE-EMPTY，不静默补默认值。
- **错误 / 回滚：** 构建期 fail-closed 并输出稳定 diagnostic code；运行期保留 last-good RenderDomain tree 与 FieldRuntime state；跨图 prepare/replace 失败不得提交新 mapId、Actor、Camera 或 sceneEpoch。
- **OpenMS 参考：** https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/client/src/physics/settings.js ; https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/client/src/physics/simulation.js#L24-L28 ; https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/client/src/physics/simulation.js#L275-L312 ; https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/client/src/physics/simulation.js#L325-L466；commit 07994de02756356e3e025e3aca9e79433898d2c8
- **CMS079 历史状态：** RE-READY；Gaps=—。只引用既有 research/source-of-truth 与 P0-P4-REQUIREMENT-EVIDENCE-MATRIX；不新增、不升级、不关闭 Claim/Evidence/Gap；历史 readiness 不等于产品批准或实现。
- **079/083 差异：** OpenMS pinned GMS083 是行为/算法候选，不是 CMS079 证明；本需求按 Adventure Island 产品规则实施，差异必须在 ADR/测试中明示，不声明原版等价。
- **ABI / 接口影响：** 不修改 Frozen RenderNode ABI v1 五字段、现有标签/attrs/data/event/key/sceneEpoch；可在 Field Runtime/Subsystem 内新增状态。当前 v1 无法表达的动态背景/Obj flow/Portal phase 必须走新 Plan/tag 版本 ADR。
- **性能目标：** 有界解析；每个逻辑引用一次索引；13 图构建必须可重复；未测量前不设虚假 wall-clock SLO
- **确定性单测：** P0-13 正常/边界/错误/回放纯函数测试；同一 ContentVersion 解析出完全相同 physics config；版本变化需重新构建。；同一输入 state hash 一致。
- **集成测试：** P0-13 集成测试：R1 三图垂直切片与 R2 全 13 图；验证 Content API、Field Runtime、InputGate、Render Projection 责任边界。
- **13 图验收：** 同一 ContentVersion 解析出完全相同 physics config；版本变化需重新构建。；13 图逐张执行适用项；SOURCE-EMPTY/SOURCE-ABSENT/RESOURCE-MISSING 分别断言。
- **依赖 / 未决：** P3-01 至 P3-20；待需求卡审批；P3-01 至 P3-20；未获批前保持 PROPOSED。
- **批准状态：** PROPOSED / NOT-APPROVED

### P1-01 — 背景type0静态绘制
- **用户目标：** 绘制 type0 背景单帧，按 placement-origin 锚定，远景/近景由父树段决定。
- **地图范围：** 222000000;222000001;230030200;230030100;230030000;230020300;230020200;230020100;230020000;230000000;230000001;230000002;230000003
- **模块 / 权威所有者：** Render Projection/Components；场景与位置仍由 Field Runtime；组件仅拥有 frame/cache/canvas 私有呈现状态
- **输入 → 输出：** MapScenePlanV1 + LogicalResourceRefV1 + Viewport snapshot; 关联源字段：BackPlanV1.frames、origin、source、opacity、flip。 → Frozen ABI v1 RenderNode tree / Canvas pixels; 可观察验收：world-space 位置变更只更新计划；组件不自行查询 WZ/FSDB。
- **资源字段依赖：** Canvas width/height/origin/source/delay + LogicalResourceRefV1; BackPlanV1.frames、origin、source、opacity、flip。
- **正常行为：** 绘制 type0 背景单帧，按 placement-origin 锚定，远景/近景由父树段决定。 world-space 位置变更只更新计划；组件不自行查询 WZ/FSDB。
- **边界行为：** 单帧无 delay 正常；多帧任一缺 delay 时 v1 停第一帧；缺资源整张地图失败。；不把 SOURCE-ABSENT 当成 SOURCE-EMPTY，不静默补默认值。
- **错误 / 回滚：** 构建期 fail-closed 并输出稳定 diagnostic code；运行期保留 last-good RenderDomain tree 与 FieldRuntime state；跨图 prepare/replace 失败不得提交新 mapId、Actor、Camera 或 sceneEpoch。
- **OpenMS 参考：** https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/client/src/rendering/animation.js#L315-L395 ; https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/client/src/rendering/animation.js#L419-L465；commit 07994de02756356e3e025e3aca9e79433898d2c8
- **CMS079 历史状态：** PRODUCT-READY；Gaps=G35。只引用既有 research/source-of-truth 与 P0-P4-REQUIREMENT-EVIDENCE-MATRIX；不新增、不升级、不关闭 Claim/Evidence/Gap；历史 readiness 不等于产品批准或实现。
- **079/083 差异：** OpenMS pinned GMS083 是行为/算法候选，不是 CMS079 证明；本需求按 Adventure Island 产品规则实施，差异必须在 ADR/测试中明示，不声明原版等价。
- **ABI / 接口影响：** 不修改 Frozen RenderNode ABI v1 五字段、现有标签/attrs/data/event/key/sceneEpoch；可在 Field Runtime/Subsystem 内新增状态。当前 v1 无法表达的动态背景/Obj flow/Portal phase 必须走新 Plan/tag 版本 ADR。
- **性能目标：** viewport-sized Canvas；不建世界尺寸画布；资源解码有并发/像素预算；排序只在 plan 构建时完成
- **确定性单测：** P1-01 正常/边界/错误/回放纯函数测试；world-space 位置变更只更新计划；组件不自行查询 WZ/FSDB。；同一输入 state hash 一致。
- **集成测试：** P1-01 集成测试：R1 三图垂直切片与 R2 全 13 图；验证 Content API、Field Runtime、InputGate、Render Projection 责任边界。
- **13 图验收：** world-space 位置变更只更新计划；组件不自行查询 WZ/FSDB。；13 图逐张执行适用项；SOURCE-EMPTY/SOURCE-ABSENT/RESOURCE-MISSING 分别断言。
- **依赖 / 未决：** P0-06、P0-11、P1-15；待需求卡审批；P0-06、P0-11、P1-15；未获批前保持 PROPOSED。
- **批准状态：** PROPOSED / NOT-APPROVED

### P1-02 — 背景type1平铺
- **用户目标：** 提出 type1 单轴平铺产品行为：仅按明确 tile-step-x 沿 X 重复，Y 不重复。
- **地图范围：** 222000000;222000001;230030200;230030100;230030000;230020300;230020200;230020100;230020000;230000000;230000001;230000002;230000003
- **模块 / 权威所有者：** Render Projection/Components；场景与位置仍由 Field Runtime；组件仅拥有 frame/cache/canvas 私有呈现状态
- **输入 → 输出：** MapScenePlanV1 + LogicalResourceRefV1 + Viewport snapshot; 关联源字段：Back type/cx/cy/rx/ry/Canvas width/height。 → Frozen ABI v1 RenderNode tree / Canvas pixels; 可观察验收：视口内重复覆盖无缝且不会生成世界尺寸 Canvas。
- **资源字段依赖：** Canvas width/height/origin/source/delay + LogicalResourceRefV1; Back type/cx/cy/rx/ry/Canvas width/height。
- **正常行为：** 提出 type1 单轴平铺产品行为：仅按明确 tile-step-x 沿 X 重复，Y 不重复。 视口内重复覆盖无缝且不会生成世界尺寸 Canvas。
- **边界行为：** tile-step-x=0 表示不重复；非正/过大步长拒绝或诊断，不改用画布宽度。；不把 SOURCE-ABSENT 当成 SOURCE-EMPTY，不静默补默认值。
- **错误 / 回滚：** 构建期 fail-closed 并输出稳定 diagnostic code；运行期保留 last-good RenderDomain tree 与 FieldRuntime state；跨图 prepare/replace 失败不得提交新 mapId、Actor、Camera 或 sceneEpoch。
- **OpenMS 参考：** https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/client/src/rendering/animation.js#L315-L395 ; https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/client/src/rendering/animation.js#L419-L465；commit 07994de02756356e3e025e3aca9e79433898d2c8
- **CMS079 历史状态：** RE-GAP-STATIC；Gaps=G36。只引用既有 research/source-of-truth 与 P0-P4-REQUIREMENT-EVIDENCE-MATRIX；不新增、不升级、不关闭 Claim/Evidence/Gap；历史 readiness 不等于产品批准或实现。
- **079/083 差异：** OpenMS pinned GMS083 是行为/算法候选，不是 CMS079 证明；本需求按 Adventure Island 产品规则实施，差异必须在 ADR/测试中明示，不声明原版等价。
- **ABI / 接口影响：** 不修改 Frozen RenderNode ABI v1 五字段、现有标签/attrs/data/event/key/sceneEpoch；可在 Field Runtime/Subsystem 内新增状态。当前 v1 无法表达的动态背景/Obj flow/Portal phase 必须走新 Plan/tag 版本 ADR。
- **性能目标：** viewport-sized Canvas；不建世界尺寸画布；资源解码有并发/像素预算；排序只在 plan 构建时完成
- **确定性单测：** P1-02 正常/边界/错误/回放纯函数测试；视口内重复覆盖无缝且不会生成世界尺寸 Canvas。；同一输入 state hash 一致。
- **集成测试：** P1-02 集成测试：R1 三图垂直切片与 R2 全 13 图；验证 Content API、Field Runtime、InputGate、Render Projection 责任边界。
- **13 图验收：** 视口内重复覆盖无缝且不会生成世界尺寸 Canvas。；13 图逐张执行适用项；SOURCE-EMPTY/SOURCE-ABSENT/RESOURCE-MISSING 分别断言。
- **依赖 / 未决：** P0-07、ADR-005；待需求卡审批；P0-07、ADR-005；未获批前保持 PROPOSED。
- **批准状态：** PROPOSED / NOT-APPROVED

### P1-03 — 背景type2平铺
- **用户目标：** 提出 type2 双轴平铺产品行为：按显式 cx/cy 周期在 X/Y 两轴重复。
- **地图范围：** 222000000;222000001;230030200;230030100;230030000;230020300;230020200;230020100;230020000;230000000;230000001;230000002;230000003
- **模块 / 权威所有者：** Render Projection/Components；场景与位置仍由 Field Runtime；组件仅拥有 frame/cache/canvas 私有呈现状态
- **输入 → 输出：** MapScenePlanV1 + LogicalResourceRefV1 + Viewport snapshot; 关联源字段：Back type/cx/cy/origin/frames。 → Frozen ABI v1 RenderNode tree / Canvas pixels; 可观察验收：不同 viewport 下可见重复数正确，资源仍只解码一次。
- **资源字段依赖：** Canvas width/height/origin/source/delay + LogicalResourceRefV1; Back type/cx/cy/origin/frames。
- **正常行为：** 提出 type2 双轴平铺产品行为：按显式 cx/cy 周期在 X/Y 两轴重复。 不同 viewport 下可见重复数正确，资源仍只解码一次。
- **边界行为：** 任一轴步长为 0 时该轴不重复；不从画布尺寸静默补周期。；不把 SOURCE-ABSENT 当成 SOURCE-EMPTY，不静默补默认值。
- **错误 / 回滚：** 构建期 fail-closed 并输出稳定 diagnostic code；运行期保留 last-good RenderDomain tree 与 FieldRuntime state；跨图 prepare/replace 失败不得提交新 mapId、Actor、Camera 或 sceneEpoch。
- **OpenMS 参考：** https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/client/src/rendering/animation.js#L315-L395 ; https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/client/src/rendering/animation.js#L419-L465；commit 07994de02756356e3e025e3aca9e79433898d2c8
- **CMS079 历史状态：** RE-GAP-STATIC；Gaps=G36。只引用既有 research/source-of-truth 与 P0-P4-REQUIREMENT-EVIDENCE-MATRIX；不新增、不升级、不关闭 Claim/Evidence/Gap；历史 readiness 不等于产品批准或实现。
- **079/083 差异：** OpenMS pinned GMS083 是行为/算法候选，不是 CMS079 证明；本需求按 Adventure Island 产品规则实施，差异必须在 ADR/测试中明示，不声明原版等价。
- **ABI / 接口影响：** 不修改 Frozen RenderNode ABI v1 五字段、现有标签/attrs/data/event/key/sceneEpoch；可在 Field Runtime/Subsystem 内新增状态。当前 v1 无法表达的动态背景/Obj flow/Portal phase 必须走新 Plan/tag 版本 ADR。
- **性能目标：** viewport-sized Canvas；不建世界尺寸画布；资源解码有并发/像素预算；排序只在 plan 构建时完成
- **确定性单测：** P1-03 正常/边界/错误/回放纯函数测试；不同 viewport 下可见重复数正确，资源仍只解码一次。；同一输入 state hash 一致。
- **集成测试：** P1-03 集成测试：R1 三图垂直切片与 R2 全 13 图；验证 Content API、Field Runtime、InputGate、Render Projection 责任边界。
- **13 图验收：** 不同 viewport 下可见重复数正确，资源仍只解码一次。；13 图逐张执行适用项；SOURCE-EMPTY/SOURCE-ABSENT/RESOURCE-MISSING 分别断言。
- **依赖 / 未决：** P0-07、ADR-005；待需求卡审批；P0-07、ADR-005；未获批前保持 PROPOSED。
- **批准状态：** PROPOSED / NOT-APPROVED

### P1-04 — 背景type3双轴
- **用户目标：** 提出 type3 双轴平铺并分别应用 rx/ry 视差因子，公式固定在 BackPlanV2。
- **地图范围：** 222000000;222000001;230030200;230030100;230030000;230020300;230020200;230020100;230020000;230000000;230000001;230000002;230000003
- **模块 / 权威所有者：** Render Projection/Components；场景与位置仍由 Field Runtime；组件仅拥有 frame/cache/canvas 私有呈现状态
- **输入 → 输出：** MapScenePlanV1 + LogicalResourceRefV1 + Viewport snapshot; 关联源字段：Back type/rx/ry/cx/cy/viewport/camera。 → Frozen ABI v1 RenderNode tree / Canvas pixels; 可观察验收：相同 camera 输入重放结果一致，视差只影响绘制位置不改世界坐标。
- **资源字段依赖：** Canvas width/height/origin/source/delay + LogicalResourceRefV1; Back type/rx/ry/cx/cy/viewport/camera。
- **正常行为：** 提出 type3 双轴平铺并分别应用 rx/ry 视差因子，公式固定在 BackPlanV2。 相同 camera 输入重放结果一致，视差只影响绘制位置不改世界坐标。
- **边界行为：** rx/ry=0 为无视差；非有限数拒绝；负速率按有符号方向处理。；不把 SOURCE-ABSENT 当成 SOURCE-EMPTY，不静默补默认值。
- **错误 / 回滚：** 构建期 fail-closed 并输出稳定 diagnostic code；运行期保留 last-good RenderDomain tree 与 FieldRuntime state；跨图 prepare/replace 失败不得提交新 mapId、Actor、Camera 或 sceneEpoch。
- **OpenMS 参考：** https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/client/src/rendering/animation.js#L315-L395 ; https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/client/src/rendering/animation.js#L419-L465；commit 07994de02756356e3e025e3aca9e79433898d2c8
- **CMS079 历史状态：** RE-GAP-STATIC；Gaps=G36。只引用既有 research/source-of-truth 与 P0-P4-REQUIREMENT-EVIDENCE-MATRIX；不新增、不升级、不关闭 Claim/Evidence/Gap；历史 readiness 不等于产品批准或实现。
- **079/083 差异：** OpenMS pinned GMS083 是行为/算法候选，不是 CMS079 证明；本需求按 Adventure Island 产品规则实施，差异必须在 ADR/测试中明示，不声明原版等价。
- **ABI / 接口影响：** 不修改 Frozen RenderNode ABI v1 五字段、现有标签/attrs/data/event/key/sceneEpoch；可在 Field Runtime/Subsystem 内新增状态。当前 v1 无法表达的动态背景/Obj flow/Portal phase 必须走新 Plan/tag 版本 ADR。
- **性能目标：** viewport-sized Canvas；不建世界尺寸画布；资源解码有并发/像素预算；排序只在 plan 构建时完成
- **确定性单测：** P1-04 正常/边界/错误/回放纯函数测试；相同 camera 输入重放结果一致，视差只影响绘制位置不改世界坐标。；同一输入 state hash 一致。
- **集成测试：** P1-04 集成测试：R1 三图垂直切片与 R2 全 13 图；验证 Content API、Field Runtime、InputGate、Render Projection 责任边界。
- **13 图验收：** 相同 camera 输入重放结果一致，视差只影响绘制位置不改世界坐标。；13 图逐张执行适用项；SOURCE-EMPTY/SOURCE-ABSENT/RESOURCE-MISSING 分别断言。
- **依赖 / 未决：** P0-07、P2-01、ADR-005；待需求卡审批；P0-07、P2-01、ADR-005；未获批前保持 PROPOSED。
- **批准状态：** PROPOSED / NOT-APPROVED

### P1-05 — 背景type4滚动
- **用户目标：** 提出 type4 水平自动移动背景；使用单调 presentation clock，不依赖帧率。
- **地图范围：** 222000000;222000001;230030200;230030100;230030000;230020300;230020200;230020100;230020000;230000000;230000001;230000002;230000003
- **模块 / 权威所有者：** Render Projection/Components；场景与位置仍由 Field Runtime；组件仅拥有 frame/cache/canvas 私有呈现状态
- **输入 → 输出：** MapScenePlanV1 + LogicalResourceRefV1 + Viewport snapshot; 关联源字段：Back type/rx、frame duration、presentation clock。 → Frozen ABI v1 RenderNode tree / Canvas pixels; 可观察验收：30/60/120Hz 重放相同时间点得到相同背景位移。
- **资源字段依赖：** Canvas width/height/origin/source/delay + LogicalResourceRefV1; Back type/rx、frame duration、presentation clock。
- **正常行为：** 提出 type4 水平自动移动背景；使用单调 presentation clock，不依赖帧率。 30/60/120Hz 重放相同时间点得到相同背景位移。
- **边界行为：** rate=0 静止；非零方向由符号决定；视口 resize 不重置相位。；不把 SOURCE-ABSENT 当成 SOURCE-EMPTY，不静默补默认值。
- **错误 / 回滚：** 构建期 fail-closed 并输出稳定 diagnostic code；运行期保留 last-good RenderDomain tree 与 FieldRuntime state；跨图 prepare/replace 失败不得提交新 mapId、Actor、Camera 或 sceneEpoch。
- **OpenMS 参考：** https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/client/src/rendering/animation.js#L315-L395 ; https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/client/src/rendering/animation.js#L419-L465；commit 07994de02756356e3e025e3aca9e79433898d2c8
- **CMS079 历史状态：** RE-GAP-STATIC；Gaps=G36;G39。只引用既有 research/source-of-truth 与 P0-P4-REQUIREMENT-EVIDENCE-MATRIX；不新增、不升级、不关闭 Claim/Evidence/Gap；历史 readiness 不等于产品批准或实现。
- **079/083 差异：** OpenMS pinned GMS083 是行为/算法候选，不是 CMS079 证明；本需求按 Adventure Island 产品规则实施，差异必须在 ADR/测试中明示，不声明原版等价。
- **ABI / 接口影响：** 不修改 Frozen RenderNode ABI v1 五字段、现有标签/attrs/data/event/key/sceneEpoch；可在 Field Runtime/Subsystem 内新增状态。当前 v1 无法表达的动态背景/Obj flow/Portal phase 必须走新 Plan/tag 版本 ADR。
- **性能目标：** viewport-sized Canvas；不建世界尺寸画布；资源解码有并发/像素预算；排序只在 plan 构建时完成
- **确定性单测：** P1-05 正常/边界/错误/回放纯函数测试；30/60/120Hz 重放相同时间点得到相同背景位移。；同一输入 state hash 一致。
- **集成测试：** P1-05 集成测试：R1 三图垂直切片与 R2 全 13 图；验证 Content API、Field Runtime、InputGate、Render Projection 责任边界。
- **13 图验收：** 30/60/120Hz 重放相同时间点得到相同背景位移。；13 图逐张执行适用项；SOURCE-EMPTY/SOURCE-ABSENT/RESOURCE-MISSING 分别断言。
- **依赖 / 未决：** P0-07、P1-06、ADR-005；待需求卡审批；P0-07、P1-06、ADR-005；未获批前保持 PROPOSED。
- **批准状态：** PROPOSED / NOT-APPROVED

### P1-06 — 背景帧动画
- **用户目标：** 为背景帧建立独立确定性时钟，delay 为非负毫秒，loop 时按总周期取模。
- **地图范围：** 222000000;222000001;230030200;230030100;230030000;230020300;230020200;230020100;230020000;230000000;230000001;230000002;230000003
- **模块 / 权威所有者：** Render Projection/Components；场景与位置仍由 Field Runtime；组件仅拥有 frame/cache/canvas 私有呈现状态
- **输入 → 输出：** MapScenePlanV1 + LogicalResourceRefV1 + Viewport snapshot; 关联源字段：BackFrame.delay、frames、loop、tick timestamp。 → Frozen ABI v1 RenderNode tree / Canvas pixels; 可观察验收：虚拟时钟 0/1/延迟边界/循环边界逐帧一致。
- **资源字段依赖：** Canvas width/height/origin/source/delay + LogicalResourceRefV1; BackFrame.delay、frames、loop、tick timestamp。
- **正常行为：** 为背景帧建立独立确定性时钟，delay 为非负毫秒，loop 时按总周期取模。 虚拟时钟 0/1/延迟边界/循环边界逐帧一致。
- **边界行为：** 缺 delay 表示 hold；全 0 周期的循环计划拒绝；延迟过大只保留合法帧。；不把 SOURCE-ABSENT 当成 SOURCE-EMPTY，不静默补默认值。
- **错误 / 回滚：** 构建期 fail-closed 并输出稳定 diagnostic code；运行期保留 last-good RenderDomain tree 与 FieldRuntime state；跨图 prepare/replace 失败不得提交新 mapId、Actor、Camera 或 sceneEpoch。
- **OpenMS 参考：** https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/client/src/rendering/animation-timing.js#L2-L60 ; https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/client/src/rendering/animation-timing.js#L94-L135；commit 07994de02756356e3e025e3aca9e79433898d2c8
- **CMS079 历史状态：** RE-GAP-STATIC；Gaps=G39。只引用既有 research/source-of-truth 与 P0-P4-REQUIREMENT-EVIDENCE-MATRIX；不新增、不升级、不关闭 Claim/Evidence/Gap；历史 readiness 不等于产品批准或实现。
- **079/083 差异：** OpenMS pinned GMS083 是行为/算法候选，不是 CMS079 证明；本需求按 Adventure Island 产品规则实施，差异必须在 ADR/测试中明示，不声明原版等价。
- **ABI / 接口影响：** 不修改 Frozen RenderNode ABI v1 五字段、现有标签/attrs/data/event/key/sceneEpoch；可在 Field Runtime/Subsystem 内新增状态。当前 v1 无法表达的动态背景/Obj flow/Portal phase 必须走新 Plan/tag 版本 ADR。
- **性能目标：** viewport-sized Canvas；不建世界尺寸画布；资源解码有并发/像素预算；排序只在 plan 构建时完成
- **确定性单测：** P1-06 正常/边界/错误/回放纯函数测试；虚拟时钟 0/1/延迟边界/循环边界逐帧一致。；同一输入 state hash 一致。
- **集成测试：** P1-06 集成测试：R1 三图垂直切片与 R2 全 13 图；验证 Content API、Field Runtime、InputGate、Render Projection 责任边界。
- **13 图验收：** 虚拟时钟 0/1/延迟边界/循环边界逐帧一致。；13 图逐张执行适用项；SOURCE-EMPTY/SOURCE-ABSENT/RESOURCE-MISSING 分别断言。
- **依赖 / 未决：** P0-06、P1-01、ADR-005；待需求卡审批；P0-06、P1-01、ADR-005；未获批前保持 PROPOSED。
- **批准状态：** PROPOSED / NOT-APPROVED

### P1-07 — Tile整数加载键
- **用户目标：** 计算 Tile 诊断整数键，但不把诊断键当排序方向；产品顺序按 canvasZ 后 sourceOrder。
- **地图范围：** 222000000;222000001;230030200;230030100;230030000;230020300;230020200;230020100;230020000;230000000;230000001;230000002;230000003
- **模块 / 权威所有者：** Render Projection/Components；场景与位置仍由 Field Runtime；组件仅拥有 frame/cache/canvas 私有呈现状态
- **输入 → 输出：** MapScenePlanV1 + LogicalResourceRefV1 + Viewport snapshot; 关联源字段：canvasZ/layer/zM/sourceOrder。 → Frozen ABI v1 RenderNode tree / Canvas pixels; 可观察验收：同输入 key 恒定，层号变化按公式变化，渲染排序不依赖 JS sort 稳定性。
- **资源字段依赖：** Canvas width/height/origin/source/delay + LogicalResourceRefV1; canvasZ/layer/zM/sourceOrder。
- **正常行为：** 计算 Tile 诊断整数键，但不把诊断键当排序方向；产品顺序按 canvasZ 后 sourceOrder。 同输入 key 恒定，层号变化按公式变化，渲染排序不依赖 JS sort 稳定性。
- **边界行为：** canvasZ 缺失拒绝；负 zM 可合法保留；键溢出或非 safe integer 拒绝。；不把 SOURCE-ABSENT 当成 SOURCE-EMPTY，不静默补默认值。
- **错误 / 回滚：** 构建期 fail-closed 并输出稳定 diagnostic code；运行期保留 last-good RenderDomain tree 与 FieldRuntime state；跨图 prepare/replace 失败不得提交新 mapId、Actor、Camera 或 sceneEpoch。
- **OpenMS 参考：** https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/client/src/online/scene.js；commit 07994de02756356e3e025e3aca9e79433898d2c8
- **CMS079 历史状态：** RE-READY；Gaps=—。只引用既有 research/source-of-truth 与 P0-P4-REQUIREMENT-EVIDENCE-MATRIX；不新增、不升级、不关闭 Claim/Evidence/Gap；历史 readiness 不等于产品批准或实现。
- **079/083 差异：** OpenMS pinned GMS083 是行为/算法候选，不是 CMS079 证明；本需求按 Adventure Island 产品规则实施，差异必须在 ADR/测试中明示，不声明原版等价。
- **ABI / 接口影响：** 不修改 Frozen RenderNode ABI v1 五字段、现有标签/attrs/data/event/key/sceneEpoch；可在 Field Runtime/Subsystem 内新增状态。当前 v1 无法表达的动态背景/Obj flow/Portal phase 必须走新 Plan/tag 版本 ADR。
- **性能目标：** viewport-sized Canvas；不建世界尺寸画布；资源解码有并发/像素预算；排序只在 plan 构建时完成
- **确定性单测：** P1-07 正常/边界/错误/回放纯函数测试；同输入 key 恒定，层号变化按公式变化，渲染排序不依赖 JS sort 稳定性。；同一输入 state hash 一致。
- **集成测试：** P1-07 集成测试：R1 三图垂直切片与 R2 全 13 图；验证 Content API、Field Runtime、InputGate、Render Projection 责任边界。
- **13 图验收：** 同输入 key 恒定，层号变化按公式变化，渲染排序不依赖 JS sort 稳定性。；13 图逐张执行适用项；SOURCE-EMPTY/SOURCE-ABSENT/RESOURCE-MISSING 分别断言。
- **依赖 / 未决：** P0-04、P1-09；待需求卡审批；P0-04、P1-09；未获批前保持 PROPOSED。
- **批准状态：** PROPOSED / NOT-APPROVED

### P1-08 — Obj整数加载键
- **用户目标：** 计算 Obj 诊断整数键，产品绘制按 z 升序和 sourceOrder tie-break。
- **地图范围：** 222000000;222000001;230030200;230030100;230030000;230020300;230020200;230020100;230020000;230000000;230000001;230000002;230000003
- **模块 / 权威所有者：** Render Projection/Components；场景与位置仍由 Field Runtime；组件仅拥有 frame/cache/canvas 私有呈现状态
- **输入 → 输出：** MapScenePlanV1 + LogicalResourceRefV1 + Viewport snapshot; 关联源字段：layer/z/zM/sourceOrder。 → Frozen ABI v1 RenderNode tree / Canvas pixels; 可观察验收：Obj key 公式可 golden test；相同 z 顺序不变。
- **资源字段依赖：** Canvas width/height/origin/source/delay + LogicalResourceRefV1; layer/z/zM/sourceOrder。
- **正常行为：** 计算 Obj 诊断整数键，产品绘制按 z 升序和 sourceOrder tie-break。 Obj key 公式可 golden test；相同 z 顺序不变。
- **边界行为：** z 缺失/非整数拒绝；zM 只保留，不代替 z 参与 Obj key。；不把 SOURCE-ABSENT 当成 SOURCE-EMPTY，不静默补默认值。
- **错误 / 回滚：** 构建期 fail-closed 并输出稳定 diagnostic code；运行期保留 last-good RenderDomain tree 与 FieldRuntime state；跨图 prepare/replace 失败不得提交新 mapId、Actor、Camera 或 sceneEpoch。
- **OpenMS 参考：** https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/client/src/online/scene.js；commit 07994de02756356e3e025e3aca9e79433898d2c8
- **CMS079 历史状态：** RE-READY；Gaps=—。只引用既有 research/source-of-truth 与 P0-P4-REQUIREMENT-EVIDENCE-MATRIX；不新增、不升级、不关闭 Claim/Evidence/Gap；历史 readiness 不等于产品批准或实现。
- **079/083 差异：** OpenMS pinned GMS083 是行为/算法候选，不是 CMS079 证明；本需求按 Adventure Island 产品规则实施，差异必须在 ADR/测试中明示，不声明原版等价。
- **ABI / 接口影响：** 不修改 Frozen RenderNode ABI v1 五字段、现有标签/attrs/data/event/key/sceneEpoch；可在 Field Runtime/Subsystem 内新增状态。当前 v1 无法表达的动态背景/Obj flow/Portal phase 必须走新 Plan/tag 版本 ADR。
- **性能目标：** viewport-sized Canvas；不建世界尺寸画布；资源解码有并发/像素预算；排序只在 plan 构建时完成
- **确定性单测：** P1-08 正常/边界/错误/回放纯函数测试；Obj key 公式可 golden test；相同 z 顺序不变。；同一输入 state hash 一致。
- **集成测试：** P1-08 集成测试：R1 三图垂直切片与 R2 全 13 图；验证 Content API、Field Runtime、InputGate、Render Projection 责任边界。
- **13 图验收：** Obj key 公式可 golden test；相同 z 顺序不变。；13 图逐张执行适用项；SOURCE-EMPTY/SOURCE-ABSENT/RESOURCE-MISSING 分别断言。
- **依赖 / 未决：** P0-05、P1-09；待需求卡审批；P0-05、P1-09；未获批前保持 PROPOSED。
- **批准状态：** PROPOSED / NOT-APPROVED

### P1-09 — Tile/Obj通道与注册
- **用户目标：** 每个非空地图层生成一个 cms-map-layer；Tile/Obj 批量绘制，不为每个画布创建 RenderNode。
- **地图范围：** 222000000;222000001;230030200;230030100;230030000;230020300;230020200;230020100;230020000;230000000;230000001;230000002;230000003
- **模块 / 权威所有者：** Render Projection/Components；场景与位置仍由 Field Runtime；组件仅拥有 frame/cache/canvas 私有呈现状态
- **输入 → 输出：** MapScenePlanV1 + LogicalResourceRefV1 + Viewport snapshot; 关联源字段：MapLayerPlanV1.assets/tiles/objs、LogicalResourceRefV1。 → Frozen ABI v1 RenderNode tree / Canvas pixels; 可观察验收：0..7 层排序、placement 资源闭包与 ABI schema 校验通过。
- **资源字段依赖：** Canvas width/height/origin/source/delay + LogicalResourceRefV1; MapLayerPlanV1.assets/tiles/objs、LogicalResourceRefV1。
- **正常行为：** 每个非空地图层生成一个 cms-map-layer；Tile/Obj 批量绘制，不为每个画布创建 RenderNode。 0..7 层排序、placement 资源闭包与 ABI schema 校验通过。
- **边界行为：** 空层不生成节点；资产 ID 重复、孤儿资产或错误 kind 引用拒绝。；不把 SOURCE-ABSENT 当成 SOURCE-EMPTY，不静默补默认值。
- **错误 / 回滚：** 构建期 fail-closed 并输出稳定 diagnostic code；运行期保留 last-good RenderDomain tree 与 FieldRuntime state；跨图 prepare/replace 失败不得提交新 mapId、Actor、Camera 或 sceneEpoch。
- **OpenMS 参考：** https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/client/src/online/scene.js；commit 07994de02756356e3e025e3aca9e79433898d2c8
- **CMS079 历史状态：** RE-READY；Gaps=G01;G07;G24;G27。只引用既有 research/source-of-truth 与 P0-P4-REQUIREMENT-EVIDENCE-MATRIX；不新增、不升级、不关闭 Claim/Evidence/Gap；历史 readiness 不等于产品批准或实现。
- **079/083 差异：** OpenMS pinned GMS083 是行为/算法候选，不是 CMS079 证明；本需求按 Adventure Island 产品规则实施，差异必须在 ADR/测试中明示，不声明原版等价。
- **ABI / 接口影响：** 不修改 Frozen RenderNode ABI v1 五字段、现有标签/attrs/data/event/key/sceneEpoch；可在 Field Runtime/Subsystem 内新增状态。当前 v1 无法表达的动态背景/Obj flow/Portal phase 必须走新 Plan/tag 版本 ADR。
- **性能目标：** viewport-sized Canvas；不建世界尺寸画布；资源解码有并发/像素预算；排序只在 plan 构建时完成
- **确定性单测：** P1-09 正常/边界/错误/回放纯函数测试；0..7 层排序、placement 资源闭包与 ABI schema 校验通过。；同一输入 state hash 一致。
- **集成测试：** P1-09 集成测试：R1 三图垂直切片与 R2 全 13 图；验证 Content API、Field Runtime、InputGate、Render Projection 责任边界。
- **13 图验收：** 0..7 层排序、placement 资源闭包与 ABI schema 校验通过。；13 图逐张执行适用项；SOURCE-EMPTY/SOURCE-ABSENT/RESOURCE-MISSING 分别断言。
- **依赖 / 未决：** P0-04、P0-05、P1-15；待需求卡审批；P0-04、P0-05、P1-15；未获批前保持 PROPOSED。
- **批准状态：** PROPOSED / NOT-APPROVED

### P1-10 — 最终容器/排序比较/Draw遍历
- **用户目标：** 按 Obj z 升序→Tile canvasZ 升序→sourceOrder 绘制；layer 0..7 按树顺序。
- **地图范围：** 222000000;222000001;230030200;230030100;230030000;230020300;230020200;230020100;230020000;230000000;230000001;230000002;230000003
- **模块 / 权威所有者：** Render Projection/Components；场景与位置仍由 Field Runtime；组件仅拥有 frame/cache/canvas 私有呈现状态
- **输入 → 输出：** MapScenePlanV1 + LogicalResourceRefV1 + Viewport snapshot; 关联源字段：MapLayerPlanV1、sourceOrder、z/canvasZ/layer。 → Frozen ABI v1 RenderNode tree / Canvas pixels; 可观察验收：不同引擎排序实现的 golden draw list 完全相同。
- **资源字段依赖：** Canvas width/height/origin/source/delay + LogicalResourceRefV1; MapLayerPlanV1、sourceOrder、z/canvasZ/layer。
- **正常行为：** 按 Obj z 升序→Tile canvasZ 升序→sourceOrder 绘制；layer 0..7 按树顺序。 不同引擎排序实现的 golden draw list 完全相同。
- **边界行为：** 相同 key 不推断原版比较器；`clientSortKey` 仅诊断，不影响产品顺序。；不把 SOURCE-ABSENT 当成 SOURCE-EMPTY，不静默补默认值。
- **错误 / 回滚：** 构建期 fail-closed 并输出稳定 diagnostic code；运行期保留 last-good RenderDomain tree 与 FieldRuntime state；跨图 prepare/replace 失败不得提交新 mapId、Actor、Camera 或 sceneEpoch。
- **OpenMS 参考：** https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/client/src/online/scene.js；commit 07994de02756356e3e025e3aca9e79433898d2c8
- **CMS079 历史状态：** Frozen ABI只定义产品顺序；Gaps=旧报告同一比较器与CleanRoom冲突。只引用既有 research/source-of-truth 与 P0-P4-REQUIREMENT-EVIDENCE-MATRIX；不新增、不升级、不关闭 Claim/Evidence/Gap；历史 readiness 不等于产品批准或实现。
- **079/083 差异：** OpenMS pinned GMS083 是行为/算法候选，不是 CMS079 证明；本需求按 Adventure Island 产品规则实施，差异必须在 ADR/测试中明示，不声明原版等价。
- **ABI / 接口影响：** 不修改 Frozen RenderNode ABI v1 五字段、现有标签/attrs/data/event/key/sceneEpoch；可在 Field Runtime/Subsystem 内新增状态。当前 v1 无法表达的动态背景/Obj flow/Portal phase 必须走新 Plan/tag 版本 ADR。
- **性能目标：** viewport-sized Canvas；不建世界尺寸画布；资源解码有并发/像素预算；排序只在 plan 构建时完成
- **确定性单测：** P1-10 正常/边界/错误/回放纯函数测试；不同引擎排序实现的 golden draw list 完全相同。；同一输入 state hash 一致。
- **集成测试：** P1-10 集成测试：R1 三图垂直切片与 R2 全 13 图；验证 Content API、Field Runtime、InputGate、Render Projection 责任边界。
- **13 图验收：** 不同引擎排序实现的 golden draw list 完全相同。；13 图逐张执行适用项；SOURCE-EMPTY/SOURCE-ABSENT/RESOURCE-MISSING 分别断言。
- **依赖 / 未决：** P1-07、P1-08、ADR-007；待需求卡审批；P1-07、P1-08、ADR-007；未获批前保持 PROPOSED。
- **批准状态：** PROPOSED / NOT-APPROVED

### P1-11 — equal key tie稳定性
- **用户目标：** Avatar 内部使用 zmap/smap、islot/vslot、anchor 与 zOrder 决定部件顺序和遮挡。
- **地图范围：** 222000000;222000001;230030200;230030100;230030000;230020300;230020200;230020100;230020000;230000000;230000001;230000002;230000003
- **模块 / 权威所有者：** Render Projection/Components；场景与位置仍由 Field Runtime；组件仅拥有 frame/cache/canvas 私有呈现状态
- **输入 → 输出：** MapScenePlanV1 + LogicalResourceRefV1 + Viewport snapshot; 关联源字段：avatar.DrawOrder、LayerSlot、Avatar.Part、islot/vslot、smap/zmap、origin/map/anchors。 → Frozen ABI v1 RenderNode tree / Canvas pixels; 可观察验收：同装备组合绘制次序稳定；无锚点部件不画且有 diagnostic。
- **资源字段依赖：** Canvas width/height/origin/source/delay + LogicalResourceRefV1; avatar.DrawOrder、LayerSlot、Avatar.Part、islot/vslot、smap/zmap、origin/map/anchors。
- **正常行为：** Avatar 内部使用 zmap/smap、islot/vslot、anchor 与 zOrder 决定部件顺序和遮挡。 同装备组合绘制次序稳定；无锚点部件不画且有 diagnostic。
- **边界行为：** 缺 zmap/smap/slot 元数据拒绝生成 AvatarPlan；部件缺动作时按 actor contract 跳过并诊断。；不把 SOURCE-ABSENT 当成 SOURCE-EMPTY，不静默补默认值。
- **错误 / 回滚：** 构建期 fail-closed 并输出稳定 diagnostic code；运行期保留 last-good RenderDomain tree 与 FieldRuntime state；跨图 prepare/replace 失败不得提交新 mapId、Actor、Camera 或 sceneEpoch。
- **OpenMS 参考：** https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/client/src/character/avatar-composition.js#L156-L162 ; https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/client/src/character/avatar-composition.js#L179-L220 ; https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/client/src/character/avatar-composition.js#L338-L372 ; https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/client/src/character/avatar-composition.js#L500-L510；commit 07994de02756356e3e025e3aca9e79433898d2c8
- **CMS079 历史状态：** PRODUCT-READY；Gaps=G33。只引用既有 research/source-of-truth 与 P0-P4-REQUIREMENT-EVIDENCE-MATRIX；不新增、不升级、不关闭 Claim/Evidence/Gap；历史 readiness 不等于产品批准或实现。
- **079/083 差异：** OpenMS pinned GMS083 是行为/算法候选，不是 CMS079 证明；本需求按 Adventure Island 产品规则实施，差异必须在 ADR/测试中明示，不声明原版等价。
- **ABI / 接口影响：** 不修改 Frozen RenderNode ABI v1 五字段、现有标签/attrs/data/event/key/sceneEpoch；可在 Field Runtime/Subsystem 内新增状态。当前 v1 无法表达的动态背景/Obj flow/Portal phase 必须走新 Plan/tag 版本 ADR。
- **性能目标：** viewport-sized Canvas；不建世界尺寸画布；资源解码有并发/像素预算；排序只在 plan 构建时完成
- **确定性单测：** P1-11 正常/边界/错误/回放纯函数测试；同装备组合绘制次序稳定；无锚点部件不画且有 diagnostic。；同一输入 state hash 一致。
- **集成测试：** P1-11 集成测试：R1 三图垂直切片与 R2 全 13 图；验证 Content API、Field Runtime、InputGate、Render Projection 责任边界。
- **13 图验收：** 同装备组合绘制次序稳定；无锚点部件不画且有 diagnostic。；13 图逐张执行适用项；SOURCE-EMPTY/SOURCE-ABSENT/RESOURCE-MISSING 分别断言。
- **依赖 / 未决：** P1-12、P3-12；待需求卡审批；P1-12、P3-12；未获批前保持 PROPOSED。
- **批准状态：** PROPOSED / NOT-APPROVED

### P1-12 — Avatar vs Obj/Tile遮挡
- **用户目标：** 维持 v1 树顺序：地图层在 AvatarLayer 前，AvatarLayer 恰好一个 Actor；不伪造 actor 插入 Obj 深度带。
- **地图范围：** 222000000;222000001;230030200;230030100;230030000;230020300;230020200;230020100;230020000;230000000;230000001;230000002;230000003
- **模块 / 权威所有者：** Render Projection/Components；场景与位置仍由 Field Runtime；组件仅拥有 frame/cache/canvas 私有呈现状态
- **输入 → 输出：** MapScenePlanV1 + LogicalResourceRefV1 + Viewport snapshot; 关联源字段：cms-scene-view children、cms-avatar-layer、cms-actor、MapLayerPlanV1。 → Frozen ABI v1 RenderNode tree / Canvas pixels; 可观察验收：三图切换 Actor HTMLElement 身份稳定；Avatar 内部 zmap/smap 仍正确。
- **资源字段依赖：** Canvas width/height/origin/source/delay + LogicalResourceRefV1; cms-scene-view children、cms-avatar-layer、cms-actor、MapLayerPlanV1。
- **正常行为：** 维持 v1 树顺序：地图层在 AvatarLayer 前，AvatarLayer 恰好一个 Actor；不伪造 actor 插入 Obj 深度带。 三图切换 Actor HTMLElement 身份稳定；Avatar 内部 zmap/smap 仍正确。
- **边界行为：** 跨图 Actor key 不变；层内深度穿插超出 v1 能力时记录限制，不重排 managed children。；不把 SOURCE-ABSENT 当成 SOURCE-EMPTY，不静默补默认值。
- **错误 / 回滚：** 构建期 fail-closed 并输出稳定 diagnostic code；运行期保留 last-good RenderDomain tree 与 FieldRuntime state；跨图 prepare/replace 失败不得提交新 mapId、Actor、Camera 或 sceneEpoch。
- **OpenMS 参考：** https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/client/src/character/field-avatar.js#L4-L38 ; https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/client/src/character/field-avatar.js#L41-L116 ; https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/client/src/online/scene.js；commit 07994de02756356e3e025e3aca9e79433898d2c8
- **CMS079 历史状态：** RE-READY；Gaps=G08;G09。只引用既有 research/source-of-truth 与 P0-P4-REQUIREMENT-EVIDENCE-MATRIX；不新增、不升级、不关闭 Claim/Evidence/Gap；历史 readiness 不等于产品批准或实现。
- **079/083 差异：** OpenMS pinned GMS083 是行为/算法候选，不是 CMS079 证明；本需求按 Adventure Island 产品规则实施，差异必须在 ADR/测试中明示，不声明原版等价。
- **ABI / 接口影响：** 不修改 Frozen RenderNode ABI v1 五字段、现有标签/attrs/data/event/key/sceneEpoch；可在 Field Runtime/Subsystem 内新增状态。当前 v1 无法表达的动态背景/Obj flow/Portal phase 必须走新 Plan/tag 版本 ADR。
- **性能目标：** viewport-sized Canvas；不建世界尺寸画布；资源解码有并发/像素预算；排序只在 plan 构建时完成
- **确定性单测：** P1-12 正常/边界/错误/回放纯函数测试；三图切换 Actor HTMLElement 身份稳定；Avatar 内部 zmap/smap 仍正确。；同一输入 state hash 一致。
- **集成测试：** P1-12 集成测试：R1 三图垂直切片与 R2 全 13 图；验证 Content API、Field Runtime、InputGate、Render Projection 责任边界。
- **13 图验收：** 三图切换 Actor HTMLElement 身份稳定；Avatar 内部 zmap/smap 仍正确。；13 图逐张执行适用项；SOURCE-EMPTY/SOURCE-ABSENT/RESOURCE-MISSING 分别断言。
- **依赖 / 未决：** P1-11、P1-15、ADR-007；待需求卡审批；P1-11、P1-15、ADR-007；未获批前保持 PROPOSED。
- **批准状态：** PROPOSED / NOT-APPROVED

### P1-13 — Obj flow动画或平铺
- **用户目标：** 对含 flow 的 Obj 建立 V2 动画序列，不允许 v1 Adapter 静默丢弃 flow。
- **地图范围：** 222000000;222000001;230030200;230030100;230030000;230020300;230020200;230020100;230020000;230000000;230000001;230000002;230000003
- **模块 / 权威所有者：** Render Projection/Components；场景与位置仍由 Field Runtime；组件仅拥有 frame/cache/canvas 私有呈现状态
- **输入 → 输出：** MapScenePlanV1 + LogicalResourceRefV1 + Viewport snapshot; 关联源字段：Obj flow、ObjFrame、delay、frame index、origin、ResourceRef。 → Frozen ABI v1 RenderNode tree / Canvas pixels; 可观察验收：同一 presentation clock 回放 flow 帧一致；v1 收到 flow 必须 unsupported。
- **资源字段依赖：** Canvas width/height/origin/source/delay + LogicalResourceRefV1; Obj flow、ObjFrame、delay、frame index、origin、ResourceRef。
- **正常行为：** 对含 flow 的 Obj 建立 V2 动画序列，不允许 v1 Adapter 静默丢弃 flow。 同一 presentation clock 回放 flow 帧一致；v1 收到 flow 必须 unsupported。
- **边界行为：** flow 引用缺帧、循环零周期或资源不闭合时该 map 不可发布。；不把 SOURCE-ABSENT 当成 SOURCE-EMPTY，不静默补默认值。
- **错误 / 回滚：** 构建期 fail-closed 并输出稳定 diagnostic code；运行期保留 last-good RenderDomain tree 与 FieldRuntime state；跨图 prepare/replace 失败不得提交新 mapId、Actor、Camera 或 sceneEpoch。
- **OpenMS 参考：** https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/client/src/rendering/animation.js#L315-L395 ; https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/client/src/rendering/animation.js#L419-L465 ; https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/client/src/rendering/animation-timing.js#L2-L60 ; https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/client/src/rendering/animation-timing.js#L94-L135；commit 07994de02756356e3e025e3aca9e79433898d2c8
- **CMS079 历史状态：** RE-GAP-STATIC；Gaps=G37。只引用既有 research/source-of-truth 与 P0-P4-REQUIREMENT-EVIDENCE-MATRIX；不新增、不升级、不关闭 Claim/Evidence/Gap；历史 readiness 不等于产品批准或实现。
- **079/083 差异：** OpenMS pinned GMS083 是行为/算法候选，不是 CMS079 证明；本需求按 Adventure Island 产品规则实施，差异必须在 ADR/测试中明示，不声明原版等价。
- **ABI / 接口影响：** 不修改 Frozen RenderNode ABI v1 五字段、现有标签/attrs/data/event/key/sceneEpoch；可在 Field Runtime/Subsystem 内新增状态。当前 v1 无法表达的动态背景/Obj flow/Portal phase 必须走新 Plan/tag 版本 ADR。
- **性能目标：** viewport-sized Canvas；不建世界尺寸画布；资源解码有并发/像素预算；排序只在 plan 构建时完成
- **确定性单测：** P1-13 正常/边界/错误/回放纯函数测试；同一 presentation clock 回放 flow 帧一致；v1 收到 flow 必须 unsupported。；同一输入 state hash 一致。
- **集成测试：** P1-13 集成测试：R1 三图垂直切片与 R2 全 13 图；验证 Content API、Field Runtime、InputGate、Render Projection 责任边界。
- **13 图验收：** 同一 presentation clock 回放 flow 帧一致；v1 收到 flow 必须 unsupported。；13 图逐张执行适用项；SOURCE-EMPTY/SOURCE-ABSENT/RESOURCE-MISSING 分别断言。
- **依赖 / 未决：** P0-05、P0-11、ADR-005；待需求卡审批；P0-05、P0-11、ADR-005；未获批前保持 PROPOSED。
- **批准状态：** PROPOSED / NOT-APPROVED

### P1-14 — Portal pv/ph/psh可见帧
- **用户目标：** Portal v1 静态帧可显示；ph/psh 的 Start/Continue/Exit 状态动画进入新 tag/plan 版本。
- **地图范围：** 222000000;222000001;230030200;230030100;230030000;230020300;230020200;230020100;230020000;230000000;230000001;230000002;230000003
- **模块 / 权威所有者：** Render Projection/Components；场景与位置仍由 Field Runtime；组件仅拥有 frame/cache/canvas 私有呈现状态
- **输入 → 输出：** MapScenePlanV1 + LogicalResourceRefV1 + Viewport snapshot; 关联源字段：Portal type、pv/ph/psh、default、portalStart/Continue/Exit frames。 → Frozen ABI v1 RenderNode tree / Canvas pixels; 可观察验收：Portal 逻辑与视觉独立；phase transition 由 Field Runtime retained data 决定。
- **资源字段依赖：** Canvas width/height/origin/source/delay + LogicalResourceRefV1; Portal type、pv/ph/psh、default、portalStart/Continue/Exit frames。
- **正常行为：** Portal v1 静态帧可显示；ph/psh 的 Start/Continue/Exit 状态动画进入新 tag/plan 版本。 Portal 逻辑与视觉独立；phase transition 由 Field Runtime retained data 决定。
- **边界行为：** pv 帧缺失时不拿 editor icon 代替；phase 资源缺失不得假称动画完整。；不把 SOURCE-ABSENT 当成 SOURCE-EMPTY，不静默补默认值。
- **错误 / 回滚：** 构建期 fail-closed 并输出稳定 diagnostic code；运行期保留 last-good RenderDomain tree 与 FieldRuntime state；跨图 prepare/replace 失败不得提交新 mapId、Actor、Camera 或 sceneEpoch。
- **OpenMS 参考：** https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/client/src/world/portal-presentation.js#L2-L20 ; https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/client/src/rendering/animation.js#L315-L395 ; https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/client/src/rendering/animation.js#L419-L465；commit 07994de02756356e3e025e3aca9e79433898d2c8
- **CMS079 历史状态：** Frozen ABI首帧产品约定；Gaps=有帧不等于原版动画闭合。只引用既有 research/source-of-truth 与 P0-P4-REQUIREMENT-EVIDENCE-MATRIX；不新增、不升级、不关闭 Claim/Evidence/Gap；历史 readiness 不等于产品批准或实现。
- **079/083 差异：** OpenMS pinned GMS083 是行为/算法候选，不是 CMS079 证明；本需求按 Adventure Island 产品规则实施，差异必须在 ADR/测试中明示，不声明原版等价。
- **ABI / 接口影响：** 不修改 Frozen RenderNode ABI v1 五字段、现有标签/attrs/data/event/key/sceneEpoch；可在 Field Runtime/Subsystem 内新增状态。当前 v1 无法表达的动态背景/Obj flow/Portal phase 必须走新 Plan/tag 版本 ADR。
- **性能目标：** viewport-sized Canvas；不建世界尺寸画布；资源解码有并发/像素预算；排序只在 plan 构建时完成
- **确定性单测：** P1-14 正常/边界/错误/回放纯函数测试；Portal 逻辑与视觉独立；phase transition 由 Field Runtime retained data 决定。；同一输入 state hash 一致。
- **集成测试：** P1-14 集成测试：R1 三图垂直切片与 R2 全 13 图；验证 Content API、Field Runtime、InputGate、Render Projection 责任边界。
- **13 图验收：** Portal 逻辑与视觉独立；phase transition 由 Field Runtime retained data 决定。；13 图逐张执行适用项；SOURCE-EMPTY/SOURCE-ABSENT/RESOURCE-MISSING 分别断言。
- **依赖 / 未决：** P0-10、P0-11、P4-02、ADR-005；ABI 缺 delay 保持第一帧；P0-10、P0-11、P4-02、ADR-005；未获批前保持 PROPOSED。
- **批准状态：** PROPOSED / NOT-APPROVED

### P1-15 — Layer节点/viewport Canvas
- **用户目标：** 每层使用 viewport-sized Canvas 与可见区域裁剪，缓存/解码/画布生命周期有界。
- **地图范围：** 222000000;222000001;230030200;230030100;230030000;230020300;230020200;230020100;230020000;230000000;230000001;230000002;230000003
- **模块 / 权威所有者：** Render Projection/Components；场景与位置仍由 Field Runtime；组件仅拥有 frame/cache/canvas 私有呈现状态
- **输入 → 输出：** MapScenePlanV1 + LogicalResourceRefV1 + Viewport snapshot; 关联源字段：Viewport、layer plan、visible placements、DPR、resource cache。 → Frozen ABI v1 RenderNode tree / Canvas pixels; 可观察验收：Resize、disconnect、sceneEpoch change 后旧任务不覆盖新场景且资源释放。
- **资源字段依赖：** Canvas width/height/origin/source/delay + LogicalResourceRefV1; Viewport、layer plan、visible placements、DPR、resource cache。
- **正常行为：** 每层使用 viewport-sized Canvas 与可见区域裁剪，缓存/解码/画布生命周期有界。 Resize、disconnect、sceneEpoch change 后旧任务不覆盖新场景且资源释放。
- **边界行为：** 超出像素/并发/资源预算时明确 error；不得创建整幅世界 Canvas。；不把 SOURCE-ABSENT 当成 SOURCE-EMPTY，不静默补默认值。
- **错误 / 回滚：** 构建期 fail-closed 并输出稳定 diagnostic code；运行期保留 last-good RenderDomain tree 与 FieldRuntime state；跨图 prepare/replace 失败不得提交新 mapId、Actor、Camera 或 sceneEpoch。
- **OpenMS 参考：** https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/content/src/scene-assets.js ; https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/client/src/rendering/visual-resources.js ; https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/client/src/rendering/stream-scene.js；commit 07994de02756356e3e025e3aca9e79433898d2c8
- **CMS079 历史状态：** PRODUCT-READY；Gaps=—。只引用既有 research/source-of-truth 与 P0-P4-REQUIREMENT-EVIDENCE-MATRIX；不新增、不升级、不关闭 Claim/Evidence/Gap；历史 readiness 不等于产品批准或实现。
- **079/083 差异：** OpenMS pinned GMS083 是行为/算法候选，不是 CMS079 证明；本需求按 Adventure Island 产品规则实施，差异必须在 ADR/测试中明示，不声明原版等价。
- **ABI / 接口影响：** 不修改 Frozen RenderNode ABI v1 五字段、现有标签/attrs/data/event/key/sceneEpoch；可在 Field Runtime/Subsystem 内新增状态。当前 v1 无法表达的动态背景/Obj flow/Portal phase 必须走新 Plan/tag 版本 ADR。
- **性能目标：** viewport-sized Canvas；不建世界尺寸画布；资源解码有并发/像素预算；排序只在 plan 构建时完成
- **确定性单测：** P1-15 正常/边界/错误/回放纯函数测试；Resize、disconnect、sceneEpoch change 后旧任务不覆盖新场景且资源释放。；同一输入 state hash 一致。
- **集成测试：** P1-15 集成测试：R1 三图垂直切片与 R2 全 13 图；验证 Content API、Field Runtime、InputGate、Render Projection 责任边界。
- **13 图验收：** Resize、disconnect、sceneEpoch change 后旧任务不覆盖新场景且资源释放。；13 图逐张执行适用项；SOURCE-EMPTY/SOURCE-ABSENT/RESOURCE-MISSING 分别断言。
- **依赖 / 未决：** P1-09、P2-04、P4-08；待需求卡审批；P1-09、P2-04、P4-08；未获批前保持 PROPOSED。
- **批准状态：** PROPOSED / NOT-APPROVED

### P2-01 — world→screen产品变换
- **用户目标：** 定义 screenX=worldX-cameraLeft、screenY=worldY-cameraTop；Y 向下、1:1 CSS px。
- **地图范围：** 222000000;222000001;230030200;230030100;230030000;230020300;230020200;230020100;230020000;230000000;230000001;230000002;230000003
- **模块 / 权威所有者：** Field Camera；CameraState 属于 Field Runtime；RenderNode 仅投影当前值
- **输入 → 输出：** Actor feet world pose + sourceBounds + Viewport + monotonic time; 关联源字段：World position、camera top-left、viewport、DPR。 → CameraState top-left x/y → cms-scene-view.attrs.x/y; 可观察验收：world-camera 的四角和负坐标 golden test；DPR 不改变世界坐标。
- **资源字段依赖：** VR/minimap/foothold bounds + Viewport + Actor feet; World position、camera top-left、viewport、DPR。
- **正常行为：** 定义 screenX=worldX-cameraLeft、screenY=worldY-cameraTop；Y 向下、1:1 CSS px。 world-camera 的四角和负坐标 golden test；DPR 不改变世界坐标。
- **边界行为：** viewport 尺寸不为正拒绝；camera x/y 使用有限整数世界像素。；不把 SOURCE-ABSENT 当成 SOURCE-EMPTY，不静默补默认值。
- **错误 / 回滚：** 构建期 fail-closed 并输出稳定 diagnostic code；运行期保留 last-good RenderDomain tree 与 FieldRuntime state；跨图 prepare/replace 失败不得提交新 mapId、Actor、Camera 或 sceneEpoch。
- **OpenMS 参考：** https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/client/src/rendering/camera.js#L7-L16 ; https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/client/src/rendering/camera.js#L39-L64 ; https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/client/src/rendering/camera.js#L67-L129 ; https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/client/src/physics/bounds.js；commit 07994de02756356e3e025e3aca9e79433898d2c8
- **CMS079 历史状态：** 否；Gaps=1:1并非原版推论。只引用既有 research/source-of-truth 与 P0-P4-REQUIREMENT-EVIDENCE-MATRIX；不新增、不升级、不关闭 Claim/Evidence/Gap；历史 readiness 不等于产品批准或实现。
- **079/083 差异：** OpenMS pinned GMS083 是行为/算法候选，不是 CMS079 证明；本需求按 Adventure Island 产品规则实施，差异必须在 ADR/测试中明示，不声明原版等价。
- **ABI / 接口影响：** 不修改 Frozen RenderNode ABI v1 五字段、现有标签/attrs/data/event/key/sceneEpoch；可在 Field Runtime/Subsystem 内新增状态。当前 v1 无法表达的动态背景/Obj flow/Portal phase 必须走新 Plan/tag 版本 ADR。
- **性能目标：** bounds 构建后缓存；每 tick O(1) follow；禁止逐帧扫描 Foothold
- **确定性单测：** P2-01 正常/边界/错误/回放纯函数测试；world-camera 的四角和负坐标 golden test；DPR 不改变世界坐标。；同一输入 state hash 一致。
- **集成测试：** P2-01 集成测试：R1 三图垂直切片与 R2 全 13 图；验证 Content API、Field Runtime、InputGate、Render Projection 责任边界。
- **13 图验收：** world-camera 的四角和负坐标 golden test；DPR 不改变世界坐标。；13 图逐张执行适用项；SOURCE-EMPTY/SOURCE-ABSENT/RESOURCE-MISSING 分别断言。
- **依赖 / 未决：** P0-12、P2-04；待需求卡审批；P0-12、P2-04；未获批前保持 PROPOSED。
- **批准状态：** PROPOSED / NOT-APPROVED

### P2-02 — VR内缩/折叠
- **用户目标：** VR 四边完整时按 MapScenePlan 公式构建 effectiveBounds；Camera 不重复应用 inset。
- **地图范围：** 222000000;222000001;230030200;230030100;230030000;230020300;230020200;230020100;230020000;230000000;230000001;230000002;230000003
- **模块 / 权威所有者：** Field Camera；CameraState 属于 Field Runtime；RenderNode 仅投影当前值
- **输入 → 输出：** Actor feet world pose + sourceBounds + Viewport + monotonic time; 关联源字段：sourceBounds/effectiveBounds、viewport width/height。 → CameraState top-left x/y → cms-scene-view.attrs.x/y; 可观察验收：800×600 与非标准 viewport 均无二次内缩；地图小于视口时居中。
- **资源字段依赖：** VR/minimap/foothold bounds + Viewport + Actor feet; sourceBounds/effectiveBounds、viewport width/height。
- **正常行为：** VR 四边完整时按 MapScenePlan 公式构建 effectiveBounds；Camera 不重复应用 inset。 800×600 与非标准 viewport 均无二次内缩；地图小于视口时居中。
- **边界行为：** 轴收敛/反向时向零截断中点；viewport 不同于 800×600 不得沿用固定 400/300 top-left 夹取。；不把 SOURCE-ABSENT 当成 SOURCE-EMPTY，不静默补默认值。
- **错误 / 回滚：** 构建期 fail-closed 并输出稳定 diagnostic code；运行期保留 last-good RenderDomain tree 与 FieldRuntime state；跨图 prepare/replace 失败不得提交新 mapId、Actor、Camera 或 sceneEpoch。
- **OpenMS 参考：** https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/client/src/rendering/camera.js#L7-L16 ; https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/client/src/rendering/camera.js#L39-L64 ; https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/client/src/rendering/camera.js#L67-L129 ; https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/client/src/physics/bounds.js；commit 07994de02756356e3e025e3aca9e79433898d2c8
- **CMS079 历史状态：** 原版直接指令；Gaps=不得当做固定窗口800×600。只引用既有 research/source-of-truth 与 P0-P4-REQUIREMENT-EVIDENCE-MATRIX；不新增、不升级、不关闭 Claim/Evidence/Gap；历史 readiness 不等于产品批准或实现。
- **079/083 差异：** OpenMS pinned GMS083 是行为/算法候选，不是 CMS079 证明；本需求按 Adventure Island 产品规则实施，差异必须在 ADR/测试中明示，不声明原版等价。
- **ABI / 接口影响：** 不修改 Frozen RenderNode ABI v1 五字段、现有标签/attrs/data/event/key/sceneEpoch；可在 Field Runtime/Subsystem 内新增状态。当前 v1 无法表达的动态背景/Obj flow/Portal phase 必须走新 Plan/tag 版本 ADR。
- **性能目标：** bounds 构建后缓存；每 tick O(1) follow；禁止逐帧扫描 Foothold
- **确定性单测：** P2-02 正常/边界/错误/回放纯函数测试；800×600 与非标准 viewport 均无二次内缩；地图小于视口时居中。；同一输入 state hash 一致。
- **集成测试：** P2-02 集成测试：R1 三图垂直切片与 R2 全 13 图；验证 Content API、Field Runtime、InputGate、Render Projection 责任边界。
- **13 图验收：** 800×600 与非标准 viewport 均无二次内缩；地图小于视口时居中。；13 图逐张执行适用项；SOURCE-EMPTY/SOURCE-ABSENT/RESOURCE-MISSING 分别断言。
- **依赖 / 未决：** P0-12、P2-06、ADR-002；待需求卡审批；P0-12、P2-06、ADR-002；未获批前保持 PROPOSED。
- **批准状态：** PROPOSED / NOT-APPROVED

### P2-03 — 无VR边界回退
- **用户目标：** 无完整 VR 时按 miniMap→Foothold bbox 回退，source/adjustment 必须保留。
- **地图范围：** 222000000;222000001;230030200;230030100;230030000;230020300;230020200;230020100;230020000;230000000;230000001;230000002;230000003
- **模块 / 权威所有者：** Field Camera；CameraState 属于 Field Runtime；RenderNode 仅投影当前值
- **输入 → 输出：** Actor feet world pose + sourceBounds + Viewport + monotonic time; 关联源字段：miniMap width/height/centerX/centerY、Foothold bbox。 → CameraState top-left x/y → cms-scene-view.attrs.x/y; 可观察验收：8 张无 VR 地图都得到可重复边界；来源诊断可见。
- **资源字段依赖：** VR/minimap/foothold bounds + Viewport + Actor feet; miniMap width/height/centerX/centerY、Foothold bbox。
- **正常行为：** 无完整 VR 时按 miniMap→Foothold bbox 回退，source/adjustment 必须保留。 8 张无 VR 地图都得到可重复边界；来源诊断可见。
- **边界行为：** miniMap 缺项或 Foothold 空集时 bounds-unavailable；不得混合 VR 单边与 minimap。；不把 SOURCE-ABSENT 当成 SOURCE-EMPTY，不静默补默认值。
- **错误 / 回滚：** 构建期 fail-closed 并输出稳定 diagnostic code；运行期保留 last-good RenderDomain tree 与 FieldRuntime state；跨图 prepare/replace 失败不得提交新 mapId、Actor、Camera 或 sceneEpoch。
- **OpenMS 参考：** https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/client/src/rendering/camera.js#L7-L16 ; https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/client/src/rendering/camera.js#L39-L64 ; https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/client/src/rendering/camera.js#L67-L129 ; https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/client/src/physics/bounds.js；commit 07994de02756356e3e025e3aca9e79433898d2c8
- **CMS079 历史状态：** MapScenePlan§3正式产品回退；Gaps=VR与回退不同证据等级。只引用既有 research/source-of-truth 与 P0-P4-REQUIREMENT-EVIDENCE-MATRIX；不新增、不升级、不关闭 Claim/Evidence/Gap；历史 readiness 不等于产品批准或实现。
- **079/083 差异：** OpenMS pinned GMS083 是行为/算法候选，不是 CMS079 证明；本需求按 Adventure Island 产品规则实施，差异必须在 ADR/测试中明示，不声明原版等价。
- **ABI / 接口影响：** 不修改 Frozen RenderNode ABI v1 五字段、现有标签/attrs/data/event/key/sceneEpoch；可在 Field Runtime/Subsystem 内新增状态。当前 v1 无法表达的动态背景/Obj flow/Portal phase 必须走新 Plan/tag 版本 ADR。
- **性能目标：** bounds 构建后缓存；每 tick O(1) follow；禁止逐帧扫描 Foothold
- **确定性单测：** P2-03 正常/边界/错误/回放纯函数测试；8 张无 VR 地图都得到可重复边界；来源诊断可见。；同一输入 state hash 一致。
- **集成测试：** P2-03 集成测试：R1 三图垂直切片与 R2 全 13 图；验证 Content API、Field Runtime、InputGate、Render Projection 责任边界。
- **13 图验收：** 8 张无 VR 地图都得到可重复边界；来源诊断可见。；13 图逐张执行适用项；SOURCE-EMPTY/SOURCE-ABSENT/RESOURCE-MISSING 分别断言。
- **依赖 / 未决：** P0-12；待需求卡审批；P0-12；未获批前保持 PROPOSED。
- **批准状态：** PROPOSED / NOT-APPROVED

### P2-04 — Viewport来源
- **用户目标：** Viewport 来自 LoomRealm Viewport snapshot；DPR 只控制设备像素画布。
- **地图范围：** 222000000;222000001;230030200;230030100;230030000;230020300;230020200;230020100;230020000;230000000;230000001;230000002;230000003
- **模块 / 权威所有者：** Field Camera；CameraState 属于 Field Runtime；RenderNode 仅投影当前值
- **输入 → 输出：** Actor feet world pose + sourceBounds + Viewport + monotonic time; 关联源字段：Viewport width/height、DPR、scene bounds。 → CameraState top-left x/y → cms-scene-view.attrs.x/y; 可观察验收：640×480/800×600/1280×720 与 DPR 1/2/3 通过。
- **资源字段依赖：** VR/minimap/foothold bounds + Viewport + Actor feet; Viewport width/height、DPR、scene bounds。
- **正常行为：** Viewport 来自 LoomRealm Viewport snapshot；DPR 只控制设备像素画布。 640×480/800×600/1280×720 与 DPR 1/2/3 通过。
- **边界行为：** resize 连续合并；width/height 为 0 时暂停绘制但不重置 world。；不把 SOURCE-ABSENT 当成 SOURCE-EMPTY，不静默补默认值。
- **错误 / 回滚：** 构建期 fail-closed 并输出稳定 diagnostic code；运行期保留 last-good RenderDomain tree 与 FieldRuntime state；跨图 prepare/replace 失败不得提交新 mapId、Actor、Camera 或 sceneEpoch。
- **OpenMS 参考：** https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/client/src/rendering/camera.js#L7-L16 ; https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/client/src/rendering/camera.js#L39-L64 ; https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/client/src/rendering/camera.js#L67-L129 ; https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/client/src/physics/bounds.js；commit 07994de02756356e3e025e3aca9e79433898d2c8
- **CMS079 历史状态：** PRODUCT-READY；Gaps=G10。只引用既有 research/source-of-truth 与 P0-P4-REQUIREMENT-EVIDENCE-MATRIX；不新增、不升级、不关闭 Claim/Evidence/Gap；历史 readiness 不等于产品批准或实现。
- **079/083 差异：** OpenMS pinned GMS083 是行为/算法候选，不是 CMS079 证明；本需求按 Adventure Island 产品规则实施，差异必须在 ADR/测试中明示，不声明原版等价。
- **ABI / 接口影响：** 不修改 Frozen RenderNode ABI v1 五字段、现有标签/attrs/data/event/key/sceneEpoch；可在 Field Runtime/Subsystem 内新增状态。当前 v1 无法表达的动态背景/Obj flow/Portal phase 必须走新 Plan/tag 版本 ADR。
- **性能目标：** bounds 构建后缓存；每 tick O(1) follow；禁止逐帧扫描 Foothold
- **确定性单测：** P2-04 正常/边界/错误/回放纯函数测试；640×480/800×600/1280×720 与 DPR 1/2/3 通过。；同一输入 state hash 一致。
- **集成测试：** P2-04 集成测试：R1 三图垂直切片与 R2 全 13 图；验证 Content API、Field Runtime、InputGate、Render Projection 责任边界。
- **13 图验收：** 640×480/800×600/1280×720 与 DPR 1/2/3 通过。；13 图逐张执行适用项；SOURCE-EMPTY/SOURCE-ABSENT/RESOURCE-MISSING 分别断言。
- **依赖 / 未决：** P1-15、P2-01；待需求卡审批；P1-15、P2-01；未获批前保持 PROPOSED。
- **批准状态：** PROPOSED / NOT-APPROVED

### P2-05 — 相机位置更新者/跟随目标
- **用户目标：** CameraSubsystem 是 camera x/y 唯一写入者；目标为 Actor feet+(0,-50) 作为 OpenMS 候选。
- **地图范围：** 222000000;222000001;230030200;230030100;230030000;230020300;230020200;230020100;230020000;230000000;230000001;230000002;230000003
- **模块 / 权威所有者：** Field Camera；CameraState 属于 Field Runtime；RenderNode 仅投影当前值
- **输入 → 输出：** Actor feet world pose + sourceBounds + Viewport + monotonic time; 关联源字段：Actor world position、camera state、map bounds。 → CameraState top-left x/y → cms-scene-view.attrs.x/y; 可观察验收：组件 receiveRenderData 不可写 world；camera snapshot 可重放。
- **资源字段依赖：** VR/minimap/foothold bounds + Viewport + Actor feet; Actor world position、camera state、map bounds。
- **正常行为：** CameraSubsystem 是 camera x/y 唯一写入者；目标为 Actor feet+(0,-50) 作为 OpenMS 候选。 组件 receiveRenderData 不可写 world；camera snapshot 可重放。
- **边界行为：** Actor 不存在时保持最后有效 camera；首次进入 map 以 arrival target snap。；不把 SOURCE-ABSENT 当成 SOURCE-EMPTY，不静默补默认值。
- **错误 / 回滚：** 构建期 fail-closed 并输出稳定 diagnostic code；运行期保留 last-good RenderDomain tree 与 FieldRuntime state；跨图 prepare/replace 失败不得提交新 mapId、Actor、Camera 或 sceneEpoch。
- **OpenMS 参考：** https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/client/src/rendering/camera.js#L7-L16 ; https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/client/src/rendering/camera.js#L39-L64 ; https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/client/src/rendering/camera.js#L67-L129 ; https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/client/src/physics/bounds.js；commit 07994de02756356e3e025e3aca9e79433898d2c8
- **CMS079 历史状态：** DESIGN-DECISION；Gaps=G10。只引用既有 research/source-of-truth 与 P0-P4-REQUIREMENT-EVIDENCE-MATRIX；不新增、不升级、不关闭 Claim/Evidence/Gap；历史 readiness 不等于产品批准或实现。
- **079/083 差异：** OpenMS pinned GMS083 是行为/算法候选，不是 CMS079 证明；本需求按 Adventure Island 产品规则实施，差异必须在 ADR/测试中明示，不声明原版等价。
- **ABI / 接口影响：** 不修改 Frozen RenderNode ABI v1 五字段、现有标签/attrs/data/event/key/sceneEpoch；可在 Field Runtime/Subsystem 内新增状态。当前 v1 无法表达的动态背景/Obj flow/Portal phase 必须走新 Plan/tag 版本 ADR。
- **性能目标：** bounds 构建后缓存；每 tick O(1) follow；禁止逐帧扫描 Foothold
- **确定性单测：** P2-05 正常/边界/错误/回放纯函数测试；组件 receiveRenderData 不可写 world；camera snapshot 可重放。；同一输入 state hash 一致。
- **集成测试：** P2-05 集成测试：R1 三图垂直切片与 R2 全 13 图；验证 Content API、Field Runtime、InputGate、Render Projection 责任边界。
- **13 图验收：** 组件 receiveRenderData 不可写 world；camera snapshot 可重放。；13 图逐张执行适用项；SOURCE-EMPTY/SOURCE-ABSENT/RESOURCE-MISSING 分别断言。
- **依赖 / 未决：** P2-01、P2-06、ADR-002；ADR Camera焦点；P2-01、P2-06、ADR-002；未获批前保持 PROPOSED。
- **批准状态：** PROPOSED / NOT-APPROVED

### P2-06 — Camera deadzone平滑夹取/小图
- **用户目标：** 使用 28px deadband 与 coefficient=100 的 OpenMS filter 作为候选；输出仍为 ABI top-left。
- **地图范围：** 222000000;222000001;230030200;230030100;230030000;230020300;230020200;230020100;230020000;230000000;230000001;230000002;230000003
- **模块 / 权威所有者：** Field Camera；CameraState 属于 Field Runtime；RenderNode 仅投影当前值
- **输入 → 输出：** Actor feet world pose + sourceBounds + Viewport + monotonic time; 关联源字段：feet target、monotonic elapsed、viewport、sourceBounds。 → CameraState top-left x/y → cms-scene-view.attrs.x/y; 可观察验收：同一虚拟时间序列 camera 输出逐帧相同；不因 render FPS 改变。
- **资源字段依赖：** VR/minimap/foothold bounds + Viewport + Actor feet; feet target、monotonic elapsed、viewport、sourceBounds。
- **正常行为：** 使用 28px deadband 与 coefficient=100 的 OpenMS filter 作为候选；输出仍为 ABI top-left。 同一虚拟时间序列 camera 输出逐帧相同；不因 render FPS 改变。
- **边界行为：** 首帧 snap；时间回退/非有限 dt 拒绝；小地图居中；deadband 内不抖动。；不把 SOURCE-ABSENT 当成 SOURCE-EMPTY，不静默补默认值。
- **错误 / 回滚：** 构建期 fail-closed 并输出稳定 diagnostic code；运行期保留 last-good RenderDomain tree 与 FieldRuntime state；跨图 prepare/replace 失败不得提交新 mapId、Actor、Camera 或 sceneEpoch。
- **OpenMS 参考：** https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/client/src/rendering/camera.js#L7-L16 ; https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/client/src/rendering/camera.js#L39-L64 ; https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/client/src/rendering/camera.js#L67-L129 ; https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/client/src/physics/bounds.js；commit 07994de02756356e3e025e3aca9e79433898d2c8
- **CMS079 历史状态：** DESIGN-DECISION；Gaps=G10。只引用既有 research/source-of-truth 与 P0-P4-REQUIREMENT-EVIDENCE-MATRIX；不新增、不升级、不关闭 Claim/Evidence/Gap；历史 readiness 不等于产品批准或实现。
- **079/083 差异：** OpenMS pinned GMS083 是行为/算法候选，不是 CMS079 证明；本需求按 Adventure Island 产品规则实施，差异必须在 ADR/测试中明示，不声明原版等价。
- **ABI / 接口影响：** 不修改 Frozen RenderNode ABI v1 五字段、现有标签/attrs/data/event/key/sceneEpoch；可在 Field Runtime/Subsystem 内新增状态。当前 v1 无法表达的动态背景/Obj flow/Portal phase 必须走新 Plan/tag 版本 ADR。
- **性能目标：** bounds 构建后缓存；每 tick O(1) follow；禁止逐帧扫描 Foothold
- **确定性单测：** P2-06 正常/边界/错误/回放纯函数测试；同一虚拟时间序列 camera 输出逐帧相同；不因 render FPS 改变。；同一输入 state hash 一致。
- **集成测试：** P2-06 集成测试：R1 三图垂直切片与 R2 全 13 图；验证 Content API、Field Runtime、InputGate、Render Projection 责任边界。
- **13 图验收：** 同一虚拟时间序列 camera 输出逐帧相同；不因 render FPS 改变。；13 图逐张执行适用项；SOURCE-EMPTY/SOURCE-ABSENT/RESOURCE-MISSING 分别断言。
- **依赖 / 未决：** P2-02、P2-05、P2-08、ADR-002；ADR deadzone/平滑；P2-02、P2-05、P2-08、ADR-002；未获批前保持 PROPOSED。
- **批准状态：** PROPOSED / NOT-APPROVED

### P2-07 — Viewport resize不写回world
- **用户目标：** Viewport resize 只更新 camera projection 与 Canvas，不修改 Actor/physics state。
- **地图范围：** 222000000;222000001;230030200;230030100;230030000;230020300;230020200;230020100;230020000;230000000;230000001;230000002;230000003
- **模块 / 权威所有者：** Field Camera；CameraState 属于 Field Runtime；RenderNode 仅投影当前值
- **输入 → 输出：** Actor feet world pose + sourceBounds + Viewport + monotonic time; 关联源字段：Viewport resize event、camera snapshot。 → CameraState top-left x/y → cms-scene-view.attrs.x/y; 可观察验收：比较 resize 前后 PlayerState 字节完全相同。
- **资源字段依赖：** VR/minimap/foothold bounds + Viewport + Actor feet; Viewport resize event、camera snapshot。
- **正常行为：** Viewport resize 只更新 camera projection 与 Canvas，不修改 Actor/physics state。 比较 resize 前后 PlayerState 字节完全相同。
- **边界行为：** 连续 resize 与恢复旧尺寸不积累位置误差；资源加载迟到结果被 epoch 隔离。；不把 SOURCE-ABSENT 当成 SOURCE-EMPTY，不静默补默认值。
- **错误 / 回滚：** 构建期 fail-closed 并输出稳定 diagnostic code；运行期保留 last-good RenderDomain tree 与 FieldRuntime state；跨图 prepare/replace 失败不得提交新 mapId、Actor、Camera 或 sceneEpoch。
- **OpenMS 参考：** https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/client/src/rendering/camera.js#L7-L16 ; https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/client/src/rendering/camera.js#L39-L64 ; https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/client/src/rendering/camera.js#L67-L129 ; https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/client/src/physics/bounds.js；commit 07994de02756356e3e025e3aca9e79433898d2c8
- **CMS079 历史状态：** PRODUCT-READY；Gaps=—。只引用既有 research/source-of-truth 与 P0-P4-REQUIREMENT-EVIDENCE-MATRIX；不新增、不升级、不关闭 Claim/Evidence/Gap；历史 readiness 不等于产品批准或实现。
- **079/083 差异：** OpenMS pinned GMS083 是行为/算法候选，不是 CMS079 证明；本需求按 Adventure Island 产品规则实施，差异必须在 ADR/测试中明示，不声明原版等价。
- **ABI / 接口影响：** 不修改 Frozen RenderNode ABI v1 五字段、现有标签/attrs/data/event/key/sceneEpoch；可在 Field Runtime/Subsystem 内新增状态。当前 v1 无法表达的动态背景/Obj flow/Portal phase 必须走新 Plan/tag 版本 ADR。
- **性能目标：** bounds 构建后缓存；每 tick O(1) follow；禁止逐帧扫描 Foothold
- **确定性单测：** P2-07 正常/边界/错误/回放纯函数测试；比较 resize 前后 PlayerState 字节完全相同。；同一输入 state hash 一致。
- **集成测试：** P2-07 集成测试：R1 三图垂直切片与 R2 全 13 图；验证 Content API、Field Runtime、InputGate、Render Projection 责任边界。
- **13 图验收：** 比较 resize 前后 PlayerState 字节完全相同。；13 图逐张执行适用项；SOURCE-EMPTY/SOURCE-ABSENT/RESOURCE-MISSING 分别断言。
- **依赖 / 未决：** P2-04、P1-15；待需求卡审批；P2-04、P1-15；未获批前保持 PROPOSED。
- **批准状态：** PROPOSED / NOT-APPROVED

### P2-08 — 0x1E与0x5A实际节拍
- **用户目标：** Physics 固定 30ms tick；render frame delta 只累加到 accumulator，输入 edge 按 tick 顺序消费。
- **地图范围：** 222000000;222000001;230030200;230030100;230030000;230020300;230020200;230020100;230020000;230000000;230000001;230000002;230000003
- **模块 / 权威所有者：** Field Camera；CameraState 属于 Field Runtime；RenderNode 仅投影当前值
- **输入 → 输出：** Actor feet world pose + sourceBounds + Viewport + monotonic time; 关联源字段：monotonic elapsed、InputGate sequence、accumulator。 → CameraState top-left x/y → cms-scene-view.attrs.x/y; 可观察验收：16.67/33/250/1000ms 帧序列在同一 tick input log 下得到同一 state hash。
- **资源字段依赖：** VR/minimap/foothold bounds + Viewport + Actor feet; monotonic elapsed、InputGate sequence、accumulator。
- **正常行为：** Physics 固定 30ms tick；render frame delta 只累加到 accumulator，输入 edge 按 tick 顺序消费。 16.67/33/250/1000ms 帧序列在同一 tick input log 下得到同一 state hash。
- **边界行为：** 每次最多 8 个 catch-up tick；剩余 backlog 保留并报告 overload，不丢模拟时间。；不把 SOURCE-ABSENT 当成 SOURCE-EMPTY，不静默补默认值。
- **错误 / 回滚：** 构建期 fail-closed 并输出稳定 diagnostic code；运行期保留 last-good RenderDomain tree 与 FieldRuntime state；跨图 prepare/replace 失败不得提交新 mapId、Actor、Camera 或 sceneEpoch。
- **OpenMS 参考：** https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/client/src/physics/simulation.js#L24-L28 ; https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/client/src/physics/simulation.js#L275-L312 ; https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/client/src/physics/simulation.js#L325-L466；commit 07994de02756356e3e025e3aca9e79433898d2c8
- **CMS079 历史状态：** RE-GAP-STATIC；Gaps=G34。只引用既有 research/source-of-truth 与 P0-P4-REQUIREMENT-EVIDENCE-MATRIX；不新增、不升级、不关闭 Claim/Evidence/Gap；历史 readiness 不等于产品批准或实现。
- **079/083 差异：** OpenMS pinned GMS083 是行为/算法候选，不是 CMS079 证明；本需求按 Adventure Island 产品规则实施，差异必须在 ADR/测试中明示，不声明原版等价。
- **ABI / 接口影响：** 不修改 Frozen RenderNode ABI v1 五字段、现有标签/attrs/data/event/key/sceneEpoch；可在 Field Runtime/Subsystem 内新增状态。当前 v1 无法表达的动态背景/Obj flow/Portal phase 必须走新 Plan/tag 版本 ADR。
- **性能目标：** bounds 构建后缓存；每 tick O(1) follow；禁止逐帧扫描 Foothold
- **确定性单测：** P2-08 正常/边界/错误/回放纯函数测试；16.67/33/250/1000ms 帧序列在同一 tick input log 下得到同一 state hash。；同一输入 state hash 一致。
- **集成测试：** P2-08 集成测试：R1 三图垂直切片与 R2 全 13 图；验证 Content API、Field Runtime、InputGate、Render Projection 责任边界。
- **13 图验收：** 16.67/33/250/1000ms 帧序列在同一 tick input log 下得到同一 state hash。；13 图逐张执行适用项；SOURCE-EMPTY/SOURCE-ABSENT/RESOURCE-MISSING 分别断言。
- **依赖 / 未决：** P3-20、ADR-003；ADR 物理时钟；P3-20、ADR-003；未获批前保持 PROPOSED。
- **批准状态：** PROPOSED / NOT-APPROVED

### P3-01 — 行走平地积分一步
- **用户目标：** 平地行走以 Physics config 加速/限速/制动，按固定 tick 积分。
- **地图范围：** 222000000;222000001;230030200;230030100;230030000;230020300;230020200;230020100;230020000;230000000;230000001;230000002;230000003
- **模块 / 权威所有者：** Field Movement；Shared State/Field Runtime 是唯一权威；Actor 组件只接收投影
- **输入 → 输出：** InputGate tick frame + Physics config + Foothold/Rope/Seat/Map Info; 关联源字段：InputFrame、Physics walk force/speed/friction、ground tangent。 → PlayerMotionState position/velocity/mode/pose/contacts; 可观察验收：恒定输入 30 ticks 与 golden position/velocity 匹配。
- **资源字段依赖：** Physics 19 numeric fields + Foothold/Rope/Seat/Map Info; InputFrame、Physics walk force/speed/friction、ground tangent。
- **正常行为：** 平地行走以 Physics config 加速/限速/制动，按固定 tick 积分。 恒定输入 30 ticks 与 golden position/velocity 匹配。
- **边界行为：** 左右同时按下水平输入为 0；速度不越过目标限值；输入无效拒绝。；不把 SOURCE-ABSENT 当成 SOURCE-EMPTY，不静默补默认值。
- **错误 / 回滚：** 构建期 fail-closed 并输出稳定 diagnostic code；运行期保留 last-good RenderDomain tree 与 FieldRuntime state；跨图 prepare/replace 失败不得提交新 mapId、Actor、Camera 或 sceneEpoch。
- **OpenMS 参考：** https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/client/src/physics/dynamics.js#L25-L58 ; https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/client/src/physics/dynamics.js#L115-L147 ; https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/client/src/physics/simulation.js#L24-L28 ; https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/client/src/physics/simulation.js#L275-L312 ; https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/client/src/physics/simulation.js#L325-L466；commit 07994de02756356e3e025e3aca9e79433898d2c8
- **CMS079 历史状态：** RE-READY；Gaps=G40。只引用既有 research/source-of-truth 与 P0-P4-REQUIREMENT-EVIDENCE-MATRIX；不新增、不升级、不关闭 Claim/Evidence/Gap；历史 readiness 不等于产品批准或实现。
- **079/083 差异：** OpenMS pinned GMS083 是行为/算法候选，不是 CMS079 证明；本需求按 Adventure Island 产品规则实施，差异必须在 ADR/测试中明示，不声明原版等价。
- **ABI / 接口影响：** 不修改 Frozen RenderNode ABI v1 五字段、现有标签/attrs/data/event/key/sceneEpoch；可在 Field Runtime/Subsystem 内新增状态。当前 v1 无法表达的动态背景/Obj flow/Portal phase 必须走新 Plan/tag 版本 ADR。
- **性能目标：** 30ms fixed tick；每 render 最多 8 catch-up；最多 32 Foothold transitions/tick；热循环不分配数组
- **确定性单测：** P3-01 正常/边界/错误/回放纯函数测试；恒定输入 30 ticks 与 golden position/velocity 匹配。；同一输入 state hash 一致。
- **集成测试：** P3-01 集成测试：R1 三图垂直切片与 R2 全 13 图；验证 Content API、Field Runtime、InputGate、Render Projection 责任边界。
- **13 图验收：** 恒定输入 30 ticks 与 golden position/velocity 匹配。；13 图逐张执行适用项；SOURCE-EMPTY/SOURCE-ABSENT/RESOURCE-MISSING 分别断言。
- **依赖 / 未决：** P0-13、P3-20；待需求卡审批；P0-13、P3-20；未获批前保持 PROPOSED。
- **批准状态：** PROPOSED / NOT-APPROVED

### P3-02 — 缓坡/陡坡和摩擦
- **用户目标：** 坡面速度投影到 Foothold tangent；坡度、摩擦和 slip 使用明确产品参数。
- **地图范围：** 222000000;222000001;230030200;230030100;230030000;230020300;230020200;230020100;230020000;230000000;230000001;230000002;230000003
- **模块 / 权威所有者：** Field Movement；Shared State/Field Runtime 是唯一权威；Actor 组件只接收投影
- **输入 → 输出：** InputGate tick frame + Physics config + Foothold/Rope/Seat/Map Info; 关联源字段：x1/y1/x2/y2、Physics friction、force；V2 drag。 → PlayerMotionState position/velocity/mode/pose/contacts; 可观察验收：正/负斜率、零 force、最大坡度与速度上限 property tests。
- **资源字段依赖：** Physics 19 numeric fields + Foothold/Rope/Seat/Map Info; x1/y1/x2/y2、Physics friction、force；V2 drag。
- **正常行为：** 坡面速度投影到 Foothold tangent；坡度、摩擦和 slip 使用明确产品参数。 正/负斜率、零 force、最大坡度与速度上限 property tests。
- **边界行为：** FootholdV1 缺 per-segment drag 时不猜测；极陡坡按产品阈值阻止/滑落并记录诊断。；不把 SOURCE-ABSENT 当成 SOURCE-EMPTY，不静默补默认值。
- **错误 / 回滚：** 构建期 fail-closed 并输出稳定 diagnostic code；运行期保留 last-good RenderDomain tree 与 FieldRuntime state；跨图 prepare/replace 失败不得提交新 mapId、Actor、Camera 或 sceneEpoch。
- **OpenMS 参考：** https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/client/src/physics/dynamics.js#L25-L58 ; https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/client/src/physics/dynamics.js#L115-L147 ; https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/client/src/physics/geometry.js#L15-L51 ; https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/client/src/physics/geometry.js#L106-L156；commit 07994de02756356e3e025e3aca9e79433898d2c8
- **CMS079 历史状态：** RE-GAP-STATIC；Gaps=G40。只引用既有 research/source-of-truth 与 P0-P4-REQUIREMENT-EVIDENCE-MATRIX；不新增、不升级、不关闭 Claim/Evidence/Gap；历史 readiness 不等于产品批准或实现。
- **079/083 差异：** OpenMS pinned GMS083 是行为/算法候选，不是 CMS079 证明；本需求按 Adventure Island 产品规则实施，差异必须在 ADR/测试中明示，不声明原版等价。
- **ABI / 接口影响：** 不修改 Frozen RenderNode ABI v1 五字段、现有标签/attrs/data/event/key/sceneEpoch；可在 Field Runtime/Subsystem 内新增状态。当前 v1 无法表达的动态背景/Obj flow/Portal phase 必须走新 Plan/tag 版本 ADR。
- **性能目标：** 30ms fixed tick；每 render 最多 8 catch-up；最多 32 Foothold transitions/tick；热循环不分配数组
- **确定性单测：** P3-02 正常/边界/错误/回放纯函数测试；正/负斜率、零 force、最大坡度与速度上限 property tests。；同一输入 state hash 一致。
- **集成测试：** P3-02 集成测试：R1 三图垂直切片与 R2 全 13 图；验证 Content API、Field Runtime、InputGate、Render Projection 责任边界。
- **13 图验收：** 正/负斜率、零 force、最大坡度与速度上限 property tests。；13 图逐张执行适用项；SOURCE-EMPTY/SOURCE-ABSENT/RESOURCE-MISSING 分别断言。
- **依赖 / 未决：** P0-08、P0-13、ADR-006；待需求卡审批；P0-08、P0-13、ADR-006；未获批前保持 PROPOSED。
- **批准状态：** PROPOSED / NOT-APPROVED

### P3-03 — Foothold段端/连接
- **用户目标：** 跨 Foothold endpoint 时按 prev/next 转移，保留切向速度和剩余 tick 时间。
- **地图范围：** 222000000;222000001;230030200;230030100;230030000;230020300;230020200;230020100;230020000;230000000;230000001;230000002;230000003
- **模块 / 权威所有者：** Field Movement；Shared State/Field Runtime 是唯一权威；Actor 组件只接收投影
- **输入 → 输出：** InputGate tick frame + Physics config + Foothold/Rope/Seat/Map Info; 关联源字段：Foothold id/prev/next/layer/platform、position/speed。 → PlayerMotionState position/velocity/mode/pose/contacts; 可观察验收：双向链、单向链、断链、环、端点反向进入 fixture。
- **资源字段依赖：** Physics 19 numeric fields + Foothold/Rope/Seat/Map Info; Foothold id/prev/next/layer/platform、position/speed。
- **正常行为：** 跨 Foothold endpoint 时按 prev/next 转移，保留切向速度和剩余 tick 时间。 双向链、单向链、断链、环、端点反向进入 fixture。
- **边界行为：** 悬空/非互逆链接按明确边界规则；一次 tick 超过 32 次转移时 fault，不无限循环。；不把 SOURCE-ABSENT 当成 SOURCE-EMPTY，不静默补默认值。
- **错误 / 回滚：** 构建期 fail-closed 并输出稳定 diagnostic code；运行期保留 last-good RenderDomain tree 与 FieldRuntime state；跨图 prepare/replace 失败不得提交新 mapId、Actor、Camera 或 sceneEpoch。
- **OpenMS 参考：** https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/client/src/physics/geometry.js#L15-L51 ; https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/client/src/physics/geometry.js#L106-L156 ; https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/client/src/physics/contacts.js#L11-L37 ; https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/client/src/physics/contacts.js#L99-L168 ; https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/client/src/physics/contacts.js#L209-L285；commit 07994de02756356e3e025e3aca9e79433898d2c8
- **CMS079 历史状态：** RE-READY；Gaps=G40。只引用既有 research/source-of-truth 与 P0-P4-REQUIREMENT-EVIDENCE-MATRIX；不新增、不升级、不关闭 Claim/Evidence/Gap；历史 readiness 不等于产品批准或实现。
- **079/083 差异：** OpenMS pinned GMS083 是行为/算法候选，不是 CMS079 证明；本需求按 Adventure Island 产品规则实施，差异必须在 ADR/测试中明示，不声明原版等价。
- **ABI / 接口影响：** 不修改 Frozen RenderNode ABI v1 五字段、现有标签/attrs/data/event/key/sceneEpoch；可在 Field Runtime/Subsystem 内新增状态。当前 v1 无法表达的动态背景/Obj flow/Portal phase 必须走新 Plan/tag 版本 ADR。
- **性能目标：** 30ms fixed tick；每 render 最多 8 catch-up；最多 32 Foothold transitions/tick；热循环不分配数组
- **确定性单测：** P3-03 正常/边界/错误/回放纯函数测试；双向链、单向链、断链、环、端点反向进入 fixture。；同一输入 state hash 一致。
- **集成测试：** P3-03 集成测试：R1 三图垂直切片与 R2 全 13 图；验证 Content API、Field Runtime、InputGate、Render Projection 责任边界。
- **13 图验收：** 双向链、单向链、断链、环、端点反向进入 fixture。；13 图逐张执行适用项；SOURCE-EMPTY/SOURCE-ABSENT/RESOURCE-MISSING 分别断言。
- **依赖 / 未决：** P0-08、P3-06；待需求卡审批；P0-08、P3-06；未获批前保持 PROPOSED。
- **批准状态：** PROPOSED / NOT-APPROVED

### P3-04 — 空中水平vx与释键
- **用户目标：** 空中水平输入产生有限加速度；释键按 air drag 逐步减速，保持动量连续。
- **地图范围：** 222000000;222000001;230030200;230030100;230030000;230020300;230020200;230020100;230020000;230000000;230000001;230000002;230000003
- **模块 / 权威所有者：** Field Movement；Shared State/Field Runtime 是唯一权威；Actor 组件只接收投影
- **输入 → 输出：** InputGate tick frame + Physics config + Foothold/Rope/Seat/Map Info; 关联源字段：InputFrame、vx、Physics air control/drag/max speed。 → PlayerMotionState position/velocity/mode/pose/contacts; 可观察验收：跳跃上升/下降阶段左右输入切换 golden replay。
- **资源字段依赖：** Physics 19 numeric fields + Foothold/Rope/Seat/Map Info; InputFrame、vx、Physics air control/drag/max speed。
- **正常行为：** 空中水平输入产生有限加速度；释键按 air drag 逐步减速，保持动量连续。 跳跃上升/下降阶段左右输入切换 golden replay。
- **边界行为：** 左/右同时按下为 0；极端速度钳制到 Physics 上限；不因 render FPS 改变。；不把 SOURCE-ABSENT 当成 SOURCE-EMPTY，不静默补默认值。
- **错误 / 回滚：** 构建期 fail-closed 并输出稳定 diagnostic code；运行期保留 last-good RenderDomain tree 与 FieldRuntime state；跨图 prepare/replace 失败不得提交新 mapId、Actor、Camera 或 sceneEpoch。
- **OpenMS 参考：** https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/client/src/physics/dynamics.js#L25-L58 ; https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/client/src/physics/dynamics.js#L115-L147 ; https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/client/src/physics/simulation.js#L24-L28 ; https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/client/src/physics/simulation.js#L275-L312 ; https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/client/src/physics/simulation.js#L325-L466；commit 07994de02756356e3e025e3aca9e79433898d2c8
- **CMS079 历史状态：** 无；Gaps=旧R2称装载者没有而后续研究有代值。只引用既有 research/source-of-truth 与 P0-P4-REQUIREMENT-EVIDENCE-MATRIX；不新增、不升级、不关闭 Claim/Evidence/Gap；历史 readiness 不等于产品批准或实现。
- **079/083 差异：** OpenMS pinned GMS083 是行为/算法候选，不是 CMS079 证明；本需求按 Adventure Island 产品规则实施，差异必须在 ADR/测试中明示，不声明原版等价。
- **ABI / 接口影响：** 不修改 Frozen RenderNode ABI v1 五字段、现有标签/attrs/data/event/key/sceneEpoch；可在 Field Runtime/Subsystem 内新增状态。当前 v1 无法表达的动态背景/Obj flow/Portal phase 必须走新 Plan/tag 版本 ADR。
- **性能目标：** 30ms fixed tick；每 render 最多 8 catch-up；最多 32 Foothold transitions/tick；热循环不分配数组
- **确定性单测：** P3-04 正常/边界/错误/回放纯函数测试；跳跃上升/下降阶段左右输入切换 golden replay。；同一输入 state hash 一致。
- **集成测试：** P3-04 集成测试：R1 三图垂直切片与 R2 全 13 图；验证 Content API、Field Runtime、InputGate、Render Projection 责任边界。
- **13 图验收：** 跳跃上升/下降阶段左右输入切换 golden replay。；13 图逐张执行适用项；SOURCE-EMPTY/SOURCE-ABSENT/RESOURCE-MISSING 分别断言。
- **依赖 / 未决：** P0-13、P3-20；待需求卡审批；P0-13、P3-20；未获批前保持 PROPOSED。
- **批准状态：** PROPOSED / NOT-APPROVED

### P3-05 — 重力和终端下落
- **用户目标：** 空气状态按重力推进 vy，应用 terminal velocity，并进行 swept collision。
- **地图范围：** 222000000;222000001;230030200;230030100;230030000;230020300;230020200;230020100;230020000;230000000;230000001;230000002;230000003
- **模块 / 权威所有者：** Field Movement；Shared State/Field Runtime 是唯一权威；Actor 组件只接收投影
- **输入 → 输出：** InputGate tick frame + Physics config + Foothold/Rope/Seat/Map Info; 关联源字段：Physics gravity/terminal/fall speed、position/velocity。 → PlayerMotionState position/velocity/mode/pose/contacts; 可观察验收：同轨迹 30/60/120Hz replay 结果一致；高速下落不穿台。
- **资源字段依赖：** Physics 19 numeric fields + Foothold/Rope/Seat/Map Info; Physics gravity/terminal/fall speed、position/velocity。
- **正常行为：** 空气状态按重力推进 vy，应用 terminal velocity，并进行 swept collision。 同轨迹 30/60/120Hz replay 结果一致；高速下落不穿台。
- **边界行为：** 超大 dt 不跳过地面；非有限 gravity/terminal 立即 fault 并保留 last-good state。；不把 SOURCE-ABSENT 当成 SOURCE-EMPTY，不静默补默认值。
- **错误 / 回滚：** 构建期 fail-closed 并输出稳定 diagnostic code；运行期保留 last-good RenderDomain tree 与 FieldRuntime state；跨图 prepare/replace 失败不得提交新 mapId、Actor、Camera 或 sceneEpoch。
- **OpenMS 参考：** https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/client/src/physics/dynamics.js#L25-L58 ; https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/client/src/physics/dynamics.js#L115-L147 ; https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/client/src/physics/contacts.js#L11-L37 ; https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/client/src/physics/contacts.js#L99-L168 ; https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/client/src/physics/contacts.js#L209-L285 ; https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/client/src/physics/simulation.js#L24-L28 ; https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/client/src/physics/simulation.js#L275-L312 ; https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/client/src/physics/simulation.js#L325-L466；commit 07994de02756356e3e025e3aca9e79433898d2c8
- **CMS079 历史状态：** RE-GAP-STATIC；Gaps=G40。只引用既有 research/source-of-truth 与 P0-P4-REQUIREMENT-EVIDENCE-MATRIX；不新增、不升级、不关闭 Claim/Evidence/Gap；历史 readiness 不等于产品批准或实现。
- **079/083 差异：** OpenMS pinned GMS083 是行为/算法候选，不是 CMS079 证明；本需求按 Adventure Island 产品规则实施，差异必须在 ADR/测试中明示，不声明原版等价。
- **ABI / 接口影响：** 不修改 Frozen RenderNode ABI v1 五字段、现有标签/attrs/data/event/key/sceneEpoch；可在 Field Runtime/Subsystem 内新增状态。当前 v1 无法表达的动态背景/Obj flow/Portal phase 必须走新 Plan/tag 版本 ADR。
- **性能目标：** 30ms fixed tick；每 render 最多 8 catch-up；最多 32 Foothold transitions/tick；热循环不分配数组
- **确定性单测：** P3-05 正常/边界/错误/回放纯函数测试；同轨迹 30/60/120Hz replay 结果一致；高速下落不穿台。；同一输入 state hash 一致。
- **集成测试：** P3-05 集成测试：R1 三图垂直切片与 R2 全 13 图；验证 Content API、Field Runtime、InputGate、Render Projection 责任边界。
- **13 图验收：** 同轨迹 30/60/120Hz replay 结果一致；高速下落不穿台。；13 图逐张执行适用项；SOURCE-EMPTY/SOURCE-ABSENT/RESOURCE-MISSING 分别断言。
- **依赖 / 未决：** P0-13、P3-06、P3-20；待需求卡审批；P0-13、P3-06、P3-20；未获批前保持 PROPOSED。
- **批准状态：** PROPOSED / NOT-APPROVED

### P3-06 — Foothold碰撞斜线竖线/单向穿台
- **用户目标：** 使用确定性 swept segment contact；斜面可落地，竖直段只作墙/边界，不作站立面。
- **地图范围：** 222000000;222000001;230030200;230030100;230030000;230020300;230020200;230020100;230020000;230000000;230000001;230000002;230000003
- **模块 / 权威所有者：** Field Movement；Shared State/Field Runtime 是唯一权威；Actor 组件只接收投影
- **输入 → 输出：** InputGate tick frame + Physics config + Foothold/Rope/Seat/Map Info; 关联源字段：Foothold endpoints、layer/platform、prev/next、sweep start/end。 → PlayerMotionState position/velocity/mode/pose/contacts; 可观察验收：斜线、竖线、水平线、端点、反向穿越和穿台 fixture。
- **资源字段依赖：** Physics 19 numeric fields + Foothold/Rope/Seat/Map Info; Foothold endpoints、layer/platform、prev/next、sweep start/end。
- **正常行为：** 使用确定性 swept segment contact；斜面可落地，竖直段只作墙/边界，不作站立面。 斜线、竖线、水平线、端点、反向穿越和穿台 fixture。
- **边界行为：** one-way 平台只在从上向下穿越时接触；碰撞相同时按 sourceOrder/id tie-break。；不把 SOURCE-ABSENT 当成 SOURCE-EMPTY，不静默补默认值。
- **错误 / 回滚：** 构建期 fail-closed 并输出稳定 diagnostic code；运行期保留 last-good RenderDomain tree 与 FieldRuntime state；跨图 prepare/replace 失败不得提交新 mapId、Actor、Camera 或 sceneEpoch。
- **OpenMS 参考：** https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/client/src/physics/contacts.js#L11-L37 ; https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/client/src/physics/contacts.js#L99-L168 ; https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/client/src/physics/contacts.js#L209-L285 ; https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/client/src/physics/geometry.js#L15-L51 ; https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/client/src/physics/geometry.js#L106-L156；commit 07994de02756356e3e025e3aca9e79433898d2c8
- **CMS079 历史状态：** STATIC 无残项；实现按调用语境取半宽；Gaps=仅已核13图;不能外推其他地图。只引用既有 research/source-of-truth 与 P0-P4-REQUIREMENT-EVIDENCE-MATRIX；不新增、不升级、不关闭 Claim/Evidence/Gap；历史 readiness 不等于产品批准或实现。
- **079/083 差异：** OpenMS pinned GMS083 是行为/算法候选，不是 CMS079 证明；本需求按 Adventure Island 产品规则实施，差异必须在 ADR/测试中明示，不声明原版等价。
- **ABI / 接口影响：** 不修改 Frozen RenderNode ABI v1 五字段、现有标签/attrs/data/event/key/sceneEpoch；可在 Field Runtime/Subsystem 内新增状态。当前 v1 无法表达的动态背景/Obj flow/Portal phase 必须走新 Plan/tag 版本 ADR。
- **性能目标：** 30ms fixed tick；每 render 最多 8 catch-up；最多 32 Foothold transitions/tick；热循环不分配数组
- **确定性单测：** P3-06 正常/边界/错误/回放纯函数测试；斜线、竖线、水平线、端点、反向穿越和穿台 fixture。；同一输入 state hash 一致。
- **集成测试：** P3-06 集成测试：R1 三图垂直切片与 R2 全 13 图；验证 Content API、Field Runtime、InputGate、Render Projection 责任边界。
- **13 图验收：** 斜线、竖线、水平线、端点、反向穿越和穿台 fixture。；13 图逐张执行适用项；SOURCE-EMPTY/SOURCE-ABSENT/RESOURCE-MISSING 分别断言。
- **依赖 / 未决：** P0-08、P3-03；待需求卡审批；P0-08、P3-03；未获批前保持 PROPOSED。
- **批准状态：** PROPOSED / NOT-APPROVED

### P3-07 — 陆地跳初速度
- **用户目标：** jumpPressed edge 在地面有效时施加 jumpSpeed 初速度；按住不重复触发陆地跳。
- **地图范围：** 222000000;222000001;230030200;230030100;230030000;230020300;230020200;230020100;230020000;230000000;230000001;230000002;230000003
- **模块 / 权威所有者：** Field Movement；Shared State/Field Runtime 是唯一权威；Actor 组件只接收投影
- **输入 → 输出：** InputGate tick frame + Physics config + Foothold/Rope/Seat/Map Info; 关联源字段：InputFrame.jumpPressed、ground state、Physics jumpSpeed。 → PlayerMotionState position/velocity/mode/pose/contacts; 可观察验收：边缘跳、同帧双击、held-key、落地后再次跳测试。
- **资源字段依赖：** Physics 19 numeric fields + Foothold/Rope/Seat/Map Info; InputFrame.jumpPressed、ground state、Physics jumpSpeed。
- **正常行为：** jumpPressed edge 在地面有效时施加 jumpSpeed 初速度；按住不重复触发陆地跳。 边缘跳、同帧双击、held-key、落地后再次跳测试。
- **边界行为：** 空中再次按下无效；落地后新 edge 才可再次跳；movementLocked 时忽略。；不把 SOURCE-ABSENT 当成 SOURCE-EMPTY，不静默补默认值。
- **错误 / 回滚：** 构建期 fail-closed 并输出稳定 diagnostic code；运行期保留 last-good RenderDomain tree 与 FieldRuntime state；跨图 prepare/replace 失败不得提交新 mapId、Actor、Camera 或 sceneEpoch。
- **OpenMS 参考：** https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/client/src/physics/simulation.js#L24-L28 ; https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/client/src/physics/simulation.js#L275-L312 ; https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/client/src/physics/simulation.js#L325-L466；commit 07994de02756356e3e025e3aca9e79433898d2c8
- **CMS079 历史状态：** RE-READY；Gaps=G40。只引用既有 research/source-of-truth 与 P0-P4-REQUIREMENT-EVIDENCE-MATRIX；不新增、不升级、不关闭 Claim/Evidence/Gap；历史 readiness 不等于产品批准或实现。
- **079/083 差异：** OpenMS pinned GMS083 是行为/算法候选，不是 CMS079 证明；本需求按 Adventure Island 产品规则实施，差异必须在 ADR/测试中明示，不声明原版等价。
- **ABI / 接口影响：** 不修改 Frozen RenderNode ABI v1 五字段、现有标签/attrs/data/event/key/sceneEpoch；可在 Field Runtime/Subsystem 内新增状态。当前 v1 无法表达的动态背景/Obj flow/Portal phase 必须走新 Plan/tag 版本 ADR。
- **性能目标：** 30ms fixed tick；每 render 最多 8 catch-up；最多 32 Foothold transitions/tick；热循环不分配数组
- **确定性单测：** P3-07 正常/边界/错误/回放纯函数测试；边缘跳、同帧双击、held-key、落地后再次跳测试。；同一输入 state hash 一致。
- **集成测试：** P3-07 集成测试：R1 三图垂直切片与 R2 全 13 图；验证 Content API、Field Runtime、InputGate、Render Projection 责任边界。
- **13 图验收：** 边缘跳、同帧双击、held-key、落地后再次跳测试。；13 图逐张执行适用项；SOURCE-EMPTY/SOURCE-ABSENT/RESOURCE-MISSING 分别断言。
- **依赖 / 未决：** P0-13、P3-20；待需求卡审批；P0-13、P3-20；未获批前保持 PROPOSED。
- **批准状态：** PROPOSED / NOT-APPROVED

### P3-08 — 游泳四方向加速度
- **用户目标：** info.swim=1 的 8 张水图采用 water movement mode，四方向可控。
- **地图范围：** 222000000;222000001;230030200;230030100;230030000;230020300;230020200;230020100;230020000;230000000;230000001;230000002;230000003
- **模块 / 权威所有者：** Field Movement；Shared State/Field Runtime 是唯一权威；Actor 组件只接收投影
- **输入 → 输出：** InputGate tick frame + Physics config + Foothold/Rope/Seat/Map Info; 关联源字段：Map.Info.swim、InputFrame、Physics swim acceleration/drag。 → PlayerMotionState position/velocity/mode/pose/contacts; 可观察验收：八张水图分别测试上/下/左/右、对角输入和离开水域。
- **资源字段依赖：** Physics 19 numeric fields + Foothold/Rope/Seat/Map Info; Map.Info.swim、InputFrame、Physics swim acceleration/drag。
- **正常行为：** info.swim=1 的 8 张水图采用 water movement mode，四方向可控。 八张水图分别测试上/下/左/右、对角输入和离开水域。
- **边界行为：** 未提供 swimArea 的 v1 将整张目标地图视作水域；若 V2 引入区域，边界采用半闭区间规则。；不把 SOURCE-ABSENT 当成 SOURCE-EMPTY，不静默补默认值。
- **错误 / 回滚：** 构建期 fail-closed 并输出稳定 diagnostic code；运行期保留 last-good RenderDomain tree 与 FieldRuntime state；跨图 prepare/replace 失败不得提交新 mapId、Actor、Camera 或 sceneEpoch。
- **OpenMS 参考：** https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/client/src/physics/environment.js#L5-L42 ; https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/client/src/physics/dynamics.js#L25-L58 ; https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/client/src/physics/dynamics.js#L115-L147；commit 07994de02756356e3e025e3aca9e79433898d2c8
- **CMS079 历史状态：** RE-GAP-STATIC；Gaps=G40。只引用既有 research/source-of-truth 与 P0-P4-REQUIREMENT-EVIDENCE-MATRIX；不新增、不升级、不关闭 Claim/Evidence/Gap；历史 readiness 不等于产品批准或实现。
- **079/083 差异：** OpenMS pinned GMS083 是行为/算法候选，不是 CMS079 证明；本需求按 Adventure Island 产品规则实施，差异必须在 ADR/测试中明示，不声明原版等价。
- **ABI / 接口影响：** 不修改 Frozen RenderNode ABI v1 五字段、现有标签/attrs/data/event/key/sceneEpoch；可在 Field Runtime/Subsystem 内新增状态。当前 v1 无法表达的动态背景/Obj flow/Portal phase 必须走新 Plan/tag 版本 ADR。
- **性能目标：** 30ms fixed tick；每 render 最多 8 catch-up；最多 32 Foothold transitions/tick；热循环不分配数组
- **确定性单测：** P3-08 正常/边界/错误/回放纯函数测试；八张水图分别测试上/下/左/右、对角输入和离开水域。；同一输入 state hash 一致。
- **集成测试：** P3-08 集成测试：R1 三图垂直切片与 R2 全 13 图；验证 Content API、Field Runtime、InputGate、Render Projection 责任边界。
- **13 图验收：** 八张水图分别测试上/下/左/右、对角输入和离开水域。；13 图逐张执行适用项；SOURCE-EMPTY/SOURCE-ABSENT/RESOURCE-MISSING 分别断言。
- **依赖 / 未决：** P0-01、P0-13、ADR-006；待需求卡审批；P0-01、P0-13、ADR-006；未获批前保持 PROPOSED。
- **批准状态：** PROPOSED / NOT-APPROVED

### P3-09 — 水中跳初速度
- **用户目标：** 水中 jump edge 施加 water jump impulse；可按产品 cadence 支持持续按键重复。
- **地图范围：** 222000000;222000001;230030200;230030100;230030000;230020300;230020200;230020100;230020000;230000000;230000001;230000002;230000003
- **模块 / 权威所有者：** Field Movement；Shared State/Field Runtime 是唯一权威；Actor 组件只接收投影
- **输入 → 输出：** InputGate tick frame + Physics config + Foothold/Rope/Seat/Map Info; 关联源字段：swim state、jumpPressed/jump held、Physics fly/swim values。 → PlayerMotionState position/velocity/mode/pose/contacts; 可观察验收：0/299/300/301ms 边界、切出水域和重按测试。
- **资源字段依赖：** Physics 19 numeric fields + Foothold/Rope/Seat/Map Info; swim state、jumpPressed/jump held、Physics fly/swim values。
- **正常行为：** 水中 jump edge 施加 water jump impulse；可按产品 cadence 支持持续按键重复。 0/299/300/301ms 边界、切出水域和重按测试。
- **边界行为：** 300ms repeat 作为 OpenMS 候选，需 ADR 批准；释放 jump 清除 repeat accumulator。；不把 SOURCE-ABSENT 当成 SOURCE-EMPTY，不静默补默认值。
- **错误 / 回滚：** 构建期 fail-closed 并输出稳定 diagnostic code；运行期保留 last-good RenderDomain tree 与 FieldRuntime state；跨图 prepare/replace 失败不得提交新 mapId、Actor、Camera 或 sceneEpoch。
- **OpenMS 参考：** https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/client/src/physics/simulation.js#L24-L28 ; https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/client/src/physics/simulation.js#L275-L312 ; https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/client/src/physics/simulation.js#L325-L466 ; https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/client/src/physics/dynamics.js#L25-L58 ; https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/client/src/physics/dynamics.js#L115-L147；commit 07994de02756356e3e025e3aca9e79433898d2c8
- **CMS079 历史状态：** RE-READY；Gaps=G40。只引用既有 research/source-of-truth 与 P0-P4-REQUIREMENT-EVIDENCE-MATRIX；不新增、不升级、不关闭 Claim/Evidence/Gap；历史 readiness 不等于产品批准或实现。
- **079/083 差异：** OpenMS pinned GMS083 是行为/算法候选，不是 CMS079 证明；本需求按 Adventure Island 产品规则实施，差异必须在 ADR/测试中明示，不声明原版等价。
- **ABI / 接口影响：** 不修改 Frozen RenderNode ABI v1 五字段、现有标签/attrs/data/event/key/sceneEpoch；可在 Field Runtime/Subsystem 内新增状态。当前 v1 无法表达的动态背景/Obj flow/Portal phase 必须走新 Plan/tag 版本 ADR。
- **性能目标：** 30ms fixed tick；每 render 最多 8 catch-up；最多 32 Foothold transitions/tick；热循环不分配数组
- **确定性单测：** P3-09 正常/边界/错误/回放纯函数测试；0/299/300/301ms 边界、切出水域和重按测试。；同一输入 state hash 一致。
- **集成测试：** P3-09 集成测试：R1 三图垂直切片与 R2 全 13 图；验证 Content API、Field Runtime、InputGate、Render Projection 责任边界。
- **13 图验收：** 0/299/300/301ms 边界、切出水域和重按测试。；13 图逐张执行适用项；SOURCE-EMPTY/SOURCE-ABSENT/RESOURCE-MISSING 分别断言。
- **依赖 / 未决：** P3-08、P3-20、ADR-003；待需求卡审批；P3-08、P3-20、ADR-003；未获批前保持 PROPOSED。
- **批准状态：** PROPOSED / NOT-APPROVED

### P3-10 — 下跳门闩及穿台
- **用户目标：** Down+Jump edge 尝试从当前 Foothold 下跳，受 forbidFallDown 产品字段约束。
- **地图范围：** 222000000;222000001;230030200;230030100;230030000;230020300;230020200;230020100;230020000;230000000;230000001;230000002;230000003
- **模块 / 权威所有者：** Field Movement；Shared State/Field Runtime 是唯一权威；Actor 组件只接收投影
- **输入 → 输出：** InputGate tick frame + Physics config + Foothold/Rope/Seat/Map Info; 关联源字段：InputFrame.down/jumpPressed、Foothold.forbidFallDown、field policy。 → PlayerMotionState position/velocity/mode/pose/contacts; 可观察验收：平台上下两侧、边缘、禁止标志、连续按键测试。
- **资源字段依赖：** Physics 19 numeric fields + Foothold/Rope/Seat/Map Info; InputFrame.down/jumpPressed、Foothold.forbidFallDown、field policy。
- **正常行为：** Down+Jump edge 尝试从当前 Foothold 下跳，受 forbidFallDown 产品字段约束。 平台上下两侧、边缘、禁止标志、连续按键测试。
- **边界行为：** 禁止下跳时不改变位置/速度；允许时暂时忽略当前 Foothold，穿过后清除 ignore id。；不把 SOURCE-ABSENT 当成 SOURCE-EMPTY，不静默补默认值。
- **错误 / 回滚：** 构建期 fail-closed 并输出稳定 diagnostic code；运行期保留 last-good RenderDomain tree 与 FieldRuntime state；跨图 prepare/replace 失败不得提交新 mapId、Actor、Camera 或 sceneEpoch。
- **OpenMS 参考：** https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/client/src/physics/contacts.js#L11-L37 ; https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/client/src/physics/contacts.js#L99-L168 ; https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/client/src/physics/contacts.js#L209-L285 ; https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/client/src/physics/simulation.js#L24-L28 ; https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/client/src/physics/simulation.js#L275-L312 ; https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/client/src/physics/simulation.js#L325-L466；commit 07994de02756356e3e025e3aca9e79433898d2c8
- **CMS079 历史状态：** 无；Gaps=R11早期字符串未解误把fieldLimit当bit17。只引用既有 research/source-of-truth 与 P0-P4-REQUIREMENT-EVIDENCE-MATRIX；不新增、不升级、不关闭 Claim/Evidence/Gap；历史 readiness 不等于产品批准或实现。
- **079/083 差异：** OpenMS pinned GMS083 是行为/算法候选，不是 CMS079 证明；本需求按 Adventure Island 产品规则实施，差异必须在 ADR/测试中明示，不声明原版等价。
- **ABI / 接口影响：** 不修改 Frozen RenderNode ABI v1 五字段、现有标签/attrs/data/event/key/sceneEpoch；可在 Field Runtime/Subsystem 内新增状态。当前 v1 无法表达的动态背景/Obj flow/Portal phase 必须走新 Plan/tag 版本 ADR。
- **性能目标：** 30ms fixed tick；每 render 最多 8 catch-up；最多 32 Foothold transitions/tick；热循环不分配数组
- **确定性单测：** P3-10 正常/边界/错误/回放纯函数测试；平台上下两侧、边缘、禁止标志、连续按键测试。；同一输入 state hash 一致。
- **集成测试：** P3-10 集成测试：R1 三图垂直切片与 R2 全 13 图；验证 Content API、Field Runtime、InputGate、Render Projection 责任边界。
- **13 图验收：** 平台上下两侧、边缘、禁止标志、连续按键测试。；13 图逐张执行适用项；SOURCE-EMPTY/SOURCE-ABSENT/RESOURCE-MISSING 分别断言。
- **依赖 / 未决：** P0-08、P3-06、ADR-006；待需求卡审批；P0-08、P3-06、ADR-006；未获批前保持 PROPOSED。
- **批准状态：** PROPOSED / NOT-APPROVED

### P3-11 — 蹲下及松开下键
- **用户目标：** 地面仅按 Down 且无水平输入进入 crouch/prone；松开恢复 stand/walk。
- **地图范围：** 222000000;222000001;230030200;230030100;230030000;230020300;230020200;230020100;230020000;230000000;230000001;230000002;230000003
- **模块 / 权威所有者：** Field Movement；Shared State/Field Runtime 是唯一权威；Actor 组件只接收投影
- **输入 → 输出：** InputGate tick frame + Physics config + Foothold/Rope/Seat/Map Info; 关联源字段：InputFrame、ground state、locomotion state。 → PlayerMotionState position/velocity/mode/pose/contacts; 可观察验收：down press/release、down+left、空中 down fixture。
- **资源字段依赖：** Physics 19 numeric fields + Foothold/Rope/Seat/Map Info; InputFrame、ground state、locomotion state。
- **正常行为：** 地面仅按 Down 且无水平输入进入 crouch/prone；松开恢复 stand/walk。 down press/release、down+left、空中 down fixture。
- **边界行为：** 空中/游泳/攀爬状态不触发地面 crouch；左右与 down 同时按下按水平移动规则处理。；不把 SOURCE-ABSENT 当成 SOURCE-EMPTY，不静默补默认值。
- **错误 / 回滚：** 构建期 fail-closed 并输出稳定 diagnostic code；运行期保留 last-good RenderDomain tree 与 FieldRuntime state；跨图 prepare/replace 失败不得提交新 mapId、Actor、Camera 或 sceneEpoch。
- **OpenMS 参考：** https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/client/src/physics/simulation.js#L24-L28 ; https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/client/src/physics/simulation.js#L275-L312 ; https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/client/src/physics/simulation.js#L325-L466；commit 07994de02756356e3e025e3aca9e79433898d2c8
- **CMS079 历史状态：** RE-GAP-STATIC；Gaps=G40。只引用既有 research/source-of-truth 与 P0-P4-REQUIREMENT-EVIDENCE-MATRIX；不新增、不升级、不关闭 Claim/Evidence/Gap；历史 readiness 不等于产品批准或实现。
- **079/083 差异：** OpenMS pinned GMS083 是行为/算法候选，不是 CMS079 证明；本需求按 Adventure Island 产品规则实施，差异必须在 ADR/测试中明示，不声明原版等价。
- **ABI / 接口影响：** 不修改 Frozen RenderNode ABI v1 五字段、现有标签/attrs/data/event/key/sceneEpoch；可在 Field Runtime/Subsystem 内新增状态。当前 v1 无法表达的动态背景/Obj flow/Portal phase 必须走新 Plan/tag 版本 ADR。
- **性能目标：** 30ms fixed tick；每 render 最多 8 catch-up；最多 32 Foothold transitions/tick；热循环不分配数组
- **确定性单测：** P3-11 正常/边界/错误/回放纯函数测试；down press/release、down+left、空中 down fixture。；同一输入 state hash 一致。
- **集成测试：** P3-11 集成测试：R1 三图垂直切片与 R2 全 13 图；验证 Content API、Field Runtime、InputGate、Render Projection 责任边界。
- **13 图验收：** down press/release、down+left、空中 down fixture。；13 图逐张执行适用项；SOURCE-EMPTY/SOURCE-ABSENT/RESOURCE-MISSING 分别断言。
- **依赖 / 未决：** P3-01、P3-20；待需求卡审批；P3-01、P3-20；未获批前保持 PROPOSED。
- **批准状态：** PROPOSED / NOT-APPROVED

### P3-12 — 落地姿态stand/walk/alert
- **用户目标：** 落地时按水平速度选择 stand/walk，alert 计时为产品时钟状态，不由组件私有 timer 决定。
- **地图范围：** 222000000;222000001;230030200;230030100;230030000;230020300;230020200;230020100;230020000;230000000;230000001;230000002;230000003
- **模块 / 权威所有者：** Field Movement；Shared State/Field Runtime 是唯一权威；Actor 组件只接收投影
- **输入 → 输出：** InputGate tick frame + Physics config + Foothold/Rope/Seat/Map Info; 关联源字段：landing event、vx、AvatarPlan locomotionActions、alert timer。 → PlayerMotionState position/velocity/mode/pose/contacts; 可观察验收：落地速度阈值两侧、缺动作、重复落地事件测试。
- **资源字段依赖：** Physics 19 numeric fields + Foothold/Rope/Seat/Map Info; landing event、vx、AvatarPlan locomotionActions、alert timer。
- **正常行为：** 落地时按水平速度选择 stand/walk，alert 计时为产品时钟状态，不由组件私有 timer 决定。 落地速度阈值两侧、缺动作、重复落地事件测试。
- **边界行为：** 无可用姿态帧回退到 stand；姿态缺失产生 diagnostic，不改变物理状态。；不把 SOURCE-ABSENT 当成 SOURCE-EMPTY，不静默补默认值。
- **错误 / 回滚：** 构建期 fail-closed 并输出稳定 diagnostic code；运行期保留 last-good RenderDomain tree 与 FieldRuntime state；跨图 prepare/replace 失败不得提交新 mapId、Actor、Camera 或 sceneEpoch。
- **OpenMS 参考：** https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/client/src/physics/simulation.js#L24-L28 ; https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/client/src/physics/simulation.js#L275-L312 ; https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/client/src/physics/simulation.js#L325-L466 ; https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/client/src/character/field-avatar.js#L4-L38 ; https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/client/src/character/field-avatar.js#L41-L116；commit 07994de02756356e3e025e3aca9e79433898d2c8
- **CMS079 历史状态：** DESIGN-DECISION；Gaps=G12。只引用既有 research/source-of-truth 与 P0-P4-REQUIREMENT-EVIDENCE-MATRIX；不新增、不升级、不关闭 Claim/Evidence/Gap；历史 readiness 不等于产品批准或实现。
- **079/083 差异：** OpenMS pinned GMS083 是行为/算法候选，不是 CMS079 证明；本需求按 Adventure Island 产品规则实施，差异必须在 ADR/测试中明示，不声明原版等价。
- **ABI / 接口影响：** 不修改 Frozen RenderNode ABI v1 五字段、现有标签/attrs/data/event/key/sceneEpoch；可在 Field Runtime/Subsystem 内新增状态。当前 v1 无法表达的动态背景/Obj flow/Portal phase 必须走新 Plan/tag 版本 ADR。
- **性能目标：** 30ms fixed tick；每 render 最多 8 catch-up；最多 32 Foothold transitions/tick；热循环不分配数组
- **确定性单测：** P3-12 正常/边界/错误/回放纯函数测试；落地速度阈值两侧、缺动作、重复落地事件测试。；同一输入 state hash 一致。
- **集成测试：** P3-12 集成测试：R1 三图垂直切片与 R2 全 13 图；验证 Content API、Field Runtime、InputGate、Render Projection 责任边界。
- **13 图验收：** 落地速度阈值两侧、缺动作、重复落地事件测试。；13 图逐张执行适用项；SOURCE-EMPTY/SOURCE-ABSENT/RESOURCE-MISSING 分别断言。
- **依赖 / 未决：** P1-11、P3-19、ADR-007；待需求卡审批；P1-11、P3-19、ADR-007；未获批前保持 PROPOSED。
- **批准状态：** PROPOSED / NOT-APPROVED

### P3-13 — 抓绳/ladder判定
- **用户目标：** 按 Up/Down 与 Rope 几何捕获；x 容差 10px 作为 OpenMS 候选。
- **地图范围：** 222000000;222000001;230030200;230030100;230030000;230020300;230020200;230020100;230020000;230000000;230000001;230000002;230000003
- **模块 / 权威所有者：** Field Movement；Shared State/Field Runtime 是唯一权威；Actor 组件只接收投影
- **输入 → 输出：** InputGate tick frame + Physics config + Foothold/Rope/Seat/Map Info; 关联源字段：Rope x/y1/y2/l/uf/page、Actor feet、vertical input。 → PlayerMotionState position/velocity/mode/pose/contacts; 可观察验收：绳顶/底、左右边界、跨层、重叠绳测试。
- **资源字段依赖：** Physics 19 numeric fields + Foothold/Rope/Seat/Map Info; Rope x/y1/y2/l/uf/page、Actor feet、vertical input。
- **正常行为：** 按 Up/Down 与 Rope 几何捕获；x 容差 10px 作为 OpenMS 候选。 绳顶/底、左右边界、跨层、重叠绳测试。
- **边界行为：** l/uf 缺失或不受支持时不猜 ladder/rope 类型；多个绳重叠按 sourceOrder tie-break。；不把 SOURCE-ABSENT 当成 SOURCE-EMPTY，不静默补默认值。
- **错误 / 回滚：** 构建期 fail-closed 并输出稳定 diagnostic code；运行期保留 last-good RenderDomain tree 与 FieldRuntime state；跨图 prepare/replace 失败不得提交新 mapId、Actor、Camera 或 sceneEpoch。
- **OpenMS 参考：** https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/client/src/physics/ladders.js#L2-L6 ; https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/client/src/physics/ladders.js#L55-L125；commit 07994de02756356e3e025e3aca9e79433898d2c8
- **CMS079 历史状态：** RE-READY；Gaps=G41。只引用既有 research/source-of-truth 与 P0-P4-REQUIREMENT-EVIDENCE-MATRIX；不新增、不升级、不关闭 Claim/Evidence/Gap；历史 readiness 不等于产品批准或实现。
- **079/083 差异：** OpenMS pinned GMS083 是行为/算法候选，不是 CMS079 证明；本需求按 Adventure Island 产品规则实施，差异必须在 ADR/测试中明示，不声明原版等价。
- **ABI / 接口影响：** 不修改 Frozen RenderNode ABI v1 五字段、现有标签/attrs/data/event/key/sceneEpoch；可在 Field Runtime/Subsystem 内新增状态。当前 v1 无法表达的动态背景/Obj flow/Portal phase 必须走新 Plan/tag 版本 ADR。
- **性能目标：** 30ms fixed tick；每 render 最多 8 catch-up；最多 32 Foothold transitions/tick；热循环不分配数组
- **确定性单测：** P3-13 正常/边界/错误/回放纯函数测试；绳顶/底、左右边界、跨层、重叠绳测试。；同一输入 state hash 一致。
- **集成测试：** P3-13 集成测试：R1 三图垂直切片与 R2 全 13 图；验证 Content API、Field Runtime、InputGate、Render Projection 责任边界。
- **13 图验收：** 绳顶/底、左右边界、跨层、重叠绳测试。；13 图逐张执行适用项；SOURCE-EMPTY/SOURCE-ABSENT/RESOURCE-MISSING 分别断言。
- **依赖 / 未决：** P0-09、P3-14；待需求卡审批；P0-09、P3-14；未获批前保持 PROPOSED。
- **批准状态：** PROPOSED / NOT-APPROVED

### P3-14 — 爬绳积分和离绳
- **用户目标：** 攀爬每 tick 沿绳轴移动；3px/30ms 作为 OpenMS 候选速度，端点按 uf 规则释放或停住。
- **地图范围：** 222000000;222000001;230030200;230030100;230030000;230020300;230020200;230020100;230020000;230000000;230000001;230000002;230000003
- **模块 / 权威所有者：** Field Movement；Shared State/Field Runtime 是唯一权威；Actor 组件只接收投影
- **输入 → 输出：** InputGate tick frame + Physics config + Foothold/Rope/Seat/Map Info; 关联源字段：Rope y1/y2/l/uf/page、InputFrame up/down。 → PlayerMotionState position/velocity/mode/pose/contacts; 可观察验收：上端/下端、uf=0/1、绳中松键和重复捕获测试。
- **资源字段依赖：** Physics 19 numeric fields + Foothold/Rope/Seat/Map Info; Rope y1/y2/l/uf/page、InputFrame up/down。
- **正常行为：** 攀爬每 tick 沿绳轴移动；3px/30ms 作为 OpenMS 候选速度，端点按 uf 规则释放或停住。 上端/下端、uf=0/1、绳中松键和重复捕获测试。
- **边界行为：** y1/y2 顺序不归一化；超出端点按明确规则；释放后切换 air/ground 并重置速度。；不把 SOURCE-ABSENT 当成 SOURCE-EMPTY，不静默补默认值。
- **错误 / 回滚：** 构建期 fail-closed 并输出稳定 diagnostic code；运行期保留 last-good RenderDomain tree 与 FieldRuntime state；跨图 prepare/replace 失败不得提交新 mapId、Actor、Camera 或 sceneEpoch。
- **OpenMS 参考：** https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/client/src/physics/ladders.js#L2-L6 ; https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/client/src/physics/ladders.js#L55-L125；commit 07994de02756356e3e025e3aca9e79433898d2c8
- **CMS079 历史状态：** RUNTIME 绳记录 hint 张力单点 dump；STATIC 走侧 ladder/rope 分叉（0x517DA8/0x9BCC9A，见 P3-13）；Gaps=G41。只引用既有 research/source-of-truth 与 P0-P4-REQUIREMENT-EVIDENCE-MATRIX；不新增、不升级、不关闭 Claim/Evidence/Gap；历史 readiness 不等于产品批准或实现。
- **079/083 差异：** OpenMS pinned GMS083 是行为/算法候选，不是 CMS079 证明；本需求按 Adventure Island 产品规则实施，差异必须在 ADR/测试中明示，不声明原版等价。
- **ABI / 接口影响：** 不修改 Frozen RenderNode ABI v1 五字段、现有标签/attrs/data/event/key/sceneEpoch；可在 Field Runtime/Subsystem 内新增状态。当前 v1 无法表达的动态背景/Obj flow/Portal phase 必须走新 Plan/tag 版本 ADR。
- **性能目标：** 30ms fixed tick；每 render 最多 8 catch-up；最多 32 Foothold transitions/tick；热循环不分配数组
- **确定性单测：** P3-14 正常/边界/错误/回放纯函数测试；上端/下端、uf=0/1、绳中松键和重复捕获测试。；同一输入 state hash 一致。
- **集成测试：** P3-14 集成测试：R1 三图垂直切片与 R2 全 13 图；验证 Content API、Field Runtime、InputGate、Render Projection 责任边界。
- **13 图验收：** 上端/下端、uf=0/1、绳中松键和重复捕获测试。；13 图逐张执行适用项；SOURCE-EMPTY/SOURCE-ABSENT/RESOURCE-MISSING 分别断言。
- **依赖 / 未决：** P3-13、P3-20、ADR-006；待需求卡审批；P3-13、P3-20、ADR-006；未获批前保持 PROPOSED。
- **批准状态：** PROPOSED / NOT-APPROVED

### P3-15 — 坐下/站起状态
- **用户目标：** Seat 命中后设置 sit state 与固定坐标；离开输入按产品规则站起并重新寻找 Foothold。
- **地图范围：** 222000000;222000001;230030200;230030100;230030000;230020300;230020200;230020100;230020000;230000000;230000001;230000002;230000003
- **模块 / 权威所有者：** Field Movement；Shared State/Field Runtime 是唯一权威；Actor 组件只接收投影
- **输入 → 输出：** InputGate tick frame + Physics config + Foothold/Rope/Seat/Map Info; 关联源字段：Seat index/x/y、Actor bounds、InputFrame。 → PlayerMotionState position/velocity/mode/pose/contacts; 可观察验收：三个含 Seat 地图测试；无 Seat 的 10 张地图测试无副作用。
- **资源字段依赖：** Physics 19 numeric fields + Foothold/Rope/Seat/Map Info; Seat index/x/y、Actor bounds、InputFrame。
- **正常行为：** Seat 命中后设置 sit state 与固定坐标；离开输入按产品规则站起并重新寻找 Foothold。 三个含 Seat 地图测试；无 Seat 的 10 张地图测试无副作用。
- **边界行为：** 无 Seat 记录的地图坐下无效；站起空间被遮挡时保留坐姿并提示。；不把 SOURCE-ABSENT 当成 SOURCE-EMPTY，不静默补默认值。
- **错误 / 回滚：** 构建期 fail-closed 并输出稳定 diagnostic code；运行期保留 last-good RenderDomain tree 与 FieldRuntime state；跨图 prepare/replace 失败不得提交新 mapId、Actor、Camera 或 sceneEpoch。
- **OpenMS 参考：** https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/client/src/physics/simulation.js#L24-L28 ; https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/client/src/physics/simulation.js#L275-L312 ; https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/client/src/physics/simulation.js#L325-L466；commit 07994de02756356e3e025e3aca9e79433898d2c8
- **CMS079 历史状态：** RE-READY；Gaps=G41。只引用既有 research/source-of-truth 与 P0-P4-REQUIREMENT-EVIDENCE-MATRIX；不新增、不升级、不关闭 Claim/Evidence/Gap；历史 readiness 不等于产品批准或实现。
- **079/083 差异：** OpenMS pinned GMS083 是行为/算法候选，不是 CMS079 证明；本需求按 Adventure Island 产品规则实施，差异必须在 ADR/测试中明示，不声明原版等价。
- **ABI / 接口影响：** 不修改 Frozen RenderNode ABI v1 五字段、现有标签/attrs/data/event/key/sceneEpoch；可在 Field Runtime/Subsystem 内新增状态。当前 v1 无法表达的动态背景/Obj flow/Portal phase 必须走新 Plan/tag 版本 ADR。
- **性能目标：** 30ms fixed tick；每 render 最多 8 catch-up；最多 32 Foothold transitions/tick；热循环不分配数组
- **确定性单测：** P3-15 正常/边界/错误/回放纯函数测试；三个含 Seat 地图测试；无 Seat 的 10 张地图测试无副作用。；同一输入 state hash 一致。
- **集成测试：** P3-15 集成测试：R1 三图垂直切片与 R2 全 13 图；验证 Content API、Field Runtime、InputGate、Render Projection 责任边界。
- **13 图验收：** 三个含 Seat 地图测试；无 Seat 的 10 张地图测试无副作用。；13 图逐张执行适用项；SOURCE-EMPTY/SOURCE-ABSENT/RESOURCE-MISSING 分别断言。
- **依赖 / 未决：** P0-09；待需求卡审批；P0-09；未获批前保持 PROPOSED。
- **批准状态：** PROPOSED / NOT-APPROVED

### P3-16 — 普攻动作变体
- **用户目标：** 攻击动作由 RenderDomain `action` transient event 触发，不写 retained movement state。
- **地图范围：** 222000000;222000001;230030200;230030100;230030000;230020300;230020200;230020100;230020000;230000000;230000001;230000002;230000003
- **模块 / 权威所有者：** Field Movement；Shared State/Field Runtime 是唯一权威；Actor 组件只接收投影
- **输入 → 输出：** InputGate tick frame + Physics config + Foothold/Rope/Seat/Map Info; 关联源字段：InputGate attack edge、AvatarPlan actions、RenderDomain.emit。 → PlayerMotionState position/velocity/mode/pose/contacts; 可观察验收：事件不重放、重连不重播、动作结束回当前 locomotion。
- **资源字段依赖：** Physics 19 numeric fields + Foothold/Rope/Seat/Map Info; InputGate attack edge、AvatarPlan actions、RenderDomain.emit。
- **正常行为：** 攻击动作由 RenderDomain `action` transient event 触发，不写 retained movement state。 事件不重放、重连不重播、动作结束回当前 locomotion。
- **边界行为：** 动作计划缺失时丢弃一次，不补播；同动作重复事件从第 0 帧重播。；不把 SOURCE-ABSENT 当成 SOURCE-EMPTY，不静默补默认值。
- **错误 / 回滚：** 构建期 fail-closed 并输出稳定 diagnostic code；运行期保留 last-good RenderDomain tree 与 FieldRuntime state；跨图 prepare/replace 失败不得提交新 mapId、Actor、Camera 或 sceneEpoch。
- **OpenMS 参考：** https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/client/src/rendering/animation-timing.js#L2-L60 ; https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/client/src/rendering/animation-timing.js#L94-L135；commit 07994de02756356e3e025e3aca9e79433898d2c8
- **CMS079 历史状态：** RE-READY；Gaps=—。只引用既有 research/source-of-truth 与 P0-P4-REQUIREMENT-EVIDENCE-MATRIX；不新增、不升级、不关闭 Claim/Evidence/Gap；历史 readiness 不等于产品批准或实现。
- **079/083 差异：** OpenMS pinned GMS083 是行为/算法候选，不是 CMS079 证明；本需求按 Adventure Island 产品规则实施，差异必须在 ADR/测试中明示，不声明原版等价。
- **ABI / 接口影响：** 不修改 Frozen RenderNode ABI v1 五字段、现有标签/attrs/data/event/key/sceneEpoch；可在 Field Runtime/Subsystem 内新增状态。当前 v1 无法表达的动态背景/Obj flow/Portal phase 必须走新 Plan/tag 版本 ADR。
- **性能目标：** 30ms fixed tick；每 render 最多 8 catch-up；最多 32 Foothold transitions/tick；热循环不分配数组
- **确定性单测：** P3-16 正常/边界/错误/回放纯函数测试；事件不重放、重连不重播、动作结束回当前 locomotion。；同一输入 state hash 一致。
- **集成测试：** P3-16 集成测试：R1 三图垂直切片与 R2 全 13 图；验证 Content API、Field Runtime、InputGate、Render Projection 责任边界。
- **13 图验收：** 事件不重放、重连不重播、动作结束回当前 locomotion。；13 图逐张执行适用项；SOURCE-EMPTY/SOURCE-ABSENT/RESOURCE-MISSING 分别断言。
- **依赖 / 未决：** P1-11、P3-12；待需求卡审批；P1-11、P3-12；未获批前保持 PROPOSED。
- **批准状态：** PROPOSED / NOT-APPROVED

### P3-17 — 攻击命中/受击位移
- **用户目标：** 本轮只定义受击反馈接口，不做伤害结算；击退作为独立 impulse 意图进入 MovementSubsystem。
- **地图范围：** 222000000;222000001;230030200;230030100;230030000;230020300;230020200;230020100;230020000;230000000;230000001;230000002;230000003
- **模块 / 权威所有者：** Field Movement；Shared State/Field Runtime 是唯一权威；Actor 组件只接收投影
- **输入 → 输出：** InputGate tick frame + Physics config + Foothold/Rope/Seat/Map Info; 关联源字段：外部 impulse、vx/vy、movement lock。 → PlayerMotionState position/velocity/mode/pose/contacts; 可观察验收：重复 impulse、零 impulse、movement lock、非有限值测试。
- **资源字段依赖：** Physics 19 numeric fields + Foothold/Rope/Seat/Map Info; 外部 impulse、vx/vy、movement lock。
- **正常行为：** 本轮只定义受击反馈接口，不做伤害结算；击退作为独立 impulse 意图进入 MovementSubsystem。 重复 impulse、零 impulse、movement lock、非有限值测试。
- **边界行为：** 无服务器/战斗权威时拒绝伪造 HP 或 damage；无效 impulse 不改变 last-good state。；不把 SOURCE-ABSENT 当成 SOURCE-EMPTY，不静默补默认值。
- **错误 / 回滚：** 构建期 fail-closed 并输出稳定 diagnostic code；运行期保留 last-good RenderDomain tree 与 FieldRuntime state；跨图 prepare/replace 失败不得提交新 mapId、Actor、Camera 或 sceneEpoch。
- **OpenMS 参考：** https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/client/src/physics/simulation.js#L24-L28 ; https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/client/src/physics/simulation.js#L275-L312 ; https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/client/src/physics/simulation.js#L325-L466；commit 07994de02756356e3e025e3aca9e79433898d2c8
- **CMS079 历史状态：** PRODUCT-READY；Gaps=G40。只引用既有 research/source-of-truth 与 P0-P4-REQUIREMENT-EVIDENCE-MATRIX；不新增、不升级、不关闭 Claim/Evidence/Gap；历史 readiness 不等于产品批准或实现。
- **079/083 差异：** OpenMS pinned GMS083 是行为/算法候选，不是 CMS079 证明；本需求按 Adventure Island 产品规则实施，差异必须在 ADR/测试中明示，不声明原版等价。
- **ABI / 接口影响：** 不修改 Frozen RenderNode ABI v1 五字段、现有标签/attrs/data/event/key/sceneEpoch；可在 Field Runtime/Subsystem 内新增状态。当前 v1 无法表达的动态背景/Obj flow/Portal phase 必须走新 Plan/tag 版本 ADR。
- **性能目标：** 30ms fixed tick；每 render 最多 8 catch-up；最多 32 Foothold transitions/tick；热循环不分配数组
- **确定性单测：** P3-17 正常/边界/错误/回放纯函数测试；重复 impulse、零 impulse、movement lock、非有限值测试。；同一输入 state hash 一致。
- **集成测试：** P3-17 集成测试：R1 三图垂直切片与 R2 全 13 图；验证 Content API、Field Runtime、InputGate、Render Projection 责任边界。
- **13 图验收：** 重复 impulse、零 impulse、movement lock、非有限值测试。；13 图逐张执行适用项；SOURCE-EMPTY/SOURCE-ABSENT/RESOURCE-MISSING 分别断言。
- **依赖 / 未决：** P3-18；伤害结算非 MVP；伤害结算非MVP；P3-18；伤害结算非 MVP；未获批前保持 PROPOSED。
- **批准状态：** PROPOSED / NOT-APPROVED

### P3-18 — 死亡和击退字段
- **用户目标：** 死亡/击退字段保留为后续 CombatState 扩展，不进入当前 P3 movement MVP。
- **地图范围：** 222000000;222000001;230030200;230030100;230030000;230020300;230020200;230020100;230020000;230000000;230000001;230000002;230000003
- **模块 / 权威所有者：** Field Movement；Shared State/Field Runtime 是唯一权威；Actor 组件只接收投影
- **输入 → 输出：** InputGate tick frame + Physics config + Foothold/Rope/Seat/Map Info; 关联源字段：未来 Combat authority 与 avatar action；本阶段不读取未知字段。 → PlayerMotionState position/velocity/mode/pose/contacts; 可观察验收：ABI validator 拒绝未知字段；现有移动状态不受影响。
- **资源字段依赖：** Physics 19 numeric fields + Foothold/Rope/Seat/Map Info; 未来 Combat authority 与 avatar action；本阶段不读取未知字段。
- **正常行为：** 死亡/击退字段保留为后续 CombatState 扩展，不进入当前 P3 movement MVP。 ABI validator 拒绝未知字段；现有移动状态不受影响。
- **边界行为：** 未批准的死亡字段不得投影到 frozen Actor attrs 或 RenderNode data。；不把 SOURCE-ABSENT 当成 SOURCE-EMPTY，不静默补默认值。
- **错误 / 回滚：** 构建期 fail-closed 并输出稳定 diagnostic code；运行期保留 last-good RenderDomain tree 与 FieldRuntime state；跨图 prepare/replace 失败不得提交新 mapId、Actor、Camera 或 sceneEpoch。
- **OpenMS 参考：** https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/client/src/physics/simulation.js#L24-L28 ; https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/client/src/physics/simulation.js#L275-L312 ; https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/client/src/physics/simulation.js#L325-L466；commit 07994de02756356e3e025e3aca9e79433898d2c8
- **CMS079 历史状态：** DESIGN-DECISION；Gaps=G11。只引用既有 research/source-of-truth 与 P0-P4-REQUIREMENT-EVIDENCE-MATRIX；不新增、不升级、不关闭 Claim/Evidence/Gap；历史 readiness 不等于产品批准或实现。
- **079/083 差异：** OpenMS pinned GMS083 是行为/算法候选，不是 CMS079 证明；本需求按 Adventure Island 产品规则实施，差异必须在 ADR/测试中明示，不声明原版等价。
- **ABI / 接口影响：** 不修改 Frozen RenderNode ABI v1 五字段、现有标签/attrs/data/event/key/sceneEpoch；可在 Field Runtime/Subsystem 内新增状态。当前 v1 无法表达的动态背景/Obj flow/Portal phase 必须走新 Plan/tag 版本 ADR。
- **性能目标：** 30ms fixed tick；每 render 最多 8 catch-up；最多 32 Foothold transitions/tick；热循环不分配数组
- **确定性单测：** P3-18 正常/边界/错误/回放纯函数测试；ABI validator 拒绝未知字段；现有移动状态不受影响。；同一输入 state hash 一致。
- **集成测试：** P3-18 集成测试：R1 三图垂直切片与 R2 全 13 图；验证 Content API、Field Runtime、InputGate、Render Projection 责任边界。
- **13 图验收：** ABI validator 拒绝未知字段；现有移动状态不受影响。；13 图逐张执行适用项；SOURCE-EMPTY/SOURCE-ABSENT/RESOURCE-MISSING 分别断言。
- **依赖 / 未决：** ADR-007；战斗/死亡非 MVP；战斗/死亡非MVP；ADR-007；战斗/死亡非 MVP；未获批前保持 PROPOSED。
- **批准状态：** PROPOSED / NOT-APPROVED

### P3-19 — Alert计时5000值
- **用户目标：** 落地 alert 计时按 5000ms 产品时钟候选值推进，到期回当前 locomotion。
- **地图范围：** 222000000;222000001;230030200;230030100;230030000;230020300;230020200;230020100;230020000;230000000;230000001;230000002;230000003
- **模块 / 权威所有者：** Field Movement；Shared State/Field Runtime 是唯一权威；Actor 组件只接收投影
- **输入 → 输出：** InputGate tick frame + Physics config + Foothold/Rope/Seat/Map Info; 关联源字段：landing tick、alertUntilTick、locomotion。 → PlayerMotionState position/velocity/mode/pose/contacts; 可观察验收：4999/5000/5001ms 边界、暂停、跨图 reset 测试。
- **资源字段依赖：** Physics 19 numeric fields + Foothold/Rope/Seat/Map Info; landing tick、alertUntilTick、locomotion。
- **正常行为：** 落地 alert 计时按 5000ms 产品时钟候选值推进，到期回当前 locomotion。 4999/5000/5001ms 边界、暂停、跨图 reset 测试。
- **边界行为：** 重复 alert 重置计时；暂停/切图按 FieldRuntime tick policy 决定，不使用 wall-clock timer。；不把 SOURCE-ABSENT 当成 SOURCE-EMPTY，不静默补默认值。
- **错误 / 回滚：** 构建期 fail-closed 并输出稳定 diagnostic code；运行期保留 last-good RenderDomain tree 与 FieldRuntime state；跨图 prepare/replace 失败不得提交新 mapId、Actor、Camera 或 sceneEpoch。
- **OpenMS 参考：** https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/client/src/physics/simulation.js#L24-L28 ; https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/client/src/physics/simulation.js#L275-L312 ; https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/client/src/physics/simulation.js#L325-L466；commit 07994de02756356e3e025e3aca9e79433898d2c8
- **CMS079 历史状态：** RE-GAP-STATIC；Gaps=G12。只引用既有 research/source-of-truth 与 P0-P4-REQUIREMENT-EVIDENCE-MATRIX；不新增、不升级、不关闭 Claim/Evidence/Gap；历史 readiness 不等于产品批准或实现。
- **079/083 差异：** OpenMS pinned GMS083 是行为/算法候选，不是 CMS079 证明；本需求按 Adventure Island 产品规则实施，差异必须在 ADR/测试中明示，不声明原版等价。
- **ABI / 接口影响：** 不修改 Frozen RenderNode ABI v1 五字段、现有标签/attrs/data/event/key/sceneEpoch；可在 Field Runtime/Subsystem 内新增状态。当前 v1 无法表达的动态背景/Obj flow/Portal phase 必须走新 Plan/tag 版本 ADR。
- **性能目标：** 30ms fixed tick；每 render 最多 8 catch-up；最多 32 Foothold transitions/tick；热循环不分配数组
- **确定性单测：** P3-19 正常/边界/错误/回放纯函数测试；4999/5000/5001ms 边界、暂停、跨图 reset 测试。；同一输入 state hash 一致。
- **集成测试：** P3-19 集成测试：R1 三图垂直切片与 R2 全 13 图；验证 Content API、Field Runtime、InputGate、Render Projection 责任边界。
- **13 图验收：** 4999/5000/5001ms 边界、暂停、跨图 reset 测试。；13 图逐张执行适用项；SOURCE-EMPTY/SOURCE-ABSENT/RESOURCE-MISSING 分别断言。
- **依赖 / 未决：** P3-12、P3-20；待需求卡审批；P3-12、P3-20；未获批前保持 PROPOSED。
- **批准状态：** PROPOSED / NOT-APPROVED

### P3-20 — Movement timestep物理时间单位
- **用户目标：** 所有运动状态仅由 30ms 固定 tick 推进；渲染帧 delta 不直接参与物理积分。
- **地图范围：** 222000000;222000001;230030200;230030100;230030000;230020300;230020200;230020100;230020000;230000000;230000001;230000002;230000003
- **模块 / 权威所有者：** Field Movement；Shared State/Field Runtime 是唯一权威；Actor 组件只接收投影
- **输入 → 输出：** InputGate tick frame + Physics config + Foothold/Rope/Seat/Map Info; 关联源字段：monotonic clock、accumulator、InputGate tick queue。 → PlayerMotionState position/velocity/mode/pose/contacts; 可观察验收：30/60/120Hz、250ms/1000ms stall、input edge replay hash。
- **资源字段依赖：** Physics 19 numeric fields + Foothold/Rope/Seat/Map Info; monotonic clock、accumulator、InputGate tick queue。
- **正常行为：** 所有运动状态仅由 30ms 固定 tick 推进；渲染帧 delta 不直接参与物理积分。 30/60/120Hz、250ms/1000ms stall、input edge replay hash。
- **边界行为：** 每 render 最多 8 次 catch-up，余量保留；长 backlog 记录 overload，不静默丢时间。；不把 SOURCE-ABSENT 当成 SOURCE-EMPTY，不静默补默认值。
- **错误 / 回滚：** 构建期 fail-closed 并输出稳定 diagnostic code；运行期保留 last-good RenderDomain tree 与 FieldRuntime state；跨图 prepare/replace 失败不得提交新 mapId、Actor、Camera 或 sceneEpoch。
- **OpenMS 参考：** https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/client/src/physics/simulation.js#L24-L28 ; https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/client/src/physics/simulation.js#L275-L312 ; https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/client/src/physics/simulation.js#L325-L466；commit 07994de02756356e3e025e3aca9e79433898d2c8
- **CMS079 历史状态：** RE-GAP-STATIC；Gaps=G34。只引用既有 research/source-of-truth 与 P0-P4-REQUIREMENT-EVIDENCE-MATRIX；不新增、不升级、不关闭 Claim/Evidence/Gap；历史 readiness 不等于产品批准或实现。
- **079/083 差异：** OpenMS pinned GMS083 是行为/算法候选，不是 CMS079 证明；本需求按 Adventure Island 产品规则实施，差异必须在 ADR/测试中明示，不声明原版等价。
- **ABI / 接口影响：** 不修改 Frozen RenderNode ABI v1 五字段、现有标签/attrs/data/event/key/sceneEpoch；可在 Field Runtime/Subsystem 内新增状态。当前 v1 无法表达的动态背景/Obj flow/Portal phase 必须走新 Plan/tag 版本 ADR。
- **性能目标：** 30ms fixed tick；每 render 最多 8 catch-up；最多 32 Foothold transitions/tick；热循环不分配数组
- **确定性单测：** P3-20 正常/边界/错误/回放纯函数测试；30/60/120Hz、250ms/1000ms stall、input edge replay hash。；同一输入 state hash 一致。
- **集成测试：** P3-20 集成测试：R1 三图垂直切片与 R2 全 13 图；验证 Content API、Field Runtime、InputGate、Render Projection 责任边界。
- **13 图验收：** 30/60/120Hz、250ms/1000ms stall、input edge replay hash。；13 图逐张执行适用项；SOURCE-EMPTY/SOURCE-ABSENT/RESOURCE-MISSING 分别断言。
- **依赖 / 未决：** P2-08、ADR-003；ADR 物理时钟；P2-08、ADR-003；未获批前保持 PROPOSED。
- **批准状态：** PROPOSED / NOT-APPROVED

### P4-01 — 上键Portal命中框
- **用户目标：** Up edge 在 portal rectangle 内触发；半宽 20、半高 50 作为产品候选。
- **地图范围：** 222000000;222000001;230030200;230030100;230030000;230020300;230020200;230020100;230020000;230000000;230000001;230000002;230000003
- **模块 / 权威所有者：** Field Portal；PortalTravelGate/token 与 FieldRuntime state 为权威；cms-portal 只画
- **输入 → 输出：** InputGate Up edge + PortalRecord + 13-map graph + destination MapBundle; 关联源字段：Portal x/y/type、Actor feet、InputGate.upPressed。 → same-map relocation or atomic cross-map transition; 可观察验收：中心、四边、四角、边界+/-1px、重叠门测试。
- **资源字段依赖：** Portal pn/pt/x/y/tm/tn + destination portal index + resource closure; Portal x/y/type、Actor feet、InputGate.upPressed。
- **正常行为：** Up edge 在 portal rectangle 内触发；半宽 20、半高 50 作为产品候选。 中心、四边、四角、边界+/-1px、重叠门测试。
- **边界行为：** 右/下边界 exclusive；pt0/pt6 不参与；未 grounded/attack/locked 时不传送。；不把 SOURCE-ABSENT 当成 SOURCE-EMPTY，不静默补默认值。
- **错误 / 回滚：** 构建期 fail-closed 并输出稳定 diagnostic code；运行期保留 last-good RenderDomain tree 与 FieldRuntime state；跨图 prepare/replace 失败不得提交新 mapId、Actor、Camera 或 sceneEpoch。
- **OpenMS 参考：** https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/client/src/world/portal-presentation.js#L2-L20；commit 07994de02756356e3e025e3aca9e79433898d2c8
- **CMS079 历史状态：** 阶段允许上键换图；Gaps=不能混淆"。只引用既有 research/source-of-truth 与 P0-P4-REQUIREMENT-EVIDENCE-MATRIX；不新增、不升级、不关闭 Claim/Evidence/Gap；历史 readiness 不等于产品批准或实现。
- **079/083 差异：** OpenMS pinned GMS083 是行为/算法候选，不是 CMS079 证明；本需求按 Adventure Island 产品规则实施，差异必须在 ADR/测试中明示，不声明原版等价。
- **ABI / 接口影响：** 不修改 Frozen RenderNode ABI v1 五字段、现有标签/attrs/data/event/key/sceneEpoch；可在 Field Runtime/Subsystem 内新增状态。当前 v1 无法表达的动态背景/Obj flow/Portal phase 必须走新 Plan/tag 版本 ADR。
- **性能目标：** 目标索引构建期 O(n)；触发时 O(1) lookup；active token 唯一；prepare 阶段不阻塞物理 tick
- **确定性单测：** P4-01 正常/边界/错误/回放纯函数测试；中心、四边、四角、边界+/-1px、重叠门测试。；同一输入 state hash 一致。
- **集成测试：** P4-01 集成测试：R1 三图垂直切片与 R2 全 13 图；验证 Content API、Field Runtime、InputGate、Render Projection 责任边界。
- **13 图验收：** 中心、四边、四角、边界+/-1px、重叠门测试。；13 图逐张执行适用项；SOURCE-EMPTY/SOURCE-ABSENT/RESOURCE-MISSING 分别断言。
- **依赖 / 未决：** P0-10、ADR-004；ADR 门触发命中盒；P0-10、ADR-004；未获批前保持 PROPOSED。
- **批准状态：** PROPOSED / NOT-APPROVED

### P4-02 — pt分支与可见Portal
- **用户目标：** 只允许明确支持的 pt1/2/3/10 路由；pt2 pv、pt10 image/default 视觉分支独立于逻辑。
- **地图范围：** 222000000;222000001;230030200;230030100;230030000;230020300;230020200;230020100;230020000;230000000;230000001;230000002;230000003
- **模块 / 权威所有者：** Field Portal；PortalTravelGate/token 与 FieldRuntime state 为权威；cms-portal 只画
- **输入 → 输出：** InputGate Up edge + PortalRecord + 13-map graph + destination MapBundle; 关联源字段：pt、tm/tn、visual、pv/ph/psh/image resource。 → same-map relocation or atomic cross-map transition; 可观察验收：每个 pt 分支有 fixture；无视觉资源不自动填 editor icon。
- **资源字段依赖：** Portal pn/pt/x/y/tm/tn + destination portal index + resource closure; pt、tm/tn、visual、pv/ph/psh/image resource。
- **正常行为：** 只允许明确支持的 pt1/2/3/10 路由；pt2 pv、pt10 image/default 视觉分支独立于逻辑。 每个 pt 分支有 fixture；无视觉资源不自动填 editor icon。
- **边界行为：** pt0 spawn、pt6 special、pt9/12/13 unsupported；未知 pt 不触发。；不把 SOURCE-ABSENT 当成 SOURCE-EMPTY，不静默补默认值。
- **错误 / 回滚：** 构建期 fail-closed 并输出稳定 diagnostic code；运行期保留 last-good RenderDomain tree 与 FieldRuntime state；跨图 prepare/replace 失败不得提交新 mapId、Actor、Camera 或 sceneEpoch。
- **OpenMS 参考：** https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/client/src/world/portal-system.js#L20-L128 ; https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/client/src/world/portal-system.js#L412-L560 ; https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/client/src/world/portal-presentation.js#L2-L20；commit 07994de02756356e3e025e3aca9e79433898d2c8
- **CMS079 历史状态：** 阶段§1.4约束基本换图类型；Gaps=不应阻塞"。只引用既有 research/source-of-truth 与 P0-P4-REQUIREMENT-EVIDENCE-MATRIX；不新增、不升级、不关闭 Claim/Evidence/Gap；历史 readiness 不等于产品批准或实现。
- **079/083 差异：** OpenMS pinned GMS083 是行为/算法候选，不是 CMS079 证明；本需求按 Adventure Island 产品规则实施，差异必须在 ADR/测试中明示，不声明原版等价。
- **ABI / 接口影响：** 不修改 Frozen RenderNode ABI v1 五字段、现有标签/attrs/data/event/key/sceneEpoch；可在 Field Runtime/Subsystem 内新增状态。当前 v1 无法表达的动态背景/Obj flow/Portal phase 必须走新 Plan/tag 版本 ADR。
- **性能目标：** 目标索引构建期 O(n)；触发时 O(1) lookup；active token 唯一；prepare 阶段不阻塞物理 tick
- **确定性单测：** P4-02 正常/边界/错误/回放纯函数测试；每个 pt 分支有 fixture；无视觉资源不自动填 editor icon。；同一输入 state hash 一致。
- **集成测试：** P4-02 集成测试：R1 三图垂直切片与 R2 全 13 图；验证 Content API、Field Runtime、InputGate、Render Projection 责任边界。
- **13 图验收：** 每个 pt 分支有 fixture；无视觉资源不自动填 editor icon。；13 图逐张执行适用项；SOURCE-EMPTY/SOURCE-ABSENT/RESOURCE-MISSING 分别断言。
- **依赖 / 未决：** P0-10、P1-14；待需求卡审批；P0-10、P1-14；未获批前保持 PROPOSED。
- **批准状态：** PROPOSED / NOT-APPROVED

### P4-03 — tm/tn解析和同图pn匹配
- **用户目标：** 同图与跨图统一用 `(targetMap,targetName)` 严格查找唯一 PortalRecord；不 fallback 到 portal 0。
- **地图范围：** 222000000;222000001;230030200;230030100;230030000;230020300;230020200;230020100;230020000;230000000;230000001;230000002;230000003
- **模块 / 权威所有者：** Field Portal；PortalTravelGate/token 与 FieldRuntime state 为权威；cms-portal 只画
- **输入 → 输出：** InputGate Up edge + PortalRecord + 13-map graph + destination MapBundle; 关联源字段：tm/tn、map portal index、13-map graph。 → same-map relocation or atomic cross-map transition; 可观察验收：46 条内部目标均唯一；8 条外部边拒绝；重复名称 fixture 拒绝。
- **资源字段依赖：** Portal pn/pt/x/y/tm/tn + destination portal index + resource closure; tm/tn、map portal index、13-map graph。
- **正常行为：** 同图与跨图统一用 `(targetMap,targetName)` 严格查找唯一 PortalRecord；不 fallback 到 portal 0。 46 条内部目标均唯一；8 条外部边拒绝；重复名称 fixture 拒绝。
- **边界行为：** tm sentinel、空 tn、目标缺失或重名拒绝；target map 不在 13 allowlist 保持 disabled。；不把 SOURCE-ABSENT 当成 SOURCE-EMPTY，不静默补默认值。
- **错误 / 回滚：** 构建期 fail-closed 并输出稳定 diagnostic code；运行期保留 last-good RenderDomain tree 与 FieldRuntime state；跨图 prepare/replace 失败不得提交新 mapId、Actor、Camera 或 sceneEpoch。
- **OpenMS 参考：** https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/client/src/world/portal-system.js#L20-L128 ; https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/client/src/world/portal-system.js#L412-L560 ; https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/client/src/world/field-arrival.js#L1-L104；commit 07994de02756356e3e025e3aca9e79433898d2c8
- **CMS079 历史状态：** 阶段设计批准产品目标解析；Gaps=G38。只引用既有 research/source-of-truth 与 P0-P4-REQUIREMENT-EVIDENCE-MATRIX；不新增、不升级、不关闭 Claim/Evidence/Gap；历史 readiness 不等于产品批准或实现。
- **079/083 差异：** OpenMS pinned GMS083 是行为/算法候选，不是 CMS079 证明；本需求按 Adventure Island 产品规则实施，差异必须在 ADR/测试中明示，不声明原版等价。
- **ABI / 接口影响：** 不修改 Frozen RenderNode ABI v1 五字段、现有标签/attrs/data/event/key/sceneEpoch；可在 Field Runtime/Subsystem 内新增状态。当前 v1 无法表达的动态背景/Obj flow/Portal phase 必须走新 Plan/tag 版本 ADR。
- **性能目标：** 目标索引构建期 O(n)；触发时 O(1) lookup；active token 唯一；prepare 阶段不阻塞物理 tick
- **确定性单测：** P4-03 正常/边界/错误/回放纯函数测试；46 条内部目标均唯一；8 条外部边拒绝；重复名称 fixture 拒绝。；同一输入 state hash 一致。
- **集成测试：** P4-03 集成测试：R1 三图垂直切片与 R2 全 13 图；验证 Content API、Field Runtime、InputGate、Render Projection 责任边界。
- **13 图验收：** 46 条内部目标均唯一；8 条外部边拒绝；重复名称 fixture 拒绝。；13 图逐张执行适用项；SOURCE-EMPTY/SOURCE-ABSENT/RESOURCE-MISSING 分别断言。
- **依赖 / 未决：** P0-10、P4-09、ADR-001；待需求卡审批；P0-10、P4-09、ADR-001；未获批前保持 PROPOSED。
- **批准状态：** PROPOSED / NOT-APPROVED

### P4-04 — 跨图精确坐标落点
- **用户目标：** 跨图落点使用目标 portal `(x,y-10)` 候选，再按确定性规则吸附有效 Foothold。
- **地图范围：** 222000000;222000001;230030200;230030100;230030000;230020300;230020200;230020100;230020000;230000000;230000001;230000002;230000003
- **模块 / 权威所有者：** Field Portal；PortalTravelGate/token 与 FieldRuntime state 为权威；cms-portal 只画
- **输入 → 输出：** InputGate Up edge + PortalRecord + 13-map graph + destination MapBundle; 关联源字段：destination PortalRecord、FootholdPlan、target bounds。 → same-map relocation or atomic cross-map transition; 可观察验收：每条内部 edge 检查落点有限且在 bounds 内；吸附 tie-break 稳定。
- **资源字段依赖：** Portal pn/pt/x/y/tm/tn + destination portal index + resource closure; destination PortalRecord、FootholdPlan、target bounds。
- **正常行为：** 跨图落点使用目标 portal `(x,y-10)` 候选，再按确定性规则吸附有效 Foothold。 每条内部 edge 检查落点有限且在 bounds 内；吸附 tie-break 稳定。
- **边界行为：** 无可吸附 foothold 时以零速度 air state 到达；目标坐标非法或目标资源缺失则回滚。；不把 SOURCE-ABSENT 当成 SOURCE-EMPTY，不静默补默认值。
- **错误 / 回滚：** 构建期 fail-closed 并输出稳定 diagnostic code；运行期保留 last-good RenderDomain tree 与 FieldRuntime state；跨图 prepare/replace 失败不得提交新 mapId、Actor、Camera 或 sceneEpoch。
- **OpenMS 参考：** https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/client/src/world/field-arrival.js#L1-L104 ; https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/client/src/physics/contacts.js#L11-L37 ; https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/client/src/physics/contacts.js#L99-L168 ; https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/client/src/physics/contacts.js#L209-L285；commit 07994de02756356e3e025e3aca9e79433898d2c8
- **CMS079 历史状态：** RE-READY；Gaps=G38。只引用既有 research/source-of-truth 与 P0-P4-REQUIREMENT-EVIDENCE-MATRIX；不新增、不升级、不关闭 Claim/Evidence/Gap；历史 readiness 不等于产品批准或实现。
- **079/083 差异：** OpenMS pinned GMS083 是行为/算法候选，不是 CMS079 证明；本需求按 Adventure Island 产品规则实施，差异必须在 ADR/测试中明示，不声明原版等价。
- **ABI / 接口影响：** 不修改 Frozen RenderNode ABI v1 五字段、现有标签/attrs/data/event/key/sceneEpoch；可在 Field Runtime/Subsystem 内新增状态。当前 v1 无法表达的动态背景/Obj flow/Portal phase 必须走新 Plan/tag 版本 ADR。
- **性能目标：** 目标索引构建期 O(n)；触发时 O(1) lookup；active token 唯一；prepare 阶段不阻塞物理 tick
- **确定性单测：** P4-04 正常/边界/错误/回放纯函数测试；每条内部 edge 检查落点有限且在 bounds 内；吸附 tie-break 稳定。；同一输入 state hash 一致。
- **集成测试：** P4-04 集成测试：R1 三图垂直切片与 R2 全 13 图；验证 Content API、Field Runtime、InputGate、Render Projection 责任边界。
- **13 图验收：** 每条内部 edge 检查落点有限且在 bounds 内；吸附 tie-break 稳定。；13 图逐张执行适用项；SOURCE-EMPTY/SOURCE-ABSENT/RESOURCE-MISSING 分别断言。
- **依赖 / 未决：** P0-08、P0-11、P4-08、ADR-004；待需求卡审批；P0-08、P0-11、P4-08、ADR-004；未获批前保持 PROPOSED。
- **批准状态：** PROPOSED / NOT-APPROVED

### P4-05 — 同图落点/吸附
- **用户目标：** 同图跳转保留当前 sceneEpoch/tree，仅更新 Actor 世界坐标与运动状态。
- **地图范围：** 222000000;222000001;230030200;230030100;230030000;230020300;230020200;230020100;230020000;230000000;230000001;230000002;230000003
- **模块 / 权威所有者：** Field Portal；PortalTravelGate/token 与 FieldRuntime state 为权威；cms-portal 只画
- **输入 → 输出：** InputGate Up edge + PortalRecord + 13-map graph + destination MapBundle; 关联源字段：同图 target PortalRecord、FootholdPlan、Actor state。 → same-map relocation or atomic cross-map transition; 可观察验收：ph00↔ph00_1 与 230030100/200 等同图链路 replay。
- **资源字段依赖：** Portal pn/pt/x/y/tm/tn + destination portal index + resource closure; 同图 target PortalRecord、FootholdPlan、Actor state。
- **正常行为：** 同图跳转保留当前 sceneEpoch/tree，仅更新 Actor 世界坐标与运动状态。 ph00↔ph00_1 与 230030100/200 等同图链路 replay。
- **边界行为：** 目标缺失/重复不移动；无 foothold 时 air state；不重建场景或清理当前地图资源。；不把 SOURCE-ABSENT 当成 SOURCE-EMPTY，不静默补默认值。
- **错误 / 回滚：** 构建期 fail-closed 并输出稳定 diagnostic code；运行期保留 last-good RenderDomain tree 与 FieldRuntime state；跨图 prepare/replace 失败不得提交新 mapId、Actor、Camera 或 sceneEpoch。
- **OpenMS 参考：** https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/client/src/world/portal-system.js#L20-L128 ; https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/client/src/world/portal-system.js#L412-L560 ; https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/client/src/world/field-arrival.js#L1-L104；commit 07994de02756356e3e025e3aca9e79433898d2c8
- **CMS079 历史状态：** RE-READY；Gaps=G38。只引用既有 research/source-of-truth 与 P0-P4-REQUIREMENT-EVIDENCE-MATRIX；不新增、不升级、不关闭 Claim/Evidence/Gap；历史 readiness 不等于产品批准或实现。
- **079/083 差异：** OpenMS pinned GMS083 是行为/算法候选，不是 CMS079 证明；本需求按 Adventure Island 产品规则实施，差异必须在 ADR/测试中明示，不声明原版等价。
- **ABI / 接口影响：** 不修改 Frozen RenderNode ABI v1 五字段、现有标签/attrs/data/event/key/sceneEpoch；可在 Field Runtime/Subsystem 内新增状态。当前 v1 无法表达的动态背景/Obj flow/Portal phase 必须走新 Plan/tag 版本 ADR。
- **性能目标：** 目标索引构建期 O(n)；触发时 O(1) lookup；active token 唯一；prepare 阶段不阻塞物理 tick
- **确定性单测：** P4-05 正常/边界/错误/回放纯函数测试；ph00↔ph00_1 与 230030100/200 等同图链路 replay。；同一输入 state hash 一致。
- **集成测试：** P4-05 集成测试：R1 三图垂直切片与 R2 全 13 图；验证 Content API、Field Runtime、InputGate、Render Projection 责任边界。
- **13 图验收：** ph00↔ph00_1 与 230030100/200 等同图链路 replay。；13 图逐张执行适用项；SOURCE-EMPTY/SOURCE-ABSENT/RESOURCE-MISSING 分别断言。
- **依赖 / 未决：** P4-03、P4-06；待需求卡审批；P4-03、P4-06；未获批前保持 PROPOSED。
- **批准状态：** PROPOSED / NOT-APPROVED

### P4-06 — 传送后速度动作状态重置
- **用户目标：** 传送提交时清零 vx/vy、jump/drop/ladder/seat/action transient，重新判定 ground/swim/air。
- **地图范围：** 222000000;222000001;230030200;230030100;230030000;230020300;230020200;230020100;230020000;230000000;230000001;230000002;230000003
- **模块 / 权威所有者：** Field Portal；PortalTravelGate/token 与 FieldRuntime state 为权威；cms-portal 只画
- **输入 → 输出：** InputGate Up edge + PortalRecord + 13-map graph + destination MapBundle; 关联源字段：PlayerMotionState、destination environment、arrival position。 → same-map relocation or atomic cross-map transition; 可观察验收：逐字段 before/after diff；失败 rollback 与成功 reset 两组测试。
- **资源字段依赖：** Portal pn/pt/x/y/tm/tn + destination portal index + resource closure; PlayerMotionState、destination environment、arrival position。
- **正常行为：** 传送提交时清零 vx/vy、jump/drop/ladder/seat/action transient，重新判定 ground/swim/air。 逐字段 before/after diff；失败 rollback 与成功 reset 两组测试。
- **边界行为：** 朝向默认保留；目标 foothold 缺失则 air；失败时源状态逐字节保持。；不把 SOURCE-ABSENT 当成 SOURCE-EMPTY，不静默补默认值。
- **错误 / 回滚：** 构建期 fail-closed 并输出稳定 diagnostic code；运行期保留 last-good RenderDomain tree 与 FieldRuntime state；跨图 prepare/replace 失败不得提交新 mapId、Actor、Camera 或 sceneEpoch。
- **OpenMS 参考：** https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/client/src/physics/simulation.js#L24-L28 ; https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/client/src/physics/simulation.js#L275-L312 ; https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/client/src/physics/simulation.js#L325-L466；commit 07994de02756356e3e025e3aca9e79433898d2c8
- **CMS079 历史状态：** RE-READY；Gaps=G38;G41。只引用既有 research/source-of-truth 与 P0-P4-REQUIREMENT-EVIDENCE-MATRIX；不新增、不升级、不关闭 Claim/Evidence/Gap；历史 readiness 不等于产品批准或实现。
- **079/083 差异：** OpenMS pinned GMS083 是行为/算法候选，不是 CMS079 证明；本需求按 Adventure Island 产品规则实施，差异必须在 ADR/测试中明示，不声明原版等价。
- **ABI / 接口影响：** 不修改 Frozen RenderNode ABI v1 五字段、现有标签/attrs/data/event/key/sceneEpoch；可在 Field Runtime/Subsystem 内新增状态。当前 v1 无法表达的动态背景/Obj flow/Portal phase 必须走新 Plan/tag 版本 ADR。
- **性能目标：** 目标索引构建期 O(n)；触发时 O(1) lookup；active token 唯一；prepare 阶段不阻塞物理 tick
- **确定性单测：** P4-06 正常/边界/错误/回放纯函数测试；逐字段 before/after diff；失败 rollback 与成功 reset 两组测试。；同一输入 state hash 一致。
- **集成测试：** P4-06 集成测试：R1 三图垂直切片与 R2 全 13 图；验证 Content API、Field Runtime、InputGate、Render Projection 责任边界。
- **13 图验收：** 逐字段 before/after diff；失败 rollback 与成功 reset 两组测试。；13 图逐张执行适用项；SOURCE-EMPTY/SOURCE-ABSENT/RESOURCE-MISSING 分别断言。
- **依赖 / 未决：** P3-03、P3-13、P3-15、P4-08；待需求卡审批；P3-03、P3-13、P3-15、P4-08；未获批前保持 PROPOSED。
- **批准状态：** PROPOSED / NOT-APPROVED

### P4-07 — Camera转移/冷却防重复
- **用户目标：** 跨图 camera reset+snap；同图 camera filter retarget；PortalTravelGate 使用单调时钟。
- **地图范围：** 222000000;222000001;230030200;230030100;230030000;230020300;230020200;230020100;230020000;230000000;230000001;230000002;230000003
- **模块 / 权威所有者：** Field Portal；PortalTravelGate/token 与 FieldRuntime state 为权威；cms-portal 只画
- **输入 → 输出：** InputGate Up edge + PortalRecord + 13-map graph + destination MapBundle; 关联源字段：portal token、clock、camera filter、sceneEpoch。 → same-map relocation or atomic cross-map transition; 可观察验收：499/500/501ms 与 119/120/121ms 边界；迟到旧 token 不释放新 token。
- **资源字段依赖：** Portal pn/pt/x/y/tm/tn + destination portal index + resource closure; portal token、clock、camera filter、sceneEpoch。
- **正常行为：** 跨图 camera reset+snap；同图 camera filter retarget；PortalTravelGate 使用单调时钟。 499/500/501ms 与 119/120/121ms 边界；迟到旧 token 不释放新 token。
- **边界行为：** cross-map 500ms interval、same-map 120ms admission/600ms recovery 为候选值；重复 edge 与 active token 被拒绝。；不把 SOURCE-ABSENT 当成 SOURCE-EMPTY，不静默补默认值。
- **错误 / 回滚：** 构建期 fail-closed 并输出稳定 diagnostic code；运行期保留 last-good RenderDomain tree 与 FieldRuntime state；跨图 prepare/replace 失败不得提交新 mapId、Actor、Camera 或 sceneEpoch。
- **OpenMS 参考：** https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/client/src/world/portal-system.js#L20-L128 ; https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/client/src/world/portal-system.js#L412-L560 ; https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/client/src/rendering/camera.js#L7-L16 ; https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/client/src/rendering/camera.js#L39-L64 ; https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/client/src/rendering/camera.js#L67-L129；commit 07994de02756356e3e025e3aca9e79433898d2c8
- **CMS079 历史状态：** 产品转移策略尚未批准；Gaps=同图一例不可推广跨图CD。只引用既有 research/source-of-truth 与 P0-P4-REQUIREMENT-EVIDENCE-MATRIX；不新增、不升级、不关闭 Claim/Evidence/Gap；历史 readiness 不等于产品批准或实现。
- **079/083 差异：** OpenMS pinned GMS083 是行为/算法候选，不是 CMS079 证明；本需求按 Adventure Island 产品规则实施，差异必须在 ADR/测试中明示，不声明原版等价。
- **ABI / 接口影响：** 不修改 Frozen RenderNode ABI v1 五字段、现有标签/attrs/data/event/key/sceneEpoch；可在 Field Runtime/Subsystem 内新增状态。当前 v1 无法表达的动态背景/Obj flow/Portal phase 必须走新 Plan/tag 版本 ADR。
- **性能目标：** 目标索引构建期 O(n)；触发时 O(1) lookup；active token 唯一；prepare 阶段不阻塞物理 tick
- **确定性单测：** P4-07 正常/边界/错误/回放纯函数测试；499/500/501ms 与 119/120/121ms 边界；迟到旧 token 不释放新 token。；同一输入 state hash 一致。
- **集成测试：** P4-07 集成测试：R1 三图垂直切片与 R2 全 13 图；验证 Content API、Field Runtime、InputGate、Render Projection 责任边界。
- **13 图验收：** 499/500/501ms 与 119/120/121ms 边界；迟到旧 token 不释放新 token。；13 图逐张执行适用项；SOURCE-EMPTY/SOURCE-ABSENT/RESOURCE-MISSING 分别断言。
- **依赖 / 未决：** P2-05、P2-06、P4-08、ADR-004；ADR 门冷却/首帧；P2-05、P2-06、P4-08、ADR-004；未获批前保持 PROPOSED。
- **批准状态：** PROPOSED / NOT-APPROVED

### P4-08 — 成功/失败原子replace
- **用户目标：** 准备目标 Plan/资源/落点后执行单一 replace+state commit；失败保持旧树旧状态。
- **地图范围：** 222000000;222000001;230030200;230030100;230030000;230020300;230020200;230020100;230020000;230000000;230000001;230000002;230000003
- **模块 / 权威所有者：** Field Portal；PortalTravelGate/token 与 FieldRuntime state 为权威；cms-portal 只画
- **输入 → 输出：** InputGate Up edge + PortalRecord + 13-map graph + destination MapBundle; 关联源字段：MapBundle、RenderDomain.replace、FieldRuntime transaction、sceneEpoch。 → same-map relocation or atomic cross-map transition; 可观察验收：在每个 await/commit 边界注入失败；旧 mapId、Actor、Camera 和 tree hash 不变。
- **资源字段依赖：** Portal pn/pt/x/y/tm/tn + destination portal index + resource closure; MapBundle、RenderDomain.replace、FieldRuntime transaction、sceneEpoch。
- **正常行为：** 准备目标 Plan/资源/落点后执行单一 replace+state commit；失败保持旧树旧状态。 在每个 await/commit 边界注入失败；旧 mapId、Actor、Camera 和 tree hash 不变。
- **边界行为：** 任意 prepare/resource/replace 失败均释放 token/资源；不递增已发布 sceneEpoch，不产生半张地图。；不把 SOURCE-ABSENT 当成 SOURCE-EMPTY，不静默补默认值。
- **错误 / 回滚：** 构建期 fail-closed 并输出稳定 diagnostic code；运行期保留 last-good RenderDomain tree 与 FieldRuntime state；跨图 prepare/replace 失败不得提交新 mapId、Actor、Camera 或 sceneEpoch。
- **OpenMS 参考：** https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/client/src/rendering/field-transition.js#L1-L164 ; https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/client/src/world/portal-system.js#L20-L128 ; https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/client/src/world/portal-system.js#L412-L560 ; https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/client/src/character/field-avatar.js#L4-L38 ; https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/client/src/character/field-avatar.js#L41-L116；commit 07994de02756356e3e025e3aca9e79433898d2c8
- **CMS079 历史状态：** MapScenePlan及Frozen ABI正式定义；Gaps=与原版单帧场景加载无关。只引用既有 research/source-of-truth 与 P0-P4-REQUIREMENT-EVIDENCE-MATRIX；不新增、不升级、不关闭 Claim/Evidence/Gap；历史 readiness 不等于产品批准或实现。
- **079/083 差异：** OpenMS pinned GMS083 是行为/算法候选，不是 CMS079 证明；本需求按 Adventure Island 产品规则实施，差异必须在 ADR/测试中明示，不声明原版等价。
- **ABI / 接口影响：** 不修改 Frozen RenderNode ABI v1 五字段、现有标签/attrs/data/event/key/sceneEpoch；可在 Field Runtime/Subsystem 内新增状态。当前 v1 无法表达的动态背景/Obj flow/Portal phase 必须走新 Plan/tag 版本 ADR。
- **性能目标：** 目标索引构建期 O(n)；触发时 O(1) lookup；active token 唯一；prepare 阶段不阻塞物理 tick
- **确定性单测：** P4-08 正常/边界/错误/回放纯函数测试；在每个 await/commit 边界注入失败；旧 mapId、Actor、Camera 和 tree hash 不变。；同一输入 state hash 一致。
- **集成测试：** P4-08 集成测试：R1 三图垂直切片与 R2 全 13 图；验证 Content API、Field Runtime、InputGate、Render Projection 责任边界。
- **13 图验收：** 在每个 await/commit 边界注入失败；旧 mapId、Actor、Camera 和 tree hash 不变。；13 图逐张执行适用项；SOURCE-EMPTY/SOURCE-ABSENT/RESOURCE-MISSING 分别断言。
- **依赖 / 未决：** P0-11、P1-15、P4-06、ADR-004；待需求卡审批；P0-11、P1-15、P4-06、ADR-004；未获批前保持 PROPOSED。
- **批准状态：** PROPOSED / NOT-APPROVED

### P4-09 — 13图全部连通导航
- **用户目标：** 将 13 图内部唯一目标连接作为完整导航候选；外部 8 条永不静默开放。
- **地图范围：** 222000000;222000001;230030200;230030100;230030000;230020300;230020200;230020100;230020000;230000000;230000001;230000002;230000003
- **模块 / 权威所有者：** Field Portal；PortalTravelGate/token 与 FieldRuntime state 为权威；cms-portal 只画
- **输入 → 输出：** InputGate Up edge + PortalRecord + 13-map graph + destination MapBundle; 关联源字段：13 个 Map IDs、54 条非 sentinel link、PortalGraph CSV。 → same-map relocation or atomic cross-map transition; 可观察验收：46 internal/unique、8 external/disabled、forward/reverse reachability 13/13。
- **资源字段依赖：** Portal pn/pt/x/y/tm/tn + destination portal index + resource closure; 13 个 Map IDs、54 条非 sentinel link、PortalGraph CSV。
- **正常行为：** 将 13 图内部唯一目标连接作为完整导航候选；外部 8 条永不静默开放。 46 internal/unique、8 external/disabled、forward/reverse reachability 13/13。
- **边界行为：** 启用前要求目标地图/portal 唯一且资源闭包通过；图需正反向全 13 可达。；不把 SOURCE-ABSENT 当成 SOURCE-EMPTY，不静默补默认值。
- **错误 / 回滚：** 构建期 fail-closed 并输出稳定 diagnostic code；运行期保留 last-good RenderDomain tree 与 FieldRuntime state；跨图 prepare/replace 失败不得提交新 mapId、Actor、Camera 或 sceneEpoch。
- **OpenMS 参考：** https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/client/src/world/portal-system.js#L20-L128 ; https://github.com/tensorfish/openms/blob/07994de02756356e3e025e3aca9e79433898d2c8/client/src/world/portal-system.js#L412-L560；commit 07994de02756356e3e025e3aca9e79433898d2c8
- **CMS079 历史状态：** DESIGN-DECISION；Gaps=G38。只引用既有 research/source-of-truth 与 P0-P4-REQUIREMENT-EVIDENCE-MATRIX；不新增、不升级、不关闭 Claim/Evidence/Gap；历史 readiness 不等于产品批准或实现。
- **079/083 差异：** OpenMS pinned GMS083 是行为/算法候选，不是 CMS079 证明；本需求按 Adventure Island 产品规则实施，差异必须在 ADR/测试中明示，不声明原版等价。
- **ABI / 接口影响：** 不修改 Frozen RenderNode ABI v1 五字段、现有标签/attrs/data/event/key/sceneEpoch；可在 Field Runtime/Subsystem 内新增状态。当前 v1 无法表达的动态背景/Obj flow/Portal phase 必须走新 Plan/tag 版本 ADR。
- **性能目标：** 目标索引构建期 O(n)；触发时 O(1) lookup；active token 唯一；prepare 阶段不阻塞物理 tick
- **确定性单测：** P4-09 正常/边界/错误/回放纯函数测试；46 internal/unique、8 external/disabled、forward/reverse reachability 13/13。；同一输入 state hash 一致。
- **集成测试：** P4-09 集成测试：R1 三图垂直切片与 R2 全 13 图；验证 Content API、Field Runtime、InputGate、Render Projection 责任边界。
- **13 图验收：** 46 internal/unique、8 external/disabled、forward/reverse reachability 13/13。；13 图逐张执行适用项；SOURCE-EMPTY/SOURCE-ABSENT/RESOURCE-MISSING 分别断言。
- **依赖 / 未决：** P0-01、P0-11、P4-03、ADR-001；ADR 门图: 四门→完整13图；P0-01、P0-11、P4-03、ADR-001；未获批前保持 PROPOSED。
- **批准状态：** PROPOSED / NOT-APPROVED

## 统计与解释

- 需求行数：65；唯一 Requirement ID：65。
- 每行均包含目标、地图、Owner、I/O、状态权威、资源字段、正常/边界/错误行为、OpenMS commit 与文件位置、CMS079 历史边界、079/083 差异、ABI、性能、单测、集成测试、13 图验收、依赖、未决项和批准状态。
- 历史 readiness 只描述研究证据，不代表产品批准或功能实现。