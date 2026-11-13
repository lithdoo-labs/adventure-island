# T082 — R13 stack-package、[ebp-0x20] 异常与 Gr2D 虚表静态清查

**Round**: t082 (2026-11-14). **Lead agent derivation** (adversarial review pending).
**Sources**: EXE `d4a67597…31718`（linear mapping）；DLL `Gr2D_DX8.dll` `ad67b9a0…f6a25d1`（PE 节表，ImageBase 0x50400000）。两者哈希本轮重验。

## 1. [ebp-0x20] 异常裁定（t080 Reviewer 遗留疑点：已解决）

所在函数区间 0x666D70–0x667000+（0x666D70 前有 `call 0xA6EF01` 尾部，函数头在其上方）。关键指令序列：

```
0x666D8F  push ecx
0x666D90  eax = esp
0x666D92  mov [ebp-0x20], esp        # 写①：栈地址借用（临时对象槽指针）
0x666D95  push 0x331; push eax; call 0x7A48D0(字符串池)   # id 0x331
...
0x666DC4  call 0x403211
0x666DC9  mov [ebp-0x20], eax        # 写②：整数结果覆盖同一槽（生命周期②开始）
...
0x666ECE  push [ebp-0x20]            # 作为 0x427EB3 的第 2 参数（整数态）
0x666ED1  push ebp-0x10
0x666ED5  call 0x427EB3              # stack-package OUT 调用
...
0x666F22  lea eax, [ebp-0x20]
0x666F25  push eax                   # ★写③：0x414A49(ebp-0x14, &[ebp-0x20]) 以 OUT 参数形式写入
0x666F2D  call 0x414A49              # （静态单看 mov 写者会漏掉的间接写者）
...
0x666FAC  mov eax, [ebp-0x20]        # 读：生命周期③（COM 对象指针）
0x666FAF  cmp eax, ebx; je skip
0x666FB7  ecx = [eax]
0x666FBA  call [ecx+8]               # Release
```

**裁定**：`[ebp-0x20]` 是**多生命周期复用槽**（Reviewer 完整写者普查：4×`mov [ebp-0x20],esp` esp-temp @0x666C2B/C6A/D25/D92 →②整数 0x403211 返回 @0x666DC9 →③COM 对象指针，**真正重写者是 0x404BA3 的 out 参数**——`0x666F22 lea/push &slot` 穿越**无参**的 0x414A49（Reviewer 验证其体为纯解引用、`ret` 无栈参数）后成为 0x404BA3 的参数，其体写 `*[arg]=[vt+0x68]结果`，随后 0x666FAC 读到对象指针并 Release @0x666FBA。0x6670D9 的写入属于 0x667055 起的另一函数帧。**非 VARIANT 布局误判（已排除：整型与指针从未同时活跃、SEH scope 字节有序）；非跨函数写入（已排除）。**（对抗审修正：主 Agent 初稿把 OUT 写者记为 0x414A49，经 Reviewer 函数体验证修正为 0x404BA3。）

**对 R13 的含义**：0x427EB3 的第 2 参数在生命周期②是**整数**（0x403211 家族返回）——支持 t080 "0x427EB3 第一参数是 OUT"之外的参数画像；该整数与 slot45 调用的 key（见 §2）是否同源，窗口内未见同一寄存器链，**不合并结论**。

## 2. slot45 调用点新证据：key 作为显式参数（0x666F7D 上下文）

```
0x666F62  (0x666F5D imul ecx,0xBB8 / 0x666F62 sub ecx,esi —— C-001 键公式指令族)
0x666F68  lea edi, [eax + ecx*2 - 0x3FFFB1EA]     # key = z + 10*(layer*3000 - zM) - 1073721834
0x666F6F  lea ecx, [ebp-0x10]
0x666F72  call 0x42944A(ecx)                       # 指针槽读取（t080 已证非 AddRef）
0x666F77  esi = eax
0x666F79  eax = [esi]
0x666F7B  push edi                                 # ★key 作为第 2 参数
0x666F7C  push esi
0x666F7D  call [eax+0xB4]                          # slot45(this=esi, key)
0x666F83  cmp eax, ebx; jge ok                     # HRESULT 门
0x666F8C  push 0xBA0510 / 0xA6EF0F                 # 失败 → 错误报告
```

**新事实（DIRECT-INSTRUCTION）**：slot45 调用携带**计算完成的数值键**作为第 2 参数（第 1 参数 this）。slot45 的候选语义进一步收窄为"按键插入/登记容器"（intmap/有序登记），**比较器假设被再次削弱**（比较器通常不接收预计算键）。0x666F83 的 HRESULT 检查（jge）+ 0xBA0510 错误 id 是此前未记录的失败分支。

## 3. Gr2D 候选虚表 0x5042D204（t080 Reviewer 遗留：全部验证通过）

DLL 节表：.text@0x50401000、.rdata@0x5042D000、.data@0x50435000…。

