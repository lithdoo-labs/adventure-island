# T082 — Independent Adversarial Review（对抗审）

**Reviewer**: t082 Independent Static Forensics Reviewer（盲审报告见 `T082-INDEPENDENT-BLIND-REVIEW.md`，本轮第二阶段）。
**主 Agent**: t082 Lead（四份取证报告 T082-G38/G40/G41/R13）。
**方法**: Reviewer 盲审结论已固化为独立报告后，主 Agent 逐项对质；每处差异裁定为 互证 / 修正采纳 / 保留争议，并落实回四份取证报告。

## 1. 互证清单（双方独立推导一致 → 支撑 CLOSED）

| 子行为 | 主 Agent | Reviewer（盲） | 裁决 |
|---|---|---|---|
| 0x53E95D = 通知 marshaller，非重绑（this=M） | §1.3 | A.1（0x6B87D1 记录维护，无查询） | **ACCEPT（互证）** |
| 0x9BC622 参数表：arg6=0/1 标志、arg7=几何源、state≠7 安装 ctx | §2.1 | A.3 步骤 3/4 | **ACCEPT（互证）** |
| 0x9BC89F/0x9BC992 = 线段参数正逆投影对 + clamp | §2.3 | A.2 | **ACCEPT（互证）** |
| 0x9BF1FA 双向邻接（+0x4C/+0x50）+ 自环守卫 + [N+0x30]>0 转移规则 | G40 §1 | B.2 | **ACCEPT（互证）** |
| [M+0x110] = 单个当前 fh/ctx 指针（非容器） | G40 §2.1 | A.4 Q7 | **ACCEPT（互证，修正 t080 容器口径）** |
| 0xA4FC6F：x 跨度±10、y 精确内含、stride 0x1C、this=[0xBDD498] | G41 §1 | C.1 | **ACCEPT（互证）** |
| 0x9BFB52 = SetStandingContext（slot5） | G41 §3 | C.2 | **ACCEPT（互证）** |
| halfWidth 逐调用点非全局（1 主流/2/动态） | G41 §5 | C.3（17×1、1×2、4×动态、1×不可解码） | **ACCEPT（互证）** |
| M 对象第二虚表家族（slot3=0x9BF1FA、slot5=0x9BFB52、slot1 变体=4 个 E8 调用者互证闭合） | G40 §2.0 | 结构发现（8 表枚举 + slot10=0x9D7ADA） | **ACCEPT（互证+互补）** |
| [ebp-0x20] = 编译器栈槽复用；VARIANT/跨函数解释排除 | R13 §1 | D.1（完整写者普查+解释排除） | **ACCEPT（互证）** |
| slot45 携带预计算键；比较器假设削弱 | R13 §2 | A/B 区分（C.1 无类型判定） | **ACCEPT（互证）** |
| 0x5042D204 合法起点、slot+0x58=0x50403EFC 读 [this+0x28]、与 0x5042D140 分离、运行时身份仍 OPEN | R13 §3 | D.2 | **ACCEPT（互证）** |

## 2. Reviewer 纠正主 Agent（已采纳，修改落实）

