# R13 0x427EB3 取证复核（R31-C）

日期: 2026-11-13。

## Claim C-1：240 个调用点（未提交 CSV 声明）

**证实（A）**：exe 镜像 E8 rel32 全扫 = **恰好 240 个 call 0x427EB3**（0 个 E9 跳转）。抽样 8 个调用点反汇编确认统一模式：8 个 cdecl 参数压栈 + 调用（无 ecx 显式设置窗口内可见，ecx 由 0x427EB3 入口 `mov ebx,ecx` 消费——this 经 ecx 传入 + 8 显式栈参）。

首 12 站点：0x4278CE, 0x436FA2, 0x438131, 0x438E96, 0x43D801, 0x43E409, 0x43E9CE, 0x43F3F0, 0x44297B, 0x443F78, 0x450907, 0x450B11。

## Claim C-2：slot25 = [this+0xCC] setter（Round-3 措辞）

**修正（约定澄清，A）**：
```
50403FBE: mov eax,[esp+4]     ; arg1（第 1 显式栈参）
50403FC2: mov ecx,[esp+8]     ; arg2
50403FC6: mov [eax+0xCC],ecx  ; [arg1+0xCC] = arg2
50403FCE: xor eax,eax; ret 8
```
同族 slots 18-28 全部以 [esp+4]/[esp+8] 取参（cdecl 风格；getter 系=0x80004003 E_POINTER 守卫 + [arg1+field] 读出）。0x427EB3 调用 `[eax+0x64]` 前先 `push ebx`（层对象）——层成为 slot25 的 **arg1**。

**裁定**：Round-3 的"[this+0xCC]"措辞不准确；准确表述 = **"[arg1+0xCC]，arg1 = 包装器压入的层对象"**。功能结论（属性 PUT、非创建器）维持。

## Claim C-3：slot26 = 配对 getter（[arg1+0xD0] + AddRef）

复核维持（A）：
```
50403FD1: ecx=[esp+8](out); E_POINTER 守卫
50403FE4: eax=[arg1+0xD0]; [out]=eax; if eax: [eax->vt+4](AddRef)
```

## 残留（移交 R-09）

- [ebp-0x10]（tile 路径 0x666F7D 的 [eax+0xB4] 接收者）具体虚表：本轮 22 候选全表已录 R13-SLOT45-CANDIDATES.csv；Gr2D 0x2E2C4 族两读法均排除插入语义 → 若对象属该族则 0x666F7D 为析构/purecall（将推翻"插入"），否则属其余候选（'other' 类待读）。
