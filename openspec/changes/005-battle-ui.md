---
id: "005"
title: "Battle UI — Hero Movement, HP Bars, Damage Popups, Speed Control"
status: proposed
date: "2026-04-01"
specs_affected:
  - battle
risk: medium
revision: 3
review_history:
  - round: 1
    codex: "62% NO — 2 P1, 5 P2, 2 P3"
    gemini: "80% YES — 0 P1, 3 P2, 2 P3"
    exit: "R1 P1s fixed (overlay layout + DungeonMapUI API). P2s addressed."
  - round: 2
    codex: "74% NO — 2 P1, 2 P2, 1 P3"
    gemini: "90% YES — 0 P1, 1 P2, 2 P3"
    exit: "R2 P1 fixed (DungeonMapUI battle mode). Spec A1 scope noted. P2s addressed (lerp local cache, stop() timer cleanup, HP bar state-agnostic). P3s accepted (setData bgFill, CELL_SIZE constant)."
---

# Proposal 005: Battle UI

## Why

P004 Battle Core 完成了純邏輯層，但戰鬥中沒有任何視覺回饋。玩家翻到戰鬥卡後只看到「戰鬥中...」+ 手動結束按鈕。Battle UI 讓戰鬥從「後台運算」變成「可觀察的即時戰鬥」。

## Design Decisions

| Decision | Choice | Reason |
|----------|--------|--------|
| Hero visual | Colored circle + typeId initial letter | 無 sprite 資源；A1 幾何圖形，A2 換 sprite |
| HP bar | 2-layer rectangle (bg + fill) under hero circle | 簡單、Phaser 原生 |
| Damage popup | Tween float-up text + fade | 經典 RPG 回饋 |
| Speed control | 3 buttons in battle overlay bar | x1 / x2 / Skip(x10) |
| Hero position | Lerp via exported MOVE_DURATION constant | 平滑移動，公開常數避免耦合 |
| Overlay layout | 上下 bar 有按鈕，中央完全不設 interactive | 地圖 scroll 穿透不衝突 |
| Cell highlight | DungeonMapUI public API 驅動 | 不碰私有成員 |
| battleEnd flow | BattleUI emit `battleUiComplete` → FlipEventHandler 監聯 | 單一 owner 避免雙重計時 |
| Listener strategy | start() 綁 / stop() 解綁，idempotent | 避免多戰疊加 |
| Skip mode | x10 跳過 popup + cell flash | 防止特效物件爆炸 |
| DungeonMapUI battle mode | setBattleMode(true) 停用 hand/tap/popup | 防止戰鬥中選牌放牌 |
| Lerp local cache | heroMove 存 fromPos/toPos，heroArrive 清 | 不依賴 live model 當歷史 |
| Timer cleanup | stop() 取消所有 delayedCall/tween + session token | 防舊回合殘留 |
| HP bar scope | 所有在場英雄每 frame 更新，不限 fighting | 踩陷阱等也即時反映 |

## What

### 1. DungeonMapUI Battle API (新增公開方法)

```js
// 新增到 DungeonMapUI:

/** Return the map world container for adding battle visuals. */
getMapWorldContainer() { return this._mapWorldContainer; }

/** Get cell world position by cellId. */
getCellPosition(cellId) {
  const cell = this.gameState.getCell(cellId);
  return cell ? { x: cell.position.x, y: cell.position.y } : null;
}

/** Highlight a cell border with the given color. Pass null to clear. */
setCellHighlight(cellId, color) {
  const cont = this._cellContainers.find(c => c.getData('cellId') === cellId);
  if (!cont) return;
  const border = cont.getData('border');
  if (!border) return;
  const half = 32; // CELL_SIZE / 2
  border.clear();
  if (color !== null) {
    border.lineStyle(3, color, 1);
    border.strokeRoundedRect(-half, -half, 64, 64, 8);
  } else {
    // Restore original via full refresh
    const cell = this.gameState.getCell(cellId);
    if (cell) this._drawCellVisual(cell, border, cont.list[0], half);
  }
}

/** Clear all battle-related cell highlights. */
clearBattleHighlights() {
  this._rebuildCells();
}

/**
 * Enable/disable battle mode. In battle mode:
 * - Hand area hidden, card taps disabled
 * - Cell tap opens no popup, no card/monster placement
 * - Scroll still works
 */
setBattleMode(active) {
  this._battleMode = active;
  this._handAreaContainer.setVisible(!active);
  if (active) {
    this._hidePopup();
    this._clearSelection();
  }
}
```

