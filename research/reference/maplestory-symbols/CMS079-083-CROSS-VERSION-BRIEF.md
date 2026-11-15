# CMS079 / GMS083 外部逆向资料：来源、证据边界与 T085-A 候选

> 建档：2026-11-15；定向参考，不是新 CMS079 原版取证。本批只收录公开来源链接、出处、有限的事实性摘要和验证计划；**没有下载或镜像 EXE/DLL/IDB/PDB/WZ/第三方源码**。
>
> 所有正式 CMS079 Claim/Evidence/Gap 仍以 `research/source-of-truth/` 为唯一权威；当前研究基线 `16e8bd5b5c70d22a32948613ac6c598ebfe09e50`，本索引不改变 Gap、需求 readiness、Frozen ABI 或 Stage-Ready。

## 快速入口

- [26 条来源机器索引：版本、用途、核验状态、限制](CMS079-083-REFERENCE-CATALOG.csv)
- [T085-A 主 Agent + 独立 Sub-Agent 研究任务书](../../task/085-targeted-cross-version-reference-matching.md)
- [既有 v83/v95 符号源](SOURCES.md) 与 [转载许可](LEGAL.md)

## 四种不同的资料，严格隔离

| 资料 | 研究价值 | 证据边界 |
|---|---|---|
| 本仓 CMS079 原 EXE/DLL 指令 | A 级直接证据 | 必须能重现原始字节、VA/RVA、CFG、入参出参 |
| **OpenMS 对另一版 GMS083 原 EXE/DLL 的反编译** | 最高价值的跨版本算法/地址候选 | 虽来自 v83 原版机器码，但不是 CMS079 原版源码或相同构建 |
| CMS079 / GMS083 社区 IDB、论坛地址及部分插件 | 名称、字符串、RTTI/vtable、调用图的候选入口 | IDB 下载状态与文件哈希未经验证；绝不按 VA 接近程度直接移植 |
| HeavenClient / MapleUnity / Maplewright / MortalClient / OpenStory | 生成可证伪测试、调试和可视化方法 | 第三方重制，与 Wizet/Nexon 原版源码不同 |

索引状态如 `PAGE_VERIFIED` 只表示网页存在且内容大类已核验；`*_NOT_FETCHED`、`*_UNAVAILABLE`、`UNVERIFIED_412` 必须保持不可用/未检，不得写“已取得 IDB”。历史论坛帖子可能含不明来源可执行文件，**不执行、不镜像、不向 Git 提交**。所有第三方代码的实际复用均需另行许可证审查。

## 版本身份（绝不能跨构建复用地址）

| 目标 | SHA-256 |
|---|---|
| 本仓 CMS079 EXE 解包映像 | `d4a67597a7e1a072679c7b67c91a03a1242eab7aaa635ad8368277dc12a31718` |
| 本仓 CMS079 Gr2D DLL | `ad67b9a08a0a360e9a31f0274d29b8cb9839d95d691762961454c806ef6a25d1` |
| OpenMS 对应的 GMS083 EXE | `1198fa57ca5a7c489bae43ec13c69681d9cabe0f96762f3dc0357facf2e7d4df` |
| OpenMS 对应的 GMS083 Gr2D DLL | `ab1c942229af33da04d913ed1157ab322bff0812f7368bcf745d64b98698d34d` |

OpenMS 研究页：https://docs.openms.dev/client/client-evidence 。其 Ghidra 伪 C 是从二进制重建，不是丢失的原始源代码；研究者没有进行原版 Windows 运行时捕获。OpenMS 的 v83 原始函数地址在本仓 CMS079 里**一律先视为 unmatched**。

## 最接近 079 的资料

