# Adventure Island

> **当前状态：Design Baseline Reset（2026-11-17）。** 本仓库已将旧 `cms-*` 产品架构降为历史兼容路径。现行设计入口是 [DESIGN.md](./DESIGN.md) 与 [设计基线说明](./docs/design-baseline/README.md)。

Adventure Island 是一个基于 [LoomRealm](https://github.com/lithdoo/loom-realm) 的 CMS079 风格游戏研究与产品项目。CMS079 逆向证据、OpenMS 行为参考和本地 WZ/FSDB 转换资料继续保留；它们是事实与候选输入，不自动构成新产品接口。

## 当前设计基线

- `ms-avatar` 与 `ms-action` 是当前唯一保留的可审查组件候选基线。两份文档尚未批准、冻结或实现；本轮不重定义其字段和行为。
- 当前没有获批的完整 Scene ABI、World Draw List、Camera、Movement、Portal 或跨组件 Renderer 服务契约。相关提案只供审查，不得默认实施。
- LoomRealm Submodule 固定在 `93648192323bf5f57996b7b54cbae641d8a53fdb`。本次清理不修改该 gitlink，也不向 Submodule 写入游戏代码。
- OpenMS 固定参考 `07994de02756356e3e025e3aca9e79433898d2c8`，其 GPL-3.0 代码不因参考行为而获得复制或集成许可。

## 旧运行路径（保留用于兼容，不是新基线）

根目录 `game.json`、`launch.*.json`、`presentation.json`、`systems/base`、`systems/adventure-map` 和 `components/cms-*` 仍组成可复现的旧 PWA 垂直切片。它目前加载 `cms-actor` classic script，并继续由既有测试与 PWA CI 做兼容性回归。

这条路径不是 ms-avatar/ms-action 的实现，也不是新 Scene 架构的前置依赖。除兼容性修复外，不在旧 `cms-*` ABI 上扩展新产品功能。旧代码与契约保留在原路径，避免破坏历史测试和可复现性；其规范效力仅限旧路径。

## 目录职责

| 路径 | 当前定位 |
|---|---|
| `design/ms-components/ms-avatar.md`、`ms-action.md` | 可审查的组件候选设计；未批准、未冻结、未实现 |
| `design/ms-components/RENDERNODE-ARCHITECTURE.md` | 已归档的 Scene/Renderer 探索提案；非现行架构 |
| `components/` | 旧 `cms-*` 兼容实现及历史 ABI/Plan 文档 |
| `systems/`、`subsystems/`、根 manifests | 旧 PWA 垂直切片及兼容性测试入口 |
| `research/` | CMS079 逆向任务、证据、参考资料与分析脚本；只读研究资产 |
| `docs/product-first/` | 2026-11-16 产品设计提案档案；全部未批准 |
| `docs/design-baseline/` | 当前唯一设计基线与状态说明 |
| `loom-realm/` | 固定版本的 LoomRealm Git Submodule |

## 研究资产保留规则

保留 CMS079 的 claims/evidence/gaps、13 张地图覆盖审计、Portal Graph、OpenMS 来源与许可证矩阵、CMS079 WZ→FSDB 真实闭环报告及原始研究目录。它们不得被改写成产品批准、全量无损或客户端完整可用的结论。原始客户端、WZ 和全量 FSDB 仍只存在于使用者本地。

## 旧 PWA 兼容性验证

以下命令验证的是旧兼容运行路径，不是新设计基线的实现验收：

```bash
npm ci --no-audit --no-fund
npm ci --prefix loom-realm --no-audit --no-fund
npm test
npm run pwa:bundle
npm run pwa:staging
```

GitHub Actions 的 PWA 工作流同样只表示旧运行路径兼容性。当前会话未执行本地 npm、Chromium 或 E2E 测试；不得据此宣称本次清理已通过运行测试。

## Issue Agent

仓库现有 Issue Agent 操作方式与权限边界见 [docs/issue-agent.md](./docs/issue-agent.md)。研究目录仍不允许 Issue Agent 自动修改。
