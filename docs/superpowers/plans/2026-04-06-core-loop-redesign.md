# P053: Core Loop Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace RNG battle cards with monster recruitment cards, add player-initiated battle button on dungeon map, scale hero difficulty by day.

**Architecture:** Data-driven changes to constants/weights → model updates (GameState, BattleManager) → UI wiring (FlipEventHandler, DungeonMapUI, GameScene). Each task produces a buildable intermediate state.

**Tech Stack:** Phaser 3.87, vanilla ES6, CANVAS renderer. No test framework (`[SKIP-TDD]`).

**Spec:** `docs/superpowers/specs/2026-04-06-core-loop-redesign.md`

---

### Task 1: Constants + Draw Cost Data

**Files:**
- Modify: `src/utils/constants.js:7-15` (EVENT_TYPES)
- Modify: `src/utils/constants.js` (add HERO_DAY_SCALING, FREE_DRAW_COUNT, MONSTER_STAR_MULTIPLIER)
- Modify: `src/data/drawCosts.json`

- [ ] **Step 1: Update EVENT_TYPES in constants.js**

Replace lines 7-15 — remove normalBattle/eliteBattle/bossBattle, add monster:

```javascript
export const EVENT_TYPES = {
  monster:     { weight: 25, label: '怪物招募', color: 0x9b59b6 },
  activity:    { weight: 25, label: '事件',     color: 0x27ae60 },
  treasure:    { weight: 15, label: '寶藏',     color: 0xf1c40f },
  shop:        { weight: 10, label: '商店',     color: 0x2980b9 },
  finalBattle: { weight: 0,  label: '終局決戰', color: 0xffd700 },
};
```

- [ ] **Step 2: Add HERO_DAY_SCALING table after FINAL_BATTLE_CONFIG**

```javascript
export const HERO_DAY_SCALING = {
  1: { countMin: 2, countMax: 2, pool: ['trainee_swordsman', 'light_archer', 'thief'], statMult: 1.0 },
  2: { countMin: 2, countMax: 3, pool: ['trainee_swordsman', 'light_archer', 'thief'], statMult: 1.0 },
  3: { countMin: 3, countMax: 3, pool: ['trainee_swordsman', 'light_archer', 'thief', 'priest', 'fire_mage'], statMult: 1.15 },
  4: { countMin: 3, countMax: 4, pool: ['trainee_swordsman', 'light_archer', 'thief', 'priest', 'fire_mage'], statMult: 1.3 },
  5: { countMin: 4, countMax: 4, pool: ['trainee_swordsman', 'light_archer', 'thief', 'priest', 'fire_mage', 'holy_knight'], statMult: 1.5 },
  6: { countMin: 4, countMax: 5, pool: ['trainee_swordsman', 'light_archer', 'thief', 'priest', 'fire_mage', 'holy_knight'], statMult: 1.75 },
  7: { countMin: 5, countMax: 5, pool: ['trainee_swordsman', 'light_archer', 'thief', 'priest', 'fire_mage', 'holy_knight', 'hero_of_legend'], statMult: 2.0 },
};

export const FREE_DRAW_COUNT = 5;

export const MONSTER_STAR_MULTIPLIER = { 1: 1.0, 2: 1.3, 3: 1.6 };
```

- [ ] **Step 3: Update drawCosts.json**

```json
[50, 100, 150, 250, 350, 500]
```

This array holds **post-free draw costs only**. `getDrawCost()` will offset by `FREE_DRAW_COUNT` — see Task 3 Step 2.

- [ ] **Step 4: Build and verify**

Run: `npm run build`

- [ ] **Step 5: Commit**

```bash
git add src/utils/constants.js src/data/drawCosts.json
git commit -m "feat(p053): update constants — monster card type, hero day scaling, free draws"
```

---

### Task 2: FlipMatrixGenerator — Remove Battle Cards, Add Monster

**Files:**
- Modify: `src/models/FlipMatrixGenerator.js:58-93` (_generateEventTypes)

- [ ] **Step 1: Update _generateEventTypes**

