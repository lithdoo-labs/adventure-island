# Task 061: Handler Pseudo-Code Reference (Top 50)

Each entry: client handler RVA + wire schema + decompiled C code + server Java cross-reference


## 1. WARP_TO_MAP (0x0081)

**Wire schema:** `ReadInt32 > ReadByte > ReadByte > ReadByte > ReadInt16 > ReadInt32 > ReadInt32 > ReadInt32 > ReadInt32 > ReadByte > ReadInt16`

**Client handler @ 0x37e72f:**

```c

void FUN_0077e72f(void)

{
  int *piVar1;
  short sVar2;
  undefined **ppuVar3;
  code *pcVar4;
  undefined1 uVar5;
  char cVar6;
  undefined4 uVar7;
  uint uVar8;
  int iVar9;
  int *piVar10;
  undefined4 *puVar11;
  short *psVar12;
  undefined4 extraout_ECX;
  undefined4 *extraout_ECX_00;
  undefined4 *extraout_ECX_01;
  undefined4 *extraout_ECX_02;
  int unaff_EBP;
  undefined *puVar13;
  undefined4 *unaff_FS_OFFSET;
  undefined4 **ppuVar14;
  undefined4 *puStack_cc;
  uint uStack_c8;
  undefined1 *puStack_c4;
  undefined4 *puStack_c0;
  undefined **ppuStack_b8;
  undefined **ppuStack_b4;
  
  FUN_00a6fc7c();
  puVar13 = PTR_PTR_00bd9028;
  iVar9 = *(int *)(PTR_PTR_00bd9028 + 0x205c);
  ppuVar3 = *(undefined ***)(unaff_EBP + 8);
  *(undefined4 *)(unaff_EBP + -0x50) = extraout_ECX;
  *(undefined **)(unaff_EBP + -0x18) = puVar13;
  ppuStack_b4 = (undefined **)0x77e75e;
  uVar7 = ReadInt32();
  *(undefined4 *)(puVar13 + 0x205c) = uVar7;
  ppuStack_b4 = (undefined **)0x77e76b;
  uVar8 = ReadByte();
  *(uint *)(puVar13 + 0x2080) = uVar8 & 0xff;
  if (iVar9 != *(int *)(puVar13 + 0x205c)) {
    *(undefined4 *)(puVar13 + 0x2f60) = 1;
  }
  ppuStack_b4 = (undefined **)0x77e78f;
  uVar5 = ReadByte();
  *(undefined1 *)(unaff_EBP + -0x25) = uVar5;
  ppuStack_b4 = (undefined **)0x77e799;
  uVar8 = ReadByte();
  *(uint *)(unaff_EBP + -0x48) = uVar8 & 0xff;
  ppuStack_b4 = (undefined **)0x77e7a6;
  uVar8 = ReadInt16();
  ppuStack_b4 = (undefined **)0xffffffff;
  ppuStack_b8 = (undefined **)&DAT_00bdd7e4;
  *(uint *)(unaff_EBP + -0x2c) = uVar8 & 0xffff;
  *(undefined4 *)(unaff_EBP + -0x44) = 0;
  FUN_00414aea();
  *(undefined4 *)(unaff_EBP + -4) = 0;
  *(undefined4 *)(unaff_EBP + -0x4c) = 0;
  *(undefined1 *)(unaff_EBP + -4) = 1;
  if (*(int *)(unaff_EBP + -0x2c) != 0) {
    ppuStack_b4 = (undefined **)(unaff_EBP + -0x10);
    ppuStack_b8 = (undefined **)0x77e7da;
    ppuStack_b4 = (undefined **)
// ... (truncated)
```


## 2. SPAWN_PLAYER (0x00a2)

**Client handler @ 0x57f6c0:**

```c

void FUN_0097f6c0(void)

{
  undefined *puVar1;
  int iVar2;
  int unaff_EBP;
  undefined4 *unaff_FS_OFFSET;
  
  FUN_00a6fc7c();
  iVar2 = ReadInt32();
  puVar1 = PTR_PTR_00bd9028;
  *(int *)(unaff_EBP + -0x10) = iVar2;
  if (iVar2 != *(int *)(puVar1 + 0x2084)) {
    iVar2 = FUN_00980e40(unaff_EBP + -0x10,0);
    if ((iVar2 == 0) && (*(int *)(puVar1 + 0x2fe8) == 0)) {
                    /* WARNING: Subroutine does not return */
      FUN_00402d66(0x1c);
    }
  }
  *unaff_FS_OFFSET = *(undefined4 *)(unaff_EBP + -0xc);
  return;
}


```


