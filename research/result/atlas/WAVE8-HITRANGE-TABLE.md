# 攻击命中范围常量表


## 普攻分派 (0x55c5b2)

    874: *(undefined4 *)(iVar3 + 0x94) = uVar2;
    875: if ((*(int *)(unaff_EBP + -0xbec) == 0x2f514d) && (*(int *)(unaff_EBP + -0xc5c) != 0)) {
  ->876: *(int *)(*(int *)(unaff_EBP + -0xf68) + 0x10) = *(int *)(unaff_EBP + -0xbb0) + 200;
    877: }
    878: else if (((*(int *)(unaff_EBP + -0xbec) == 0x30fefb) ||

    884: (*(int *)(unaff_EBP + -0xbec) == 0x30fefc)) ||
    885: (*(undefined **)(unaff_EBP + -0xbec) == &DAT_00c80ed8)) {
  ->886: *(int *)(*(int *)(unaff_EBP + -0xf68) + 0x10) = *(int *)(unaff_EBP + -0xc00) + 400;
    887: }
    888: else if ((*(int *)(unaff_EBP + -0xbec) == 0x4e23ea) ||

    976: if (*(int *)(unaff_EBP + -4000) < 0x96) {
    977: *(int *)(unaff_EBP + -0xf9c) =
  ->978: *(int *)(unaff_EBP + -0xf9c) - (0x4b - *(int *)(unaff_EBP + -4000) / 2);
    979: *(int *)(unaff_EBP + -0xf94) =
    980: *(int *)(unaff_EBP + -0xf94) + (0x4b - *(int *)(unaff_EBP + -4000) / 2);

    978: *(int *)(unaff_EBP + -0xf9c) - (0x4b - *(int *)(unaff_EBP + -4000) / 2);
    979: *(int *)(unaff_EBP + -0xf94) =
  ->980: *(int *)(unaff_EBP + -0xf94) + (0x4b - *(int *)(unaff_EBP + -4000) / 2);
    981: }
    982: *(int *)(unaff_EBP + -0xf98) = *(int *)(unaff_EBP + -0xf90) + -10;

    1249: iStack_1c = *(int *)(unaff_EBP + -0xcf8);
    1250: iStack_20 = *(int *)(unaff_EBP + -0xbe0);
  ->1251: iStack_24 = **(int **)(unaff_EBP + -0xfa8) + 400;
    1252: iStack_28 = 1;
    1253: uVar2 = FUN_00799938();

    1274: FUN_007941d7(*(undefined4 *)(unaff_EBP + -0xc50),*(undefined4 *)(unaff_EBP + -0xbd8),
    1275: *(undefined4 *)(unaff_EBP + -0xc4c),*(undefined4 *)(unaff_EBP + -0x1458),
  ->1276: **(int **)(unaff_EBP + -0xfa4) + 400,*(undefined4 *)(unaff_EBP + -0x1454),
    1277: *(undefined4 *)(unaff_EBP + -0xbfc),*(undefined4 *)(unaff_EBP + -0x1450),
    1278: *(undefined4 *)(unaff_EBP + -0xd08),1,*(undefined4 *)(unaff_EBP + -0xc68),


## 分派B (0x55fe76)

    218: iVar3 = FUN_0070df65();
    219: if (iVar3 != 0) {
  ->220: iStack_10 = *(undefined4 *)(*(int *)(unaff_EBP + -0xc28) + 300);
    221: iStack_14 = *(int *)(unaff_EBP + -0xc28) + 0x124;
    222: iStack_18 = 0x96033a;

    655: *(uint *)(unaff_EBP + -0xefc) =
    656: *(int *)(unaff_EBP + -0xca8) +
  ->657: (-(uint)(*(int *)(unaff_EBP + -0xc80) != 0) & 0xfffffda8) + 300;
    658: *(undefined4 *)(unaff_EBP + -0xef8) = *(undefined4 *)(unaff_EBP + -0xca4);
    659: if (*(int *)(unaff_EBP + -0xefc) < *(int *)(unaff_EBP + -0xbc8)) {

    857: FUN_00692dbb();
    858: *(int *)(unaff_EBP + -0xf48) =
  ->859: (*(int *)(unaff_EBP + -0xf70) + *(int *)(unaff_EBP + -0xf68)) / 2;
    860: *(int *)(unaff_EBP + -0xf44) =
    861: (*(int *)(unaff_EBP + -0xf6c) + *(int *)(unaff_EBP + -0xf64)) / 2;

    859: (*(int *)(unaff_EBP + -0xf70) + *(int *)(unaff_EBP + -0xf68)) / 2;
    860: *(int *)(unaff_EBP + -0xf44) =
  ->861: (*(int *)(unaff_EBP + -0xf6c) + *(int *)(unaff_EBP + -0xf64)) / 2;
    862: }
    863: FUN_00692dbb();

    863: FUN_00692dbb();
    864: *(int *)(unaff_EBP + -0xf50) =
  ->865: (*(int *)(unaff_EBP + -0xf60) + *(int *)(unaff_EBP + -0xf58)) / 2;
    866: *(int *)(unaff_EBP + -0xf4c) =
    867: (*(int *)(unaff_EBP + -0xf5c) + *(int *)(unaff_EBP + -0xf54)) / 2;

    865: (*(int *)(unaff_EBP + -0xf60) + *(int *)(unaff_EBP + -0xf58)) / 2;
    866: *(int *)(unaff_EBP + -0xf4c) =
  ->867: (*(int *)(unaff_EBP + -0xf5c) + *(int *)(unaff_EBP + -0xf54)) / 2;
    868: *(undefined1 **)(unaff_EBP + -0x1040) = &stack0xffffffd0;
    869: *(undefined1 **)(unaff_EBP + -0x13a8) = &stack0xffffffd0;

    924: FUN_00796ba0(*(undefined4 *)(unaff_EBP + -0x13f4),*(int *)(unaff_EBP + -0xbdc) + 0x2098,
    925: *(int *)(unaff_EBP + -0xbdc) + 0x2110,*(undefined4 *)(unaff_EBP + -0x13ec),
  ->926: **(int **)(unaff_EBP + -0xf84) + 400,*(undefined4 *)(unaff_EBP + -0xc24),
    927: *(undefined4 *)(unaff_EBP + -0x13e8));
    928: *(undefined1 *)(unaff_EBP + -4) = 0x12;

    943: if (((*(int *)(unaff_EBP + -0xbd8) == 0x2195ad) ||
    944: (*(int *)(unaff_EBP + -0xbd8) == 0x231c4a)) &&
  ->945: (*(int *)(unaff_EBP + -0xbf8) < *(int *)(unaff_EBP + -0xc7c) / 2)) {
    946: *(uint *)(unaff_EBP + -0xf88) = (uint)(*(int *)(unaff_EBP + -0xc80) == 0);
    947: }

    1037: iStack_3c = *(int *)(unaff_EBP + -0xc7c);
    1038: iStack_40 = *(undefined4 *)(unaff_EBP + -0xbd0);
  ->1039: iStack_44 = **(int **)(unaff_EBP + -0xf84) + 400;
    1040: iStack_48 = 2;
    1041: uVar2 = FUN_00799938();


## 技能 (0x10e6f4)

    449: piStack_a4 = (int *)0x50ed15;
    450: iVar8 = FUN_00429944();
  ->451: piStack_a4 = (int *)(iVar8 - iVar5 / 2);
    452: piStack_a8 = (int *)0x50ed1f;
    453: FUN_004299f9();

    461: piStack_a4 = (int *)0x50ed4a;
    462: iVar8 = FUN_00429944();
  ->463: piStack_a4 = (int *)(iVar8 - iVar5 / 2);
    464: piStack_a8 = (int *)0x50ed54;
    465: FUN_004299f9();

    501: puStack_c0 = (undefined4 *)0x50edd0;
    502: piStack_bc = piVar9;
  ->503: iVar5 = (**(code **)(iVar5 + 100))();
    504: if (iVar5 < 0) {
    505: puStack_c0 = (undefined4 *)&DAT_00ba0500;
