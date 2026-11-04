# Task 061: 游戏公式提取报告

## 1. 伤害计算公式

```java
// 主属性 + 副属性 → 最大基础伤害
public final float calculateMaxBaseDamage(int watk) {
    // 武器类型决定主/副属性:
    switch (weapon) {
        case BOW, CROSSBOW:  mainstat = DEX; secondarystat = STR;
        case CLAW, DAGGER:   mainstat = LUK; secondarystat = DEX + STR;  // 盗贼
        case STAFF, WAND:    mainstat = INT; secondarystat = LUK;  // 法师
        default(剑/斧/锤):  mainstat = STR; secondarystat = DEX;  // 战士
    }
    // 最终公式:
    maxbasedamage = (mainstat * 5.0 + secondarystat) * watk / 100.0f;
}
```

**简化: `最大伤害 = (主属性 × 5.0 + 副属性) × 武器攻击力 ÷ 100`**

## 2. 伤害上限 (DamageParse)

```java
int maxdamage = 199999 + chr.getVip() * 1000000;
damage = Math.min(clientDamage, maxdamage);
```

## 3. 经验值曲线

```
等级   升级所需经验
```

## 4. 关键常量

| 常量 | 值 | 含义 |
|---|---|---|
| 199,999 | 基础伤害上限 | 无VIP最大单次伤害 |
| 5.0 | 主属性系数 | STR/DEX/INT/LUK → 伤害倍率 |
| 100.0 | 除数 | watk → 最终伤害转换 |
| VIP×1M | VIP加成 | 每级VIP增加100万伤害上限 |

## 5. 属性成长

```java
// MaxMP 公式 (MapleCharacter.recalcDerivedStats):
maxmp += getTotalInt() / 10;  // 每10点INT增加1点MaxMP
```