| 检查项 | 结果 |
|---|---|
| 0x5042D204 是合法虚表起点 | **是**：构造器 `0x504013E3`（`mov [edi],0x5042D204` @0x5040140E；第二初始化器 0x50401430；构造自 0x50401338）安装；簇内 dword 全部指向 .text |
| 表长 | **"47 项单表"被对抗审 REFUTED**：构造器证明该区域是**虚表组**——外层 0x5042D204=[this+0x00]、内层接口 0x5042D224=[this+0x10]、0x5042D210=[this+0x14]，各带 QI/AddRef/Release；47 只是簇内连续 .text 指针计数（0x5042D204–0x5042D2C0，数值正确） |
| slot +0x58 | **0x50403EFC** ✓（[0x5042D25C]） |
| 0x50403EFC 读 [this+0x28] | **是**（见下） |
| 与 0x5042D140 关系 | **分离类簇**：中间隔 ATL intmap @0x5042D1E0（{E576EA33…}、{IUnknown} IID 字节验证）；**intmap 由 0x5042D204 类的内层 QI（0x50401522→0x50401945，pEntries=0x5042D1E0）消费**——对 C-005 的所有权表述是精化（"相邻"仍真，归属 B 类）；0x5042D140 表 slot0–2 是 this−4 调整 thunk |
| 对象身份绑定 | **未建立**（构造器绑定静态成立；[0xBE2788] 运行时用哪张表仍 OPEN-RUNTIME） |

```
0x50403EFC(arg1=[esp+4]=this, arg2=[esp+8]=out):
  out==0 → return 0x80004003 (E_POINTER)
  *out = [this+0x28]
  return 0 (S_OK);  ret 8
```

紧邻的 0x50403E19 读 `[this+0x370]`、`×0x64 >> 7`（数值 getter）。二者是纯 getter stub。

**结论**：t080 Reviewer 的候选静态线索全部被独立验证；**但仅构成虚表结构证据，不构成 [0xBE2788] 对象的运行时身份绑定**。G24/G27 维持需运行时捕获，§4 给出最小规格。

## 4. 最小运行时捕获规格（[0xBE2788] slot25 绑定，G24/G27）

前置：模块 `Gr2D_DX8.dll`（SHA-256 `ad67b9a0…f6a25d1`），ImageBase 0x50400000；断点按文件内 VA 换算。

| 项 | 值 |
|---|---|
| 断点 A | EXE `0x666F77`（`mov esi,eax` 之后、push 之前）：EIP=0x666F7B 处下 0x666F77 断点，命中时记录 ESI、[ESI]（vptr）、EBP |
| 断点 B | EXE `0x427EB3` 入口：记录 ECX、[ESP+4..0x14]（OUT 指针与参数）、调用返回后 [OUT] 写前/写后值 |
| 前置条件 | 目标 13 图之一加载完成（建议 230000000：fh=240、含 type1 背景），首次渲染帧 |
| 需记录 | EIP/ESP/EBP/ECX/EAX；[0xBE2788]；实际 vptr；vptr+0x64（slot25）目标地址；slot25 入口的 [this+0x28] 读值 |
| 判别 | vptr==0x5042D204 → 候选类成立；vptr==0x5042D140 或其他 → 排除；slot25 目标与 0x50403EFC 比对 |
| 一次捕获是否足够 | 足够判别 [0xBE2788] 的单点绑定；不足以枚举所有 OUT 场景（至少再加 0x427EB3 一次带不同 key 的命中） |

（本规格经本轮静态校验：0x666F77 位于 slot45 调用直前、寄存器链已在本轮窗口确认。）

## 5. 裁决表

| 子行为 | 裁决 | 等级 |
|---|---|---|
| [ebp-0x20] 多生命周期槽复用；0x404BA3 out 为真正重写者（0x414A49 无参） | VERIFIED | DIRECT-INSTRUCTION |
| slot45 第 2 参数 = 预计算键；比较器假设削弱 | VERIFIED | DIRECT-INSTRUCTION |
| slot45 HRESULT 失败门（0x666F83 jge / 0xBA0510） | VERIFIED | DIRECT-INSTRUCTION |
| 0x5042D204 = 合法虚表起点（构造器 0x504013E3 安装）；slot+0x58=0x50403EFC 读 [this+0x28] | VERIFIED | DIRECT-INSTRUCTION + DIRECT-DATA |
| "47 项单表"表述 | REFUTED（对抗审；虚表组：外层+两内层接口表） | DIRECT-INSTRUCTION |
| intmap @0x5042D1E0 所有权 → 0x5042D204 类 QI 链（C-005 精化） | VERIFIED | DIRECT-INSTRUCTION |
| 0x5042D204 ↔ [0xBE2788] 运行时对象身份 | OPEN-RUNTIME（最小捕获规格 §4） | — |
| stack-package callee 家族（0x43286E/0x44484B/0x429411/0x43E3A6）完整体 | OPEN-STATIC（本轮预算转投 WP1/WP2；未虚报） | — |

## 6. Residual

1. 0x414A49 函数体（OUT 写入的具体对象类型）。
2. stack-package 四函数完整体（下一地址：0x43286E / 0x44484B / 0x429411 / 0x43E3A6）。
3. §4 捕获规格的执行（需运行时环境，本轮不执行）。
