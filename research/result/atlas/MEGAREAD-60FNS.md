# 终极阅读材料包（5 维度 60 函数）

## R: Gr2D_DX8 渲染引擎 top-20
```
[0x50024ae2] 35KB gfx=[] strs=[] ncalls=1
[0x5002646c] 34KB gfx=[] strs=[] ncalls=1
[0x5000da85] 22KB gfx=[] strs=[] ncalls=69
[0x5001752a] 14KB gfx=[] strs=[] ncalls=12
[0x50023801] 13KB gfx=[] strs=[] ncalls=11
[0x5000418c] 13KB gfx=[] strs=['Canvas'] ncalls=98
[0x5001e74d] 12KB gfx=[] strs=[] ncalls=8
[0x5000b9de] 11KB gfx=[] strs=[] ncalls=53
[0x50014b89] 11KB gfx=[] strs=[] ncalls=15
[0x50016bb2] 11KB gfx=[] strs=[] ncalls=7
[0x5001d186] 10KB gfx=[] strs=[] ncalls=76
[0x500030d3] 9KB gfx=[] strs=['Canvas', 'Already_initialized'] ncalls=17
[0x5001678f] 8KB gfx=[] strs=[] ncalls=19
[0x50017144] 8KB gfx=[] strs=[] ncalls=10
[0x50017c5b] 8KB gfx=[] strs=[] ncalls=13
[0x50018956] 7KB gfx=[] strs=[] ncalls=6
[0x5000b263] 7KB gfx=[] strs=[] ncalls=37
[0x5001e1e2] 7KB gfx=[] strs=[] ncalls=2
[0x50027c9a] 7KB gfx=[] strs=[] ncalls=1
[0x5001f37a] 6KB gfx=[] strs=[] ncalls=6
```

## C: Canvas 画布系统 top-10
```
[0x4fc1a72d] 19KB feat=[] strs=[]
[0x4fc19f01] 16KB feat=[] strs=[]
[0x4fc1a750] 16KB feat=[] strs=[]
[0x4fc01ef4] 16KB feat=[] strs=[]
[0x4fc03198] 16KB feat=[] strs=[]
[0x4fc11705] 13KB feat=[] strs=[]
[0x4fc1ef78] 8KB feat=['origin', 'Property'] strs=['Property', 'origin']
[0x4fc1f975] 7KB feat=[] strs=[]
[0x4fc101ab] 5KB feat=[] strs=[]
[0x4fc11229] 4KB feat=[] strs=[]
```

## U: UI 核心 top-10
```
[0x1fee30] 179KB tags=mod0>;mod30>;ui> encR=0 encW=2 vt=5 strs=[]
[0x2dfc8b] 164KB tags=mod0>;mod14>;mod18>;mod1>;mod2 encR=0 encW=0 vt=25 strs=[]
[0x4d50c8] 127KB tags=mod0>;mod14>;mod18>;mod1>;mod2 encR=0 encW=0 vt=30 strs=[]
[0x8aee8] 126KB tags=mod16>;mod17>;mod1>;mod4>;mod8 encR=0 encW=0 vt=27 strs=[]
[0x53a008] 98KB tags=mod1;ui encR=0 encW=0 vt=29 strs=[]
[0xbcd57] 93KB tags=mod16>;mod17>;mod1>;mod4>;mod8 encR=0 encW=0 vt=30 strs=[]
[0x314516] 89KB tags=mod0;ui encR=0 encW=0 vt=17 strs=['autoSpekaing']
[0x463f7d] 86KB tags=mod0>;mod30>;ui> encR=0 encW=0 vt=25 strs=[]
[0x4e0571] 86KB tags=ui encR=0 encW=0 vt=16 strs=[]
[0x36a129] 86KB tags=mod0>;mod14>;mod18>;mod1>;mod2 encR=0 encW=0 vt=9 strs=[]
```

## M: 移动物理补充 10
```
[0x5bd53f] 0KB encR=0 encW=0 phys=0 strs=[]
[0x5bd567] 0KB encR=0 encW=0 phys=0 strs=[]
[0x5bcc9a] 0KB encR=0 encW=0 phys=0 strs=[]
[0x5bdea7] 0KB encR=0 encW=0 phys=0 strs=[]
[0x5bfd4c] 0KB encR=0 encW=0 phys=0 strs=[]
[0x5bfd85] 0KB encR=0 encW=0 phys=0 strs=[]
[0x5bcfed] 1KB encR=1 encW=2 phys=1 strs=[]
[0x5bd492] 1KB encR=6 encW=0 phys=2 strs=[]
```

## A: 攻击链 detail
```
[0x55c5b2] 57KB margins=['200', '400', '500', '400', '400'] strs=[]
[0x55fe76] 53KB margins=['300', '300', '400', '400'] strs=[]
[0x563c7d] 14KB margins=['300'] strs=[]
[0x579aea] 8KB margins=['300'] strs=[]
[0x10e6f4] 29KB margins=['100'] strs=[]
```


# 深源（每维度 top-3 完整源码）


## Gr2D/0x50024ae2 (36KB)


void FUN_50424ae2(ulonglong *param_1,undefined8 *param_2,undefined8 *param_3,ulonglong *param_4,
                 undefined8 *param_5,undefined8 *param_6,undefined8 *param_7)

