# NameSpace WZ 导航 API（第十四轮，指令级）

日期: 2026-11-13。124 槽接口关键方法精读。

## IUnknown 三件套（槽 0-2，指令级证实）

### slot0 = QueryInterface
```c
if (iid == {0,0,0xC0,0x46000000})   // IID_IUnknown 硬编码比较！
    { *out = this; this->vtbl[1](this); }  // 返回自身 + AddRef
else
    return interfaceMap_lookup(PTR_DAT_50817518, iid, out);  // 接口映射表
```
**IID_IUnknown 常量直接以 {0,0,0xC0,0x46000000} 四 dword 出现** = PCOM 遵循 COM 规范的直接证据。

### slot2 = Release
```c
if (InterlockedDecrement(&this[1]) == 0)   // 引用计数在 +4
    { dtor(this); heap_free(DAT_5081ebe0, this); }  // 经 DLL 自有分配器
```
分配器全局 = 0x5081EBE0（NameSpace 私有堆）。

## slot7 = ResolvePath（5,879 字符核心）

```
输入：宽字符路径
1. 跳过前导 '/'(0x2F) 或 '\'(0x5C)
2. VariantInit + FUN_50804f37(v, 0xD, ...)   ← VT 0xD 属性变体
3. 逐组件循环：
     (**(vtbl+0x10))(node, name, 0x10000, &out)   ← GetChildByName 接口调用
   分隔符：/ 和 \
   标志 0x10000（语义待定：忽略大小写/创建模式）
4. 累计解析直至路径耗尽
```

## 结论

- NameSpace 对象 = 标准 COM 引用计数对象（+0 vtable/+4 refcount）+ 私有堆
- 路径解析 = 逐组件 GetChildByName 行走（与 WZ 目录结构一一对应）
- 开发者实现：节点接口需 QI/AddRef/Release + GetChildByName(name, flags) 即可复刻

## 与驻留表互证
路径组件名（zmap.img 等）经字符串驻留表进入，ResolvePath 消费——两系统闭环。