- [CMS079 IDB 发布帖](https://www.fengyewuyu.com/forum.php?extra=page%3D1&mobile=no&mod=viewthread&page=19&tid=1719) 公开索引提及 `MapleStory_79_dump.exe`，历史来源不明；本轮没有取得 IDB/EXE，不进行任何可执行文件镜像。
- [CMS079 参数与函数名增强帖所在论坛](https://www.fengyewuyu.com/forum-66-11.html)：版块存在置顶帖“改进 CMS 079版本 较全方法参数命名”，附件和帖内内容未成功读取。
- [079 地址偏移大全](https://www.fengyewuyu.com/thread-6825-1-1.html) 的地址是不同构建/社区修改的搜索线索，不是本项目直接对应的地址。
- [Angxl v83 IDB 公开说明](https://forum.ragezone.com/threads/v83-idb-client-edit-dump.1193418/) 自述约 3,000 函数名称，基于 localhost MoopleStory、IDA 7.0；没有核验实际 IDB。
- [v83 分辨率地址表](https://forum.ragezone.com/threads/all-addresses-for-v83-resolution-change.1161938/) 包含 `CWvsApp::InitializeGr2D` 与 800×600 的候选常量地址；不直接拿 v83 VA 修改 CMS079。
- [gms083-src Gitee](https://gitee.com/sleepnap/gms083-src/tree/master/gms083-starter) / [dbglog 博客](https://dbglog.com/maplestory-v083/) / [MapleStoryEx](https://github.com/unsafeblackcat/MapleStoryEx)：GMS083 研究线索，其中 Gitee 子树本轮工具不可访问，博客搜索可查但打开不稳定。

## 四个 OPEN-RUNTIME Gap：下一阶段可检验假设

### G08 — Avatar world-depth Key（原来 OPEN-RUNTIME）

OpenMS 的**另一 v83 构建**报告：设 `B=-0x40000000`，普通本地角色 depth 候选为
`B + 29992 + (activeController ? 5 : 0) + (layer*3000-group)*10`；mob `29991`、NPC `29995`、drop `29999`。报告中 v83 客户端函数在 `0x0092FD16` 附近，Gr2D tie 采用 overlay ancestor 的 depth 与插入 serial（v83 函数 `0x50403A4B`/`0x5040399B`/`0x50409EFD`）；**均未验证适用于 CMS079**。

**定向复核 H08：** 在 CMS079 EXE 搜索相关常量组合与调用者，追踪 layer/group 参数、Avatar 注册点、容器字段及 Gr2D 最终比较器；与已证 C-001/C-002 Tile/Obj depth 公式独立对照。只出现常量或同名函数不算 MATCH。若未找到，应保留 OPEN-RUNTIME 和最小插入点捕获方案。

### G09 — Avatar 部件排序及遮挡

OpenMS 报告 `smap.img` / `zmap.img`、`origin`、`map`、`brow`、`navel` 资源与客户端消费；[HeavenClient CharLook](https://github.com/maplestory-emulator/HeavenClient/blob/master/Character/Look/CharLook.cpp) 和 [MapleUnity 错位诊断](https://github.com/ilia810/MapleUnity/blob/master/CHARACTER_RENDERING_MISALIGNMENT_REPORT.md) 只能用于提出 stand/walk/ladder/rope、帽子、手持武器、翻转的可证伪矩阵。

**H09：** 用 CMS079 WZ + EXE 恢复每个部件的锚点、隐显和 draw-call 次序；必须与 G08 world-depth 分离。G09 没有真实 target 指令证据不得关闭。

### G10 — Camera 的真实写入者

OpenMS 在**v83** 记录 Camera/VR clamp 和 800×600。 [HeavenClient Camera.cpp](https://github.com/maplestory-emulator/HeavenClient/blob/master/Gameplay/Camera.cpp) 只提供重制客户端的跟随和平滑假设；其死区/速率不等于 CMS079。 [v83 分辨率帖](https://forum.ragezone.com/threads/all-addresses-for-v83-resolution-change.1161938/) 可能帮助找屏幕初始化族。

**H10：** 由本仓 `[0xBDF54C]` 场景族、slot15 Camera 矩形消费点向上逆查真正写入者；区分 EXE 静态扫描范围、外部模块、callback/vtable 和运行时分支。失败时明确有界负结论并维持 G10 OPEN-RUNTIME，不得说“没有在 EXE 发现＝函数动态生成”。

### G24 — Gr2D interface 和返回对象

本仓 T084.1 已静态确认 slot25 函数 `0x5040418C`、长表 `0x5042D224` 与 `0x5042D154`，C-086/C-087 并分离了 IID/QI 静态事实与运行时命名预测。OpenMS 的 v83 Gr2D comparator 地址只能指导“祖先 depth / stable tie / serial”假设，不能推翻或替代本仓已经验证的 slot25。

**H24：** 静态复核 CMS079 COM vtable 和调用点后，若实际 `[0xBE2788]` 的接口身份仍未运行时确认，保留对 `0x666F77` 的定点捕获：记录 DLL 装载基址、`[ESI]` vtable、slot25 函数指针、返回对象 `[0]` 及 slot45 类型。G27 已限界 CLOSED，不得未经新证据擅自重开。

## 其他链接与范围

完整索引包括 [Maplewright](https://github.com/Sheilem/maplewright)（README 描述 D3D8 draw-list 捕获技术）、[MortalClient](https://github.com/HypatiaOfAlexandria/MortalClient)、[OpenStory](https://github.com/rdiol12/OpenStory)、[SpiritIDAPlugin](https://github.com/Bratah123/SpiritIDAPlugin)（IDA7.0/Python2.7 包头扫描）、[Harepacker-resurrected](https://github.com/lastbattle/Harepacker-resurrected)（WZ 查看）、[CMSLauncher](https://github.com/zhyonc/CMSLauncher) 和服务端源码（只可协议侧证）。各自具许可证/来源边界；本次没有复制上游代码。

## 外部资料升级为本仓 CMS079 Claim 的必要步骤

1. 标明外部版本、URL、可能的文件哈希、函数属于哪个 EXE/DLL；来源无法获取时诚实记 INDEX_ONLY。
2. 先用本仓 CMS079 原始字节、VA/RVA、XREF、CFG、调用约定和字段数据流独立确认，而非先移植名称/立即数。
3. Reviewer 独立上下文、独立脚本，**先盲审 CMS079 后对照 v83**；主 Agent 逐条回应差异。
4. MATCH / REFUTED / INCONCLUSIVE 分开记录；未经 CMS079 机器字节验证，外部信息不得写成 A 级 CMS079 Evidence。
5. 资源、IDB/PDB/客户端、第三方源码不提交；许可证与合法来源不足时只保留页面链接和校验说明。
6. 不改变 Frozen `components/RENDER-NODE-ABI-V1.md`、LoomRealm pin、原研究 Gap 状态；阶段仍 NOT STAGE-READY。