| # | 主 Agent 初稿 | Reviewer 反证 | 裁决与落实 |
|---|---|---|---|
| 1 | [ebp-0x20] 的 OUT 重写者记为 0x414A49 | 0x414A49 函数体已验证为**无参**纯解引用（`ret`）；真正 out 写者是 **0x404BA3**（体：`*[arg]=[vt+0x68]结果`） | **ACCEPT-WITH-CORRECTIONS**；R13 报告 §1 已改写 |
| 2 | 0x5042D204 "47 项单表" | 构造器 0x504013E3 证明为**虚表组**（外层+两内层接口，各带 QI/AddRef/Release）；47 只是连续 .text 指针计数 | **ACCEPT-WITH-CORRECTIONS**；R13 报告 §3/§5 已改写并记 REFUTED |
| 3 | fh+0x40 命名 "tmax" | 该字段是段长 **len**（t 参数化按长度 clamp [0,len]；+0x30/+0x38 为方向分量/单位方向候选） | **ACCEPT-WITH-CORRECTIONS**；G38 §0/§2.3、G40 全文已改 |
| 4 | 0x9BF9D3 沿用 "edge finder" 标签 | 实为**地图水平边界钳制+部分步长**（worldX=round(t)·m1+x1 vs [M+0x138/0x140]） | **ACCEPT-WITH-CORRECTIONS**；G40 §3 已改（t080 标签同样作废） |
| 5 | 0x9BF1FA arg1 标注 "速度对象" | arg1 是**源线状态 2 槽基**（{t, speed}），非纯速度；分支条件基于 src.t 与 line.t 关系 | **ACCEPT-WITH-CORRECTIONS**；G40 §1 已改 |
| 6 | 同图重绑"由 0x9BF1FA 家族完成" | 0x9BF1FA 内**无碰撞查询**（纯参数化行走）；ctx 重建宿主是 **0x9BE703**（slot4 物理循环，0x9BE853–0x9BE888 扫掠盒） | **ACCEPT-WITH-CORRECTIONS**；G38 §1.4 已改 |
| 7 | G40 无邻接掉落路径 PARTIAL（窗口只到 0x9BF422） | 完整出口：t 钳端点、速度插值、当前 ctx 重投影、**vt+0x14(M,NULL)**、ret 1；函数内无状态切换 | **ACCEPT（合并窗口）**；G40 §1 L_over 已补全 |

## 3. 主 Agent 独有贡献（Reviewer 盲审未覆盖，双方无冲突）

| 子行为 | 证据 | 裁决 |
|---|---|---|
| opcode 0xCF dispatch 绑定：switch@0x9571BF（opcode∈[0xCF,0xEC]）case0→0x9658CC | 0x9571C5–0x9571D3 + 表 0x95732E | **VERIFIED（DIRECT-INSTRUCTION）** |
| 0x953FA5 = 外观/动画复位（非移动复位） | 0x6A05FF/0x6A0545 setter 家族 + fieldctx 字符串槽 | **VERIFIED（负结论）** |
| [user+0x3C0] 写入者（packet byte movzx @0x98CFF2；回写 @0x98D077） | 0x98CFB0–0x98D07D | **VERIFIED** |
| 地图边界源：0x9BC602 复制 [0xBDD498]+0x24 → M+0x138..0x144 | 0x9BC602–0x9BC621 | **VERIFIED**（与 Reviewer 的 0x9BF9D3 边界消费端互证） |
| C-056 端点槽名/方向修正（top−5/bottom+1） | 0x9D817F–0x9D81F6 + 0xA4FC6F 窗口条件 + FSDB y1<y2 | **VERIFIED（数值）/ DERIVED（槽名，loader 侧未直读）**——Reviewer 复确认了数值与 3.0 常量，未对槽名表态；按 loader 未直读降级为 DERIVED |
| FSDB 13 图覆盖清点（fh 2154 全带 prev/next；ladder 14/rope 2/seat 12；degenerate NOT PRESENT） | content/[FSDB]adventure/[group]map.* | **DIRECT-DATA** |

> **t083 correction footnote (F1/F3)**: two numbers in this historical review record were corrected after t082 acceptance — (1) the fh census is **2283** records, not 2154 (t083 machine recount, `research/scripts/t083_fsdb_manifest.py` + `T083-FSDB-MANIFEST.txt`); the ladder/rope/seat/degenerate counts were re-confirmed unchanged; (2) the halfWidth census below (§1 row "halfWidth 逐调用点") was superseded by the t083 full re-audit: 23×1 + 1×2, 0 dynamic, 0 undecodable (`T083-A4F6F1-CALLSITE-AUDIT.txt` / EV-57). This archive records what was agreed AT t082 and is retained as audit history.
| 0x81→0x97EBC9 最后一环 OPEN-STATIC 的缺失项刻画（handler vtable×15 无 imm 引用） | 0xB01414 等 dword 普查 | **OPEN-STATIC（如实登记）** |

## 4. Reviewer 独有贡献（主 Agent 未覆盖，已并入报告）

