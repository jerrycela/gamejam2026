---
id: "006"
title: "Torture UI — Prisoner Management, Slot Unlock, Extraction, Conversion Progress"
status: proposed
date: "2026-04-01"
specs_affected:
  - torture
  - units
risk: medium
revision: 4
review_history:
  - round: 1
    codex: "68% NO — 3 P1, 4 P2, 2 P3"
    gemini: "60% NO — 1 P1, 2 P2, 1 P3"
    exit: "R1 P1s fixed: event chain, TopHUD refresh, selectedPrisoner object ref, unlockTortureSlot encapsulated. P2s: staging scroll, centralized config, slot unlock shape, chip/extract hit area, pending queue."
  - round: 2
    codex: "82% NO — 1 P1, 2 P2, 1 P3"
    gemini: "90% YES — 0 P1, 1 P2, 2 P3"
    exit: "R2 P1 fixed: flush queue moved to onShown(), not rebuild(). P2s: topHUD.update() corrected, _getTortureTarget removed. P3s accepted: selective selectedPrisoner clear, assignPrisoner failure flash."
---

# Proposal 006: Torture UI

## Why

P004/P005 完成了戰鬥引擎和視覺層，英雄擊殺後已有俘虜機制（20% 俘獲率 + advanceTortureProgress），但 `prisoners[]` 和 `tortureSlots[]` 完全沒有 UI。玩家無法看到、指派、或管理俘虜，刑求轉化也只在背景發生。Torture UI 把這些純 model 操作變成可互動的遊戲系統。

## Design Decisions

| Decision | Choice | Reason |
|----------|--------|--------|
| UI 架構 | TortureUI class，掛在 GameScene containers.torture | 與 FlipMatrixUI/DungeonMapUI 一致的 substate 模式 |
| 俘虜指派 | Tap prisoner → tap slot（非拖放） | MVP 簡化，觸控友好，避免 Phaser drag 複雜度 |
| 轉化目標值 | 集中在 constants.js TORTURE_CONFIG | 單一真相來源，UI/State/Battle 共用 |
| 榨取收益 | 集中在 constants.js TORTURE_CONFIG | 同上 |
| 轉化完成通知 | TortureUI.onConversion(data) 顯示 toast | battleManager emit → GameScene 轉發 → TortureUI |
| Slot 排列 | 2x2 grid，居中 | 4 slot 上限，視覺簡潔 |
| Prisoner staging | 底部水平列，6 chip 可見 + offset scroll | _stagingOffset + clamp |
| 選取模型 | _selectedPrisoner 存 prisoner object ref | 避免 splice 後 index 偏移 |
| Chip vs 榨取按鈕 | 分離 interactive objects + stopPropagation | 避免 tap 選取與 tap 榨取衝突 |

## Scope

### New constants in `src/utils/constants.js`

```
export const TORTURE_CONFIG = {
  targets: { trainee_swordsman: 3, light_archer: 4, priest: 5, fire_mage: 5, holy_knight: 6 },
  extractGold: { trainee_swordsman: 50, light_archer: 75, priest: 100, fire_mage: 100, holy_knight: 125 },
  conversionMap: { trainee_swordsman: 'goblin', light_archer: 'bat_succubus', priest: 'frost_witch', fire_mage: 'rage_demon', holy_knight: 'skeleton_knight' },
};
```

### New file: `src/substates/TortureUI.js`

**Class: TortureUI**

