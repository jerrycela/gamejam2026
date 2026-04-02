---
id: P011
title: Hero Special Traits — 4 passive abilities (parry, skip, burn, anti-undead)
status: approved
date: 2026-04-02
version: 2.0
specs_affected: [units, battle]
risk: low
---

# P011 — Hero Special Traits

## Why

heroes.json 已定義每位英雄的 specialTrait 文字描述，但戰鬥中完全沒有對應行為。所有英雄除了數值差異外玩起來一樣。實作 trait 能讓玩家明確感受「不同英雄 = 不同威脅」，增加地城配置的策略考量。

## Scope（本期 vs 延後）

每位英雄的 specialTrait 文案描述終態能力，本期只實作**主要 clause**：

| hero | 本期實作 | 延後（P012+） |
|------|----------|---------------|
| trainee_swordsman | 10% trap parry | — |
| light_archer | first trap skip | +20% vs flying |
| fire_mage | 30% burn on skill | — |
| holy_knight | +35% vs undead | — |
| priest | — | auto-shield + 25% vs undead |
| hero_of_legend | — | 無 trait |

specialTrait 文字不修改（描述終態，非當前實作範圍）。

## What

### 1. heroes.json — 新增 trait 物件

保留原 specialTrait 文字，新增 machine-readable `trait` 欄位：

```json
// trainee_swordsman
"trait": { "id": "trap_parry", "chance": 0.1 }

// light_archer
"trait": { "id": "first_trap_skip" }

// fire_mage
"trait": { "id": "burn_on_skill", "chance": 0.3, "damage": 5, "ticks": 3 }

// holy_knight
"trait": { "id": "anti_undead", "multiplier": 1.35 }

// priest, hero_of_legend
// 無 trait 欄位
```

### 2. HeroInstance.js — 初始化 trait

```js
this.trait = def.trait || null;
this.traitState = {};  // mutable per-battle state
```

**traitState 初始 keys：**
- `first_trap_skip` → `{ firstTrapUsed: false }`
- 其他 trait → `{}`（無狀態）

生命週期：HeroInstance 是 battle-scoped，每場戰鬥自動重建。

### 3. BattleManager.js — trait 邏輯

**_resolveTrap 改動（trap_parry + first_trap_skip）：**

`_resolveTrap` 返回值從 `number` 改為 `{ damage, status }` 物件：
- `status: 'normal'` — 正常觸發
- `status: 'parried'` — trap_parry 成功
- `status: 'skipped'` — first_trap_skip 觸發

Trait check 在 damage 計算前：
- `trap_parry`：`Math.random() < trait.chance` → return `{ damage: 0, status: 'parried' }`
- `first_trap_skip`：`!hero.traitState.firstTrapUsed` → set flag, return `{ damage: 0, status: 'skipped' }`

Caller（_tickMoving）依 status emit 不同事件：
- `'normal'` → emit `trapTrigger`（既有行為）
- `'parried'` → emit `trapParry`（不 emit trapTrigger）
- `'skipped'` → emit `trapSkip`（不 emit trapTrigger）

**_tickMonsterFight 擴充（anti_undead + burn_on_skill）：**

`anti_undead`：hero normal attack / skill damage × trait.multiplier（當 `monsterDef.type.includes('undead')`）。emit attack 事件加 `holyBonus: true` flag。

`burn_on_skill`：hero skill hit 後 `Math.random() < trait.chance` → 設 `ctx.burnState = { damage: trait.damage, ticksRemaining: trait.ticks, timer: 0 }`。

**Burn 機制：**
- **獨立 timer**：`ctx.burnState.timer += dt`，每 1500ms（1.5s）tick 一次，不綁 monsterAttackTimer
- **Tick 行為**：`monster.currentHp -= burnState.damage`（raw damage，不受 DEF 減免），emit `burnDamage`，`ticksRemaining--`
- **Tick ordering**：burn tick 在 monster attack 之後、hero death check 之前
- **Refresh policy**：再次 proc 時覆蓋（reset ticksRemaining 為 trait.ticks），不疊加
- **Monster death**：burn tick 後 check `monster.currentHp <= 0` → 觸發 monsterDefeated
- **清除**：combat context 刪除時 burnState 自然清除

