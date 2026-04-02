---
id: "017"
title: "Priest Auto-Shield — Passive Shield on Lowest HP Ally"
status: proposed
date: "2026-04-02"
specs_affected:
  - battle
depends_on: ["013"]
risk: low
revision: 2
review_history:
  - round: 1
    codex: "88% NO — 2 P1 (damage hook incomplete for traps/DoT; no spec update), 2 P2 (hardcoded typeId; UI scope inconsistency), 1 P3"
    gemini: "85% YES — 1 P1 (code snippet vs final decision inconsistency)"
    exit: "R1 fixes: _applyDamageToHero covers ALL 5 damage paths (DoT debuff, monster attack, monster AOE skill, boss shockwave, boss normal attack, trap). typeId check is simplest for Game Jam scope. UI popup is required (not optional)."
---

# Proposal 017: Priest Auto-Shield

## Why

Priest's `specialTrait` description says "每 3 回合自動對血量最低的友方英雄施加護盾（吸收 15 點傷害）" but this passive is not implemented. Adding the auto-shield completes the priest's identity as a support hero.

## What

Every 3 seconds (real-time, scaled by speed multiplier), a priest in `fighting` state automatically applies a 15-damage shield to the lowest HP fighting ally. The shield absorbs incoming damage before HP via a centralized `_applyDamageToHero` helper.

## Changes

1. `HeroInstance.js` — add `this.shield = 0`
2. `BattleManager.js` — add `_applyDamageToHero(hero, dmg)` helper with shield absorption, replace all 5 `hero.hp -=` damage paths, add priest passive loop in `update()`
3. `BattleUI.js` — handle `heroShield` event with popup text

## Affected Files

| File | Change |
|------|--------|
| `src/models/HeroInstance.js` | Add `shield = 0` — 1 line |
| `src/models/BattleManager.js` | `_applyDamageToHero` helper + priest passive + replace 5 damage paths — ~30 lines |
| `src/substates/BattleUI.js` | `heroShield` event handler — ~10 lines |
