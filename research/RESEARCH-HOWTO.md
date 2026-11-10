# 逆向工程操作手册（新 Agent 从零开始指南）

## 第一步：了解游戏

你在逆向一个 **MapleStory CMS079 V5 中文私服客户端**（Windows x86 PE, Themida 加壳）。

- **目标**: 恢复客户端的完整游戏逻辑（协议/物理/战斗/UI/数据）
- **已有**: 10.3MB 解壳游戏体 + 完整服务端源码 + WZ 游戏数据
- **验证手段**: 合成客户端可以实际连接服务器并执行游戏动作

## 第二步：读取已有成果

按顺序读:
1. `research/README.md` — 总览
2. `research/RESEARCH-FINDINGS.md` — 已知什么
3. `research/RESEARCH-GAPS.md` — 还缺什么
4. `research/RESEARCH-METHODOLOGY.md` — 怎么做
5. `research/RESEARCH-TOOLS.md` — 用什么工具

## 第三步：开始工作

### 如果分析反编译代码:
```python
import csv
csv.field_size_limit(50 * 1024 * 1024)
fns = {}
with open(r'E:\ghidra-projects\decompiled_v2.csv', encoding='utf-8') as f:
    for row in csv.DictReader(f):
        fns[row['rva'].lower()] = row.get('decompiled', '')
# 注意: key 是 RVA (用户文档可能用 VA = RVA + 0x400000)
```

### 如果需要连接服务器:
```powershell
python .work\task-053\start_stack.py  # 启动 MySQL + 服务端
python scripts\t055_syn_client_v2.py   # 合成客户端登录
```

### 如果需要分析 WZ 数据:
```python
# 服务端 WZ 在 .work\task-002\server\079V5\wz\ 目录 (XML 格式)
# 直接用 ElementTree 解析
from xml.etree import ElementTree as ET
tree = ET.parse(r'.work\task-002\server\079V5\wz\String.wz\Item.img.xml')
```

### 如果需要反汇编（没有 Ghidra 时）:
```python
import capstone
md = capstone.Cs(capstone.CS_ARCH_X86, capstone.CS_MODE_32)
img = open('.work/task-036/game-image-unpacked.bin', 'rb').read()
for ins in md.disasm(img[rva:rva+100], 0x400000 + rva):
    print(f'{ins.address:08X}  {ins.mnemonic} {ins.op_str}')
```

## 关键注意事项

1. **VA vs RVA**: 用户文档用 VA (0x9BD58F), Ghidra 用 RVA (0x5BD58F = VA - 0x400000)
2. **CSV 字段限制**: `csv.field_size_limit(50 * 1024 * 1024)` 必须设置
3. **加密速度**: 速度字段通过 FUN_006131F4/FUN_00548806 加密对读写
4. **Ghidra unicode**: 反编译代码中 `u_walkForce_00bd40fc` 格式的标签名就是 WZ 属性名
5. **服务端更容易读**: Java 源码比 x86 反编译好读; 同一逻辑在两端都有实现

## 常见陷阱

- capstone 输出的跳转目标是 **VA**, 不是 RVA
- 速度写入不是直接 `+0x50 = value`, 而是经过 FUN_006131F4 加密写入
- 位置字段 +0x20/+0x38 也是加密存储的
- 有些函数不是独立函数, 而是大函数的中间地址
- Ghidra 的 `param[8]` 对应偏移 +0x20 (int* 索引 × 4)
