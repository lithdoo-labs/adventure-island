# T084 — Static Forensics Report: Camera Chain / Ladder-Rope Fork / Movement State / Loader & Registration

**Round**: t084 (2026-11-15) — 原版静态逆向深挖阶段 (Camera Chain / Ladder-Rope Fork / Movement State Machine / Loader & Registration).
**Branch**: `design/adventure-field-map-scene`. **Starting commit (t083)**: `5cec6572669a7a4006d80c30be2a7dd8ebb50635` (verified: HEAD == baseline before any write; working tree clean; t083 history preserved, no force operations).
**Binary identity** (re-verified this round before any analysis): `.work/task-036/game-image-unpacked.bin`, SHA-256 `d4a67597a7e1a072679c7b67c91a03a1242eab7aaa635ad8368277dc12a31718`, `fileOffset = VA − 0x400000`. Gr2D_DX8.dll evidence uses the PE model (ImageBase 0x50400000), hash embedded in the evidence file header.

---

## 1. Git 状态

| | |
|---|---|
| Starting SHA | `5cec6572669a7a4006d80c30be2a7dd8ebb50635` (t083) |
| Final SHA | see commit (single t084 research commit; this report written pre-commit) |
| Branch | `design/adventure-field-map-scene` |
| Diff scope | `research/` only（source-of-truth CSV、stage-readiness 报告与 forensics 证据、scripts、无 components/ 改动、Frozen ABI pin 未动、LoomRealm submodule 未动、`.work/` 未动） |

## 2. 工作包逐项结果

| 包 | 结果 | Claim / Evidence / Gap |
|---|---|---|
| P0 Camera 更新链 | **PARTIALLY CONFIRMED** — scene-manager 33-vtable slot 结构、加载顺序（tiles→objs→backs→attr→VR fold→life）、每帧 slot12/slot14 分发、slot15=相机矩形消费者、viewport=[0xBE2788] slot11/12 getters、跨图 load→attach→write 顺序全部指令级闭合；**每帧跟随写点不在 EXE 镜像内**（C-028 负结论再确认），G10 保持 OPEN-RUNTIME | C-084 (B)；EV-73/EV-70；G10（scope 扩充）、G38 |
| P1 Ladder/Rope 分叉 | **CONFIRMED** — 分叉=记录 id **符号约定**：slot13 0x9BCA6F（8/8 物理表 [vt+0x34]）id>0→0x517DA8（foothold-by-id）、id<0→0x9BCC9A（rope-by-index）；id 符号在 0x6B87D1 生成（[fh+0x48] / neg word）；绳 loader 写侧全映射 {id,l,uf,x,y1,y2,page}；**l 无任何静态消费者**（完整读者清点）；0x517DA8 候选身份反证；G41 hint 张力**静态消解**（[M+0x130/0x134]=(layer,platform)/(page,0)，C-068 标签纠正→C-080） | C-078/C-079/C-080 (A)；EV-64/65/66/67；G41 收窄 |
| P2 起身/状态链 | **CONFIRMED** — 真链=0x965A09（user vt slot14）：seat→0、椅子道具→姿势码（0x2DEDxx 映射）、flag=0 时 0x53E95D(M,0xB) 通知；**0x6A0ADF 反证**=通用加密对解密助手（55 调用者）；残项=slot14 flag=0 触发点枚举 | C-081 (A)；EV-69；G41（seat 项闭合） |
| P3 Gr2D slot25 | **PARTIALLY CONFIRMED** — 静态候选集穷尽：0x50403FBE（平凡 setter，不写出参）+ 新增 0x50404E85（0x5042D204 簇 outer slot25=布尔出参 getter）；**两者均不满足**生产路径出参约束（0x666FAC Release 读会崩）→ 运行时绑定必须为 put-with-object-out；G24/G27 保持运行时 dump（现可三选一判定） | C-082 (A 有界负结论)；EV-72；G24/G27 scope 扩充 |
| P4 Foothold Loader 写侧 | **CONFIRMED** — 0xA4F4B6 写入器 10 参全映射（id/x1/y1/x2/y2/layer/platform/piece/两链接）+ 0xA4F54A 派生字段（len=√(dx²+dy²)、单位方向）+ 双插入（0xA513F6 hashmap by-id、0xA4FFCD 空间集合）；失败/空路径有界；C-068 的 DERIVED 标签升级为写侧直证 | C-080 (A)；EV-67；G40（写侧项闭合） |
| P5 Opcode 0x0081 | **PARTIALLY CONFIRMED** — 0x97EBC9 全体闭合（alloc→0x94FDB4 新图全载→0x980A8C 挂接→0x9507F0 落点写）；唯一调用者 0x533FF1 位于 handler 家族 slot0（33 表 0xB01308..0xB02730）；**静态字节绑定不存在**：0x77E6F3 通道上下文 0x81/0x82/0x83 碰撞证明 opcode 注册是上下文相关的运行时数据 | C-083 (A)；EV-70；G38（0x81 项改写为碰撞反证） |
| P6 Stack-package | **STATIC-EXHAUSTED（负结论）** — 四个具名 callee 全读：0x43286E null-assert ctor、0x44484B/0x429411 字节级相同的 attach+AddRef、0x43E3A6=又一个 0x427EB3 PUT 包装；**零比较/排序/插入逻辑**；比较器假说的 EXE 领土穷尽 | C-085 (A)；EV-71；G07 收窄为 runtime slot25 端点 |
| （无空洞交付物） | 全部 8 份交付物均含实际研究内容；无 NOT STARTED/BLOCKED 项 | — |

## 3. 新发现（新确认的原版行为 vs 候选解释）

