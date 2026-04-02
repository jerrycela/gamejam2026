---
id: "013"
title: "Priest Hero Traits — Heal Skill + Anti-Undead"
status: proposed
date: "2026-04-02"
specs_affected:
  - battle
  - heroes
risk: low
revision: 2
review_history:
  - round: 1
    codex: "60% NO — 1 P1 (HeroInstance filters out heal skill), 3 P2 (maxHp cap, popup prefix, misleading verification)"
    gemini: "50% NO — 1 P1 (REJECT: restating the task, not a contradiction), 1 P3 (REJECT: already handled by short-circuit)"
    exit: "R1 fixes: add HeroInstance.js to affected files, fix skill normalization to keep heal-type, use hero.maxHp for cap, emit string '+N' for popup, correct verification for anti_undead scope."
---

# Proposal 013: Priest Hero Traits

## Why

Priest（祭司）已在 heroes.json 定義（stats、spawnWeight、skill 描述），但 trait 為空、heal skill 被 HeroInstance 正規化邏輯過濾掉——等於空殼英雄。補齊後完成 5 英雄陣容，heal 機制為 boss 戰增加存活策略。

## Design Decisions

| Decision | Choice | Reason |
|----------|--------|--------|
| Anti-undead trait | 複用 `anti_undead` trait，multiplier 1.25 | 與 holy_knight (1.35) 同機制但弱化，代碼零新增 |
| Heal skill 目標 | Boss 戰：最低 HP 友方英雄（含自己）；一般戰：自我治療 | 一般戰各英雄獨立在不同 cell |
| Heal 上限 | `Math.min(target.hp + healAmount, target.maxHp)` | 用 HeroInstance.maxHp（已含縮放），不超過上限 |
| HeroInstance skill 正規化 | 改為保留 `damage` 型 **或** `heal` 型 skill | 現有邏輯只保留 damage 型，priest heal 被過濾 |
| UI popup | emit `heroHeal` 帶 `{ hero, target, amount }` → BattleUI 傳 `'+20'` 字串 | `_spawnDamagePopup` 對字串不加 `-` 前綴 |
| Anti-undead 範圍 | **僅普攻**（priest skill 是 heal 不是 damage） | 既有 anti_undead 只在 damage 路徑觸發 |
| 自動護盾 | 本次不做 | Game Jam 範圍限制 |

## Implementation

### Affected Files

| File | Change | Lines |
|------|--------|-------|
| `src/data/heroes.json` | priest 加 `trait` 欄位 | ~1 |
| `src/models/HeroInstance.js` | skill 正規化：保留 damage 或 healAmount 型 | ~2 |
| `src/models/BattleManager.js` | `_tickMonsterFight` + `_tickBossFight` 加 heal skill 分支 | ~30 |
| `src/substates/BattleUI.js` | 監聯 `heroHeal` 事件，綠色 popup | ~12 |

預估改動：~45 行（小型）

### Steps

1. `heroes.json` priest 加 `"trait": { "id": "anti_undead", "multiplier": 1.25 }`
2. `HeroInstance.js` line 23 改為：
   ```js
   this.skill = (def.skill && (def.skill.damage || def.skill.healAmount)) ? { ...def.skill } : null;
   ```
3. `BattleManager._tickMonsterFight` — 在 skill timer 觸發後，分流：
   - `hero.skill.damage` → 現有傷害邏輯（不變）
   - `hero.skill.healAmount` → `const amount = Math.min(hero.skill.healAmount, hero.maxHp - hero.hp); hero.hp += amount; emit('heroHeal', { hero, target: hero, amount })`
4. `BattleManager._tickBossFight` — 在 skill timer 觸發後，分流：
   - `hero.skill.damage` → 現有傷害邏輯（不變）
   - `hero.skill.healAmount` → 找 `_heroes` 中 `state === 'fighting' && hp > 0` 的最低 HP 英雄 → heal → emit `heroHeal`
5. `BattleUI` bind `heroHeal`，handler 用 `_spawnDamagePopup` 傳 `'+${amount}'` 字串 + 綠色 `#2ecc71`

### Verification

- [ ] Priest 在一般戰自我治療，HP 不超過 maxHp
- [ ] Priest 在 boss 戰治療最低 HP 友方（含自己）
- [ ] Anti-undead trait (+25%) 套用於 priest 普攻 vs undead 怪物
- [ ] heroHeal 事件觸發，BattleUI 顯示綠色 `+N` popup（非 `-N`）
- [ ] HeroInstance 正確保留 heal 型 skill
- [ ] 不影響其他英雄的技能邏輯
- [ ] ESLint 通過、build 成功
