# 武器→命中边距映射（指令级材料）


## 普攻分派 (0x55c5b2)

- 行876 (带分支条件):
    iVar3 = *(int *)(unaff_EBP + -0xf68);
    *(undefined4 *)(iVar3 + 0x90) = *puVar4;
    *(undefined4 *)(iVar3 + 0x94) = uVar2;
    if ((*(int *)(unaff_EBP + -0xbec) == 0x2f514d) && (*(int *)(unaff_EBP + -0xc5c) != 0)) {
    *(int *)(*(int *)(unaff_EBP + -0xf68) + 0x10) = *(int *)(unaff_EBP + -0xbb0) + 200;
    }

- 行886 (带分支条件):
    }
    else if (((*(int *)(unaff_EBP + -0xbec) == 0x2f785c) ||
    (*(int *)(unaff_EBP + -0xbec) == 0x30fefc)) ||
    (*(undefined **)(unaff_EBP + -0xbec) == &DAT_00c80ed8)) {
    *(int *)(*(int *)(unaff_EBP + -0xf68) + 0x10) = *(int *)(unaff_EBP + -0xc00) + 400;
    }

- 行931:
    *(undefined4 *)(unaff_EBP + -0x18a0) = *(undefined4 *)(unaff_EBP + -0x1410);
    *(undefined4 *)(unaff_EBP + -0x18a0) =
    *(undefined4 *)**(undefined4 **)(unaff_EBP + -0x1414);
    }
    iStack_1c = 500;
    iStack_20 = *(int *)(unaff_EBP + -0xbb0);

- 行1251:
    *(int *)(unaff_EBP + -0xfac) = *(int *)(unaff_EBP + -0xfac) + 1;
    }
    iStack_1c = *(int *)(unaff_EBP + -0xcf8);
    iStack_20 = *(int *)(unaff_EBP + -0xbe0);
    iStack_24 = **(int **)(unaff_EBP + -0xfa8) + 400;
    iStack_28 = 1;

- 行1276:
    iStack_24 = *(int *)(unaff_EBP + -0xfa4) + 0x18;
    iStack_28 = *(int *)(unaff_EBP + 0xc);
    FUN_007941d7(*(undefined4 *)(unaff_EBP + -0xc50),*(undefined4 *)(unaff_EBP + -0xbd8),
    *(undefined4 *)(unaff_EBP + -0xc4c),*(undefined4 *)(unaff_EBP + -0x1458),
    **(int **)(unaff_EBP + -0xfa4) + 400,*(undefined4 *)(unaff_EBP + -0x1454),
    *(undefined4 *)(unaff_EBP + -0xbfc),*(undefined4 *)(unaff_EBP + -0x1450),


## 分派B (0x55fe76)

- 行220 (带分支条件):
    }
    iStack_10 = 0x960319;
    iVar3 = FUN_0070df65();
    if (iVar3 != 0) {
    iStack_10 = *(undefined4 *)(*(int *)(unaff_EBP + -0xc28) + 300);
    iStack_14 = *(int *)(unaff_EBP + -0xc28) + 0x124;

- 行657:
    }
    else {
    *(uint *)(unaff_EBP + -0xefc) =
    *(int *)(unaff_EBP + -0xca8) +
    (-(uint)(*(int *)(unaff_EBP + -0xc80) != 0) & 0xfffffda8) + 300;
    *(undefined4 *)(unaff_EBP + -0xef8) = *(undefined4 *)(unaff_EBP + -0xca4);

- 行926:
    iStack_44 = *(int *)(unaff_EBP + 8);
    iStack_48 = *(int *)(unaff_EBP + -0xc00);
    FUN_00796ba0(*(undefined4 *)(unaff_EBP + -0x13f4),*(int *)(unaff_EBP + -0xbdc) + 0x2098,
    *(int *)(unaff_EBP + -0xbdc) + 0x2110,*(undefined4 *)(unaff_EBP + -0x13ec),
    **(int **)(unaff_EBP + -0xf84) + 400,*(undefined4 *)(unaff_EBP + -0xc24),
    *(undefined4 *)(unaff_EBP + -0x13e8));

- 行1039:
    *(int *)(unaff_EBP + -0xf8c) = *(int *)(unaff_EBP + -0xf8c) + 1;
    }
    iStack_3c = *(int *)(unaff_EBP + -0xc7c);
    iStack_40 = *(undefined4 *)(unaff_EBP + -0xbd0);
    iStack_44 = **(int **)(unaff_EBP + -0xf84) + 400;
    iStack_48 = 2;


## 技能 (0x10e6f4)

- 行503 (带分支条件):
    *(int **)(unaff_EBP + -0x1c) = piVar9;
    puStack_ac = *(undefined **)(unaff_EBP + -0x38);
    puStack_c0 = (undefined4 *)0x50edd0;
    piStack_bc = piVar9;
    iVar5 = (**(code **)(iVar5 + 100))();
    if (iVar5 < 0) {