Note: `_handleMapTap` and `_onCardTap` must early-return if `this._battleMode` is true.

Also: `_buildCellContainer` stores bgFill via `cont.setData('bgFill', bgFill)` for `setCellHighlight` to reference. `setCellHighlight` uses `CELL_SIZE / 2` instead of magic number 32.

### 2. BattleManager 公開常數

```js
// Export MOVE_DURATION for BattleUI interpolation
export const MOVE_DURATION = 400; // ms per cell transition
```

### 3. BattleUI (`src/substates/BattleUI.js`) — NEW

**Constructor**: `constructor(scene, battleManager, gameState, dungeonMapUI)`

**Lifecycle**:
- `start()` — 綁 BattleManager events, 建 hero visuals
- `update(dt)` — lerp hero positions, update HP bars
- `stop()` — 解綁 events, cancel all timers/tweens, destroy all visuals, clear cell highlights, disable battle mode. Idempotent. Uses `_sessionId` counter to reject stale callbacks.

**Hero visual map**: `this._heroVisuals = new Map()` (instanceId → visual object)

```js
{
  container: Phaser.GameObjects.Container,
  circle: Phaser.GameObjects.Arc,       // 12px radius
  letter: Phaser.GameObjects.Text,      // typeId[0]
  hpBg: Phaser.GameObjects.Rectangle,   // gray 30x4
  hpFill: Phaser.GameObjects.Rectangle, // colored fill
}
```

**Hero colors**:
```js
const HERO_COLORS = {
  trainee_swordsman: 0x3498db,
  light_archer:      0x2ecc71,
  priest:            0xf39c12,
  fire_mage:         0xe74c3c,
  holy_knight:       0x9b59b6,
};
```

**Event handlers** (bound in `start()`, unbound in `stop()`):

| Event | Action |
|-------|--------|
| `heroSpawn` | 建 hero visual at portal position, add to mapWorldContainer |
| `heroMove` | 快取 `{fromPos, toPos}` 到 heroVisual 本地狀態供 lerp |
| `heroArrive` | snap visual to cell position, 清除 lerp cache |
| `combatStart` | `dungeonMapUI.setCellHighlight(cellId, 0xff0000)` |
| `attack` | popup at hero visual pos（hero 受擊）or cell pos（monster 受擊）；x10 跳過 |
| `bossHit` | popup at heart cell pos；x10 跳過 |
| `trapTrigger` | popup orange at cell pos；x10 跳過 |
| `monsterDefeated` | flash cell green 300ms → restore；x10 跳過 flash |
| `heroDefeated` | fade out hero visual (tween alpha 0, 500ms); captured → "Captured!" text |
| `battleEnd` | show result banner → 1.5s delay → emit `battleUiComplete` on scene events |

**Popup anchor strategy**:
- `attack` event has `targetType` + `targetId` + `cellId`:
  - `targetType === 'hero'` → popup at hero visual position (from `_heroVisuals` map)
  - `targetType === 'monster'` → popup at cell position (from `dungeonMapUI.getCellPosition(cellId)`)
  - `attackerType === 'boss'` → popup at hero visual position

**Cell highlight lifecycle**:
- `combatStart` → set red on cellId
- `monsterDefeated` → flash green 300ms → clear (setCellHighlight null)
- `heroDefeated` where hero was fighting a monster → clear that cell's highlight
- `stop()` → `dungeonMapUI.clearBattleHighlights()`

**Hero position interpolation** (in `update(dt)`):
```
for each [instanceId, visual] of _heroVisuals:
  hero = find hero by instanceId
  if hero.state === 'dead' || hero.state === 'captured': continue

  // Lerp from cached positions (set by heroMove handler, cleared by heroArrive)
  if hero.state === 'moving' && visual.lerpFrom && visual.lerpTo:
    progress = hero.moveTimer / MOVE_DURATION
    x = visual.lerpFrom.x + (visual.lerpTo.x - visual.lerpFrom.x) * progress
    y = visual.lerpFrom.y + (visual.lerpTo.y - visual.lerpFrom.y) * progress
    visual.container.setPosition(x, y)

  // HP bar: update for ALL alive heroes regardless of state
  const ratio = Math.max(0, hero.hp / hero.maxHp)
  visual.hpFill.width = ratio * HP_BAR_W
  visual.hpFill.fillColor = ratio > 0.5 ? 0x27ae60 : ratio > 0.25 ? 0xf39c12 : 0xe74c3c
```

