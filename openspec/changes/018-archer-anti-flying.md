---
id: "018"
title: "Archer Anti-Flying + Generic combatTrait System"
status: proposed
date: "2026-04-02"
specs_affected:
  - battle
  - units
depends_on: ["011"]
risk: low
revision: 2
review_history:
  - round: 1
    codex: "82% NO — 1 P1 (hardcoded typeId not data-driven), 2 P2 (spec conflict, UI underspecified), 1 P3"
    gemini: "429 (flash capacity exhausted)"
    exit: "R1 fixes: introduced data-driven combatTrait field in heroes.json with targetType+multiplier. Refactored anti_undead to use same system. All combat bonuses now generic."
---

# Proposal 018: Archer Anti-Flying + Generic combatTrait

## Why

light_archer's anti-flying bonus and priest/holy_knight's anti-undead bonuses were implemented differently (anti_undead hardcoded in trait.id checks). Unifying into a generic `combatTrait` system makes all combat bonuses data-driven.

## What

- Add `combatTrait: { id, targetType, multiplier }` to heroes.json for archer (flying, 1.2x), priest (undead, 1.25x), holy_knight (undead, 1.35x)
- Refactor BattleManager to use generic `hero.combatTrait.targetType` check instead of hardcoded `anti_undead`
- Separate from `trait` (which handles non-combat abilities like trap_parry, first_trap_skip)

## Changes

1. `heroes.json` — add `combatTrait` to archer, priest, holy_knight
2. `HeroInstance.js` — add `this.combatTrait = def.combatTrait || null`
3. `BattleManager.js` — replace 2 hardcoded `anti_undead` checks with generic `combatTrait.targetType` check
