# Movement / Physics Round 4（MOVEMENT-PHYSICS-ROUND4）

日期: 2026-11-13。

## 六项指定检查

### 1. +0x61 是否属于 user 结构（OPEN-STATIC 维持）

77 个 disp8 候选中 6 个 mov-b 写者 + 4 个 mov-d 写者分散在 FUN_4f2dc9/60a556/5356ac 等——**结构归属未定**（可能属 UI 缓冲/计数器/其他结构体）。不做 user 归属断言（诚实维持）。

### 2. +0x3BC 写/递减/清零

| 操作 | 证据 |
|---|---|
| 写 5000 | 9 个统一 `mov [reg+0x3BC], 0x1388`（A）|
| 读 | 8 个 cmp/mov-r（A）|
| 递减 | **全库无 sub/dec 直接形式**（A——负面证明）|
| 清零 | FUN_76F4F8 的 2 个 mov-w @0x7857B8/0x78E709（A）|

**递减机制假说（C）**：计算位移循环（`lea reg,[reg-1]` 后 mov 回）或经通用定时器数组遍历器。FUN_6292f5（透镜/HP 药水族）最近候选。

### 3. 5000 单位

0x1388 = 5000。写点含攻击分派器入口（0x935526）——**假说（C）：毫秒或 tick 计数**，帧率 50fps × 100ms = 5000（100ms 窗口）。

### 4. Physics 与 Move 同一对象？

**否（B）**：Physics 全局 0xBDD498 独立；move+0x190 ← [Physics+0xAC]（SEC16 R14 已证——跨对象字段拷贝，非同一结构）。

### 5. 加密字段

**是（A）**：全部位置/速度 = {值,键} 相邻对（14 对布局，3 处独立实证：主循环 0x5be703、清理器 0x9BC404、R9 攻击随机）。 foothold 几何 = 明文（A）。

### 6. 解密键生成

**A 级（SEC16 R9 已闭合）**：
```
key = xorshift/MT 状态@0xBDF028（tempering: >>0xD &0x7FFC0 <<0xC >>6）
写: xor 0xBAADF00D 后存（0x416E36 写者）
读: FUN_00548806(value_ptr, key)
```

## MOVEMENT-FIELD-WRITERS.csv

见附件 CSV（+0x61/+0x3BC/加密对/Physics/Move 全写字段登记）。