## 3. CHATTEXT (0x00a4)

**Client handler @ 0x53d546:**

```c

void FUN_0093d546(void)

{
  uint uVar1;
  char *__s2;
  int iVar2;
  int *piVar3;
  int iVar4;
  undefined4 *puVar5;
  undefined4 uVar6;
  int *extraout_ECX;
  char *__s1;
  int unaff_EBP;
  undefined4 *unaff_FS_OFFSET;
  bool bVar7;
  int *piStack_58;
  int *piStack_54;
  undefined4 uStack_50;
  undefined4 uStack_4c;
  int iStack_48;
  undefined *puStack_44;
  
  FUN_00a6fc7c();
  *(undefined4 *)(unaff_EBP + -0x20) = 0;
  uVar1 = ReadByte();
  *(uint *)(unaff_EBP + -0x24) = uVar1 & 0xff;
  ReadString();
  *(undefined4 *)(unaff_EBP + -4) = 0;
  uVar1 = ReadByte();
  *(uint *)(unaff_EBP + -0x30) = uVar1 & 0xff;
  *(undefined4 *)(unaff_EBP + -0x14) = 0;
  *(undefined1 *)(unaff_EBP + -4) = 1;
  if (*(int *)(unaff_EBP + 0xc) == 0) {
    iVar2 = (**(code **)(*extraout_ECX + 0xc))();
    if (iVar2 == 0) goto LAB_0093d5ec;
  }
  else {
    ReadString();
    *(undefined1 *)(unaff_EBP + -4) = 2;
    FUN_00418f94();
    *(undefined1 *)(unaff_EBP + -4) = 1;
    if (*(int *)(unaff_EBP + -0x1c) != 0) {
      FUN_00429f5a();
    }
    __s2 = (char *)extraout_ECX[0x3cc];
    if ((char *)extraout_ECX[0x3cc] == (char *)0x0) {
      __s2 = DAT_00be7b74;
    }
    __s1 = DAT_00be7b74;
    if (*(int *)(unaff_EBP + -0x14) != 0) {
      __s1 = *(char **)(unaff_EBP + -0x14);
    }
    puStack_44 = (undefined *)0x93d5e6;
    iVar2 = _strcmp(__s1,__s2);
    if (iVar2 != 0) {
LAB_0093d5ec:
      puStack_44 = (undefined *)0x0;
      iStack_48 = 1;
      uStack_4c = 0x400;
      uStack_50 = 0x93d600;
      iStack_48 = FUN_00416ef9();
      uStack_4c = 0x93d606;
      FUN_007a6e6e();
      FUN_00416fa4();
    }
  }
  iVar2 = (**(code **)(*extraout_ECX + 0xc))();
  if ((iVar2 == 0) && (iVar2 = FUN_004376f2(), iVar2 != 0)) {
    piVar3 = (int *)FUN_004376f2();
    iVar2 = (**(code **)(*piVar3 + 0x1c))();
    if (iVar2 == 0x13) {
      iVar2 = extraout_ECX[0xa2c];
      if (iVar2 == 2) {
        iVar2 = 0;
   
// ... (truncated)
```


## 4. UPDATE_STATS (0x0022)

**Client handler @ 0x6292f5:**

