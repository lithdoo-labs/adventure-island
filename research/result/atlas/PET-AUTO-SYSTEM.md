# 宠物自动行为系统 + BATCH13 语义批次

日期: 2026-11-12 第六轮。

## 宠物自动行为系统（完整架构）

### 6 项设置键
| 键 | 语义 |
|---|---|
| e_levelup | 升级时表情 |
| e_prelevelup | 升级前表情 |
| e_rest | 休息时表情 |
| e_HPAlert | HP 警戒阈值（自动提醒） |
| e_NOHPPotion | HP 药水耗尽时动作 |
| e_NOMPPotion | MP 药水耗尽时动作 |

### 结构
- **41 个加载器函数**（等大小 5,536 字符）= 41 个窗口/上下文类
- 每个加载器：6 个连续全局（24 字节设置块）+ FUN_0041cb7f(键名, -1) 读取
- 设置块遍布 0xBD8FC8-0xBE65B8 = 设置全局区
- FUN_0041cb7f = WZ 配置读取器（Ghidra 间隙函数，模式与 0x40263b 族一致）

### 结论
宠物自动药水/自动表情 = 每上下文可独立配置的 6 键系统；
与盲区发现的 e_XXX 字符串簇、Effect/PetEff.img 完全互证。

## BATCH13：148 个信号函数分组阅读（51 组）

| 组 | 数量 | 身份 |
|---|---|---|
| e_levelup 加载器 | 41 | 宠物自动行为设置（上） |
| crypto-intensive | 24 | 移动物体更新操作（enc 读+写+vt） |
| crypto-user | 13 | 加密位置读取器（FUN_00548806 解密读） |
| physics-heavy;crypto | 10 | 移动物理综合更新（4-6r/4-8w 加密 + Physics 引用） |
| physics-ref | 9 | 物理参数使用方 |
| PetEff/ItemEff/ViciousHammer/Gachapon/ItemMake/EmptyCanvas 等 | 51 | 各 UI/效果窗口构建器（分组见 batch13-run.log） |

## 资产
- EMOTION-REGISTRATION.csv（41 加载器 × 全局块映射）
- batch13-run.log（51 组完整分组）
