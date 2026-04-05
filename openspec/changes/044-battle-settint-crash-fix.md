# P044: Fix battle freeze caused by setTint on arc fallback sprites

## Why

QA 核心玩法測試發現 **High severity** bug：戰鬥完全卡住。

根因鏈：
1. 怪物/部分英雄的 sprite 不存在 → `SpriteHelper.createSprite` 回傳 `Phaser.GameObjects.Arc`（灰色圓形 fallback）
2. 戰鬥中 `BattleUI` 監聽 BattleManager 的 `'attack'` 事件，呼叫 `targetSprite.setTint(0xff0000)` 做受擊閃紅
3. `Arc` 沒有 `setTint`/`clearTint` 方法 → **throws TypeError**
4. TypeError 在 `BattleManager.update()` 中冒泡（emit → listener throw → update crash）
5. 同 frame 後續所有 hero tick 和 boss tick 被跳過
6. **效果**：boss 戰鬥永遠不結束（攻擊 timer 完全凍結）

影響範圍：所有使用 arc fallback sprite 的戰鬥（= 所有怪物 + hero_thief）

## What

`src/utils/SpriteHelper.js` 的 arc fallback 加上 `setTint`/`clearTint` no-op stub，防止 TypeError。

## Affected Files

- `src/utils/SpriteHelper.js` (2 lines added)

## Risk

Low — 只在 fallback arc 上加空方法，不改遊戲邏輯

## Verification

- 開始戰鬥（翻 normalBattle 牌）→ 英雄和怪物正常互打
- console 無 `setTint is not a function` 錯誤
- 英雄到 heart cell 後 boss HP 正常下降
- 戰鬥能正常結束（defenseSuccess 或 bossBreached）
