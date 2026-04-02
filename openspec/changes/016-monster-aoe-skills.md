---
id: "016"
title: "Monster AOE Skills — Multi-Target Skill Activation"
status: proposed
date: "2026-04-02"
specs_affected:
  - battle
depends_on: []
risk: low
revision: 2
review_history:
  - round: 1
    codex: "84% NO — 2 P1 (AOE target scope too broad vs boss precedent; death handling unsafe for non-fighting heroes), 1 P2, 1 P3"
    gemini: "95% YES — 0 P1, 2 P3"
    exit: "R1 fixes: narrow AOE targets to state === 'fighting' && hp > 0, matching boss shockwave pattern exactly. This resolves both P1s — only fighting heroes are hit, so existing per-tick death checks are sufficient."
---

# Proposal 016: Monster AOE Skills

## Why

Two monsters (bat_succubus, frost_witch) already have `skill.type: "aoe"` in their JSON data, but BattleManager ignores the type field and treats all monster skills as single-target. This wastes existing data design and reduces tactical variety — AOE monsters should punish hero clustering.

## What

When a monster's skill type is `"aoe"`, the skill damage hits all heroes currently in combat (`state === 'fighting'` and `hp > 0`), not just the hero fighting that monster. Single-target skills (`"single"`) remain unchanged.

## Design Decisions

| Decision | Choice | Reason |
|----------|--------|--------|
| AOE targets | All heroes with `state === 'fighting'` and `hp > 0` | Exact same pattern as boss shockwave (BattleManager line 482) |
| AOE damage | Same `skillDef.damage` to each target (no split) | Simple, consistent with boss AOE |
| Hero death from AOE | Handled by existing per-tick death check (line 358) | Same as boss shockwave — no immediate death resolution needed |
| Synergy-enhanced AOE | Enhanced skill inherits type from base if not overridden | Already uses spread: `{ ...base, ...enhanced }` |
| frost_witch slowTurns | Ignored for now (no slow system yet) | Pure damage AOE is the MVP; slow is future work |

## Changes

### 1. `src/models/BattleManager.js` — `_tickMonsterFight()` (~15 lines changed)

Current code (lines 342-356): monster skill always does `hero.hp -= dmg` to the single combat hero.

Change: check `skillDef.type`:
- If `"aoe"`: iterate `this._heroes.filter(h => h.state === 'fighting' && h.hp > 0)`, apply damage to each, emit attack event per hit
- If `"single"` (or default): keep current behavior (damage only the combat hero)

```js
if (ctx.monsterSkillTimer >= skillDef.cd * 1000) {
  ctx.monsterSkillTimer = 0;
  const dmg = skillDef.damage;

  if (skillDef.type === 'aoe') {
    const targets = this._heroes.filter(h => h.state === 'fighting' && h.hp > 0);
    for (const target of targets) {
      target.hp -= dmg;
      this.emit('attack', { attackerType: 'monster', attackerId: monster.instanceId, targetType: 'hero', targetId: target.instanceId, damage: dmg, isSkill: true, cellId: ctx.cellId });
    }
  } else {
    hero.hp -= dmg;
    this.emit('attack', { attackerType: 'monster', attackerId: monster.instanceId, targetType: 'hero', targetId: hero.instanceId, damage: dmg, isSkill: true, cellId: ctx.cellId });
  }
}
```

### 2. Hero death from AOE — no extra code needed

Heroes hit by AOE who reach `hp <= 0` will be resolved in their own `_tickMonsterFight` or `_tickBossFight` call's death check on the same or next tick. This is the exact pattern boss shockwave uses — it does not immediately resolve deaths either.

## Affected Files

| File | Change |
|------|--------|
| `src/models/BattleManager.js` | Modify monster skill block in `_tickMonsterFight` — ~15 lines |

## Risk

Low. Single-file change in existing skill execution path. AOE pattern proven by boss shockwave. No data schema changes needed.

## Verification

1. `npm run build` passes
2. Place bat_succubus (AOE: 魅惑尖叫) in a room, trigger battle with 2+ fighting heroes → all fighting heroes take damage when skill fires
3. Place skeleton_knight (single: 猛劈) → only the fighting hero takes skill damage (no regression)
4. frost_witch AOE (極寒領域) hits all fighting heroes, slowTurns ignored gracefully
5. Synergy-enhanced AOE (bat_succubus in treasury) uses enhanced damage but still hits all fighting heroes
6. Heroes in `moving` or `waitingForCombat` state are NOT hit by AOE
