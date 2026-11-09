# RenderNode ABI v1 修复记录与剩余工作

日期：2026-11-09  
基线审计：`f2c711d9821aae911de3e0157cbbf59de76f6f8c`  
分支：`design/adventure-field-map-scene`

## 状态

**P0 文档阻断已修复；证据等级和产品选择已更正；客户端画面一致性仍为 PARTIALLY VERIFIED。**

本次修复不启动地图组件的大规模实现，不把第三方/编辑器算法提升为客户端事实。

## 已完成

- [x] **P0-001**：删除 ABI 中重复插入的前言/第 1–4 节，恢复完整的 `^sha256:[0-9a-f]{64}$` 规则；保留有效的 Unicode scalar、DeepReadonly、InputEvent payload 和 source rectangle 约束。
- [x] **P1-001（文档层）**：`rx/ry`、`type`、`cx/cy` 明确为源参数；不冻结单一背景公式；`cx/cy=0` 保留为 0，不暗示客户端一定替换为图像尺寸。
- [x] **P1-002（文档层）**：Obj/Tile 和 Scene 树顺序明确为当前产品候选顺序，注明来源是 HaCreator 移植而非客户端绘制函数；保留 `zM`，不宣称客户端忽略它。
- [x] **P1-003**：修正 Portal 排他判断；样本中类型 1 的 15/20 条、类型 2 的 16/16 条都有真实目标；类型 2 只作为 MVP 视觉试验子集。
- [x] **P1-004（适配器层，部分）**：CMS079 生产适配器要求显式 `slotMetadata(islot/vslot)`、完整 `zmap.img` 整数记录和 `smap.img`，按 `priority=max(zmap[islot token])`、`tag=vslot ∩ smap[z]` 投影并 fail closed。新增纯函数及 signed-delay 归一化测试。真实 Item 元数据接入 Content closure 与客户端像素对照仍未完成。
- [x] **P2-001**：Portal `flip` 改为可选，缺省 false；明确 99 个样本均没有源 `f`。
- [x] **P2-002**：`locomotion` 明确为 MVP 子集，不代表客户端只有三种动作。
- [x] **P2-003**：修正 AvatarPlan validator 的负 delay 接受问题，并按源重新生成 classic browser bundle；262,144 字节错误信息归属 AvatarPlan 应用层，不再称作 LoomRealm 协议上限。
- [x] **P2-004 / P2-006 / P3-004 / P3-005（文档层）**：不可复现的全库统计降级为样本统计或移除；Camera 1:1/bounds fallback 标为产品约定；`FieldDispatcher+0x24` 降级为未复核笔记。
- [x] **P3-001 / P3-002**：ABI 补充空 update 拒绝规则和 generation 内 one-shot key 生命周期说明。

## 仍然阻塞客户端一致性验收

- [ ] **P1-001**：提取并反汇编原始客户端 Background/Camera 绘制函数；确认 type 0–7、滚动时间基准、镜头项、`cx/cy=0`。
- [ ] **P1-002**：确认 Tile/Obj 排序、Tile canvasZ、Actor 与 Obj 的 `zM` 关系；若客户端确实需要人物深度带，再设计 ABI v2/扩展树结构。
- [ ] **P1-003**：恢复 MapHelper 游戏 Portal 资源，验证类型 1/2 的帧目录、origin、碰撞与实际像素；禁止使用 `portal/editor` 代替。
- [ ] **P1-004**：把真实 CMS Item 元数据、完整 `zmap.img` 整数记录和 `smap.img` 纳入生产 Content closure；复核 `0x77CE9A` 求交循环和 `this+0x38` 预置槽位来源；完成真实 FSDB 遮挡像素测试。当前本地 test helper 只做几何/渲染 smoke，不构成遮挡验收。
- [ ] **P2-005**：提取 Back/Tile/Obj/Portal 画布元数据，验证 origin、宽高、source 和帧 delay。
- [ ] **P2-007**：找到客户端动画定时器，确认 delay 单位/时钟基准。
- [ ] **P2-008**：用完整 CMS zmap 和真实帧验证 AvatarPlan 64 项 zOrder 上限足够。
- [ ] 运行 cms-actor Node 套件、browser artifact `--check`、Chromium 集成套件；执行地图客户端动态像素对照。

## 2026-11-09 证据更新

后续逆向已经改写上面若干阻塞项的范围。现行口径以 [设计评审修订](./2026-11-09-adventure-field-design-revision.md) 和 [MAP-REVERSE-STATUS.md](../../research/result/map/MAP-REVERSE-STATUS.md) 为准。

- Tile / Obj 的加载键、VR 内缩、背景 type 分支和 `20000 / |rate|`、Portal pv 路径、画布 origin 与缺 `z` 的四张 Tile，已经写入契约。
- 比较方向、相同键次序、背景 `+0x98` 的方法体、时间单位、Camera 跟随和帧时钟仍然待逆向。`+0x98` 的参数顺序、`cx`/`cy` 步长，以及 `ph`/`psh` 与 `pt == 10` 的对应，已经写回逆向笔记。
- MapHelper 的原始资源存在。当前缺的是 Content 闭包，不是路径。
- 静态场景组件可以按产品呈现验收推进。客户端像素一致仍要等比较器和动态画面对照。

## 实施门槛

1. 产品绘制顺序和 1:1 Camera 继续标成产品约定，不标成客户端已确认。
2. 不把 HaCreator 或 WzComparerR2 的视差公式称为原始客户端行为。已经反汇编确认的键、VR 内缩和背景分支按修订稿引用。
3. 背景 type 1–7，以及没有游戏帧的 Portal，保持 unsupported。不用 editor 图标回退。
4. Field Runtime 继续持有 Camera、碰撞、Portal 触发和换图权威状态。
5. 当前固定 LoomRealm 没有 Frame Clock。人物运动使用注入步长的纯函数。Subsystem 和视觉组件不自建动画时钟。补算上限仍等上游 Clock 评审。
