# cms-actor 部署与注册

> 把 `cms-actor` 交给 LoomRealm 正式加载所需的全部产物、MIME 与步骤。不修改 LoomRealm 冻结接口。
> PR-A 只交付组件与合成验证；根 PWA 的正式注册与发布属于 PR-B（新 Issue/新 PR）。

## 1. 产物清单

| 文件 | 作用 |
|---|---|
| `browser/cms-actor.browser.js` | classic script 入口（IIFE，无模块语法），注册 `cms-actor` |
| `presentation.json` | Web Presentation Config v1 注册声明（组件级示范/测试配置） |
| `scripts/build.mjs` | 由 `src/` 重新生成产物的确定性打包器（`--check` 字节级校验） |

## 2. 放进 FSDB

按 `content/cms_design.md` 的物理协议，产物作为 Presentation 资源入库：

```text
[FSDB]cms/
└── [resource]Presentation/
    ├── .desc.meta                      # 必需：Markdown 说明
    └── cms-actor/
        └── cms-actor.browser.js.js     # 双扩展名：物理名剥去最后一个扩展名后
                                        # 得到逻辑 key cms-actor/cms-actor.browser.js
```

- `.desc.meta` 说明命名与格式（合成 fixture 见 `test/synthetic-fsdb.mjs` 的示例）；
- 逻辑标识：namespace `resource.Presentation`，key `cms-actor/cms-actor.browser.js`；
- 所有文本 UTF-8 without BOM；资源字节为 opaque bytes。

## 3. MIME

| 产物 | MIME essence（冻结要求） |
|---|---|
| `cms-actor.browser.js` | `text/javascript`（`text/javascript; charset=utf-8` 亦合法：参数不参与相等判断） |
| 计划内 PNG | `image/*`（组件侧校验 essence） |

平台 PREPARE 在浏览器副作用前固定 MIME；`prepareWebPresentationV1` 会拒绝 essence 不是 `text/javascript` 的脚本引用（有测试覆盖）。

## 4. 注册（平台侧）

1. 平台从私有配置源读入组件声明，等价于本仓库的组件级 `presentation.json`；
2. `validateWebPresentationConfigV1` 闭包校验（精确字段、去重、版本）；
3. `prepareWebPresentationV1` 在当前 prepared Content 视图内解析 `resource.Presentation/cms-actor/cms-actor.browser.js`，固定 `contentVersion`（body bytes 的 SHA-256）、MIME 与私有 `browserSource`；
4. Renderer Window 启动 projection 前，`bootstrapWebPresentation()` 按 classic `<script src>` 有序评估；
5. `window.onload` 之后 Projector 首次 managed mutation 前，`customElements.get("cms-actor")` 已就绪（unknown tag 会触发该 Window 的 fail-closed 结构性失败，无回退元素）。

组件运行期读图走 `PresentationResourceClient.resource(namespace, key, expectedContentVersion)`；业务侧拿不到 origin、installationId、token/bearer、路径、FSDB、私有 URL 或原始 Response。

## 5. Subsystem 侧数据

游戏适配层（参考 `test/look-adapter.mjs`，非正式运行时）负责：

- 从 `struct.Look` / `struct.ZMap` 读取记录，解析 UOL、武器后缀、帧号钳制、部件缺动作不画；
- 以可信 Content API 获取每张画布的 `contentVersion`；
- 产出有界 `avatarPlan`（≤ 262,144 compact 字节，其余边界见 [IMPLEMENTATION.md](./IMPLEMENTATION.md) §3.1）投影到 `RenderNode.data`；
- 一次性动作（`brandish1` 等）按需包含在计划中，通过 `RenderDomain.emit` 的 `action` 事件触发，不写进 retained data。

## 6. 合成验证与真实素材的边界

- **可复现的合成验证**：合成 FSDB 与运行时生成 PNG 的 21 例 Node 测试 + 13 例真实 Chromium 集成测试（命令见 [IMPLEMENTATION.md](./IMPLEMENTATION.md) §7）；
- **真实素材验证**：需持有合法 079 WZ 的使用者本地转出真实 FSDB 后执行 `test/real-assets.local.test.mjs`（`CMS_ACTOR_REAL_FSDB`）；无真实素材的环境**显式 skip**，仓库不提交 WZ、原版 PNG/音频或生成的真实 FSDB；
- 根 PWA 的正式 Content 发布、staging 与 Service Worker 闭环属 PR-B。
