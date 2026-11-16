# MS 组件重构设计

> 状态：**Draft / 讨论中**  
> 设计基线：Adventure Island `design/openms-guided-product-first`；LoomRealm gitlink `93648192323bf5f57996b7b54cbae641d8a53fdb`；OpenMS GMS083 `07994de02756356e3e025e3aca9e79433898d2c8`。  
> 本目录记录下一代组件的**新设计**，不代表实现完成、ABI 已冻结或旧组件已废弃。

## 目录约定

- 新组件的 Custom Element 标签统一使用 `ms-` 前缀。
- 一种组件一个独立设计文档；文档文件名与标签对应，如 `ms-avatar.md`。
- 先确定职责边界，再逐项讨论 `attrs / data / RenderEvent`、时间与资源语义；未批准的方案明确标注为候选。
- 不把 OpenMS PixiJS 对象直接复制为 LoomRealm RenderNode；保留 LoomRealm Render Update v1 五字段协议和 Subsystem/Renderer 跨进程边界。
- **不就地修改冻结的 `cms-*` ABI**。若将来确定迁移方式，再单独提出实施和兼容计划。

## 组件设计

| 组件 | 文档 | 状态 |
| --- | --- | --- |
| `ms-avatar` | [ms-avatar.md](./ms-avatar.md) | Draft：已确认职责；动态 ABI 和时钟待讨论 |

## 依据

- [现有 Avatar 设计](../../components/cms-actor/DESIGN.md)
- [现有 Avatar 实施契约](../../components/cms-actor/IMPLEMENTATION.md)
- [现有 RenderNode ABI v1](../../components/RENDER-NODE-ABI-V1.md)
- [OpenMS 适配合同](../../docs/product-first/OPENMS-ADAPTATION-CONTRACT.md)

后续其他 `ms-*` 组件的设计独立增加文档，不由 `ms-avatar` 预先定义。