```c

/* WARNING: Globals starting with '_' overlap smaller symbols at the same address */

uint FUN_00a292f5(void)

{
  int *piVar1;
  float fVar2;
  float fVar3;
  char cVar4;
  byte bVar5;
  byte bVar6;
  short sVar7;
  undefined4 uVar8;
  int iVar9;
  uint uVar10;
  uint *puVar11;
  int iVar12;
  int *piVar13;
  undefined4 *puVar14;
  int extraout_ECX;
  uint extraout_ECX_00;
  uint extraout_ECX_01;
  uint extraout_ECX_02;
  uint uVar15;
  int iVar16;
  int unaff_EBP;
  undefined4 *unaff_FS_OFFSET;
  undefined4 uVar17;
  uint uStack_50;
  int iStack_4c;
  undefined1 *puStack_48;
  uint uStack_44;
  uint uStack_40;
  
  FUN_00a6fc7c();
  *(undefined4 *)(unaff_EBP + -0x28) = 0;
  *(int *)(unaff_EBP + -0x10) = extraout_ECX;
  uStack_40 = 0xa29316;
  cVar4 = ReadByte();
  if (cVar4 != '\0') {
    *(undefined4 *)(extraout_ECX + 0x2088) = 0;
    uStack_40 = 0xa29329;
    uVar8 = FUN_00994c7a();
    *(undefined4 *)(extraout_ECX + 0x208c) = uVar8;
  }
  uStack_40 = unaff_EBP - 0x3c;
  uStack_44 = 0xa2933a;
  iVar9 = FUN_00426f51();
  iVar9 = *(int *)(iVar9 + 4);
  uStack_40 = 0xa29345;
  FUN_00429bfe();
  uStack_40 = *(uint *)(iVar9 + 0x35);
  uVar15 = iVar9 + 0x33;
  puStack_48 = (undefined1 *)0xa29351;
  uStack_44 = uVar15;
  bVar5 = FUN_004f7707();
  puStack_48 = *(undefined1 **)(iVar9 + 0x3d);
  *(undefined4 *)(unaff_EBP + -0x24) = *(undefined4 *)(iVar9 + 0x13);
  iStack_4c = iVar9 + 0x39;
  uStack_50 = 0xa29366;
  sVar7 = FUN_0047376f();
  uStack_40 = *(uint *)(unaff_EBP + 8);
  *(int *)(unaff_EBP + -0x18) = (int)sVar7;
  uStack_44 = 0xa29379;
  uVar10 = FUN_004f2674();
  *(uint *)(unaff_EBP + -0x14) = uVar10;
  if ((uVar10 & 0x38) != 0) {
    *(int **)(unaff_EBP + -0x20) = DAT_00bdd490;
    uStack_40 = 0xa29390;
    uStack_40 = ReadByte();
    uStack_44 = 0xa29399;
    FUN_0096795f();
  }
  uStack_40 = 0xa293a1;
  FUN_00a11a22();
  uStack_40 = *(uint *)(iVar9 + 0x35);
  puStack_48 = (u
// ... (truncated)
```


## 5. MODIFY_INVENTORY_ITEM (0x0020)

**Client handler @ 0x6286ec:**

```c

void FUN_00a286ec(void)

{
  char cVar1;
  char cVar2;
  short sVar3;
  undefined4 uVar4;
  int iVar5;
  uint uVar6;
  int iVar7;
  int *piVar8;
  undefined4 *puVar9;
  int extraout_ECX;
  int extraout_ECX_00;
  int extraout_ECX_01;
  int extraout_ECX_02;
  int extraout_ECX_03;
  int extraout_ECX_04;
  int unaff_EBP;
  int iVar10;
  undefined4 *unaff_FS_OFFSET;
  int iStack_68;
  int local_64;
  
  FUN_00a6fc7c();
  *(int *)(unaff_EBP + -0x10) = extraout_ECX;
  local_64 = 0xa28709;
  cVar1 = ReadByte();
  if (cVar1 != '\0') {
    *(undefined4 *)(extraout_ECX + 0x2088) = 0;
    local_64 = 0xa2871d;
    uVar4 = FUN_00994c7a();
    *(undefined4 *)(extraout_ECX + 0x208c) = uVar4;
  }
  local_64 = unaff_EBP + -0x48;
  iStack_68 = 0xa2872e;
  iVar5 = FUN_00426f51();
  *(undefined4 *)(unaff_EBP + -0x14) = *(undefined4 *)(iVar5 + 4);
  local_64 = 0xa2873c;
  FUN_00429bfe();
  *(undefined4 *)(unaff_EBP + -0x24) = 0;
  *(undefined4 *)(unaff_EBP + -0x18) = 0;
  *(undefined4 *)(unaff_EBP + -4) = 0;
  local_64 = 0xa2874d;
  uVar6 = ReadByte();
  if ((uVar6 & 0xff) != 0) {
    *(uint *)(unaff_EBP + -0x2c) = uVar6 & 0xff;
    do {
      local_64 = 0xa28763;
      cVar1 = ReadByte();
      local_64 = 0xa2876e;
      cVar2 = ReadByte();
      iVar10 = (int)cVar2;
      local_64 = 0xa28779;
      sVar3 = ReadInt16();
      iVar5 = (int)sVar3;
      *(int *)(unaff_EBP + -0x1c) = iVar5;
      if (cVar1 == '\0') {
        local_64 = *(undefined4 *)(unaff_EBP + 8);
        iStack_68 = unaff_EBP + -0x48;
        FUN_004f2a47();
        *(undefined1 *)(unaff_EBP + -4) = 1;
        local_64 = 0xa28abd;
        local_64 = FUN_00429944();
        iStack_68 = 0xa28ac6;
        uVar4 = FUN_00a32017();
        local_64 = *(undefined4 *)(unaff_EBP + -0x44);
        *(int **)(unaff_EBP + -0x30) = &iStack_68;
        FUN_00429ab7();
        FUN_0047a261(iVar10,iVar5);
        iStack_68 = 0xa28af0;
        lo
// ... (truncated)
```


