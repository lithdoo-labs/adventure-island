# Components — Legacy Compatibility Runtime

> **状态：Legacy / Non-normative for the current design baseline.** 本目录中的 `cms-*` 组件与 ABI 文档仅用于维护和复现旧 PWA 兼容运行路径。当前设计入口见 [设计基线](../docs/design-baseline/README.md)。

## 旧组件路径

旧运行树由 `cms-scene-view`、`cms-back`、`cms-map-layer`、`cms-avatar-layer`、`cms-actor` 和 `cms-portal` 等标签组成。根目录 `presentation.json` 仍注册 `cms-actor` classic script；旧 PWA 测试继续覆盖该路径。

- [旧 RenderNode ABI v1](./RENDER-NODE-ABI-V1.md)：仅对旧 `cms-*` 树保持历史兼容效力，不约束新设计。
- [旧 MapScenePlanV1](./MAP-SCENE-PLAN-V1.md)：旧 Adapter / Field Runtime 的历史逻辑 Plan 草案。
- [cms-actor](./cms-actor/DESIGN.md) 与 [实施说明](./cms-actor/IMPLEMENTATION.md)：既有实现，不是 ms-avatar 的实现。
- 其他 `cms-*` 组件设计：旧运行路径的历史设计资料。

## 当前可审查的组件候选

- [ms-avatar V1](../design/ms-components/ms-avatar.md)
- [ms-action V1](../design/ms-components/ms-action.md)

这两份文档保留其现有字段和行为作为审查基线，但尚未批准、冻结或实现。它们不继承旧 `cms-*` 的产品级 ABI。不要通过改标签名、复用旧 AvatarPlan 或把 ms-avatar 塞入旧 cms-avatar-layer 来假设迁移兼容。

## 维护规则

- 旧组件只接受必要的兼容性修复；不以它们作为新功能的默认扩展点。
- 不从旧 ABI 推导新 Scene、World Layer、Camera 或 Entity 的接口。
- 新组件实现前先完成 [设计基线说明](../docs/design-baseline/README.md) 中的审批门和上游能力核验。