1. 0x6B87D1/0x6B8701/0x6B8949 记录族结构（0x14 字节记录、X/Y word、fh id=word[ctx+0x48]、绳 id=−word[rope]）。
2. 0x9D7ADA（0xB0CC78 slot10）抓绳完整键位判定：DOWN 盒 [X±10]×[Y−20,Y]、UP 盒 [X±10]×[Y,Y+10] + 绳顶可达门 + 互斥 + **ctx 替换为绳记录（非清除）** + X←rope.x、Y←顶/min、双速度清零。
3. **静态张力（OPEN）**：紧凑绳记录（stride 0x1C）作为 slot5 arg1 时，0x9BFB52 的 [arg1+0x1C]/[+0x20] hint 读取落在邻条目——两种解释 + 可推翻条件（运行时 dump [M+0x130/0x134] @绳抓）。
4. hint 消费者全量普查：仅身份比较（0x9BE913/0x9C5E32/0x9CCBED），从不喂查询坐标（反证搜索为空）。
5. 0x9BC622 步骤 10：a1≠0 时 [M+0x190]=[Physics+0xAC] 再播种（C-030 互证）。
6. C-005 intmap 所有权精化（intmap@0x5042D1E0 由 0x5042D204 类 QI 消费；0x5042D140 slot0-2 是 this−4 thunk）。
7. 0x9BC622 无 ctx 路径写 [M+0x130]=7 是 stale-eax 编译器伪影（0x9BC6D6 push 7/pop eax）。

## 5. 历史Claim 冲突裁定

| Claim | 裁决 |
|---|---|
| C-054（同图链） | 无冲突；本轮增补 [M+0x110] 清零与 0x9BE703 重建（C-061 承载） |
| C-055（跨图链） | 无冲突（参数表一致）；"hint 拷贝+rebind" 的条件语义由 C-062 精确化（跨图路径恒不执行） |
| C-056（climb 端点） | 数值/常量复确认；槽名标签修正以新 Claim 承载（DERIVED，不撤回 C-056） |
| C-057（座位） | 本轮未触碰 |
| C-058（halfWidth 参数） | 深化为逐调用点审计表（C-072），无冲突 |
| C-029/C-030 | Reviewer 复确认（slot4=0x9BE703=C-029 m4；Physics 再播种=C-030） |
| C-005 | intmap 所有权精化（位置表述不变，归属修正），无撤回 |
| P4-04 / C-055 RE-READY 子行为 | 本轮无新反证；维持 RE-READY |

## 6. 最终裁决汇总

- **WP1（G38）**：ACCEPT-WITH-CORRECTIONS——A/B/C/D 四子行为闭合（D 中 0x81 注册保持 OPEN-STATIC），E Camera 未开始。G38 维持 PARTIAL-STATIC（范围重划）。
- **WP2（G40/G41）**：ACCEPT——0x9BF1FA 完整链、抓绳/离绳/设段安装器闭合；张力项（绳记录 hint）与 ladder/rope 分叉保持 OPEN。G40/G41 维持 PARTIAL-STATIC（范围大幅缩小）。
- **WP3（R13/G24/G27）**：ACCEPT-WITH-CORRECTIONS——[ebp-0x20] 裁定、slot45 key 参数闭合；"47 项单表"表述 REFUTED 并更正为虚表组；运行时身份保持 OPEN-RUNTIME（最小捕获规格已固化）。
- **未解决重大异议**：无。唯一登记张力 = 绳记录 hint 读取（已入 OPEN-RUNTIME 清单，附最小 dump 规格）。
- **G38 整体**：PARTIAL-STATIC（E Camera + 0x81 注册 + 首帧建段函数完整体未闭合前不得 CLOSED）。

## 7. Reviewer 质量门禁核对（§十一 清单）

1. 源哈希独立核验 ✓（盲审报告头部）2. 指令窗口完整 ✓（40+ 窗口文件）3. 参数栈未误读（两处错位由对抗审互纠）✓ 4. 异常分支未忽略（无邻接掉落路径、E_FAIL、HRESULT 门均覆盖）✓ 5. 虚表候选逐一排除/登记 ✓ 6. 13 图数据未外推（NOT PRESENT 项如实标注）✓ 7. Claim 等级复核（DERIVED 降级两处）✓ 8. Gap 状态与剩余问题一致 ✓ 9/10. 矩阵/Readiness 更新（见台账提交）✓ 11. C-053 无冲突 ✓ 12. Frozen ABI / Clean-Room 未触碰 ✓