## 6. TEMP_STATS (0x0025)

**Client handler @ 0x62a040:**

```c

void FUN_00a2a040(undefined4 param_1)

{
  FUN_007848b7(param_1);
  FUN_00a11a22();
  return;
}


```


## 7. TEMP_STATS_RESET (0x0026)

**Client handler @ 0x62a05d:**

```c

void FUN_00a2a05d(void)

{
  FUN_0078453c();
  FUN_00a11a22();
  return;
}


```


## 8. UPDATE_SKILLS (0x0027)


## 9. KEYMAP (0x016f)

**Server handler:** `PlayerHandler.ChangeKeymap`

**Client handler @ 0x1b9e4f:**

```c

void __thiscall FUN_005b9e4f(int param_1,undefined4 param_2)

{
  char cVar1;
  int iVar2;
  
  cVar1 = ReadByte();
  if (cVar1 == '\0') {
    iVar2 = 0x59;
    do {
      FUN_004f3bb2(param_2);
      iVar2 = iVar2 + -1;
    } while (iVar2 != 0);
  }
  else {
    iVar2 = FUN_0049ee30(param_1 + 4);
    if (iVar2 == 0) {
      FUN_005ba1af();
    }
    FUN_005b9fca();
  }
  FUN_005b9f47();
  FUN_00a6fce0(param_1 + 0x1c1,param_1 + 4,0x1bd);
  FUN_005b9fca();
  return;
}


```


## 10. BUDDYLIST (0x003c)

**Client handler @ 0x64915c:**

```c

/* WARNING (jumptable): Unable to track spacebase fully for stack */

void FUN_00a4915c(void)

{
  int *piVar1;
  undefined1 uVar2;
  byte bVar3;
  int iVar4;
  int iVar5;
  uint uVar6;
  int extraout_ECX;
  int iVar7;
  int unaff_EBP;
  undefined4 *unaff_FS_OFFSET;
  undefined1 *puVar8;
  undefined4 uVar9;
  undefined1 auStack_30 [4];
  undefined4 uStack_2c;
  undefined4 uStack_28;
  int iStack_24;
  int local_20;
  
  FUN_00a6fc7c();
  iVar4 = *(int *)(unaff_EBP + 8);
  local_20 = 0xa49178;
  uVar2 = ReadByte();
  switch(uVar2) {
  case 7:
  case 10:
  case 0x12:
    iStack_24 = 0xa4919a;
    local_20 = iVar4;
    FUN_00a49db4();
    goto LAB_00a49437;
  case 8:
    local_20 = 1;
    uStack_28 = 0xa49418;
    iStack_24 = iVar4;
    FUN_00a49ed6();
    goto LAB_00a49437;
  case 9:
    local_20 = 0xa4935e;
    ReadInt32();
    *(undefined4 *)(unaff_EBP + -0x10) = 0;
    *(undefined4 *)(unaff_EBP + 8) = 0;
    *(undefined4 *)(unaff_EBP + -4) = 3;
    local_20 = unaff_EBP + -0x18;
    *(undefined1 *)(unaff_EBP + -4) = 4;
    iStack_24 = 0xa4937e;
    local_20 = ReadString();
    *(undefined1 *)(unaff_EBP + -4) = 5;
    iStack_24 = 0xa4938b;
    FUN_00418f94();
    *(undefined1 *)(unaff_EBP + -4) = 4;
    local_20 = 0xa49397;
    FUN_004063b5();
    iStack_24 = 0xa493a3;
    local_20 = iVar4;
    FUN_00a49e51();
    local_20 = 0x10c;
                    /* WARNING: Subroutine does not return */
    iStack_24 = 0xa493b2;
    FUN_00402d66();
  case 0xb:
    *(undefined1 **)(unaff_EBP + -0x1c) = auStack_30;
    uVar9 = 0x27a;
    break;
  case 0xc:
    *(undefined1 **)(unaff_EBP + -0x1c) = auStack_30;
    uVar9 = 0x27b;
    break;
  case 0xd:
    *(undefined1 **)(unaff_EBP + -0x1c) = auStack_30;
    uVar9 = 0x27c;
    break;
  case 0xe:
    *(undefined1 **)(unaff_EBP + -0x1c) = auStack_30;
    uVar9 = 0x27e;
    break;
  case 0xf:
    *(undefined1 **)(unaff_EBP + -0x1c) = auStack_3
// ... (truncated)
```


