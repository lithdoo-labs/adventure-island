# 水中跳合成报告

## swim 检查器 (VA 0x70DF65) 的 16 个直接调用者

- `0x30de45` (1361 ch): 纯调用
- `0x53d1ba` (1369 ch): 纯调用
- `0x548b66` (1928 ch): 纯调用
- `0x552f1f` (1424 ch): 纯调用
- `0x553fa5` (8526 ch): 纯调用
- `0x55c5b2` (57191 ch): 含物理全局
- `0x55fe76` (53763 ch): 含物理全局
- `0x576947` (1178 ch): 纯调用
- `0x5775af` (14702 ch): 纯调用
- `0x579aa8` (470 ch): 纯调用
- `0x57a00a` (2733 ch): 纯调用
- `0x5bd0d9` (5511 ch): ★含swimSpeed乘法+加密写
  关键行:
    iVar1 = FUN_006131f4((double)(fVar4 + fVar4));
    fVar4 = fVar4 * (float10)*(double *)(*(int *)(DAT_00bdd498 + 8) + 0x48) *
    iVar1 = FUN_006131f4((double)-fVar4);
    iVar2 = FUN_006131f4((double)-(((float10)*(double *)(unaff_EBP + -0x24) *
    iVar1 = FUN_006131f4((double)(fVar4 * (float10)_DAT_00b06458));
    iVar1 = FUN_006131f4((double)((float10)extraout_ECX[0x54] *
- `0x5bd455` (425 ch): 纯调用
- `0x5bd757` (13848 ch): 含物理全局
- `0x5bdf18` (9099 ch): ★含swimSpeed乘法+加密写
  关键行:
    fVar11 = fVar11 * (float10)*(double *)(*(int *)(DAT_00bdd498 + 8) + 0x48);
    iVar8 = FUN_006131f4((double)((fVar11 + (float10)local_14) * (float10)dVar6 *
    iVar8 = FUN_006131f4((double)((fVar11 + (float10)local_c) * (float10)dVar6 *
    iVar8 = FUN_006131f4(local_14);
    iVar8 = FUN_006131f4(local_c);
- `0x5cbe89` (17006 ch): 含物理全局

## 结论
调用者中存在同时含 swimSpeed(+0x48) 乘法与加密写(FUN_006131F4)的函数。