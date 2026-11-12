# 逐函数阅读战役 — 第四批成果

日期: 2026-11-12。

## Canvas 桥接函数 (FUN_5001ef78, 8.6KB) — WZ Property → Canvas 反序列化

这是 wzpy 解析的**客户端原版实现**：

```c
deserialize(canvas, wzProperty):
    stream = open_wz_stream(wzProperty)         // ZIStream = WZ 节点数据流

    lock(canvas+0x80)                           // 图像缓存互斥锁
    if (canvas+0x88 != 0)                       // 已有子属性
        re-read(canvas+0x88, stream)             // 刷新

    // 读 Property 子节点（u_Property 字符串标签在此！）
    if (stream.find('Property'))
        deserialize(canvas+0x88, Property)       // 递归

    // 核心分叉：
    if (canvas.width && canvas.height)           // 有尺寸 → 读像素数据
        pixel_data = FUN_5001f975(canvas, stream)  // 像素加载
        width  = read_int(stream)
        height = read_int(stream)
    else                                         // 无尺寸 → 读 origin 坐标
        origin_start = read_int(stream)
        origin_end = read_int(stream)
        data_size = origin_end - origin_start - 4
```

**关键发现**：
1. **ZIStream = WZ 数据流读取器**（客户端原版等价于 wzpy 的 reader）
2. `canvas+0x80` = 图像缓存锁、`+0x88` = 子属性指针
3. `u_Property` 字符串在此函数使用 → **WZ Property 节点的运行时反序列化点**
4. origin 的读取方式：从流中读 start/end 对计算大小

## Gr2D-Canvas 桥接 (0x5000418c, 13KB, 98 callers)

98 个调用者 = 最被依赖的桥接函数。引用 'Canvas' 字符串。
信号：`FUN_50020ff0`（流检查）→ `FUN_5000c070`（获取子属性）→ `FUN_5001f975`（像素加载）
该函数是**渲染管线的画布获取入口**——所有绘制都通过它拿 Canvas 对象。

## Gr2D 初始化守卫 (0x500030d3, 9KB)

有 'Already_initialized' 字符串 → 初始化幂等检查。
确保 Direct3D 只创建一次。

## 维度推进

| 维度 | 发现 | 进度 |
|---|---|---|
| 渲染 | Canvas 反序列化器解码 = wzpy 客户端原版确认；Gr2D-Canvas 桥=98 调用枢纽 | 42→**45%** |
| **整体** | | **71.2→71.8%** |