## 11. PARTY_OPERATION (0x003b)

**Client handler @ 0x648120:**

```c

/* WARNING (jumptable): Unable to track spacebase fully for stack */

void FUN_00a48120(void)

{
  bool bVar1;
  undefined1 uVar2;
  char cVar3;
  short sVar4;
  int iVar5;
  undefined4 uVar6;
  uint uVar7;
  undefined4 *puVar8;
  int iVar9;
  undefined4 uVar10;
  int extraout_ECX;
  int iVar11;
  int unaff_EBP;
  int *piVar12;
  undefined4 *puVar13;
  undefined4 *unaff_FS_OFFSET;
  
  FUN_00a6fc7c();
  *(undefined4 *)(unaff_EBP + -0x18) = 0;
  uVar10 = *(undefined4 *)(extraout_ECX + 0x2e04);
  puVar8 = (undefined4 *)(extraout_ECX + 0x2e08);
  puVar13 = (undefined4 *)(unaff_EBP + -0x1e8);
  for (iVar11 = 0x4a; iVar11 != 0; iVar11 = iVar11 + -1) {
    *puVar13 = *puVar8;
    puVar8 = puVar8 + 1;
    puVar13 = puVar13 + 1;
  }
  *(undefined2 *)puVar13 = *(undefined2 *)puVar8;
  *(undefined4 *)(unaff_EBP + -0x24) = uVar10;
  uVar2 = ReadByte();
  *(undefined4 *)(unaff_EBP + -0x10) = 0;
  *(undefined4 *)(unaff_EBP + -4) = 0;
  *(undefined4 *)(unaff_EBP + 8) = 0;
  *(undefined1 *)(unaff_EBP + -4) = 1;
  *(undefined4 *)(unaff_EBP + -0x14) = 0;
  switch(uVar2) {
  case 4:
    uVar10 = ReadInt32();
    *(undefined4 *)(unaff_EBP + -0x1c) = uVar10;
    ReadString();
    *(undefined1 *)(unaff_EBP + -4) = 2;
    uVar7 = ReadByte();
    *(uint *)(unaff_EBP + -0x20) = uVar7 & 0xff;
    iVar11 = *(int *)(DAT_00bdd494 + 0x34);
    iVar9 = *(int *)(DAT_00bdd494 + 0x38);
    if (iVar11 == 0) {
LAB_00a481f4:
      *(undefined4 *)(unaff_EBP + -0x14) = 1;
    }
    else {
      *(undefined1 **)(unaff_EBP + -0x24) = &stack0xfffffe14;
      FUN_00418f94(unaff_EBP + -0x18);
      *(undefined1 *)(unaff_EBP + -4) = 2;
      FUN_00548285();
      iVar5 = FUN_0049fba1();
      if ((iVar5 != 0) || (iVar5 = FUN_00a2e37d(), iVar5 != 0)) goto LAB_00a481f4;
      *(undefined4 *)(unaff_EBP + -0x14) = 0;
    }
    if ((iVar9 == 0) || (iVar11 == 0)) {
LAB_00a48229:
      bVar1 = true;
    }
    else {
      *(undefined1
// ... (truncated)
```


## 12. GUILD_OPERATION (0x003e)

**Client handler @ 0x641174:**

