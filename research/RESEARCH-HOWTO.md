# 逆向工程操作手册（新 Agent 从零开始指南，2026-11-11 修订）

## 第〇步：铁律（先读，历史上栽过 4+ 次）

1. **VA/RVA 换算**：用户指令级文档用 **VA**（如 0x9BD58F），Ghidra CSV 键是
   **RVA**（0x5BD58F）。换算：`RVA = VA - 0x400000`。映像内 `文件偏移 == RVA`。
   校准锚点：UTF-16 字符串 "walkForce" 在 Ghidra 0xBD40FC = 文件偏移 0x7D40FC。
2. **Ghidra 指针渲染**：指针被当作 `int*`，结构偏移除以 4。
   `+0x190` 显示为 `[x + 0x64]`，`+0x150` 显示为 `[x + 0x54]`。
3. **加密存储**：位置/速度/绳几何等运行时数据**全部加密存储**
   （0xBAADF00D 滚动密钥族）。搜明文偏移赋值永远找不到，必须找
   `FUN_00548806`（读）/`FUN_006131F4`（写）调用点。
4. **符号基准约定**（子 agent 验证时踩过）：反编译正文里的 `FUN_xxxxxxxx`、
   `u_名字_地址`、`DAT_xxxxxxxx` 都是 **VA**；CSV 键是 **RVA**。
   例：正文 `FUN_00a4d393` → CSV 键 `'0x64d393'`；`FUN_00548806` → 键 `'0x148806'`。
   加密原语名同理：`FUN_00548806` 的键是 `'0x148806'`。
5. **证据分级**（写结论时必须标级）：
   - **A 级** = 指令级反汇编（用户 capstone 记录，research/result/map/MAP-MOTION-REVERSE.md 等）
   - **B 级** = 反编译推导 + 独立证据交叉（运行时转储数值、WZ 数据对照）
   - **C 级** = 仅反编译推导（只能作假设）
   与指令级记录冲突的 C 级结论一律撤回（先例见 MAP-GAPS-FINAL-CLOSURE.md 修订记录）。

## 第一步：资产地图（全部实际存在，路径已逐一验证）

| 资产 | 位置 | 说明 |
|---|---|---|
| 反编译全集 | `E:\ghidra-projects\decompiled_v2.csv` | 52,326 函数，列 rva/decompiled |
| 解壳游戏体 | `.work/task-036/game-image-unpacked.bin` | 10.3MB，RVA==偏移，基址 0x400000 |
| 运行时内存转储 | `E:\vm-store\task-036-captures\t036-mem.elf` | 2GB QEMU 物理转储（物化后） |
| VA→物理页映射 | `.work/task-036/proc-vamap.csv` | 上一转储专用，列 va,pa |
| 原始客户端 | `.work/task-001/extracted\冒险岛online\` | WZ 二进制 + MapleStory.exe 等 |
| wzpy 第三方库 | `.work\tools\wz-python\` | **region='EMS'**，直接解原始 WZ |
| FSDB 提取数据 | `E:\ai-local-wz-fsdb\full\[FSDB]cms\` | 全量 WZ 结构化（键按字母序=WZ 原序） |
| 服务端 Java 源 | `E:\t055-decompiled\` | 364 文件（CFR 反编译） |
| 恢复的服务器 | `E:\vm-store\t063-server\079V5\` | 可运行（MySQL+JAR），见 MAP-CAPTURE-CAMPAIGN-063.md |
| VM/QEMU 设施 | `E:\vm-store\task-024-vm\` + docker 容器 task024-qemu | Win7x86 快照 win7x86-clean |
| 本会话脚本 | `.work\task-063\` | vmio.py 等；分析脚本见下 |

⚠️ 旧文档里 `.work/task-002/server/079V5/wz/`（XML WZ）**已不存在**（目录空）。
二进制 WZ 用 wzpy；结构化查询用 FSDB。

## 第二步：读已有成果（按序）

1. `research/README.md` — 总览
2. `research/RESEARCH-FINDINGS.md` — 已知什么（公式以其中指令级条目为准）
3. `research/result/map/MAP-GAPS-FINAL-CLOSURE.md` — **缺口终局状态（证据分级）**
4. `research/RESEARCH-GAPS.md` — 剩余缺口
5. `research/result/map/MAP-MOTION-REVERSE.md` — 指令级物理/移动记录（最高权威）

## 第三步：标准操作配方（全部验证过）

### 3.1 查反编译代码
```python
import csv
csv.field_size_limit(50 * 1024 * 1024)
fns = {}
with open(r'E:\ghidra-projects\decompiled_v2.csv', encoding='utf-8') as f:
    for row in csv.DictReader(f):
        fns[row['rva'].lower()] = row.get('decompiled', '')