**Boss fight 限制（明確）：**
- Trap traits（parry, skip）在 boss 路徑上正常生效（trap processing 發生在 boss cell 之前）
- Combat traits（anti_undead, burn_on_skill）僅在 _tickMonsterFight 中，不影響 _tickBossFight / _tickBossSharedAttack。Boss 不是 typed monster，此為 MVP 範圍限制。

### 4. BattleUI.js — 視覺回饋

| 事件 | 顯示 | 顏色 |
|------|------|------|
| trapParry | "Parry!" text popup | #ffffff |
| trapSkip | "Skip!" text popup | #00bcd4 (cyan) |
| burnDamage | -{damage} popup | #e67e22 (orange) |
| attack (holyBonus: true) | -{damage} popup | #ffd700 (gold) |

### Affected Files

- `src/data/heroes.json` — 新增 trait 欄位
- `src/models/HeroInstance.js` — 初始化 trait + traitState
- `src/models/BattleManager.js` — _resolveTrap 返回物件 + trait 邏輯 + burn timer
- `src/substates/BattleUI.js` — 新事件監聽 + popup 顏色

### Verification

- [ ] 見習劍士偶爾（~10%）閃避陷阱傷害，顯示 "Parry!"（不顯示橘色 0 傷害）
- [ ] 光弓獵手第一次踩陷阱免疫顯示 "Skip!"，第二次起正常受傷（per-battle reset）
- [ ] 火焰法師技能命中後 30% 機率燒傷怪物（橘色 popup，每 1.5s tick）
- [ ] 燒傷再次 proc 時 refresh（不疊加），burn 可擊殺怪物
- [ ] 聖騎士打骷髏劍士（undead）傷害明顯更高（金色 popup）
- [ ] 非 trait 情境行為不變
- [ ] burn 在戰鬥結束時正確清除
- [ ] boss fight 中 trap traits 正常，combat traits 不觸發（非 bug）

## Not Doing

- Priest auto-shield + anti-undead bonus（延後 P012+）
- Light archer +20% vs flying（延後 P012+）
- Trait 在 boss fight combat 中的效果（MVP 限制，boss 非 typed monster）
- Trait UI 圖示/描述
- Trait 升級 / meta-progression 互動
- hero_of_legend 無 trait

## Risk

- **Low**：所有邏輯 hook 進既有函式，early-return guard 保護
- **Low**：burn 用獨立 timer + combat context，combat 結束自動清除
- **Low**：_resolveTrap 返回值變更需同步 caller（僅一處）

## R1 審查修正記錄

| Finding | Sev | Source | 處理 |
|---------|-----|--------|------|
| 英雄文案多 clause 但只實作部分 | P1 | Codex | 新增 Scope 表明確本期 vs 延後 |
| Boss fight trait 不生效 | P1 | Codex+Gemini | 明確：trap traits 正常，combat traits MVP 限制 |
| trapTrigger 與 parry/skip 事件衝突 | P2 | Codex+Opus | _resolveTrap 返回 {damage, status}，caller 依 status emit |
| Burn refresh/stack 未定義 | P2 | Codex+Gemini | 定義：refresh 覆蓋，不疊加 |
| Burn timer 綁 monsterAttackTimer | P2 | Codex+Gemini | 改用獨立 1.5s timer |
| Burn damage 是否受 DEF 減免 | P2 | Gemini | 明確：raw damage |
| First trap skip scope 不明確 | P2 | Gemini | 明確：per-battle |

## 預估規模

~100-140 行，中型（5 檔案）。

## 設計依據

完整設計見 `docs/superpowers/specs/2026-04-02-hero-traits-design.md`。