```
constructor(scene, gameState)
  - this._scene, this._gameState
  - this._rootContainer = scene.add.container(0, 0)
  - this._slotContainers = []         // 4 slot visual groups
  - this._prisonerChips = []           // bottom staging area chips
  - this._selectedPrisoner = null      // prisoner object ref (NOT index)
  - this._stagingOffset = 0            // first visible chip index
  - this._pendingConversions = []      // queued conversion toasts for off-tab display
  - this._VISIBLE_CHIPS = 6

getContainer() -> this._rootContainer

rebuild()
  - Clear all children, rebuild from gameState.tortureSlots + gameState.prisoners
  - Selective _selectedPrisoner clear: only null if the referenced prisoner no longer exists in prisoners[] or tortureSlots
  - Clamp _stagingOffset: max(0, min(offset, prisoners.length - _VISIBLE_CHIPS))
  - Does NOT flush _pendingConversions (flush only in onShown)
  - Called on substate enter, after mutation, and on onConversion/onBattleEnd

onShown()
  - Called by GameScene.switchSubstate('torture') AFTER rebuild
  - Flush _pendingConversions: for each, show toast "{monsterName} 轉化完成！" (1.5s fade, stagger 0.5s)
  - Clear _pendingConversions after flush

onConversion(data)
  - data = { heroTypeId, monsterTypeId } from BattleManager tortureConversion event
  - Push data to _pendingConversions queue
  - Does NOT flush here (player may be in battle overlay or other tab)

onBattleEnd()
  - rebuild() to reflect progress changes from advanceTortureProgress

_buildTitle(width)
  - "刑求室" gold centered text at y=80

_buildSlots(width, contentH)
  - 2x2 grid centered (gap 120px)
  - Each slot:
    - IF locked: dark circle + "解鎖 {cost}G" label, tap -> _onSlotUnlock(index)
    - IF unlocked+empty: dashed circle + "空" label, tap -> _onSlotTap(index)
    - IF unlocked+occupied: circle with prisoner letter + progress ring + "{progress}/{target}" text

_buildPrisonerStaging(width, height)
  - y = height - TAB_BAR_HEIGHT - 100
  - Show prisoners[_stagingOffset .. _stagingOffset + _VISIBLE_CHIPS - 1]
  - Each chip = container with:
    - Circle (interactive) -> pointerdown: _onPrisonerTap(prisoner)
    - Hero letter + name text (non-interactive, inside circle container)
    - "榨取" button (separate interactive Text, pointerdown: stopPropagation + _onExtract(prisoner))
  - Left arrow (visible if _stagingOffset > 0): _onStagingScroll(-1)
  - Right arrow (visible if _stagingOffset + _VISIBLE_CHIPS < prisoners.length): _onStagingScroll(+1)

_onStagingScroll(delta)
  - _stagingOffset = clamp(_stagingOffset + delta, 0, max(0, prisoners.length - _VISIBLE_CHIPS))
  - rebuild()

_onSlotUnlock(slotIndex)
  - Guard: gameState.gold >= slot.cost
  - Call gameState.unlockTortureSlot(slotIndex) [NEW method]
  - this._scene.topHUD.update()
  - rebuild()

_onPrisonerTap(prisoner)
  - Toggle: if _selectedPrisoner === prisoner -> null, else -> prisoner
  - Visual: highlight selected chip border

_onSlotTap(slotIndex)
  - Guard: slot unlocked + empty + _selectedPrisoner !== null
  - Call gameState.assignPrisoner(slotIndex, _selectedPrisoner) [NEW method, takes object ref]
  - If returns false: flash slot border red (300ms) as failure feedback
  - _selectedPrisoner = null
  - rebuild()

_onExtract(prisoner)
  - Call gameState.extractPrisoner(prisoner) [NEW method, takes object ref]
  - _selectedPrisoner = null (clear in case extracted was selected)
  - this._scene.topHUD.update()
  - rebuild()

_drawSlotProgress(slotContainer, slot)
  - Arc-style progress ring (0..360 proportional to progress/target)
  - Color: 0x9b59b6 (purple)
```

### Changes to `src/models/GameState.js`

**New method: `unlockTortureSlot(slotIndex)`**
```
unlockTortureSlot(slotIndex) {
  const slot = this.tortureSlots[slotIndex];
  if (!slot || slot.unlocked || this.gold < slot.cost) return false;
  this.gold -= slot.cost;
  this.tortureSlots[slotIndex] = { unlocked: true, prisoner: null, progress: 0, target: 0 };
  return true;
}
```

