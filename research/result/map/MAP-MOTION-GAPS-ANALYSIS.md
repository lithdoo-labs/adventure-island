# 移动物理缺口分析 — Ghidra 反编译视角

日期: 2026-11-10

## 1. 跳跃竖直速度（0x9BCFED = Ghidra RVA 0x5BCFED）

反编译代码揭示的关键算式：

```c
// 0x9BD088 处的竖直速度写入:
//   this 是移动对象（movable），字段偏移按 int* 索引（×4）

int footholdMgr = *(int*)(DAT_00bdd498 + 8);
double speedParam = FUN_006a0545();  // decrypt WZ double

// 公式:
verticalVel = (footholdMgr[0x70/4] * DAT_00b0c590) / speedParam;
this[0x1e] = verticalVel;  // +0x78 写入（解密后的速度）
this[0x18] = 0;           // +0x60 水平速度清零
```

**解**: `DAT_00b0c590 = -0.35355339`（已知常数）。
`footholdMgr+0x70` 是全局物理参数之一（WZ Physics.img 的字段）。
`FUN_006a0545` 解密 `[move+0x190]+0x24` 处的 WZ double。
所以公式为: `v = (gravityParam × -0.35355339) / jumpParam`

**字段名映射**（推断，非字符串证实）:
- `[footholdMgr+0x70]` → `gravityAcc`（重力加速度）
- `decrypt([move+0x190]+0x24)` → `jumpSpeed`（跳跃初速度相关）
- `DAT_00b0c590 = -0.35355339` → `-√2/4`（方向系数）

## 2. 主物理函数（0x9BD0D9 = Ghidra RVA 0x5BD0D9）

这个函数处理陆跳和水中跳的分叉。

反编译揭示三个分支：

```c
// 分支 A: 普通陆跳（param1=0, param2=0, 移动中）
//   水平速度公式:
speedParam = FUN_006a0545();  // decrypt [move+0x190]+0x18
walkParam  = FUN_006a0545();  // decrypt [move+0x198]+0x6C
global48   = *(double*)(footholdMgr + 0x48);
horizontalVel = -(walkParam * global48 * speedParam * 5.0);
this[0x1e] = horizontalVel;  // 写入 +0x78

// 分支 B: 有乘骑（this[0x54] != 0）
//   同样写 +0x78 但额外乘 this[0x54]
rideFactor = this[0x54];  // +0x150 的整数化（可能是 swim）
horizontalVel = -(jumpSpeed * gravityAcc * 0.3_or_0.5 * rideFactor * 1.3);

// 分支 C: 水中跳（else 分支，0x9BF6EC 路径）
jumpParam  = FUN_006a0545();  // decrypt
speedParam = FUN_006a0545();  // decrypt
verticalVel = -(jumpParam * gravityParam) / speedParam;
this[0x1e] = verticalVel;
// 如果 param1 != 0，再乘 0.7 (DAT_00b06458)
```

**字段映射（推断）**:
- `decrypt([move+0x198]+0x6C)` → `walkForce`（行走力）
- `*(double*)(footholdMgr+0x48)` → 全局行走参数
- `*(double*)(footholdMgr+0x58)` → 全局速度参数
- `*(double*)(footholdMgr+0x70)` → `gravityAcc`
- `*(double*)(footholdMgr+0x90)` → 额外速度因子
- `DAT_00b04f40 = 5.0` → 行走力放大系数
- `DAT_00b06458 = 0.7` → 二次跳衰减
- `DAT_00b064b0 = 1.3` → 水中跳放大
- `DAT_00afec18 = 0.8` → 速度上限因子
- `DAT_00b05538 = 0.3` → 水中跳方向系数 A
- `DAT_00afec20 = 0.5` → 水中跳方向系数 B

## 3. 速度积分函数（0x9BD58F = Ghidra RVA 0x5BD58F）

```c
// param_1 是移动对象
double horizontalVel = *(double*)(obj + 0x60);  // +0x180
double verticalVel   = *(double*)(obj + 0x62);  // +0x188 (×4=+0x188)

// 读取解密后的当前速度
double currentH = FUN_00548806(obj + 0x14, obj[0x18]);  // 读 +0x50/+0x60

// 速度限制逻辑:
// 如果 horizontalVel > 0 且 currentH > horizontalVel:
//   currentH = horizontalVel + currentH  → 但有溢出保护
//   写回 +0x50 (校验在 +0x60)
// 同样处理 verticalVel → +0x68/+0x78
//
// 最后: 取整（ftol）并写回
```

