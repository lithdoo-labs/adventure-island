# DLL / COM Runtime Round 4（DLL-COM-ROUND4）

日期: 2026-11-13。

## 已闭合维持

ATL 技术栈 + 32 RTTI 类名 + 7 intmap + 22 slot45 全分类 + PCOM 名字类标识 + 工厂链。**全部维持。**

## 本轮增量

### 伪虚表修正

Gr2D 0x2F530（120 槽）= **字符串表**（slot45 0x3022C 指向 ASCII "colors" 等）——全 DLL 虚表清单修正为 **21 张真虚表**（0x2F530 移除）。

### 属性 put/get 跨 DLL 同构族

| DLL | 虚表 | put 偏移 | get 偏移 |
|---|---|---|---|
| Gr2D（Layer）| 0x2D140 slot25/26 | +0xCC | +0xD0 |
| Gr2D（Canvas 族）| 0x367B8 slot45 区域 | — | — |
| Canvas | 0x270E4 slot45 | **+0x8C** | **+0x90** |

**同构模式 = ATL CComDispatchDriver 属性绑定的类级实例化**（B 级——不同偏移证明不同类属性集，相同代码生成模式）。

### 栈封装调用通道（Obj 路径发现）

Obj 路径的 `mov ecx,esp; mov [ebp+0x30],esp; push; call` 模式 = **CComVariant 栈式调用**（ATL 的栈封装 Invoke 变体）——第三种分派通道（虚表直调 / 属性 PUT 包装 / 栈封装），完整 PCOM 调用面分类（B 级）。
