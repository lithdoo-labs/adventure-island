# MS 组件设计

> 状态：**ms-avatar / ms-action V1 设计基线已收口；尚未实现。**
> Scene ABI v2 总体架构目前为 PROPOSED，不是 Frozen。
> LoomRealm gitlink：93648192323bf5f57996b7b54cbae641d8a53fdb。
> OpenMS GMS083 参考：07994de02756356e3e025e3aca9e79433898d2c8。

## 目录约定

- 新组件标签统一使用 ms- 前缀。
- 一个组件一个独立设计文件。
- 每个组件必须定义 attrs/data/children/Event/生命周期/资源/Clock/Validator/容量/失败策略。
- 不就地修改 Frozen cms-* ABI v1。
- 新 Scene ABI v2 仍使用 LoomRealm RenderNode 五字段，不增加 props/state/style/events/resources 等平级字段。
- OpenMS 仅作 GMS083 行为参考；不得把其 PixiJS 结构直接变成业务 ABI，也不得把 GMS083 行为写成 CMS079 证据。

## 设计基线

| 组件 | 文档 | 设计状态 | 实现状态 |
|---|---|---|---|
| ms-avatar | [ms-avatar.md](./ms-avatar.md) | V1 设计基线已收口 | 未实现；CMS079 样本、浏览器集成、像素/性能验收未完成 |
| ms-action | [ms-action.md](./ms-action.md) | V1 设计基线已收口 | 未实现；Clip Validator 和真实 WebProjector 集成未完成 |

不要重新讨论 ms-avatar / ms-action V1 的公开 attrs/data/children 和播放规则，除非出现可复现矛盾或新工程证据。

## 总体架构

- [RenderNode 基线审计](./RENDERNODE-BASELINE-AUDIT.md)
- [RenderNode 总体架构与 Scene ABI v2](./RENDERNODE-ARCHITECTURE.md)

当前 Proposed 目标树包含 ms-scene-view、ms-back、ms-world-layer、ms-entity；这些组件尚未拥有冻结的独立 ABI。

## 实施阻塞

ms-avatar V1 要求 Renderer 内部 RenderProjectionBatch begin/end 通知。固定 LoomRealm commit 尚未提供该能力。必须先完成 LoomRealm 内部设计和批准；不得通过增加 RenderNode 字段或扩展 WebPresentationContext 绕过。