**解**: +0x180 和 +0x188 是**速度上限**（speed cap），不是加速度。
这个函数是速度钳制器，不是逐步积分。
真正的积分在别处（可能在每帧调用链的其他环节）。

## 4. 坐下/蹲下写入（0x952F1F = Ghidra RVA 0x552F1F）

```c

void __thiscall FUN_00952f1f(int *param_1,int param_2)

{
  int iVar1;
  uint uVar2;
  int *local_8;
  
  local_8 = param_1;
  if (param_2 == 0) {
    iVar1 = FUN_0096c96b();
    if (iVar1 != 0) {
      return;
    }
    iVar1 = FUN_0095306d();
    if (iVar1 != 0) {
      return;
    }
    uVar2 = FUN_00451b00();
    if (uVar2 < 0x80000000) {
      return;
    }
    iVar1 = FUN_00952a38();
    if (iVar1 != 0) {
      return;
    }
  }
  iVar1 = FUN_005024c5();
  if ((iVar1 == 0) && (iVar1 = FUN_004376f2(), (*(byte *)(iVar1 + 0x13c) & 1) != 0)) {
    return;
  }
  iVar1 = FUN_0070df65();
  if ((iVar1 != 0) ||
     (iVar1 = (**(code **)(*(int *)(-(uint)(param_1[0x3ca] != 0) & param_1[0x3ca] - 0xcU) + 8))(),
     iVar1 != 0)) {
    iVar1 = FUN_00994c7a();
    if (iVar1 - param_1[0xbb4] < 300) {
      return;
    }
    iVar1 = FUN_00994c7a();
    param_1[0xbb4] = iVar1;
  }
  *(undefined4 *)((-(uint)(param_1[0x3ca] != 0) & param_1[0x3ca] - 0xcU) + 0x158) = 1;
  iVar1 = (**(code **)(*param_1 + 8))();
  iVar1 = FUN_00416de8(iVar1 + 0xbbc,*(undefined4 *)(iVar1 + 0xbc4));
  if ((iVar1 != 0) && ((param_1[0xf0] & 0xfffffffeU) != 0x12)) {
    iVar1 = FUN_00994c7a();
    param_1[0xbb3] = iVar1;
  }
  iVar1 = (**(code **)(*param_1 + 0x40))();
  if (iVar1 / 1000 == 2) {
    param_2 = FUN_00994c7a();
    param_2 = param_2 + 0x3c;
    local_8 = (int *)0x1407329;
    FUN_004f7cfc(&local_8,&param_2);
  }
  return;
}


```

## 5. 下跳门控（0x95308C = Ghidra RVA 0x55308C）