# 键 = RVA 小写十六进制字符串（'0x55c5b2'）
code = fns.get('0x55c5b2', '').replace('\\n', '\n')
```
- 字符串常量以 `u_名字_地址`（UTF-16）/`s_名字_地址`（ASCII）标签出现。
  用它找 WZ 属性名（成功先例：Physics 20 个名字全靠 u_ 标签）。
- 按地址找包含函数：把 RVA 排序后 bisect。

### 3.2 解析原始 WZ（二进制）
```python
import sys
sys.path.insert(0, r'.work\tools\wz-python')
from wzpy import WzFile
wz = WzFile.open(r'.work\task-001\extracted\冒险岛online\Character.wz', region='EMS')
root = wz.root
# root.images / root.subdirs 是名字字符串列表；对象用 root.get(path)
img = root.get('00002000.img')
children = img.parse().children()   # children 可能是方法，callable 判断
names = [c.name for c in children]
```
- 节点顺序 = 文件物理顺序（Character.wz 为字母序）。
- 已验证：00002000.img 顶层 149 节点 = 二进制动作表 149 槽（数量级）。

### 3.3 内存转储分析（t036-mem.elf）
```python
# 1) ELF64 PT_LOAD → (file_off, paddr, size) → pa2off(pa)
# 2) vamap = {int(va,16): int(pa,16)} from .work/task-036/proc-vamap.csv
# 3) read_va(va, n): 按页查 vamap → pa2off → 读文件
```
- 全局变量读法：`read_u32(0xBDDB10 + i*0x18)` 直接拿运行时值。
- **动作表名字提取链**（已验证）：表 entry+0 → 动画对象；对象+0x00 的目标 =
  名字（短名 UTF-16 直接内联在对象 +0x14 区域，长名是指向 ASCII 的指针）。
  逐槽实现在 `research/result/map/MOTION-SLOT-NAMES.csv`。
- 另有一类 `{u32 0x1d, 1, len, len, name[]}` 记录出现在堆字符串区
  （名字堆存储格式），两种都要认得。
- **新转储需重新走页表**：用 `.work/task-063/build_vamap.py`（PAE DTB 枚举+
  PE 数量评分，m5f 方法的可复用版）。

### 3.4 加密原语（定位数据流的关键）
| 函数 | 作用 |
|---|---|
| `FUN_00548806(ptr, key_dword)` | 解密 8 字节 double（16 字节 {cipher,key} 对） |
| `FUN_006131F4(value)` | 加密写（返回加密值写入槽对） |
| `FUN_005488A6` | 加密记录打包（SwimArea 矩形等） |
| `FUN_006a0545` / `FUN_00a70fbb` | WZ 属性/变换解密 |
滚动密钥初始 `0xBAADF00D`。搜数据流 = 搜这些函数的调用者/被调者。

### 3.5 关键全局地址表
| 地址 | 内容 | 转储状态说明 |
|---|---|---|
| 0xBDDB10 | 动作表（149×0x18；entry+0=动画对象→+0x00=名字） | t036 转储已填充 ✅ |
| 0xBDD498 | Physics 对象（[+8]→19 个 double，偏移×8 按加载序） | **t036 转储为 NULL**（该转储停在角色选择界面，未进图，Physics 未加载）；字段表靠静态加载函数复核（A 级），数值靠 WZ 直读（B 级）。运行时验证需进图后的新转储 |
| 0xBDF54C | field/地图对象 | 同上，转储未进图时无效 |
| 0xBE2000 | 运行时字符串表指针（名字按数字 ID，FUN_007a48d0 存取） | t036 转储 = 0x29A6FC ✅ |
| 0xBA59B8 | 攻击变体表（18×0x10 {count,frames[3]}，帧号=动作表下标） | t036 转储未持武器：类型 3/4/7/9 有值，1/2/5/6/8 空 |

### 3.6 服务器起停（验证协议/登录用）
```powershell
# MySQL（自带，宿主）
python .work\task-063\start_mysql.py        # 需要 --innodb_log_file_size=25165824
# 服务器 JAR
python .work\task-063\start_server.py       # server.Start 控制台引导
# 健康检查（15 字节 hello）
python .work\task-063\server_hello.py
# 合成客户端（登录→游戏→聊天→移动 全通）
python scripts\t056_client.py
```

### 3.7 QEMU/VM（仅授权捕获，失败教训全记录）
读 `research/result/map/MAP-CAPTURE-CAMPAIGN-063.md`：基础设施全套已搭好，
但存在未解决的自旋锁死（F2），下次尝试方向也已列出。**优先静态路径**。

## 第四步：产出规范

- 新发现写 `research/result/<域>/`，结论标证据级别
- 与既有记录冲突时：以 A 级为准，修订文档并在提交信息注明撤回内容
- 工具脚本放 `scripts/`（可复用）或 `.work/task-XXX/`（过程性）
- `.work/` 与二进制**永不入库**；`research/` 与 `scripts/` 才提交