**New method: `assignPrisoner(slotIndex, prisoner)`** (takes object ref, not index)
```
assignPrisoner(slotIndex, prisoner) {
  const slot = this.tortureSlots[slotIndex];
  if (!slot || !slot.unlocked || slot.prisoner) return false;
  const idx = this.prisoners.indexOf(prisoner);
  if (idx === -1) return false;
  slot.prisoner = prisoner;
  slot.target = TORTURE_CONFIG.targets[prisoner.heroTypeId] || 3;
  slot.progress = 0;
  this.prisoners.splice(idx, 1);
  return true;
}
```

**New method: `extractPrisoner(prisoner)`** (takes object ref, not index)
```
extractPrisoner(prisoner) {
  const idx = this.prisoners.indexOf(prisoner);
  if (idx === -1) return 0;
  const gold = TORTURE_CONFIG.extractGold[prisoner.heroTypeId] || 50;
  this.gold += gold;
  this.prisoners.splice(idx, 1);
  return gold;
}
```

Note: `_getTortureTarget` does not exist in current GameState. Target is set only in `assignPrisoner()` using `TORTURE_CONFIG.targets`.

### Changes to `src/models/BattleManager.js`

**Modify: `_heroDefeated`** -> replace hardcoded conversionMap with `TORTURE_CONFIG.conversionMap` (import from constants)

### Changes to `src/scenes/GameScene.js`

1. `import TortureUI from '../substates/TortureUI.js';`
2. In `create()`, after building DungeonMapUI:
   ```
   this.tortureUI = new TortureUI(this, this.gameState);
   this.containers.torture.add(this.tortureUI.getContainer());
   ```
3. Skip torture in placeholder loop (add to skip condition with flipMatrix/dungeonMap).
4. In `switchSubstate()`, when switching TO torture: `this.tortureUI.rebuild()` then `this.tortureUI.onShown()`.
5. Event wiring in `create()`:
   ```
   this.battleManager.on('tortureConversion', (data) => this.tortureUI.onConversion(data));
   this.battleManager.on('battleEnd', () => this.tortureUI.onBattleEnd());
   ```

### Changes to `src/substates/TopHUD.js`

No changes to TopHUD itself. TortureUI calls `scene.topHUD.update()` after gold mutations (unlock/extract). `update()` already exists and re-reads gameState.

## Migration

無破壞性變更。新增 TortureUI + 3 個 GameState 方法 + TORTURE_CONFIG 常數。BattleManager 的 conversionMap 改為讀取 TORTURE_CONFIG（行為不變）。

## Risks

| Risk | Mitigation |
|------|------------|
| selectedPrisoner 存 object ref，prisoner 被 splice 後 ref 仍有效 | JS object ref 不受 array splice 影響，splice 只移除 array slot |
| tortureSlots 在戰鬥中被 advanceTortureProgress 改動 | TortureUI 不在戰鬥中操作（tab lock），battleEnd 後 rebuild |
| 轉化目標值 (3-6) 可能太容易或太難 | MVP 數值，TORTURE_CONFIG 可一處調整 |
| staging offset 在 mutation 後可能越界 | rebuild() 內 clamp offset |

## Verification

1. 開啟刑求室 tab -> 看到 2 個空 slot + 2 個鎖住 slot
2. 有俘虜時 -> 底部顯示 chip，可點選高亮
3. 選俘虜 -> 點空 slot -> 俘虜上台，顯示 0/{target}
4. 戰鬥擊殺英雄 -> 返回刑求室 -> progress +1
5. progress 滿 -> slot 清空 + monsterRoster 新增轉化怪物 + toast
6. 榨取 -> 俘虜消失 + 金幣增加 + TopHUD 更新
7. 解鎖 slot -> 金幣扣除 + slot 變空 + TopHUD 更新
8. 7+ 俘虜 -> 左右箭頭出現，可翻頁
9. 榨取按鈕不觸發選取（stopPropagation）