```c

void FUN_0095308c(void)

{
  int *piVar1;
  undefined4 uVar2;
  int iVar3;
  uint uVar4;
  undefined4 *puVar5;
  undefined4 uVar6;
  int extraout_ECX;
  int unaff_EBP;
  undefined4 *unaff_FS_OFFSET;
  
  FUN_00a6fc7c();
  iVar3 = FUN_005024c5();
  if (iVar3 == 0) {
    iVar3 = FUN_004376f2();
    uVar4 = *(uint *)(iVar3 + 0x13c) >> 0x11 & 1;
    *(uint *)(unaff_EBP + -0x14) = uVar4;
    if (uVar4 != 0) goto LAB_009532c9;
  }
  iVar3 = FUN_0096c96b();
  if (((iVar3 != 0) || (iVar3 = FUN_0095306d(), iVar3 != 0)) || (iVar3 = FUN_00952a38(), iVar3 != 0)
     ) goto LAB_009532c9;
  piVar1 = (int *)(extraout_ECX + 4);
  iVar3 = (**(code **)(*(int *)(extraout_ECX + 4) + 0x10))();
  uVar6 = *(undefined4 *)(iVar3 + 4);
  puVar5 = (undefined4 *)(**(code **)(*piVar1 + 0x10))(uVar6);
  iVar3 = FUN_0071b4fd(*puVar5,uVar6);
  if (((iVar3 != 0) && ((*(int *)(iVar3 + 8) == 0xc || (*(int *)(iVar3 + 8) == 0xd)))) ||
     (uVar4 = FUN_00451b00(), uVar4 < 0x80000000)) goto LAB_009532c9;
  FUN_00994c7a();
  iVar3 = *(int *)(extraout_ECX + 0x2928);
  *(undefined4 *)(unaff_EBP + -0x14) = DAT_00bdd498;
  if ((iVar3 != 0) ||
     (uVar4 = -(uint)(*(int *)(extraout_ECX + 0xf28) != 0) & *(int *)(extraout_ECX + 0xf28) - 0xcU,
     *(int *)(uVar4 + 0x110) == 0)) goto LAB_009532c9;
  puVar5 = (undefined4 *)(**(code **)(*piVar1 + 0x10))();
  uVar6 = *puVar5;
  uVar2 = puVar5[1];
  *(undefined4 *)(unaff_EBP + -0x18) = 0;
  *(undefined4 *)(unaff_EBP + -0x2c) = uVar6;
  *(undefined4 *)(unaff_EBP + -0x28) = uVar2;
  iVar3 = *(int *)(uVar4 + 0x110);
  *(undefined4 *)(unaff_EBP + -4) = 0;
  *(int *)(unaff_EBP + -0x20) = iVar3;
  if (iVar3 != 0) {
    (*DAT_00afe1bc)(iVar3 + 4);
  }
  *(undefined1 *)(unaff_EBP + -4) = 1;
  iVar3 = FUN_0096e48b();
  if (iVar3 == 0) {
    *(int *)(unaff_EBP + -0x28) = *(int *)(unaff_EBP + -0x28) + 300;
    uVar6 = FUN_00a4f609(*(undefined4 *)(unaff_EBP + -0x2c),*(undefined4 *)(unaff_EBP + -0x28),
                         unaff_EBP + -0x10,0x80000000);
    FUN_0096e327(uVar6);
    if ((*(int *)(unaff_EBP + -0x18) == 0) ||
       (*(int *)(unaff_EBP + -0x18) == *(int *)(unaff_EBP + -0x20))) {
      uVar6 = FUN_00a4f6f1(*(undefined4 *)(unaff_EBP + -0x2c),*(int *)(unaff_EBP + -0x28),
                           unaff_EBP + -0x10,*(int *)(unaff_EBP + -0x28) + 300,1);
      FUN_0096e327(uVar6);
    }
    iVar3 = (**(code **)(*piVar1 + 0x10))();
    if ((*(int *)(iVar3 + 4) + -5 < *(int *)(unaff_EBP + -0x10)) &&
       (iVar3 = (**(code **)(*piVar1 + 0x10))(),
       *(int *)(unaff_EBP + -0x10) < *(int *)(iVar3 + 4) + 5)) {
      if (*(int *)(unaff_EBP + -0x18) != 0) {
        FUN_005117d1(0);
        *(undefined4 *)(unaff_EBP + -0x18) = 0;
        goto LAB_0095327f;
      }
    }
    else {
LAB_0095327f:
      if (*(int *)(unaff_EBP + -0x18) != 0) {
        *(undefined4 *)(extraout_ECX + 0x2928) = 1;
        *(undefined4 *)(extraout_ECX + 0x292c) = *(undefined4 *)(uVar4 + 0x110);
        FUN_00940011(1,1);
      }
    }
    *(undefined1 *)(unaff_EBP + -4) = 
```

## 6. 攻击分派器（0x95C5B2 = Ghidra RVA 0x55C5B2，58KB）

这个函数太大（58KB），只展示前 3000 字符:

```c

/* WARNING: Removing unreachable block (ram,0x0095ee81) */
/* WARNING: Removing unreachable block (ram,0x0095ed7c) */
/* WARNING: Removing unreachable block (ram,0x0095ef9f) */

undefined4 FUN_0095c5b2(void)

{
  undefined1 uVar1;
  undefined4 uVar2;
  int iVar3;
  undefined4 *puVar4;
  uint uVar5;
  int iVar6;
  int iVar7;
  int *piVar8;
  undefined4 uVar9;
  undefined4 extraout_ECX;
  int extraout_ECX_00;
  int extraout_ECX_01;
  int extraout_ECX_02;
  int extraout_ECX_03;
  int extraout_ECX_04;
  int unaff_EBP;
  undefined4 *unaff_FS_OFFSET;
  float10 fVar10;
  undefined4 uVar11;
  undefined4 uVar12;
  undefined4 uVar13;
  undefined4 uVar14;
  undefined4 uVar15;
  undefined4 uVar16;
  undefined4 uVar17;
  int iStack_28;
  int iStack_24;
  int iStack_20;
  int iStack_1c;
  
  FUN_00a6fc7c();
  FUN_00a70270();
  *(undefined4 *)(unaff_EBP + -0x1820) = extraout_ECX;
  *(undefined4 *)(unaff_EBP + -0x1294) = 0;
  if ((DAT_00be2570 & 1) == 0) {
    DAT_00be2570 = DAT_00be2570 | 1;
    DAT_00be256c = FUN_00769b51();
  }
  if ((DAT_00be2570 & 2) == 0) {
    DAT_00be2570 = DAT_00be2570 | 2;
    DAT_00be2568 = FUN_00769b51();
  }
  *(undefined **)(unaff_EBP + -0xbf4) = PTR_PTR_00bd9028;
  uVar2 = FUN_00426f51();
  *(undefined4 *)(unaff_EBP + -0x1298) = uVar2;
  *(undefined4 *)(unaff_EBP + -0xc50) = *(undefined4 *)(*(int *)(unaff_EBP + -0x1298) + 4);
  if (*(int *)(unaff_EBP + -0xff8) != 0) {
    FUN_00429e8b();
    *(undefined4 *)(unaff_EBP + -0xff8) = 0;
  }
  *(undefined4 *)(unaff_EBP + -0xc04) = *(undefined4 *)(unaff_EBP + -0xc50);
  *(int *)(unaff_EBP + -0xbd8) = *(int *)(unaff_EBP + -0xbf4) + 0x2098;
  *(int *)(unaff_EBP + -0xc4c) = *(int *)(unaff_EBP + -0xbf4) + 0x2110;
  uVar2 = FUN_00994c7a();
  *(undefined4 *)(unaff_EBP + -0xc70) = uVar2;
  *(undefined4 *)(unaff_EBP + -0x129c) = *(undefined4 *)(*(int *)(unaff_EBP + -0x1820) + 0x348);
  uVar2 = FUN_00460061();
  *(undefined4 *)(unaff_EBP + -0xc6c) = uVar2;
  if (*(int *)(unaff_EBP + 8) == 0) {
    *(undefined4 *)(unaff_EBP + -0x1824) = 0;
  }
  else {
    *(undefined4 *)(unaff_EBP + -0x1824) = **(undefined4 **)(unaff_EBP + 8);
  }
  *(undefined4 *)(unaff_EBP + -0xbec) = *(undefined4 *)(unaff_EBP + -0x1824);
  if ((*(int *)(unaff_EBP + 8) == 0) ||
     ((**(int **)(unaff_EBP + 8) != 0x3ee1ab && (**(int **)(unaff_EBP + 8) != 0x40684b)))) {
    *(undefined4 *)(unaff_EBP + -0x1828) = 0;
  }
  else {
    *(undefined4 *)(unaff_EBP + -0x1828) = 1;
  }
  *(undefined4 *)(unaff_EBP + -0xd58) = *(undefined4 *)(unaff_EBP + -0x1828);
  if ((*(int *)(unaff_EBP + 8) == 0) || (**(int **)(unaff_EBP + 8) != 0x4e23ea)) {
    *(undefined4 *)(unaff_EBP + -0x182c) = 0;
  }
  else {
    *(undefined4 *)(unaff_EBP + -0x182c) = 1;
  }
  *(undefined4 *)(unaff_EBP + -0xd54) = *(undefined4 *)(unaff_EBP + -0x182c);
  if ((*(int *)(unaff_EBP + 8) == 0) || (**(int **)(unaff_EBP + 8) != 0x4f5c6e)) {
    *(undefined4 *)(unaff_EBP + -0x1830) = 0;
  }
  else {
    *(undefined4 *)(unaff_EBP + -0x1830) = 1;
  }
  *(undefined4 *)(una
```
