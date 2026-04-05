---
id: "042"
title: "Card Pick Strategic Info — Show Effects on Cards"
status: applied
date: "2026-04-05"
specs_affected:
  - card_pick
depends_on: []
risk: low
---

# Proposal 042: Card Pick Strategic Info

## Why

Card pick UI only shows name + type + star rating. Players can't compare effects (room buffs, trap damage) to make strategic decisions. This is the other half of the strategy feedback loop — P034 shows info at placement, but choice happens at card pick.

## What

Add effect description text below star rating on each card:

**Rooms:** "增益 [target]: [effect summary]" — same format as P034 popup
- e.g. "增益 亡靈系: 防禦 x1.30, 回復 5/s"

**Traps:** "[baseDamage] dmg [description excerpt]"
- e.g. "25 dmg 火焰範圍傷害" or "15 dmg + 減速 3格"

Text is small (10px), gray, word-wrapped within card width.

## Changes

### `src/substates/CardPickUI.js` (~25 lines)

In the `options.forEach` loop, after `starText`, add effect description text:

```js
let effectText = '';
if (option.type === 'room') {
  const def = dataManager.getRoom(option.id);
  if (def?.buffEffect) {
    const targetMap = { undead: '亡靈系', melee: '近戰系', glutton: '暴食系', mage: '法師系', greedy: '貪財系' };
    const parts = [];
    if (def.buffEffect.def) parts.push(`防禦 x${def.buffEffect.def}`);
    if (def.buffEffect.atk) parts.push(`攻擊 x${def.buffEffect.atk}`);
    if (def.buffEffect.skillDamage) parts.push(`技能 x${def.buffEffect.skillDamage}`);
    if (def.buffEffect.hpRegen) parts.push(`回復 ${def.buffEffect.hpRegen}/s`);
    effectText = `${targetMap[def.buffTarget] || def.buffTarget}: ${parts.join(', ')}`;
  }
} else {
  const def = dataManager.getTrap(option.id);
  if (def) effectText = `${def.baseDamage} dmg`;
}
```

## Risk

Low. Read-only display addition to existing UI. No game state changes.

## Verification

1. `npm run build` passes
2. Card pick: room cards show buff target + effect
3. Card pick: trap cards show base damage
4. Text doesn't overflow card bounds (wordWrap)