**新确认（指令级）**
1. 上下文 id 符号分叉体系（C-078/C-079）：foothold id=正、rope id=−索引；rope 表 1 基索引、count 在 [表−4]。
2. 绳记录 7 字段写侧映射与 l 的“加载但无消费”（C-079）。
3. fh 记录写侧与派生字段（C-080）；**[M+0x130/0x134]=立足 (layer,platform)**、绳上下文=(page,0)——t082 登记的运行时 dump 需求撤除。
4. 起身链 0x965A09 与 0x6A0ADF 反证（C-081）。
5. slot25 第二静态候选及其与出参约束的矛盾（C-082）。
6. 跨图处理器内部顺序（新图先全载再挂接再落点写）与 0x81 上下文碰撞（C-083）。
7. scene-manager 槽位结构与加载/分发顺序（C-084，B 级——slot15 的“args=相机矩形”语义由比较用途推出，生产者未定位）。
8. stack-package 四 callee 无比较逻辑（C-085）。

**候选解释（未升级）**：+0x4C/+0x50 的 prev/next 具体对应（0x6C1/0x6C2 名字顺序 DERIVED）；user+0xF04 姿势码的消费端语义（偏移语义 DERIVED）；slot15 参数生产者（G10 运行时）。

## 4. 独立复核

独立 Reviewer 子代理（独立上下文、独立 capstone 脚本 `dislib.py`/`r5_dll.py`/`r8_audit.py`、独立哈希、二进制哈希复核一致；不以 t084 产出物为输入）对 R1..R8 八项任务逐条从原始字节复核，裁定：**ACCEPT ×7、ACCEPT-WITH-CORRECTIONS ×1（C-081）**；4 项差异（无 HIGH）全部处置：

- D1（C-081 文本错误）：姿势映射 →1 区间实为 0x2DEDED..0x2DEDEF 三 id（cmp @0x965A93/0x965A9A），已修正 claims 行与本报告并保留 reviewer 原文标记；
- D2（0xA4F4B6 参数物理序）：arg8→+0x4C(0x6C1)、arg9→+0x50(0x6C2)、arg10→+0x28(piece)，FOOTHOLD 报告表已按 reviewer 编号修正（ledger C-080 行不含参数编号，无需改）；
- D3（提示地址笔误 0x5042D264→0x5042D268）：仅评审提示文本；交付物与 EV-72 未含错误地址（DLL dump 文件按 slot 循环计算，slot25 标注正确）；
- D4（C-085 证伪措辞过宽）：收紧为"数据对数据比较/排序指令"（零值守卫比较不算），claims 行已改。

Reviewer 报告原文：`forensics/T084-REVIEWER-REPORT.md`。未观察到任何 CLOSED-STATIC 声明的证伪条件成立。

## 5. 质量门禁（真实执行日志）

- Validator：`python research/scripts/validate_reverse_engineering.py` → **PASS (0 errors, 0 warnings)**（`forensics/T084-VALIDATOR-LOG.txt`；85 Claims / 41 Gaps / 73 Evidence）。
- Unit tests：`python -m unittest research.tests.test_validate_reverse_engineering` → **44/44 OK**（`forensics/T084-UNITTEST-LOG.txt`）。
- Clean-room：`generate_cleanroom_deliverables.py` 再生成，CHECK 15/16 同步通过（含 17a 证据哈希逐文件校验，EV-64..EV-73 全部绑定实际文件哈希）。
- Frozen ABI pin：未改动（validator CHECK 13 通过）；LoomRealm submodule、components/、content/、.work/ 均未改动。

## 6. 剩余问题（需 Runtime Dump / 后续实验）

1. **G10**：每帧相机矩形生产者（slot15 caller）、跟随/deadzone/world-to-screen 写点、帧循环宿主 — in-map dump。
2. **G24+G27**：bp 0x666F77 单值 dump（现为三候选判定：trivial-setter / boolean-getter / runtime put-with-out）。
3. **G38**：0x81→handler 的运行时注册数据；0x9BE703 完整体；相机刷新时机。
4. **G40**：slot3 变体 0x9C5B8A/0x9CCAA8 差异；鞋 +0x198 默认与四 DEC 槽。
5. **G41**（收窄后）：slot14 flag=0 触发枚举（静态可续）；上下键同按仲裁；运行时 corroboration 已降级为可选。
6. **G36/G37/G39**：动态层捕获（slot25 出参/slot 值/slot58 双采样）不变。
7. **G34**：0x5A↔0x1E 转换站点仍无（本轮未发现新站点）。

## 7. 需求矩阵 / 就绪变化

- 65 行不变；RE-READY 16→**17**（P3-13 抓绳/ladder 判定：分叉+l/uf 消费闭合，C-069/C-071/C-078/C-079）；RE-GAP-STATIC 27→26。
- 更新行：P1-09、P1-10、P3-03、P3-13、P3-14、P3-15、P4-04、P4-06、P4-07（minimum_next_work 全部去除已完成项并带 t084 修正标记；P3-15 的 0x6A0ADF 指针以 correction 标记移除）。

## 8. 最终阶段判断

Camera 每帧跟随（G10）与 slot25 运行时身份（G24/G27）仍未解决，0x81 的运行时注册与 0x9BE703 完整体未闭合。

**项目状态保持：NOT STAGE-READY。**

本轮把 Ladder/Rope 分叉、Foothold 写侧、起身链、stack-package 四 callee 与跨图处理器顺序从“开放静态问题”推进为“A 级指令级结论”（并附带两处带纠错链的标签修正：C-068→C-080、P3-15→C-081）；Camera 侧交付了完整的静态骨架与明确的“写点不在本镜像内”边界。下一轮最高价值目标：G10 运行时捕获 + G24 单值 dump + 0x9BE703 完整体。