The `_generateEventTypes` method (line 58) uses weighted random from EVENT_TYPES. Since we removed battle types from EVENT_TYPES, the method already won't generate them. However, the boss-cap logic (lines 77-81 that converts excess bossBattle to eliteBattle) is now dead code. Remove it:

In `_generateEventTypes`, remove the boss-cap block (approximately lines 77-81):
```javascript
// REMOVE THIS BLOCK:
// const bossCount = types.filter(t => t === 'bossBattle').length;
// if (bossCount > 1) { ... convert excess to eliteBattle ... }
```

Also remove any `shuffle` call that was specifically for boss placement if it only applied to boss cards.

- [ ] **Step 2: Update _injectFinalBattle replacement target**

In `_injectFinalBattle` (line 30), the current logic prefers replacing non-battle cards. Since all cards are now non-battle, simplify the replacement: pick any random non-finalBattle card.

Replace the target selection logic (approximately lines 42-48) with:
```javascript
// Pick a random card to replace with finalBattle
const candidates = [];
for (let r = 0; r < matrix.length; r++) {
  for (let c = 0; c < matrix[r].length; c++) {
    if (matrix[r][c].eventType !== 'finalBattle') {
      candidates.push(matrix[r][c]);
    }
  }
}
if (candidates.length === 0) return;
const target = candidates[Math.floor(Math.random() * candidates.length)];
target.eventType = 'finalBattle';
target.flipped = true;
target.resolved = false;
```

- [ ] **Step 3: Build and verify**

Run: `npm run build`

- [ ] **Step 4: Commit**

```bash
git add src/models/FlipMatrixGenerator.js
git commit -m "feat(p053): remove battle cards from flip matrix, add monster type"
```

---

### Task 3: GameState — Free Draws + Monster Star Rating

**Files:**
- Modify: `src/models/GameState.js` (constructor, advanceDay, createMonsterInstance, getDrawCost)

- [ ] **Step 1: Add freeDrawsUsed tracking**

In the constructor (around line 19), add after `drawCount`:
```javascript
this.freeDrawsUsed = 0;
```

In `advanceDay()` (line 318), add reset:
```javascript
advanceDay() {
  this.day++;
  this.drawCount = 0;      // reset draw count for new day
  this.freeDrawsUsed = 0;  // reset free draws
  this.initFlipMatrix();
  console.log('[GameState] Advanced to day', this.day);
}
```

- [ ] **Step 2: Update getDrawCost to use FREE_DRAW_COUNT with offset**

Replace `getDrawCost()` (line 212-214) with:
```javascript
getDrawCost() {
  if (this.drawCount < FREE_DRAW_COUNT) return 0;
  const paidIndex = this.drawCount - FREE_DRAW_COUNT;
  return this._dataManager.getDrawCost(paidIndex);
}
```

`getDrawCost(paidIndex)` reads from the updated `drawCosts.json` which now starts at index 0 = 50G.

Import `FREE_DRAW_COUNT` from constants at top of file.

- [ ] **Step 3: Add starRating to createMonsterInstance**

Modify `createMonsterInstance` (line 83) to accept optional `starRating` parameter:
```javascript
createMonsterInstance(typeId, source = 'initial', index, starRating = 1) {
```

Add `starRating` to the returned instance object (around line 92):
```javascript
starRating,
```

- [ ] **Step 4: Build and verify**

Run: `npm run build`

- [ ] **Step 5: Commit**

```bash
git add src/models/GameState.js
git commit -m "feat(p053): free draw tracking, star rating on monster instances"
```

---

### Task 4: FlipMatrixUI — Monster Card Visuals

**Files:**
- Modify: `src/substates/FlipMatrixUI.js` (card rendering for monster type)

- [ ] **Step 1: Add monster card icon**

In the card face-up rendering section (where icons are drawn per eventType), add a case for `monster`. Use the existing icon pattern — add an emoji or sprite icon. Find the icon rendering block (search for `eventType` switch/if in the face-up card builder) and add:

```javascript
case 'monster':
  iconText = '👾';
  break;
```

Or if it uses a mapping object:
```javascript
monster: '👾',
```

The card color (0x9b59b6 purple) is already defined in EVENT_TYPES and should be picked up automatically.

