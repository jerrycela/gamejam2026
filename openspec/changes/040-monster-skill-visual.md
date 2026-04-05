---
id: "040"
title: "Monster Skill Visual Feedback"
status: applied
date: "2026-04-05"
specs_affected:
  - battle
depends_on: []
risk: low
---

# Proposal 040: Monster Skill Visual Feedback

## Why

When monsters use skills, there's no visual distinction from normal attacks — same white flash. Players can't tell when synergy-enhanced skills fire or appreciate their strategic placement. DM shows skill names prominently.

## What

1. Add `skillName` to monster skill attack events in BattleManager
2. In BattleUI, when a monster uses a skill, show the skill name as a floating text above the cell (distinct from damage numbers)

## Changes

### `src/models/BattleManager.js` (~4 lines)

Add `skillName: skillDef.name` to the two `emit('attack', ...)` calls in the monster skill block (lines 431, 436).

### `src/substates/BattleUI.js` (~10 lines)

In `_onAttack`, destructure `isSkill` and `skillName`. When `targetType === 'hero'` and `isSkill && skillName`:
- Show skill name text at cell position (y - 50), color cyan (#00ddff), fontSize 11px
- Float up + fade out over 800ms
- Only show if speed multiplier < 10

## Risk

Low. Adds one field to existing event, one visual element. No game state changes.

## Verification

1. `npm run build` passes
2. Battle: when monster uses skill, see skill name float above cell
3. Synergy-enhanced skills show enhanced skill name
4. High-speed mode (10x): no skill text spawned