{
  uint uVar1;
  undefined4 uVar2;
  undefined8 uVar3;
  longlong lVar4;
  ulonglong uVar5;
  undefined8 uVar6;
  undefined8 uVar7;
  undefined4 uVar11;
  ulonglong uVar8;
  ulonglong uVar9;
  ulonglong uVar10;
  undefined8 uVar12;
  ulonglong uVar13;
  ulonglong uVar14;
  ulonglong uVar15;
  ulonglong uVar16;
  ulonglong uVar17;
  undefined4 uVar20;
  ulonglong uVar18;
  undefined8 uVar19;
  ulonglong uVar21;
  undefined8 uVar22;
  longlong lVar23;
  undefined8 uVar24;
  undefined8 uVar25;
  undefined8 uVar26;
  uint uVar29;
  undefined8 uVar27;
  undefined8 uVar28;
  undefined4 uVar30;
  undefined8 uVar31;
  undefined4 uVar33;
  ulonglong uVar32;
  
  uVar1 = DAT_50430aa0;
  uVar16 = DAT_50430a80;
  if (param_4 == (ulonglong *)0x0) {
    uVar16 = (ulonglong)DAT_50430a90;
    *param_1 = uVar16;
    param_1[1] = 0;
    param_1[2] = uVar16 << 0x20;
    param_1[3] = 0;
    param_1[4] = 0;
    param_1[5] = uVar16;
    param_1[6] = 0;
    param_1[7] = uVar16 << 0x20;
  }
  else if (param_3 == (undefined8 *)0x0) {
    uVar32 = *param_4;
    uVar15 = param_4[1];
    *param_1 = uVar32 & 0xffffffff;
    param_1[1] = 0;
    param_1[2] = uVar32 & 0xffffffff00000000;
    param_1[3] = 0;
    param_1[4] = 0;
    param_1[5] = (ulonglong)(uint)uVar15;
    param_1[6] = 0;
    param_1[7] = uVar16;
  }
  else {
    uVar17 = (ulonglong)(uint)param_4[1];
    uVar5 = *param_4 & 0xffffffff;
    uVar21 = *param_4 & 0xffffffff00000000;
    uVar26 = *param_3;
    uVar7 = param_3[1];
    uVar3 = PackedFloatingADD(uVar26,uVar26);
    uVar6 = PackedFloatingADD(uVar7,uVar7);
    uVar11 = (undefined4)((ulonglong)uVar26 >> 0x20);
    uVar20 = (undefined4)((ulonglong)uVar7 >> 0x20);
    uVar31 = CONCAT44(uVar20,uVar20);
    uVar12 = PackedFloatingMUL(uVar26,uVar3);
    uVar26 = CONCAT44((int)uVar3,(int)uVar6);
    uVar22 = PackedFloatingMUL(uVar3,uVar31);
    uVar6 = PackedFloatingMUL(CONCAT44((int)uVar7,(int)uVar7),uVar26);
    uVar7 = PackedFloatingMUL(uVar26,CONCAT44(uVar11,uVar11));
    uVar26 = PackedFloatingMUL(uVar26,uVar31);
    uVar3 = CONCAT44((int)((ulonglong)uVar6 >> 0x20),(int)((ulonglong)uVar7 >> 0x20));
    uVar31 = PackedFloatingADD(CONCAT44((int)uVar6,(int)uVar6),uVar12);
    uVar6 = PackedFloatingAccumulate(uVar12,uVar12);
    uVar26 = CONCAT44((int)((ulonglong)uVar22 >> 0x20),(int)uVar26);
    uVar13 = PackedFloatingSUBR(uVar6,CONCAT44(DAT_50430aa4,DAT_50430aa0));
    uVar12 = PackedFloatingSUBR(uVar31,CONCAT44(DAT_50430aa4,DAT_50430aa0));
    uVar14 = uVar13 & 0xffffffff;
    uVar6 = PackedFloatingADD(uVar3,uVar26);
    uVar18 = PackedFloatingSUB(uVar3,uVar26);
    uVar8 = PackedFloatingADD(uVar7,uVar22);
    uVar15 = PackedFloatingSUB(uVar7,uVar22);
    uVar9 = uVar8 & 0xffffffff;
    uVar20 = (undefined4)uVar18;
    uVar30 = (undefined4)uVar12;
    uVar7 = CONCAT44(uVar30,uVar20);
    uVar11 = (undefined4)uVar6;
    uVar32 = uVar18 >> 0x20;
    lVar4 = (ulonglong)DAT_50430aa0 << 0x20;
    uVar29 = (uint)((ulonglong)uVar6 >> 0x20);
    uVar33 = (undefined4)((ulonglong)uVar12 >> 0x20);
    uVar26 = CONCAT44(uVar11,uVar33);
    uVar3 = CONCAT44((int)uVar15,uVar29);
    uVar2 = (undefined4)(uVar18 >> 0x20);
    if (param_2 == (undefined8 *)0x0) {
      *param_1 = CONCAT44(uVar20,uVar33);
      param_1[2] = CONCAT44(uVar30,uVar11);
      param_1[5] = uVar13 & 0xffffffff;
      param_1[7] = (ulonglong)uVar1 << 0x20;
      param_1[4] = CONCAT44((int)uVar8,uVar2);
      param_1[6] = 0;
      param_1[3] = uVar15 & 0xffffffff;
      param_1[1] = (ulonglong)uVar29;
      uVar11 = (undefined4)(*param_1 >> 0x20);
      uVar20 = (undefined4)(param_1[1] >> 0x20);
      uVar2 = (undefined4)*param_1;
      uVar12 = CONCAT44(uVar2,uVar2);
      uVar2 = (undefined4)param_1[1];
      uVar22 = CONCAT44(uVar2,uVar2);
      uVar28 = PackedFloatingMUL(uVar5,uVar12);
      uVar6 = CONCAT44(uVar11,uVar11);
      uVar31 = PackedFloatingMUL(uVar12,0);
      uVar25 = PackedFloatingMUL(uVar21,uVar6);
      uVar12 = CONCAT44(uVar20,uVar20);
      uVar6 = PackedFloatingMUL(uVar6,0);
      uVar28 = PackedFloatingADD(uVar25,uVar28);
      uVar25 = PackedFloatingMUL(0,uVar22);
      uVar31 = PackedFloatingADD(uVar6,uVar31);
      uVar6 = PackedFloatingMUL(uVar22,uVar17);
      uVar22 = PackedFloatingADD(uVar25,uVar28);
      uVar28 = PackedFloatingMUL(0,uVar12);
      uVar6 = PackedFloatingADD(uVar31,uVar6);
      uVar12 = PackedFloatingMUL(uVar12,uVar16);
      uVar8 = PackedFloatingADD(uVar28,uVar22);
      uVar15 = PackedFloatingADD(uVar12,uVar6);
      *param_1 = uVar8;
      param_1[1] = uVar15;
      uVar11 = (undefined4)(param_1[2] >> 0x20);
      uVar20 = (undefined4)(param_1[3] >> 0x20);
      uVar2 = (undefined4)param_1[2];
      uVar12 = CONCAT44(uVar2,uVar2);
      uVar2 = (undefined4)param_1[3];
      uVar22 = CONCAT44(uVar2,uVar2);
      uVar28 = PackedFloatingMU

## Gr2D/0x5002646c (35KB)


void FUN_5042646c(ulonglong *param_1,undefined8 *param_2,undefined8 *param_3,ulonglong *param_4,
                 undefined8 *param_5,undefined8 *param_6,undefined8 *param_7)

{
  undefined4 uVar1;
  undefined8 uVar2;
  undefined8 uVar3;
  undefined8 uVar4;
  undefined4 uVar5;
  undefined4 uVar6;
  undefined8 uVar7;
  ulonglong uVar8;
  undefined8 in_MM2;
  ulonglong uVar9;
  undefined8 uVar10;
  ulonglong uVar11;
  ulonglong uVar12;
  ulonglong uVar13;
  uint uVar14;
  ulonglong in_MM3;
  undefined8 uVar15;
  undefined8 uVar16;
  ulonglong uVar17;
  ulonglong uVar18;
  ulonglong uVar19;
  undefined8 uVar20;
  ulonglong uVar21;
  undefined8 uVar22;
  ulonglong uVar23;
  ulonglong uVar24;
  longlong lVar25;
  undefined8 uVar26;
  undefined8 uVar27;
  undefined4 uVar29;
  undefined8 uVar28;
  undefined4 uVar30;
  longlong lVar31;
  ulonglong uVar32;
  
  uVar18 = DAT_50430a80;
  if (param_4 == (ulonglong *)0x0) {
    uVar18 = (ulonglong)DAT_50430a90;
    uVar32 = PackedSwapDWords(in_MM2,uVar18);
    *param_1 = uVar18;
    param_1[1] = 0;
    param_1[2] = uVar32;
    param_1[3] = 0;
    param_1[4] = 0;
    param_1[5] = uVar18;
    param_1[6] = 0;
    param_1[7] = uVar32;
  }
  else if (param_3 == (undefined8 *)0x0) {
    in_MM3 = *param_4;
    uVar32 = param_4[1];
    *param_1 = in_MM3 & 0xffffffff;
    param_1[1] = 0;
    param_1[2] = in_MM3 & 0xffffffff00000000;
    param_1[3] = 0;
    param_1[4] = 0;
    param_1[5] = (ulonglong)(uint)uVar32;
    param_1[6] = 0;
    param_1[7] = uVar18;
  }
  else {
    uVar32 = *param_4;
    uVar19 = (ulonglong)(uint)param_4[1];
    uVar9 = uVar32 & 0xffffffff;
    uVar23 = uVar32 & 0xffffffff00000000;
    uVar4 = *param_3;
    uVar20 = param_3[1];
    uVar15 = PackedSwapDWords(uVar32,uVar4);
    uVar2 = PackedFloatingADD(uVar4,uVar4);
    uVar7 = PackedFloatingADD(uVar20,uVar20);
    uVar3 = PackedFloatingMUL(uVar2,uVar4);
    uVar10 = PackedFloatingMUL(uVar4,uVar7);
    uVar16 = PackedFloatingMUL(uVar15,uVar7);
    uVar15 = PackedFloatingMUL(uVar7,uVar20);
    uVar2 = PackedFloatingMUL(CONCAT44((int)((ulonglong)uVar20 >> 0x20),
                                       (int)((ulonglong)uVar4 >> 0x20)),
                              CONCAT44((int)uVar7,(int)uVar2));
    uVar4 = PackedFloatingSUBR(uVar3,CONCAT44(DAT_50430aa4,DAT_50430aa0));
    uVar17 = PackedFloatingPosNegAccumulate(uVar16,uVar16);
    uVar20 = PackedFloatingAccumulate(uVar3,uVar3);
    uVar3 = PackedFloatingPosNegAccumulate(uVar2,uVar2);
    uVar11 = PackedFloatingPosNegAccumulate(uVar10,uVar10);
    uVar4 = PackedFloatingSUB(uVar4,CONCAT44((int)uVar15,(int)uVar15));
    uVar24 = PackedSwapDWords(uVar15,uVar11);
    uVar21 = PackedFloatingSUBR(uVar20,CONCAT44(DAT_50430aa4,DAT_50430aa0));
    uVar2 = CONCAT44((int)uVar17,(int)uVar24);
    uVar12 = uVar11 & 0xffffffff;
    uVar32 = uVar21 >> 0x20;
    uVar5 = (undefined4)((ulonglong)uVar4 >> 0x20);
    uVar29 = (undefined4)((ulonglong)uVar3 >> 0x20);
    uVar20 = CONCAT44(uVar29,uVar5);
    uVar13 = uVar17 >> 0x20;
    uVar6 = (undefined4)uVar4;
    uVar1 = (undefined4)uVar3;
    uVar4 = CONCAT44(uVar6,uVar1);
    uVar8 = (ulonglong)DAT_50430aa0;
    lVar31 = uVar8 << 0x20;
    uVar30 = (undefined4)(uVar17 >> 0x20);
    uVar14 = (uint)(uVar21 >> 0x20);
    if (param_2 == (undefined8 *)0x0) {
      *param_1 = CONCAT44(uVar1,uVar5);
      param_1[2] = CONCAT44(uVar6,uVar29);
      param_1[5] = (ulonglong)uVar14;
      param_1[7] = uVar8 << 0x20;
      param_1[4] = CONCAT44(uVar30,(int)uVar11);
      param_1[6] = 0;
      param_1[3] = uVar17 & 0xffffffff;
      param_1[1] = uVar24 & 0xffffffff;
      uVar5 = (undefined4)(*param_1 >> 0x20);
      uVar6 = (undefined4)(param_1[1] >> 0x20);
      uVar1 = (undefined4)*param_1;
      uVar7 = CONCAT44(uVar1,uVar1);
      uVar1 = (undefined4)param_1[1];
      uVar10 = CONCAT44(uVar1,uVar1);
      uVar16 = PackedFloatingMUL(uVar9,uVar7);
      uVar3 = CONCAT44(uVar5,uVar5);
      uVar15 = PackedFloatingMUL(uVar7,0);
      uVar27 = PackedFloatingMUL(uVar23,uVar3);
      uVar7 = CONCAT44(uVar6,uVar6);
      uVar3 = PackedFloatingMUL(uVar3,0);
      uVar16 = PackedFloatingADD(uVar27,uVar16);
      uVar27 = PackedFloatingMUL(0,uVar10);
      uVar15 = PackedFloatingADD(uVar3,uVar15);
      uVar3 = PackedFloatingMUL(uVar10,uVar19);
      uVar10 = PackedFloatingADD(uVar27,uVar16);
      uVar16 = PackedFloatingMUL(0,uVar7);
      uVar3 = PackedFloatingADD(uVar15,uVar3);
      uVar7 = PackedFloatingMUL(uVar7,uVar18);
      uVar17 = PackedFloatingADD(uVar16,uVar10);
      uVar8 = PackedFloatingADD(uVar7,uVar3);
      *param_1 = uVar17;
      param_1[1] = uVar8;
      uVar5 = (undefined4)(param_1[2] >> 0x20);
      uVar6 = (undefined4)(param_1[3] >> 0x20);
      uVar1 = (undefined4)param_1[2];
      uVar7 = CONCAT44(uVar1,uVar1);
      uVar1 = (undefined4)param_1[3];
      uVar10 = CONCAT44(uVar1,uVar1);
      uVar16 = PackedFloatingMUL(uVar9,uVar7);
      uVar3 = CONCAT44(uVar5,uVar5);
      uVar15 = PackedFloatingMUL(uVar7,0);
  

## Gr2D/0x5000da85 (22KB)


void FUN_5040da85(void)

{
  uint *puVar1;
  VARIANTARG *pVVar2;
  ULONG UVar3;
  undefined4 *puVar4;
  HRESULT HVar5;
  int iVar6;
  int *piVar7;
  int *piVar8;
  int *piVar9;
  int iVar10;
  int *this;
  uint uVar11;
  uint uVar12;
  undefined4 *puVar13;
  int unaff_EBP;
  uint uVar14;
  longlong lVar15;
  undefined4 uVar16;
  
  FUN_5042a5f0();
  if (this[0x25] == 0) goto LAB_5040e600;
  iVar6 = this[0x39];
  *(undefined4 *)(unaff_EBP + -0x20) = *(undefined4 *)(this[9] + 0x328);
  while (iVar6 != 0) {
    iVar6 = this[0x3a];
    iVar10 = *(int *)(iVar6 + 0x10);
    *(int *)(unaff_EBP + -0x24) = iVar6;
    if (iVar10 != *(int *)(unaff_EBP + -0x20) && -1 < iVar10 - *(int *)(unaff_EBP + -0x20)) break;
    VariantInit((VARIANTARG *)(unaff_EBP + -0xc4));
    iVar6 = *(int *)(iVar6 + 0x1c);
    *(undefined4 *)(unaff_EBP + -4) = 0;
    if (-1 < iVar6) {
      VariantInit((VARIANTARG *)(unaff_EBP + -0x58));
      HVar5 = FUN_50405986((VARIANTARG *)(unaff_EBP + -0x58),(VARIANTARG *)&DAT_5043a160);
      if (HVar5 < 0) {
        FUN_5042a518(HVar5);
      }
      *(undefined1 *)(unaff_EBP + -4) = 1;
      VariantInit((VARIANTARG *)(unaff_EBP + -0x7c));
      HVar5 = FUN_50405986((VARIANTARG *)(unaff_EBP + -0x7c),(VARIANTARG *)&DAT_5043a160);
      if (HVar5 < 0) {
        FUN_5042a518(HVar5);
      }
      iVar6 = this[0xd];
      *(undefined1 *)(unaff_EBP + -4) = 2;
      if (iVar6 == 0) {
        FUN_5042a518(0x80004003);
      }
      piVar7 = (int *)this[0xd];
      uVar16 = *(undefined4 *)(*(int *)(unaff_EBP + -0x24) + 0x1c);
      iVar6 = *piVar7;
      *(int **)(unaff_EBP + -0x18) = piVar7;
      iVar6 = (**(code **)(iVar6 + 0x90))
                        (piVar7,uVar16,0,*(undefined4 *)(unaff_EBP + -0x7c),
                         *(undefined4 *)(unaff_EBP + -0x78),*(undefined4 *)(unaff_EBP + -0x74),
                         *(undefined4 *)(unaff_EBP + -0x70),*(undefined4 *)(unaff_EBP + -0x58),
                         *(undefined4 *)(unaff_EBP + -0x54),*(undefined4 *)(unaff_EBP + -0x50),
                         *(undefined4 *)(unaff_EBP + -0x4c));
      if (iVar6 < 0) {
        FUN_5042a526(iVar6,*(int **)(unaff_EBP + -0x18),&DAT_50436390);
      }
      *(undefined1 *)(unaff_EBP + -4) = 1;
      HVar5 = FUN_50402791((VARIANTARG *)(unaff_EBP + -0x7c));
      if (HVar5 < 0) {
        FUN_5042a518(HVar5);
      }
      *(undefined1 *)(unaff_EBP + -4) = 0;
      HVar5 = FUN_50402791((VARIANTARG *)(unaff_EBP + -0x58));
      if (HVar5 < 0) {
        FUN_5042a518(HVar5);
      }
    }
    pVVar2 = *(VARIANTARG **)(unaff_EBP + -0x24);
    if (pVVar2[2].n1.decVal.Hi32 != 0) {
      VariantInit((VARIANTARG *)(unaff_EBP + -0x114));
      HVar5 = FUN_50405986((VARIANTARG *)(unaff_EBP + -0x114),(VARIANTARG *)&DAT_5043a160);
      if (HVar5 < 0) {
        FUN_5042a518(HVar5);
      }
      *(undefined1 *)(unaff_EBP + -4) = 3;
      FUN_5040b6e4();
      *(undefined1 *)(unaff_EBP + -4) = 0;
      HVar5 = FUN_50402791((VARIANTARG *)(unaff_EBP + -0x114));
      if (HVar5 < 0) {
        FUN_5042a518(HVar5);
      }
    }
    VariantInit((VARIANTARG *)(unaff_EBP + -0xd4));
    HVar5 = FUN_50405986((VARIANTARG *)(unaff_EBP + -0xd4),pVVar2);
    if (HVar5 < 0) {
      FUN_5042a518(HVar5);
    }
    *(undefined1 *)(unaff_EBP + -4) = 4;
    HVar5 = FUN_50405986((VARIANTARG *)(unaff_EBP + -0xc4),(VARIANTARG *)(unaff_EBP + -0xd4));
    if (HVar5 < 0) {
      FUN_5042a518(HVar5);
    }
    *(undefined1 *)(unaff_EBP + -4) = 0;
    HVar5 = FUN_50402791((VARIANTARG *)(unaff_EBP + -0xd4));
    if (HVar5 < 0) {
      FUN_5042a518(HVar5);
    }
    UVar3 = pVVar2[1].n1.decVal.Hi32;
    if (UVar3 == 0xffffffff) {
      FUN_5040c708(this + 0x37,this[0x3a]);
    }
    else if (UVar3 == 0) {
      *(int *)&pVVar2[1].n1 = *(int *)(unaff_EBP + -0x20) + -1;
    }
    else {
      *(ULONG *)&pVVar2[1].n1 = *(int *)&pVVar2[1].n1 + UVar3;
      FUN_50405476(this + 0x37,(int)(this + 0x37),this[0x3a],this[0x3a],0);
    }
    if (this[0x39] != 0) {
      iVar6 = *(int *)(this[0x3a] + 0x18);
      *(int *)(unaff_EBP + -0x10) = this[0x3a];
      if (-1 < iVar6) {
        VariantInit((VARIANTARG *)(unaff_EBP + -0x104));
        HVar5 = FUN_50405986((VARIANTARG *)(unaff_EBP + -0x104),(VARIANTARG *)&DAT_5043a160);
        if (HVar5 < 0) {
          FUN_5042a518(HVar5);
        }
        *(undefined1 *)(unaff_EBP + -4) = 5;
        VariantInit((VARIANTARG *)(unaff_EBP + -0x124));
        HVar5 = FUN_50405986((VARIANTARG *)(unaff_EBP + -0x124),(VARIANTARG *)&DAT_5043a160);
        if (HVar5 < 0) {
          FUN_5042a518(HVar5);
        }
        iVar6 = this[0xd];
        *(undefined1 *)(unaff_EBP + -4) = 6;
        if (iVar6 == 0) {
          FUN_5042a518(0x80004003);
        }
        piVar7 = (int *)this[0xd];
        uVar16 = *(undefined4 *)(*(int *)(unaff_EBP + -0x10) + 0x18);
        iVar6 = *piVar7;
        *(int **)(unaff_EBP + -0x18) = piVar7;
        iVar6 = (**(code **)(iVar6 + 0x90))
                          (piVar7,uVar16,0,*(undefined4 *

## Canvas/0x4fc1a72d (19KB)


void FUN_5001a72d(void)

{
  bool bVar1;
  undefined4 uVar2;
  void *pvVar3;
  int iVar4;
  refcount_ptr<boost::exception_detail::error_info_container> *prVar5;
  int unaff_EBP;
  
  *(int *)(unaff_EBP + -0x6c) = *(int *)(unaff_EBP + -0x6c) + *(int *)(unaff_EBP + -0x50);
  if (*(int *)(unaff_EBP + -0x6c) == *(int *)(unaff_EBP + -0x70)) {
    FUN_5001b21c();
    return;
  }
  *(undefined4 *)(unaff_EBP + -0xcc) = *(undefined4 *)(unaff_EBP + -0x84);
  do {
    if (*(int *)(unaff_EBP + -0xcc) == *(int *)(unaff_EBP + -0x5c)) {
      FUN_5001a72d();
      return;
    }
    *(undefined4 *)(unaff_EBP + -0x104) = *(undefined4 *)(unaff_EBP + -0xcc);
    *(undefined4 *)(unaff_EBP + -0x100) = *(undefined4 *)(unaff_EBP + -0x6c);
    *(int *)(unaff_EBP + -0xfc) = *(int *)(unaff_EBP + -0xcc) + *(int *)(unaff_EBP + -0x4c);
    *(int *)(unaff_EBP + -0xf8) = *(int *)(unaff_EBP + -0x6c) + *(int *)(unaff_EBP + -0x54);
    uVar2 = (*DAT_50095eb8)(unaff_EBP + -0x104,unaff_EBP + -0x104,unaff_EBP + -0x44);
    *(undefined4 *)(unaff_EBP + -0x218) = uVar2;
    if (*(int *)(unaff_EBP + -0x218) != 0) {
      pvVar3 = FUN_5001c280(*(void **)(unaff_EBP + 0x14),(void *)(unaff_EBP + -0xd8),
                            *(undefined4 *)(unaff_EBP + -0xcc),*(undefined4 *)(unaff_EBP + -0x6c));
      *(void **)(unaff_EBP + -0x21c) = pvVar3;
      *(undefined1 *)(unaff_EBP + -4) = 7;
      bVar1 = FUN_5000c430((void *)(unaff_EBP + -0xd8),0);
      *(bool *)(unaff_EBP + -0x220) = bVar1;
      if ((*(uint *)(unaff_EBP + -0x220) & 0xff) == 0) {
        iVar4 = FUN_5000c070((int *)(unaff_EBP + -0xd8));
        *(int *)(unaff_EBP + -0x224) = iVar4;
        uVar2 = FUN_500199c0(*(int **)(unaff_EBP + -0x224));
        *(undefined4 *)(unaff_EBP + -0x228) = uVar2;
        *(undefined4 *)(unaff_EBP + -0xf4) = *(undefined4 *)(unaff_EBP + -0x228);
        iVar4 = FUN_5000c070((int *)(unaff_EBP + -0xd8));
        *(int *)(unaff_EBP + -0x22c) = iVar4;
        uVar2 = FUN_50019a00(*(int **)(unaff_EBP + -0x22c));
        *(undefined4 *)(unaff_EBP + -0x230) = uVar2;
        *(undefined4 *)(unaff_EBP + -0xf0) = *(undefined4 *)(unaff_EBP + -0x230);
        iVar4 = FUN_5000c070((int *)(unaff_EBP + -0xd8));
        *(int *)(unaff_EBP + -0x234) = iVar4;
        pvVar3 = FUN_50019ac0((void *)(unaff_EBP + -0x198),unaff_EBP + -0xe0);
        *(void **)(unaff_EBP + -0x238) = pvVar3;
        *(undefined4 *)(unaff_EBP + -0xec) = *(undefined4 *)(*(int *)(unaff_EBP + -0x238) + 8);
        FUN_5000f570((_Concurrent_vector_base_v4 *)(unaff_EBP + -0x198));
        if (*(int *)(unaff_EBP + -0xec) != 0) {
          *(undefined4 *)(unaff_EBP + -0x30) = *(undefined4 *)(unaff_EBP + -0x104);
          *(undefined4 *)(unaff_EBP + -0x2c) = *(undefined4 *)(unaff_EBP + -0x100);
          *(undefined4 *)(unaff_EBP + -0x28) = *(undefined4 *)(unaff_EBP + -0xfc);
          *(undefined4 *)(unaff_EBP + -0x24) = *(undefined4 *)(unaff_EBP + -0xf8);
          if (*(int *)(unaff_EBP + -0x20) != 0) {
            (*DAT_50095e64)(unaff_EBP + -0x30,
                            (*(int *)(unaff_EBP + -0x3c) -
                            (*(int *)(unaff_EBP + -0xfc) - *(int *)(unaff_EBP + -0x44))) -
                            *(int *)(unaff_EBP + -0x104),0);
          }
          if (*(int *)(unaff_EBP + -0x74) != 0) {
            (*DAT_50095e64)(unaff_EBP + -0x30,0,
                            (*(int *)(unaff_EBP + -0x38) -
                            (*(int *)(unaff_EBP + -0xf8) - *(int *)(unaff_EBP + -0x40))) -
                            *(int *)(unaff_EBP + -0x100));
          }
          *(int *)(unaff_EBP + -0x30) =
               *(int *)(unaff_EBP + 0xc) +
               ((*(int *)(unaff_EBP + -0x30) - *(int *)(unaff_EBP + 0x24)) *
               *(int *)(unaff_EBP + 0x1c)) / *(int *)(unaff_EBP + 0x2c);
          *(int *)(unaff_EBP + -0x2c) =
               *(int *)(unaff_EBP + 0x10) +
               ((*(int *)(unaff_EBP + -0x2c) - *(int *)(unaff_EBP + 0x28)) *
               *(int *)(unaff_EBP + 0x20)) / *(int *)(unaff_EBP + 0x30);
          *(int *)(unaff_EBP + -0x28) =
               *(int *)(unaff_EBP + 0xc) +
               ((*(int *)(unaff_EBP + -0x28) - *(int *)(unaff_EBP + 0x24)) *
               *(int *)(unaff_EBP + 0x1c)) / *(int *)(unaff_EBP + 0x2c);
          *(int *)(unaff_EBP + -0x24) =
               *(int *)(unaff_EBP + 0x10) +
               ((*(int *)(unaff_EBP + -0x24) - *(int *)(unaff_EBP + 0x28)) *
               *(int *)(unaff_EBP + 0x20)) / *(int *)(unaff_EBP + 0x30);
          (*DAT_50095e64)(unaff_EBP + -0x104,-*(int *)(unaff_EBP + -0xcc),
                          -*(int *)(unaff_EBP + -0x6c));
          *(int *)(unaff_EBP + -0xfc) =
               (*(int *)(unaff_EBP + -0xfc) - *(int *)(unaff_EBP + -0x104)) + -1 +
               (1 << ((byte)*(undefined4 *)(unaff_EBP + -0xf0) & 0x1f)) >>
               ((byte)*(undefined4 *)(unaff_EBP + -0xf0) & 0x1f);
          *(int *)(unaff_EBP + -0xf8) =
               (*(int *)(unaff_EBP + -0xf8) - *(int *)(unaff_EBP + -0x100)) 

## Canvas/0x4fc19f01 (17KB)


/* WARNING: Removing unreachable block (ram,0x5001a51e) */

void FUN_50019f01(int *param_1,int param_2,int param_3,int *param_4,int param_5,int param_6,
                 int param_7,int param_8,int param_9,int param_10,int param_11,uint param_12)

{
  bool bVar1;
  int iVar2;
  void *pvVar3;
  undefined4 uVar4;
  HRESULT HVar5;
  int *piVar6;
  int iVar7;
  byte bVar8;
  int **ppiVar9;
  int *piStack_298;
  int *piStack_294;
  int *piStack_290;
  int *piStack_28c;
  int *piStack_288;
  int iStack_268;
  int local_1ec;
  int local_1e8;
  _Concurrent_vector_base_v4 a_Stack_1ac [16];
  _Concurrent_vector_base_v4 a_Stack_19c [20];
  int local_188;
  _Concurrent_vector_base_v4 local_184 [16];
  int local_174;
  _Concurrent_vector_base_v4 local_170 [20];
  uint uStack_15c;
  uint uStack_158;
  int iStack_154;
  int iStack_150;
  int iStack_14c;
  int iStack_148;
  int iStack_144;
  uint *puStack_140;
  uint uStack_13c;
  uint *puStack_138;
  uint uStack_134;
  uint uStack_130;
  int iStack_12c;
  int iStack_128;
  int iStack_124;
  int iStack_120;
  int iStack_11c;
  refcount_ptr<boost::exception_detail::error_info_container> arStack_118 [4];
  uint uStack_114;
  uint uStack_110;
  int iStack_10c;
  int iStack_108;
  int iStack_104;
  int iStack_100;
  int iStack_fc;
  uint uStack_f8;
  int iStack_f4;
  uint *puStack_f0;
  uint uStack_ec;
  uint uStack_e8;
  int iStack_e4;
  uint uStack_e0;
  int iStack_dc;
  uint uStack_d8;
  int iStack_d4;
  int iStack_d0;
  int local_cc;
  VARIANTARG local_c8;
  int local_b8;
  int local_b4;
  int local_b0;
  undefined1 local_ac [16];
  int local_9c;
  int local_98;
  int local_94;
  int local_90;
  int local_8c;
  int local_88;
  int local_84;
  int local_80;
  uint local_7c;
  uint local_78;
  int local_74;
  int local_70;
  int local_6c;
  int local_68;
  int local_64;
  int local_60;
  int local_5c;
  int local_58;
  int local_54;
  int local_50;
  int local_4c;
  int local_48;
  int local_44;
  int local_40;
  int local_3c;
  ushort *local_38;
  int local_34;
  int local_30;
  int local_2c;
  int local_28;
  uint local_24;
  uint local_20;
  int local_1c;
  int local_18;
  undefined1 *local_14;
  void *pvStack_10;
  undefined1 *puStack_c;
  int local_8;
  
  puStack_c = &LAB_50025d66;
  pvStack_10 = ExceptionList;
  local_14 = &stack0xfffffd80;
  local_8 = 0;
  ExceptionList = &pvStack_10;
  local_5c = FUN_5001c370(param_4);
  local_6c = FUN_5000f6b0(param_4);
  local_48 = 0;
  local_44 = 0;
  local_40 = local_5c;
  local_34 = 0;
  local_30 = 0;
  local_2c = param_1[10];
  local_28 = param_1[0xb];
  piStack_288 = (int *)0x50019fa1;
  local_3c = local_6c;
  iVar2 = FUN_50016466(param_1,&local_34);
  if (iVar2 == 0) {
    FUN_5001b21c();
    return;
  }
  local_24 = 0;
  local_78 = 0;
  if (param_10 == 0) {
    param_10 = local_5c;
  }
  else if (param_10 < 0) {
    local_24 = 1;
    param_10 = -param_10;
  }
  if (param_11 == 0) {
    param_11 = local_6c;
  }
  else if (param_11 < 0) {
    local_78 = 1;
    param_11 = -param_11;
  }
  if (param_6 == 0) {
    param_6 = param_10;
  }
  else if (param_6 < 0) {
    local_24 = (uint)(local_24 == 0);
    param_6 = -param_6;
  }
  if (param_7 == 0) {
    param_7 = param_11;
  }
  else if (param_7 < 0) {
    local_78 = (uint)(local_78 == 0);
    param_7 = -param_7;
  }
  local_9c = param_8;
  local_98 = param_9;
  local_94 = param_8 + param_10;
  local_90 = param_9 + param_11;
  piStack_288 = &local_48;
  piStack_28c = &local_48;
  piStack_290 = (int *)0x5001a0a4;
  iVar2 = (*DAT_50095eb8)();
  if (iVar2 == 0) {
    FUN_5001b21c();
    return;
  }
  local_48 = param_2 + ((local_48 - param_8) * param_6) / param_10;
  local_44 = param_3 + ((local_44 - param_9) * param_7) / param_11;
  local_40 = param_2 + ((local_40 - param_8) * param_6) / param_10;
  local_3c = param_3 + ((local_3c - param_9) * param_7) / param_11;
  piStack_290 = &local_34;
  piStack_294 = &local_48;
  piStack_298 = &local_34;
  iVar2 = (*DAT_50095eb8)();
  if (iVar2 == 0) {
    FUN_5001b21c();
    return;
  }
  local_48 = param_8 + ((local_34 - param_2) * param_10) / param_6;
  local_44 = param_9 + ((local_30 - param_3) * param_11) / param_7;
  local_40 = param_8 + ((local_2c - param_2) * param_10) / param_6;
  local_3c = param_9 + ((local_28 - param_3) * param_11) / param_7;
  local_84 = local_40 - local_48;
  local_80 = local_3c - local_44;
  local_68 = local_2c - local_34;
  local_64 = local_28 - local_30;
  if (((param_4 == param_1) && (iVar2 = (*DAT_50095eb8)(local_ac,&local_34,&local_48), iVar2 != 0))
     && (((local_24 != 0 || (((local_78 != 0 || (local_68 != local_84)) || (local_64 != local_80))))
         || (iVar2 = FUN_5001c3b0(param_4), param_1[7] < iVar2)))) {
    FUN_5000c030(&local_b8);
    local_8._0_1_ = 1;
    pvVar3 = (void *)FUN_50018440(&local_b8);
    FUN_5000bdf0(pvVar3,2,0,local_84,local_80,0,0);
    FUN_5000c030(&local_b4);
    local_8._0_1_ = 2;
    local_b0 = FUN_5000cf80(&local_b4);
    *(int *)(local_b0 + 0x28) = local_84;
    *(int

## Canvas/0x4fc1a750 (17KB)


void FUN_5001a750(void)

{
  bool bVar1;
  undefined4 uVar2;
  void *pvVar3;
  int iVar4;
  refcount_ptr<boost::exception_detail::error_info_container> *prVar5;
  int unaff_EBP;
  
  while( true ) {
    while( true ) {
      do {
        *(int *)(unaff_EBP + -0xcc) = *(int *)(unaff_EBP + -0xcc) + *(int *)(unaff_EBP + -0x48);
        if (*(int *)(unaff_EBP + -0xcc) == *(int *)(unaff_EBP + -0x5c)) {
          FUN_5001a72d();
          return;
        }
        *(undefined4 *)(unaff_EBP + -0x104) = *(undefined4 *)(unaff_EBP + -0xcc);
        *(undefined4 *)(unaff_EBP + -0x100) = *(undefined4 *)(unaff_EBP + -0x6c);
        *(int *)(unaff_EBP + -0xfc) = *(int *)(unaff_EBP + -0xcc) + *(int *)(unaff_EBP + -0x4c);
        *(int *)(unaff_EBP + -0xf8) = *(int *)(unaff_EBP + -0x6c) + *(int *)(unaff_EBP + -0x54);
        uVar2 = (*DAT_50095eb8)(unaff_EBP + -0x104,unaff_EBP + -0x104,unaff_EBP + -0x44);
        *(undefined4 *)(unaff_EBP + -0x218) = uVar2;
      } while (*(int *)(unaff_EBP + -0x218) == 0);
      pvVar3 = FUN_5001c280(*(void **)(unaff_EBP + 0x14),(void *)(unaff_EBP + -0xd8),
                            *(undefined4 *)(unaff_EBP + -0xcc),*(undefined4 *)(unaff_EBP + -0x6c));
      *(void **)(unaff_EBP + -0x21c) = pvVar3;
      *(undefined1 *)(unaff_EBP + -4) = 7;
      bVar1 = FUN_5000c430((void *)(unaff_EBP + -0xd8),0);
      *(bool *)(unaff_EBP + -0x220) = bVar1;
      if ((*(uint *)(unaff_EBP + -0x220) & 0xff) == 0) break;
      *(undefined1 *)(unaff_EBP + -4) = 0;
      FUN_5000c050((int *)(unaff_EBP + -0xd8));
    }
    iVar4 = FUN_5000c070((int *)(unaff_EBP + -0xd8));
    *(int *)(unaff_EBP + -0x224) = iVar4;
    uVar2 = FUN_500199c0(*(int **)(unaff_EBP + -0x224));
    *(undefined4 *)(unaff_EBP + -0x228) = uVar2;
    *(undefined4 *)(unaff_EBP + -0xf4) = *(undefined4 *)(unaff_EBP + -0x228);
    iVar4 = FUN_5000c070((int *)(unaff_EBP + -0xd8));
    *(int *)(unaff_EBP + -0x22c) = iVar4;
    uVar2 = FUN_50019a00(*(int **)(unaff_EBP + -0x22c));
    *(undefined4 *)(unaff_EBP + -0x230) = uVar2;
    *(undefined4 *)(unaff_EBP + -0xf0) = *(undefined4 *)(unaff_EBP + -0x230);
    iVar4 = FUN_5000c070((int *)(unaff_EBP + -0xd8));
    *(int *)(unaff_EBP + -0x234) = iVar4;
    pvVar3 = FUN_50019ac0((void *)(unaff_EBP + -0x198),unaff_EBP + -0xe0);
    *(void **)(unaff_EBP + -0x238) = pvVar3;
    *(undefined4 *)(unaff_EBP + -0xec) = *(undefined4 *)(*(int *)(unaff_EBP + -0x238) + 8);
    FUN_5000f570((_Concurrent_vector_base_v4 *)(unaff_EBP + -0x198));
    if (*(int *)(unaff_EBP + -0xec) != 0) break;
    *(undefined1 *)(unaff_EBP + -4) = 0;
    FUN_5000c050((int *)(unaff_EBP + -0xd8));
  }
  *(undefined4 *)(unaff_EBP + -0x30) = *(undefined4 *)(unaff_EBP + -0x104);
  *(undefined4 *)(unaff_EBP + -0x2c) = *(undefined4 *)(unaff_EBP + -0x100);
  *(undefined4 *)(unaff_EBP + -0x28) = *(undefined4 *)(unaff_EBP + -0xfc);
  *(undefined4 *)(unaff_EBP + -0x24) = *(undefined4 *)(unaff_EBP + -0xf8);
  if (*(int *)(unaff_EBP + -0x20) != 0) {
    (*DAT_50095e64)(unaff_EBP + -0x30,
                    (*(int *)(unaff_EBP + -0x3c) -
                    (*(int *)(unaff_EBP + -0xfc) - *(int *)(unaff_EBP + -0x44))) -
                    *(int *)(unaff_EBP + -0x104),0);
  }
  if (*(int *)(unaff_EBP + -0x74) != 0) {
    (*DAT_50095e64)(unaff_EBP + -0x30,0,
                    (*(int *)(unaff_EBP + -0x38) -
                    (*(int *)(unaff_EBP + -0xf8) - *(int *)(unaff_EBP + -0x40))) -
                    *(int *)(unaff_EBP + -0x100));
  }
  *(int *)(unaff_EBP + -0x30) =
       *(int *)(unaff_EBP + 0xc) +
       ((*(int *)(unaff_EBP + -0x30) - *(int *)(unaff_EBP + 0x24)) * *(int *)(unaff_EBP + 0x1c)) /
       *(int *)(unaff_EBP + 0x2c);
  *(int *)(unaff_EBP + -0x2c) =
       *(int *)(unaff_EBP + 0x10) +
       ((*(int *)(unaff_EBP + -0x2c) - *(int *)(unaff_EBP + 0x28)) * *(int *)(unaff_EBP + 0x20)) /
       *(int *)(unaff_EBP + 0x30);
  *(int *)(unaff_EBP + -0x28) =
       *(int *)(unaff_EBP + 0xc) +
       ((*(int *)(unaff_EBP + -0x28) - *(int *)(unaff_EBP + 0x24)) * *(int *)(unaff_EBP + 0x1c)) /
       *(int *)(unaff_EBP + 0x2c);
  *(int *)(unaff_EBP + -0x24) =
       *(int *)(unaff_EBP + 0x10) +
       ((*(int *)(unaff_EBP + -0x24) - *(int *)(unaff_EBP + 0x28)) * *(int *)(unaff_EBP + 0x20)) /
       *(int *)(unaff_EBP + 0x30);
  (*DAT_50095e64)(unaff_EBP + -0x104,-*(int *)(unaff_EBP + -0xcc),-*(int *)(unaff_EBP + -0x6c));
  *(int *)(unaff_EBP + -0xfc) =
       (*(int *)(unaff_EBP + -0xfc) - *(int *)(unaff_EBP + -0x104)) + -1 +
       (1 << ((byte)*(undefined4 *)(unaff_EBP + -0xf0) & 0x1f)) >>
       ((byte)*(undefined4 *)(unaff_EBP + -0xf0) & 0x1f);
  *(int *)(unaff_EBP + -0xf8) =
       (*(int *)(unaff_EBP + -0xf8) - *(int *)(unaff_EBP + -0x100)) + -1 +
       (1 << ((byte)*(undefined4 *)(unaff_EBP + -0xf0) & 0x1f)) >>
       ((byte)*(undefined4 *)(unaff_EBP + -0xf0) & 0x1f);
  *(int *)(unaff_EBP + -0x104) =
       *(int *)(unaff_EBP + -0x104) >> ((byte)*(undefined4 *)(unaff_EBP + -0xf0) & 0x1f);
  *(int *)(unaff_EBP + -0xfc) = *(int *