- [ ] **Step 2: Remove battle card icon entries**

Remove icon entries for `normalBattle`, `eliteBattle`, `bossBattle` from the icon mapping since these card types no longer exist.

- [ ] **Step 3: Build and verify**

Run: `npm run build`

- [ ] **Step 4: Commit**

```bash
git add src/substates/FlipMatrixUI.js
git commit -m "feat(p053): monster card visuals in flip matrix"
```

---

### Task 5: FlipEventHandler — Monster Recruitment + Remove Battle Handlers

**Files:**
- Modify: `src/substates/FlipEventHandler.js` (handleEvent switch, add _handleMonster, modify _checkDayEnd)

- [ ] **Step 1: Update handleEvent switch**

In `handleEvent` (line 14), remove the `normalBattle`, `eliteBattle`, `bossBattle` cases. Add `monster` case:

```javascript
handleEvent(flipCard, unlockCallback) {
  switch (flipCard.eventType) {
    case 'monster':
      this._handleMonster(flipCard, unlockCallback);
      break;
    case 'finalBattle':
      this._handleFinalBattle(flipCard, unlockCallback);
      break;
    case 'activity':
      this._handleActivity(flipCard, unlockCallback);
      break;
    case 'treasure':
      this._handleTreasure(flipCard, unlockCallback);
      break;
    case 'shop':
      this._handleShop(flipCard, unlockCallback);
      break;
    default:
      console.warn('[FlipEventHandler] Unknown event type:', flipCard.eventType);
      this.gameState.resolveCard(flipCard.row, flipCard.col);
      unlockCallback();
  }
}
```

- [ ] **Step 2: Add _handleMonster method**

Add new method after `handleEvent`. This shows a pick-1-of-3 panel using the existing shop modal pattern from `GameScene.openShop()`:

```javascript
_handleMonster(flipCard, unlockCallback) {
  const gs = this.gameState;
  const scene = this.scene;
  const gameScene = this.gameScene;
  const dataManager = scene.registry.get('dataManager');

  // Generate 3 candidates from unlocked pool
  const metaState = scene.registry.get('metaState');
  const unlockedMonsters = buildUnlockedPool(dataManager.monsters, 'monsters', metaState);
  const candidates = [];
  const usedTypes = new Set();

  for (let i = 0; i < 3 && usedTypes.size < unlockedMonsters.length; i++) {
    // Pick a random monster type not yet used in this selection
    let type;
    do {
      type = unlockedMonsters[Math.floor(Math.random() * unlockedMonsters.length)];
    } while (usedTypes.has(type.id) && usedTypes.size < unlockedMonsters.length);
    usedTypes.add(type.id);

    // Roll star rating
    const star = this._rollStarRating();
    candidates.push({ def: type, starRating: star });
  }

  // Show selection panel (reuse cardPick container pattern)
  this._showMonsterPickPanel(candidates, (chosen) => {
    // Add chosen monster to roster
    const inst = gs.createMonsterInstance(chosen.def.id, 'recruit', gs.monsterRoster.length, chosen.starRating);
    gs.monsterRoster.push(inst);

    gs.resolveCard(flipCard.row, flipCard.col);
    this._checkDayEnd(unlockCallback);
  });
}
```

- [ ] **Step 3: Add _showMonsterPickPanel method**

Similar to `GameScene.openShop()` layout (lines 329-433 of GameScene.js):