```c

/* WARNING (jumptable): Unable to track spacebase fully for stack */

void FUN_00a41174(void)

{
  undefined1 *puVar1;
  char *pcVar2;
  byte bVar3;
  char cVar4;
  undefined1 uVar5;
  undefined2 uVar6;
  uint uVar7;
  undefined4 uVar8;
  int iVar9;
  undefined4 *puVar10;
  int *piVar11;
  undefined4 *puVar12;
  int iVar13;
  int iVar14;
  int extraout_ECX;
  int unaff_EBP;
  uint uVar15;
  undefined4 *unaff_FS_OFFSET;
  int **ppiVar16;
  undefined4 uStack_130;
  int *piStack_12c;
  int iStack_128;
  int iStack_124;
  undefined *puStack_120;
  undefined1 *local_11c;
  
  FUN_00a6fc7c();
  *(undefined4 *)(unaff_EBP + -0x1c) = 0;
  puVar1 = *(undefined1 **)(unaff_EBP + 8);
  local_11c = (undefined1 *)0xa41197;
  bVar3 = ReadByte();
  *(undefined4 *)(unaff_EBP + -0x18) = 0;
  *(undefined4 *)(unaff_EBP + -4) = 0;
  *(undefined4 *)(unaff_EBP + 8) = 0;
  *(undefined1 *)(unaff_EBP + -4) = 1;
  if (bVar3 < 0x33) {
    if (bVar3 == 0x32) {
      iVar9 = *(int *)(extraout_ECX + 0x2f7c);
      local_11c = (undefined1 *)0xa41dc2;
      iVar13 = ReadInt32();
      if (iVar13 != iVar9) goto LAB_00a425ea;
      if ((iVar9 == 0) || (**(int **)(extraout_ECX + 0x2f88) != *(int *)(extraout_ECX + 0x2084))) {
        puStack_120 = (undefined *)(unaff_EBP + -0xe8);
        local_11c = (undefined1 *)0x128;
        iStack_124 = 0xa41e5b;
        FUN_007a48d0();
        iStack_124 = 0xa41e62;
        puStack_120 = (undefined *)FUN_0040652b();
        local_11c = (undefined1 *)0xb;
        *(undefined1 *)(unaff_EBP + -4) = 0x29;
        iStack_124 = 0xa41e6e;
        FUN_00490191();
        *(undefined1 *)(unaff_EBP + -4) = 1;
        if (*(int *)(unaff_EBP + -0xe8) != 0) {
          local_11c = (undefined1 *)(*(int *)(unaff_EBP + -0xe8) + -0xc);
          puStack_120 = (undefined *)0xa41e87;
          FUN_00429f5a();
        }
      }
      else {
        *(undefined4 *)(unaff_EBP + -0x10) = 0;
        puStack_120 = 
// ... (truncated)
```


## 13. CHAR_CASH (0x007d)

**Client handler @ 0x634844:**

```c

void FUN_00a34844(void)

{
  undefined4 uVar1;
  int iVar2;
  uint uVar3;
  int extraout_ECX;
  int unaff_EBP;
  undefined4 *unaff_FS_OFFSET;
  
  FUN_00a6fc7c();
  uVar1 = ReadInt32();
  iVar2 = FUN_0097ec5e(uVar1);
  uVar3 = -(uint)(iVar2 != 0) & iVar2 + 8U;
  *(uint *)(unaff_EBP + -0x10) = -(uint)(uVar3 != 0) & uVar3 - 8;
  FUN_00a35129();
  *(undefined4 *)(unaff_EBP + -4) = 0;
  if (*(int *)(unaff_EBP + -0x10) == 0) {
    *(undefined4 *)(unaff_EBP + -4) = 0xffffffff;
    FUN_00a35146();
  }
  else {
    uVar1 = ReadInt32();
    if (DAT_00bdd6f0 != 0) {
      FUN_008e4603(uVar1);
    }
    uVar1 = FUN_00416e36();
    *(undefined4 *)(unaff_EBP + -4) = 0xffffffff;
    *(undefined4 *)(extraout_ECX + 0x20) = uVar1;
    FUN_00a35146();
  }
  *unaff_FS_OFFSET = *(undefined4 *)(unaff_EBP + -0xc);
  return;
}


```


## 14. MAP_EFFECT (0x0091)


## 15. SERVERMESSAGE (0x0041)


## 16. SHOW_STATUS_INFO (0x0048)


## 17. OPEN_FAMILY (0x0065)

**Server handler:** `FamilyHandler.OpenFamily`


## 18. FAMILY (0x006a)

**Server handler:** `FamilyHandler.RequestFamily`


## 19. SHOW_NOTES (0x002b)
