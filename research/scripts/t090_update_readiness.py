"""T090: append the t090 round section to the readiness report (after t089)."""
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
RP = REPO / "research/result/stage-readiness/P0-P4-READINESS-REPORT.md"

t = RP.read_text(encoding="utf-8")
if "t090 轮结论" in t:
    print("already applied")
    raise SystemExit

anchor = "## 3. 交付验收规则"
block = """> **t090 轮结论（WZ 动画时序与相机溯源）**：以 T089 归档基线 `d1dcb8b4` 为起点，全轮纯静态（WP0 勘误先行独立提交 `e9e71ba3`）。**WP0 三组权威勘误**——C-109 焦点来源修正为现行 `[[arg3]+0x14]`（旧 `[[this+0xF28]+0x14]` 降为历史推断，t090 独立字节复核）；T089 主报告矩阵统计对账修正（真实 24 行=16 MATCH 类/2 REFUTED/2 INCONCLUSIVE/1 内部 RESOLVED/3 NOT-RUN；外部候选 22 项执行 19）；Gap 审计 reviewer 状态归档（G35/G36/G37/G39/G10 → archived-ACCEPT）、G40 起始状态修正 PARTIAL-STATIC、n/a 终态替换为权威状态；EV-96 哈希随勘误注释迁移；20 项 WP0 回归测试。**G39 三残项闭合（C-117/EV-104/EV-105）**——原始 Map.wz（sha 9e0d2a0f…）帧普查 4,347 帧/475 资源：**2,450 帧显式 delay（35 种值 100..4000）**、225/329 多帧资源依赖默认——"全部 120ms"被资源反证；**animationScale 默认=1000**（累加器 0x504B9DE=[vt+0x110]@0x5042E3F0；0x504027BB 快路径）；**36 站点默认矩阵全表**（120×18 全部 imm8 `6A 78`、150×2、60×2、180×3 字节确认、1000×2、寄存器×9；portal 平面读取 0x71A72A 默认=0）；原始 portal 帧无 delay（pv=8、ph 4/7/3、仅 psh/1 delay=1500+a0/a1）；数值时间线模型。G39 维持 PARTIAL-STATIC（portal 逐帧默认未字节定位）。**G36 `+0x9C` 完整解码（C-118）**——0x514086B3 ret 0x34=矩形范围成员附加（0xFFFFFF 钳制、VARIANT 门、快路径矩形数学、共享待处理列表提交）；attach 基线文档化=运行时快照→**首帧绝对偏移静态不可证**；13 图 387 条 back 布局表。**G10 滤波消费链闭合（C-116/EV-106）**——滤波提交在共享相机创建动画 wrapper（[this+0x24]）；X/Y getter 经 0x51406ADC 解析器内联泵引擎返回**滤波坐标**（w+0x70/+0x74）；武装态立即 Set=增量存储（0x51407A34）；**scene-cull slot15 与 world→screen 结构性地消费滤波坐标**；EXE +0xA4 查询普查=0；调用表精化（C-119：8 arg3=0/2 可传对象，0x990E21/91 勘误，0x959493 调用者依赖，0x98DC43 同 [0xBDD460] 上下文）；25 残余站点诚实分类（18 POSSIBLE/7 OTHER-POSSIBLE）。G10 维持 PARTIAL-STATIC（[[arg3]+0x14] 写入者、arg3↔F28、E2/E3 相位、wrapper 持续性）。G37 随共享引擎并入资源闭合。盲审 Reviewer 四项分歧裁定（180×3 确认/120 全 imm8/arg3 表精化/getter 快路径术语统一）。Claim/Evidence/Gap = **119 / 107 / 41**（CLOSED-STATIC 26 不变——本轮零强行关闭，全部按证据边界收窄）。阶段维持 **NOT STAGE-READY**。独立 Reviewer 见 `forensics/T090-REVIEWER-INDEPENDENT.md`（盲审+对抗复审+远程复验）。

"""
assert anchor in t
t = t.replace(anchor, block + anchor, 1)
RP.write_text(t, encoding="utf-8", newline="")
print("readiness report updated")