```javascript
_showMonsterPickPanel(candidates, onPick) {
  const scene = this.scene;
  const gameScene = this.gameScene;
  const { width, height } = scene.scale;

  // Use cardPick container as modal
  const container = gameScene.containers.cardPick;
  container.removeAll(true);
  container.setVisible(true);

  // Dark overlay
  const overlay = scene.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.7);
  container.add(overlay);

  // Title
  const title = scene.add.text(width / 2, 80, '怪物招募', {
    fontSize: '24px', color: '#bb88ff', fontFamily: FONT_FAMILY, fontStyle: 'bold',
  }).setOrigin(0.5);
  container.add(title);

  const subtitle = scene.add.text(width / 2, 110, '選擇一隻加入名冊', {
    fontSize: '12px', color: '#9999bb', fontFamily: FONT_FAMILY,
  }).setOrigin(0.5);
  container.add(subtitle);

  // Render each candidate card
  const cardW = 100;
  const cardH = 150;
  const gap = 10;
  const totalW = candidates.length * cardW + (candidates.length - 1) * gap;
  const startX = (width - totalW) / 2 + cardW / 2;
  const cardY = height / 2 - 20;

  candidates.forEach((cand, i) => {
    const x = startX + i * (cardW + gap);
    const def = cand.def;

    // Card background
    const bg = scene.add.rectangle(x, cardY, cardW, cardH, 0x2d2d4e, 0.9);
    bg.setStrokeStyle(2, 0x9b59b6);
    container.add(bg);

    // Monster name
    const nameText = scene.add.text(x, cardY - 55, def.name, {
      fontSize: '12px', color: '#ffffff', fontFamily: FONT_FAMILY, fontStyle: 'bold',
    }).setOrigin(0.5);
    container.add(nameText);

    // Type tags
    const typeStr = (def.type || []).join('/');
    const typeText = scene.add.text(x, cardY - 38, typeStr, {
      fontSize: '9px', color: '#aaaacc', fontFamily: FONT_FAMILY,
    }).setOrigin(0.5);
    container.add(typeText);

    // Monster sprite
    const spriteKey = `monster_${def.id}`;
    const sprite = SpriteHelper.createSprite(scene, spriteKey, x, cardY - 5, 48);
    container.add(sprite);

    // Star rating
    let stars = '';
    for (let s = 0; s < cand.starRating; s++) stars += '★';
    const starText = scene.add.text(x, cardY + 28, stars, {
      fontSize: '12px', color: '#f1c40f', fontFamily: FONT_FAMILY,
    }).setOrigin(0.5);
    container.add(starText);

    // Stats
    const statsStr = `HP:${def.baseHp} ATK:${def.baseAtk}`;
    const statsText = scene.add.text(x, cardY + 44, statsStr, {
      fontSize: '9px', color: '#cccccc', fontFamily: FONT_FAMILY,
    }).setOrigin(0.5);
    container.add(statsText);

    // Preferred room
    const roomStr = def.preferredRoom ? `適性:${def.preferredRoom}` : '';
    const roomText = scene.add.text(x, cardY + 57, roomStr, {
      fontSize: '8px', color: '#88bb88', fontFamily: FONT_FAMILY,
    }).setOrigin(0.5);
    container.add(roomText);

    // Hit zone
    const hitZone = scene.add.rectangle(x, cardY, cardW, cardH, 0x000000, 0)
      .setInteractive({ useHandCursor: true });
    hitZone.on('pointerdown', () => {
      container.removeAll(true);
      container.setVisible(false);
      onPick(cand);
      // Refresh monster list and map UIs after recruiting
      if (gameScene.monsterListUI) gameScene.monsterListUI.rebuild();
      if (gameScene.dungeonMapUI) gameScene.dungeonMapUI.updateBattleButton();
    });
    container.add(hitZone);
  });
}
```

Import `FONT_FAMILY` and `SpriteHelper` at top of FlipEventHandler.js. Also import `buildUnlockedPool` from `../utils/buildUnlockedPool.js` (already imported in current file for room/trap pools).

- [ ] **Step 4: Add _rollStarRating helper**

```javascript
_rollStarRating() {
  const weights = STAR_WEIGHTS;
  const totalWeight = weights.reduce((sum, w) => sum + w.weight, 0);
  let roll = Math.random() * totalWeight;
  for (const entry of weights) {
    roll -= entry.weight;
    if (roll <= 0) return entry.star;
  }
  return 1;
}
```

Import `STAR_WEIGHTS` from constants.

- [ ] **Step 5: Simplify _checkDayEnd**

Remove the auto-battle-trigger logic from `_checkDayEnd` (lines 205-226). Day advancement now happens ONLY through the map's "迎戰" button. Keep the finalBattle auto-trigger:

```javascript
_checkDayEnd(unlockCallback) {
  if (this.gameState.isMatrixComplete()) {
    // Check if only finalBattle unresolved — auto-trigger it
    const unresolved = [];
    for (const row of this.gameState.flipMatrix) {
      for (const card of row) {
        if (!card.resolved) unresolved.push(card);
      }
    }
    if (unresolved.length === 1 && unresolved[0].eventType === 'finalBattle') {
      this._handleFinalBattle(unresolved[0], unlockCallback);
      return;
    }
    // Matrix complete — player can now go to map and press "迎戰"
    this._showToast('翻牌完成！前往地圖迎戰', 1200, () => unlockCallback());
  } else {
    unlockCallback();
  }
}
```

- [ ] **Step 6: Remove _handleBattle method**

Delete the entire `_handleBattle` method (lines 40-87) since battles no longer trigger from flip cards.

- [ ] **Step 7: Build and verify**

Run: `npm run build`

- [ ] **Step 8: Commit**

```bash
git add src/substates/FlipEventHandler.js
git commit -m "feat(p053): monster recruitment handler, remove flip battle triggers"
```

---

### Task 6: BattleManager — Day-Scaled Hero Generation

**Files:**
- Modify: `src/models/BattleManager.js:974-1019` (_generateHeroes)

- [ ] **Step 1: Rewrite _generateHeroes for day scaling**

Replace the current `_generateHeroes(eventType)` method (lines 974-1019). Import `HERO_DAY_SCALING` from constants. The method now ignores `eventType` for normal battles (all map-initiated battles use day scaling):

```javascript
_generateHeroes(eventType) {
  if (eventType === 'finalBattle') {
    return this._generateFinalBattleHeroes();
  }

  const day = this._gameState.day;
  // Clamp to max configured day (7)
  const clampedDay = Math.min(day, 7);
  const config = HERO_DAY_SCALING[clampedDay] || HERO_DAY_SCALING[7];

  // Random hero count within range
  const count = config.countMin + Math.floor(Math.random() * (config.countMax - config.countMin + 1));

  const heroes = [];
  for (let i = 0; i < count; i++) {
    // Weighted random from pool (equal weights for simplicity)
    const typeId = config.pool[Math.floor(Math.random() * config.pool.length)];
    const hero = new HeroInstance(typeId, i, this._dataManager);

    // Apply day stat multiplier (HP and ATK only)
    hero.maxHp = Math.round(hero.maxHp * config.statMult);
    hero.hp = hero.maxHp;
    hero.atk = Math.round(hero.atk * config.statMult);

    heroes.push(hero);
  }

  return heroes;
}
```

- [ ] **Step 2: Remove glamour scaling from _generateFinalBattleHeroes**

In `_generateFinalBattleHeroes()` (line 1021-1071), remove the glamour scaling block (approximately lines 1063-1068):

```javascript
// REMOVE:
// const glamourMult = 1 + (this._gameState.glamour / 500);
// hero.maxHp = Math.round(hero.maxHp * glamourMult);
// hero.hp = hero.maxHp;
// hero.atk = Math.round(hero.atk * glamourMult);
```

The final battle config multipliers (FINAL_BATTLE_CONFIG) remain as-is.

- [ ] **Step 3: Add MONSTER_STAR_MULTIPLIER to monster combat stats**

Monster stats are read in two places — both need star rating:

**A) `_tickMonsterFight` (line 308-329):** Monster ATK is computed from `monsterDef.baseAtk`. After line 312 (`const monsterDef = ...`), add star multiplier:

```javascript
const starMult = MONSTER_STAR_MULTIPLIER[monster.starRating || 1] || 1.0;
```

Then apply `starMult` wherever `monsterDef.baseAtk` and `monsterDef.baseHp` are used in this method. Specifically, in the hero damage calc (line 329):
```javascript
const effectiveDef = Math.round(monsterDef.baseDef * roomBuff.defMult);
```
And in monster attack calc, multiply `monsterDef.baseAtk` by `starMult`.

**B) `_restoreMonsters` (line 862-873):** HP is reset from `def.baseHp`. Update line 869:

```javascript
const starMult = MONSTER_STAR_MULTIPLIER[cell.monster.starRating || 1] || 1.0;
const maxHp = Math.round(baseHp * starMult * buffFlags.hpMult);
```