### 4. Battle Overlay Redesign

**Layout** (depth 1500):
```
[Top bar, y=0..48] — "戰鬥中..." title + eventType label + hero alive count
   Background: solid dark, interactive (blocks clicks)

[Middle zone, y=48..height-104] — TRANSPARENT, NO interactive
   Map scroll works here unimpeded
   Hero visuals visible on dungeon map below

[Bottom bar, y=height-104..height-56] — Speed buttons + debug end button
   Background: solid dark, interactive (blocks clicks)
   [ x1 ] [ x2 ] [ Skip ]        [ 結束戰鬥 ]
```

Hero alive count text updated in BattleUI.update().

### 5. Battle Result Banner

On `battleEnd` event:
```
defenseSuccess → "防禦成功！" (green) + "擊殺 N 獲得 NG"
bossBreached → "魔王被突破！" (red) + "英雄突破了防線"
```

Banner shows centered, fade-in 300ms → hold 1.2s → BattleUI emits `battleUiComplete` on `scene.events`.

### 6. FlipEventHandler Modification

```js
_handleBattle(flipCard, unlockCallback) {
  this._showToast('戰鬥開始！', 1000, () => {
    this.gameScene.switchSubstateForced('dungeonMap');
    this.gameScene.showBattleOverlay(flipCard.eventType);
    this.gameScene.battleManager.start(flipCard.eventType);
    this.gameScene.battleUI.start();

    // Single owner: wait for BattleUI to finish banner, then clean up
    this.scene.events.once('battleUiComplete', () => {
      this.gameScene.battleUI.stop();
      this.gameScene.hideBattleOverlay();
      this.gameScene.returnToPreviousSubstate();
      this.gameState.resolveCard(flipCard.row, flipCard.col);
      this.gameScene.topHUD.update();
      this._checkDayEnd(unlockCallback);
    });

    this.gameScene._onBattleEnd = () => {
      if (this.gameScene.battleManager.isActive()) {
        this.gameScene.battleManager.forceEnd('defenseSuccess');
      }
    };
  });
}
```

### 7. GameScene Modifications

```js
// In create():
this.battleUI = new BattleUI(this, this.battleManager, this.gameState, this.dungeonMapUI);

// In update():
update(time, delta) {
  if (this.battleManager && this.battleManager.isActive()) {
    this.battleManager.update(delta);
  }
  if (this.battleUI) {
    this.battleUI.update(delta);
  }
}
```

Note: BattleUI.update() runs even after battle ends (for result banner animation). BattleUI internally checks `_active` flag.

## Affected Files

```
new:      src/substates/BattleUI.js
modified: src/models/BattleManager.js (export MOVE_DURATION)
modified: src/substates/DungeonMapUI.js (add battle API: getMapWorldContainer, getCellPosition, setCellHighlight, clearBattleHighlights)
modified: src/scenes/GameScene.js (import BattleUI, create init, update call, overlay redesign)
modified: src/substates/FlipEventHandler.js (battleUiComplete event flow)
```

## Not Included (Future)

- Boss active skill button + cooldown UI
- Hero sprite art
- Cell dim overlay for non-combat cells
- Battle end summary screen (detailed stats)

## Verification

1. `npm run dev` → flip a battle card → hero circles spawn at portal
2. Heroes move smoothly between cells (lerp)
3. Damage numbers float up during combat
4. HP bars update in real-time
5. Trap triggers show orange damage popup
6. Monster defeated → cell flashes green briefly
7. Hero defeated → hero fades out; captured → "Captured!" text
8. Speed buttons: x1 normal, x2 fast, Skip very fast (no popups at x10)
9. Battle end → result banner 1.5s → overlay closes → returns to flipMatrix
10. DungeonMap scrollable during battle (middle zone transparent)
11. Multiple consecutive battles work correctly (no listener duplication)

## Risk

Medium —
- Hero visuals in mapWorldContainer must be cleaned up on stop()
- Lerp reads hero.moveTimer directly — now using exported MOVE_DURATION constant
- Skip mode (x10) disables popups + cell flashes to prevent object explosion
- Overlay middle zone must NOT have interactive objects to allow scroll pass-through