Import `MONSTER_STAR_MULTIPLIER` from constants at top of BattleManager.js.

- [ ] **Step 4: Build and verify**

Run: `npm run build`

- [ ] **Step 5: Commit**

```bash
git add src/models/BattleManager.js
git commit -m "feat(p053): day-scaled hero generation, monster star rating in combat"
```

---

### Task 7: DungeonMapUI — "迎戰 Day N" Button

**Files:**
- Modify: `src/substates/DungeonMapUI.js` (_buildContainers, setBattleMode, refresh)

- [ ] **Step 1: Add battle button in _buildContainers**

In `_buildContainers()` (line 246), after the popup container, add the battle button:

```javascript
// "迎戰" battle initiation button
this._battleBtn = scene.add.container(width - 70, TOP_HUD_HEIGHT + 12);

const btnBg = scene.add.rectangle(0, 0, 120, 36, 0xc0392b, 0.9);
btnBg.setStrokeStyle(2, 0xff6666);
const btnLabel = scene.add.text(0, 0, `迎戰 Day ${this.gameState.day}`, {
  fontSize: '13px', color: '#ffffff', fontFamily: FONT_FAMILY, fontStyle: 'bold',
}).setOrigin(0.5);

this._battleBtnBg = btnBg;
this._battleBtnLabel = btnLabel;
this._battleBtn.add([btnBg, btnLabel]);

const btnHit = scene.add.rectangle(0, 0, 120, 36, 0x000000, 0)
  .setInteractive({ useHandCursor: true });
btnHit.on('pointerdown', () => {
  if (this._battleBtnDisabled) return;
  if (this._onBattleStart) this._onBattleStart();
});
this._battleBtn.add(btnHit);

this._rootContainer.add(this._battleBtn);
this._battleBtnDisabled = false;
```

- [ ] **Step 2: Add updateBattleButton method**

```javascript
updateBattleButton() {
  if (!this._battleBtn) return;
  const hasDefense = this.gameState.hasAnyDefense();
  this._battleBtnDisabled = !hasDefense;
  this._battleBtnBg.fillColor = hasDefense ? 0xc0392b : 0x555555;
  this._battleBtnBg.setStrokeStyle(2, hasDefense ? 0xff6666 : 0x777777);
  this._battleBtnLabel.setText(hasDefense ? `迎戰 Day ${this.gameState.day}` : '至少部署一隻怪物');
  this._battleBtnLabel.setColor(hasDefense ? '#ffffff' : '#999999');
  this._battleBtnLabel.setFontSize(hasDefense ? '13px' : '10px');
}
```

- [ ] **Step 3: Add onBattleStart callback setter**

```javascript
onBattleStart(callback) {
  this._onBattleStart = callback;
}
```

- [ ] **Step 4: Call updateBattleButton in refresh()**

In `refresh()` (line 190), add at end:
```javascript
this.updateBattleButton();
```

- [ ] **Step 5: Hide button during battle mode**

In `setBattleMode(active)` (line 173), add:
```javascript
if (this._battleBtn) this._battleBtn.setVisible(!active);
```

- [ ] **Step 6: Build and verify**

Run: `npm run build`

- [ ] **Step 7: Commit**

```bash
git add src/substates/DungeonMapUI.js
git commit -m "feat(p053): add battle initiation button on dungeon map"
```

---

### Task 8: GameScene — Wire Battle Button + Post-Battle Day Advance

**Files:**
- Modify: `src/scenes/GameScene.js` (create method, add battle flow)

- [ ] **Step 1: Wire dungeon map battle button**

In `create()`, after `this.dungeonMapUI` is created (around line 85), add:

```javascript
this.dungeonMapUI.onBattleStart(() => {
  this._startMapBattle();
});
```

- [ ] **Step 2: Add _startMapBattle method**

Add new method to GameScene:

```javascript
_startMapBattle() {
  if (this._interactionLockCount > 0) return;
  if (!this.gameState.hasAnyDefense()) return;

  this.lockInteraction();

  // Toast
  const { width, height } = this.scale;
  const toast = this.add.text(width / 2, height / 2, '英雄來襲！', {
    fontSize: '20px', color: '#ff4444', fontFamily: FONT_FAMILY, fontStyle: 'bold',
    backgroundColor: '#000000cc', padding: { x: 16, y: 8 },
  }).setOrigin(0.5).setDepth(3000);

  this.tweens.add({
    targets: toast,
    alpha: 0,
    delay: 800,
    duration: 300,
    onComplete: () => {
      toast.destroy();
      // Start battle
      this.showBattleOverlay('normalBattle');
      this.battleManager.start('normalBattle');
      this.battleUI.start();

      this.events.once('battleUiComplete', () => {
        this.battleUI.stop();
        this.hideBattleOverlay();
        this.unlockInteraction();

        // Advance day and return to flip matrix
        this.gameState.advanceDay();
        this.topHUD.update();
        this.flipMatrixUI.rebuild();
        this.dungeonMapUI.refresh();
        this.switchSubstateForced('flipMatrix');
      });

      this._onBattleEnd = () => {
        this.battleManager.forceEnd();
      };
    },
  });
}
```

Import `FONT_FAMILY` if not already imported.

- [ ] **Step 3: Remove battle-from-flip wiring if any remains**

Verify that `FlipEventHandler._handleBattle` is already removed (Task 5). No additional changes needed in GameScene for flip-triggered battles since the handler no longer exists.

- [ ] **Step 4: Build and verify**

Run: `npm run build`

- [ ] **Step 5: Commit**

```bash
git add src/scenes/GameScene.js
git commit -m "feat(p053): wire map battle button, post-battle day advance"
```

---

### Task 9: TopHUD — Draw Button Label Update

**Files:**
- Modify: `src/substates/TopHUD.js` (update method, draw button label)

- [ ] **Step 1: Update draw button label logic**

Find the `update()` method in TopHUD.js where the draw button label is set. Change it to show free draw count:

```javascript
// In update() where draw button text is set:
const drawCount = this._gameState.drawCount;
const cost = this._gameState.getDrawCost();
const freeRemaining = Math.max(0, FREE_DRAW_COUNT - drawCount);

if (freeRemaining > 0) {
  this._drawBtn.setText(`抽卡 [免費] (${freeRemaining}/${FREE_DRAW_COUNT})`);
} else {
  this._drawBtn.setText(`抽卡 [${cost}G]`);
}
```

Import `FREE_DRAW_COUNT` from constants.

- [ ] **Step 2: Disable draw button when matrix complete**

In the same update method, add a check:

```javascript
// Disable draw button if all cards are already flipped
const allFlipped = this._gameState.flipMatrix.flat().every(c => c.flipped);
if (allFlipped) {
  this._drawBtn.setAlpha(0.4);
  // Ensure the draw callback checks this too
}
```

Also in GameScene's draw callback (lines 128-138), add guard:
```javascript
const allFlipped = this.gameState.flipMatrix.flat().every(c => c.flipped);
if (allFlipped) return;
```

- [ ] **Step 3: Build and verify**

Run: `npm run build`

- [ ] **Step 4: Commit**

```bash
git add src/substates/TopHUD.js src/scenes/GameScene.js
git commit -m "feat(p053): update draw button label — free count + matrix complete guard"
```

---

### Task 10: Integration Verification

- [ ] **Step 1: Start dev server and play through Day 1**

Run: `npm run dev`

Verify:
- Flip matrix shows 15 cards, no battle types
- Monster cards (purple, 👾) appear
- First 5 flips are free, 6th costs gold
- Flipping monster card shows pick-1-of-3 panel
- Picked monster appears in monster list tab

- [ ] **Step 2: Test battle flow**

- Switch to map tab → "迎戰 Day 1" button visible
- Button grayed if no defenses
- Place room + monster → button turns red
- Tap button → battle starts with 2 basic heroes
- Win → automatically advance to Day 2 flip matrix

- [ ] **Step 3: Test day progression**

- Play through Day 3+ → verify heroes get stronger (more heroes, higher stats)
- Check finalBattle card still appears face-up on Day 3+

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat(p053): core loop redesign complete — resource flipping + manual battle"
git push
```
