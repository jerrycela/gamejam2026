# P026 Monster/Room Grid Display Optimization — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade dungeon map cell visuals — monster as primary focus with idle spritesheet animation, remove text labels, replace emoji trap with pixel art, add deploy/swap animations.

**Architecture:** Extend spriteManifest schema to support spritesheets, register idle animations in BootScene, refactor DungeonMapUI cell rendering to use sprites instead of text, split `_clearSelection` into three reusable parts, and add deploy/swap animation methods.

**Tech Stack:** Phaser 3.87, nano banana MCP (asset generation), Canvas renderer

**Spec:** `docs/superpowers/specs/2026-04-05-p026-monster-room-grid-design.md`

**[SKIP-TDD]** — No test framework (Game Jam scope per CLAUDE.md)

---

### Task 1: Generate Sprite Assets via Nano Banana

**Files:**
- Create: `public/sprites/monster_skeleton_knight_idle.png`
- Create: `public/sprites/monster_goblin_idle.png`
- Create: `public/sprites/monster_bat_succubus_idle.png`
- Create: `public/sprites/monster_rage_demon_idle.png`
- Create: `public/sprites/monster_frost_witch_idle.png`
- Create: `public/sprites/icon_trap.png`

- [ ] **Step 1: Generate skeleton knight idle spritesheet**

Use nano banana MCP `generate_image` with prompt:
"Pixel art spritesheet, 128x32 pixels, 4 frames side by side (each 32x32), dark fantasy skeleton knight idle breathing animation cycle: frame 1 standing, frame 2 slight shrink, frame 3 standing, frame 4 slight expand. Dark purple armor, glowing eyes. Transparent background. Retro game style matching dungeon tileset."

Save to `public/sprites/monster_skeleton_knight_idle.png`.

- [ ] **Step 2: Generate goblin idle spritesheet**

Same format prompt but for: "green goblin with dagger, mischievous pose, idle breathing cycle"
Save to `public/sprites/monster_goblin_idle.png`.

- [ ] **Step 3: Generate bat succubus idle spritesheet**

Prompt for: "bat-winged succubus, dark red/purple, wings folding cycle for idle"
Save to `public/sprites/monster_bat_succubus_idle.png`.

- [ ] **Step 4: Generate rage demon idle spritesheet**

Prompt for: "rage demon, red skin, flames, heavy breathing idle cycle"
Save to `public/sprites/monster_rage_demon_idle.png`.

- [ ] **Step 5: Generate frost witch idle spritesheet**

Prompt for: "frost witch, ice blue robes, floating ice particles, idle sway cycle"
Save to `public/sprites/monster_frost_witch_idle.png`.

- [ ] **Step 6: Generate trap icon**

Use nano banana MCP with prompt:
"Pixel art icon, 32x32 pixels, dungeon trap warning symbol, metallic bear trap or spike trap, dark fantasy style, transparent background. Retro game style."

Save to `public/sprites/icon_trap.png`.

- [ ] **Step 7: Verify all 6 assets exist**

Run: `ls -la public/sprites/monster_*_idle.png public/sprites/icon_trap.png`
Expected: 6 files, each non-zero size.

- [ ] **Step 8: Commit assets**

```bash
git add public/sprites/monster_*_idle.png public/sprites/icon_trap.png
git commit -m "feat(p026): add monster idle spritesheets and trap icon"
```

---

### Task 2: Extend spriteManifest + BootScene Loading (Atomic Change)

**Files:**
- Modify: `src/data/spriteManifest.js`
- Modify: `src/scenes/BootScene.js`

These three changes (manifest schema, preload branch, animation registration) are an **atomic dependency** — all must land together.

- [ ] **Step 1: Add spritesheet entries to spriteManifest.js**

Add after the `path_diamond` entry (line 30), before the closing `]`:

```js
  // Monster idle spritesheets (P026)
  { key: 'monster_skeleton_knight_idle', path: 'sprites/monster_skeleton_knight_idle.png', type: 'spritesheet', frameWidth: 32, frameHeight: 32 },
  { key: 'monster_goblin_idle',          path: 'sprites/monster_goblin_idle.png',          type: 'spritesheet', frameWidth: 32, frameHeight: 32 },
  { key: 'monster_bat_succubus_idle',    path: 'sprites/monster_bat_succubus_idle.png',    type: 'spritesheet', frameWidth: 32, frameHeight: 32 },
  { key: 'monster_rage_demon_idle',      path: 'sprites/monster_rage_demon_idle.png',      type: 'spritesheet', frameWidth: 32, frameHeight: 32 },
  { key: 'monster_frost_witch_idle',     path: 'sprites/monster_frost_witch_idle.png',     type: 'spritesheet', frameWidth: 32, frameHeight: 32 },
  // Trap icon (P026)
  { key: 'icon_trap', path: 'sprites/icon_trap.png' },
```

- [ ] **Step 2: Update BootScene preload to handle spritesheets**

In `src/scenes/BootScene.js`, replace line 38-40:

```js
    // Load sprite textures
    spriteManifest.forEach((entry) => {
      this.load.image(entry.key, entry.path);
    });
```

With:

```js
    // Load sprite textures (image or spritesheet)
    spriteManifest.forEach((entry) => {
      if (entry.type === 'spritesheet') {
        this.load.spritesheet(entry.key, entry.path, {
          frameWidth: entry.frameWidth,
          frameHeight: entry.frameHeight,
        });
      } else {
        this.load.image(entry.key, entry.path);
      }
    });
```

- [ ] **Step 3: Add animation registration in BootScene.create**

In `src/scenes/BootScene.js`, add at the beginning of `create()` method, after line 43 (`const { width, height } = this.scale;`):

```js
    // Register idle animations from spritesheet manifest entries (idempotent)
    spriteManifest.forEach((entry) => {
      if (entry.type === 'spritesheet' && entry.key.endsWith('_idle')) {
        if (!this.anims.exists(entry.key)) {
          this.anims.create({
            key: entry.key,
            frames: this.anims.generateFrameNumbers(entry.key, { start: 0, end: 3 }),
            frameRate: 4,
            repeat: -1,
          });
        }
      }
    });
```

- [ ] **Step 4: Verify dev server loads without errors**

Run: `npm run dev`
Open browser console. Expected: no "missing texture" or "duplicate animation key" warnings. All 5 idle spritesheets and icon_trap should load.

- [ ] **Step 5: Commit**

```bash
git add src/data/spriteManifest.js src/scenes/BootScene.js
git commit -m "feat(p026): spritesheet manifest schema + BootScene preload/animation registration"
```

---

### Task 3: Refactor Cell Rendering — Remove Labels, Update Icons and Monster Sprite

**Files:**
- Modify: `src/substates/DungeonMapUI.js:433-492` (`_buildCellContainer`)

- [ ] **Step 1: Update _buildCellContainer to remove label, fix room icon position, use pixel art trap, and use idle sprite for monsters**

In `src/substates/DungeonMapUI.js`, replace the content inside `_buildCellContainer` (lines 433-493) with:

```js
  _buildCellContainer(cell) {
    const scene = this.scene;
    const vp = cell.visualPos ?? cell.position;
    const { x, y } = vp;
    const half = CELL_SIZE / 2;

    const cont = scene.add.container(x, y);

    // Base sprite (cell tile)
    const spriteKey = this._getCellSpriteKey(cell);
    const baseSprite = scene.add.image(0, 0, spriteKey).setOrigin(0.5);
    cont.add(baseSprite);

    // Default border (drawn per cell state)
    const defaultBorder = scene.add.graphics();
    this._drawDefaultBorder(cell, defaultBorder, half);
    cont.add(defaultBorder);

    // Highlight border (transient, initially hidden)
    const highlightBorder = scene.add.graphics();
    highlightBorder.setVisible(false);
    cont.add(highlightBorder);

    // Room icon sprite — left-bottom corner, small (only for normal cells with known room types)
    if (cell.room) {
      const iconKey = this._getRoomIconKey(cell.room.typeId);
      if (iconKey) {
        const iconSprite = SpriteHelper.createSprite(scene, iconKey, -half + 10, half - 10, 10);
        cont.add(iconSprite);
        cont.setData('roomIcon', iconSprite);
      }
    }

    // Trap icon — top-right corner, pixel art (replaces emoji)
    if (cell.trap) {
      const trapIcon = SpriteHelper.createSprite(scene, 'icon_trap', half - 8, -half + 8, 12);
      cont.add(trapIcon);
    }

    // Monster sprite — centered, idle animation
    if (cell.monster) {
      const idleKey = `monster_${cell.monster.typeId}_idle`;
      let monSprite;
      if (scene.anims.exists(idleKey)) {
        monSprite = scene.add.sprite(0, 0, idleKey).setOrigin(0.5);
        monSprite.displayWidth = 40;
        monSprite.displayHeight = 40;
        const startFrame = Phaser.Math.Between(0, 3);
        monSprite.play({ key: idleKey, startFrame });
      } else {
        // Fallback to static sprite
        const staticKey = `monster_${cell.monster.typeId}`;
        monSprite = SpriteHelper.createSprite(scene, staticKey, 0, 0, 40);
      }
      cont.add(monSprite);
      cont.setData('monsterSprite', monSprite);
    }

    // Store references
    cont.setData('cellId', cell.id);
    cont.setData('baseSprite', baseSprite);
    cont.setData('defaultBorder', defaultBorder);
    cont.setData('highlightBorder', highlightBorder);

    return cont;
  }
```

Key changes:
- Removed `_getCellLabel` call and label text creation entirely
- Room icon moved from `(0, -14)` to `(-half+10, half-10)` with size 10px, stored as `roomIcon` data
- Trap icon changed from emoji text to `SpriteHelper.createSprite(scene, 'icon_trap', ...)` at 12px
- Monster changed from static 54px image at `(0, 6)` to 40px idle spritesheet animation at `(0, 0)` with random start frame
- Added `baseSprite` data reference (needed for buff pulse effect)

- [ ] **Step 2: Verify cells render correctly**

Run: `npm run dev`
Expected: Cells show room tile + small room icon at bottom-left + monster with idle animation at center. No text labels. Trap cells show pixel art icon instead of emoji.

- [ ] **Step 3: Commit**

```bash
git add src/substates/DungeonMapUI.js
git commit -m "feat(p026): refactor cell rendering — remove labels, pixel art trap, idle monster sprites"
```

---

### Task 4: Split _clearSelection Into Three Methods

**Files:**
- Modify: `src/substates/DungeonMapUI.js:1015-1021` (`_clearSelection`)

- [ ] **Step 1: Replace _clearSelection with three separate methods**

In `src/substates/DungeonMapUI.js`, replace lines 1015-1021:

```js
  _clearSelection() {
    this.selectionState = { mode: 'none', handIndex: -1, monsterId: null };
    this._stopPulseTweens();
    // Restore cell visuals (remove pulse tint)
    this._rebuildCells();
    this._rebuildHand();
  }
```

With:

```js
  /** Reset selection state to sentinel (pure state, no visuals). */
  _resetSelectionState() {
    this.selectionState = { mode: 'none', handIndex: -1, monsterId: null };
  }

  /** Stop pulse tweens and hide all highlight borders (pure visual cleanup). */
  _clearPlacementHighlights() {
    this._stopPulseTweens();
    for (const cont of this._cellContainers) {
      const hb = cont.getData('highlightBorder');
      if (hb) {
        hb.setVisible(false);
        hb.setAlpha(1);
      }
    }
  }

  /** Full selection clear: reset state + clear highlights + rebuild everything. */
  _clearSelection() {
    this._resetSelectionState();
    this._clearPlacementHighlights();
    this._rebuildCells();
    this._rebuildHand();
  }
```

- [ ] **Step 2: Verify existing flows still work**

Run: `npm run dev`
Test: Place a card on a cell (card placement flow uses `_clearSelection`). Confirm highlights clear and cells rebuild correctly.

- [ ] **Step 3: Commit**

```bash
git add src/substates/DungeonMapUI.js
git commit -m "refactor(p026): split _clearSelection into three reusable methods"
```

---

### Task 5: Implement Deploy Animation

**Files:**
- Modify: `src/substates/DungeonMapUI.js` — add constants, `_playDeployAnimation`, refactor `_handleMonsterPlacement`

- [ ] **Step 1: Add deploy animation constants at file top**

After the existing constants (around line 11), add:

```js
const DEPLOY_DROP_Y     = -30;   // Start offset above cell
const DEPLOY_DURATION   = 200;   // ms, Back.Out ease
const DEPLOY_BOUNCE     = 1.05;  // Cell scale bounce
const BUFF_DELAY        = 200;   // ms after landing
const BUFF_PULSE_DUR    = 300;   // ms for alpha pulse + icon bounce
```

- [ ] **Step 2: Add _playDeployAnimation method**

Add before the `_clearSelection` section (before `// Selection clear` comment):

```js
  // ---------------------------------------------------------------------------
  // Deploy / remove animations
  // ---------------------------------------------------------------------------

  /**
   * Play monster deploy animation on a cell.
   * @param {Phaser.GameObjects.Container} cellCont - The cell container
   * @param {object} cell - The cell data (must already have monster set in GameState)
   * @param {string} monsterTypeId - The monster type ID
   * @param {Function} onComplete - Called after all animations finish
   */
  _playDeployAnimation(cellCont, cell, monsterTypeId, onComplete) {
    const scene = this.scene;

    // Create monster sprite
    const idleKey = `monster_${monsterTypeId}_idle`;
    let monSprite;
    if (scene.anims.exists(idleKey)) {
      monSprite = scene.add.sprite(0, DEPLOY_DROP_Y, idleKey).setOrigin(0.5);
      monSprite.displayWidth = 40;
      monSprite.displayHeight = 40;
      monSprite.setAlpha(0);
    } else {
      const staticKey = `monster_${monsterTypeId}`;
      monSprite = SpriteHelper.createSprite(scene, staticKey, 0, DEPLOY_DROP_Y, 40);
      monSprite.setAlpha(0);
    }
    cellCont.add(monSprite);
    cellCont.setData('monsterSprite', monSprite);

    // Drop animation: y offset → 0, alpha 0 → 1
    scene.tweens.add({
      targets: monSprite,
      y: 0,
      alpha: 1,
      duration: DEPLOY_DURATION,
      ease: 'Back.Out',
      onComplete: () => {
        // Start idle animation after landing
        if (scene.anims.exists(idleKey)) {
          const startFrame = Phaser.Math.Between(0, 3);
          monSprite.play({ key: idleKey, startFrame });
        }

        // Cell bounce
        scene.tweens.add({
          targets: cellCont,
          scaleX: DEPLOY_BOUNCE,
          scaleY: DEPLOY_BOUNCE,
          duration: 100,
          yoyo: true,
          ease: 'Sine.InOut',
        });

        // Check buff match
        this._maybePlayBuffEffect(cellCont, cell, monsterTypeId);

        if (onComplete) onComplete();
      },
    });
  }

  /**
   * Play buff pulse effect if monster matches room.
   */
  _maybePlayBuffEffect(cellCont, cell, monsterTypeId) {
    if (!cell.room) return;

    const dataManager = this.scene.registry.get('dataManager');
    const monsterDef = dataManager.getMonster(monsterTypeId);
    const roomDef = dataManager.getRoom(cell.room.typeId);
    if (!monsterDef || !roomDef) return;
    if (!monsterDef.type.includes(roomDef.buffTarget)) return;

    const scene = this.scene;

    // Base sprite alpha pulse
    const baseSprite = cellCont.getData('baseSprite');
    if (baseSprite) {
      scene.tweens.add({
        targets: baseSprite,
        alpha: 0.6,
        duration: BUFF_PULSE_DUR / 2,
        yoyo: true,
        delay: BUFF_DELAY,
        ease: 'Sine.InOut',
      });
    }

    // Room icon scale bounce
    const roomIcon = cellCont.getData('roomIcon');
    if (roomIcon) {
      scene.tweens.add({
        targets: roomIcon,
        scaleX: 1.3,
        scaleY: 1.3,
        duration: BUFF_PULSE_DUR / 2,
        yoyo: true,
        delay: BUFF_DELAY,
        ease: 'Sine.InOut',
      });
    }
  }
```

- [ ] **Step 3: Verify DataManager API**

DataManager methods confirmed: `dataManager.getMonster(typeId)` returns `{ type: [...], ... }`, `dataManager.getRoom(typeId)` returns `{ buffTarget: "...", ... }`. Buff match: `monsterDef.type.includes(roomDef.buffTarget)`.

- [ ] **Step 4: Refactor _handleMonsterPlacement to use deploy animation**

Replace the `_handleMonsterPlacement` method (lines 950-969):

```js
  _handleMonsterPlacement(cell) {
    if (cell.type !== 'normal') {
      this._clearSelection();
      return;
    }

    const { monsterId } = this.selectionState;
    const monster = this.gameState.monsterRoster.find(m => m.instanceId === monsterId);
    if (!monster) { this._clearSelection(); return; }

    if (!cell.monster) {
      // Empty monster slot — place with animation
      this.gameState.setCellMonster(cell.id, monsterId, monster.typeId);
      this._resetSelectionState();
      this._clearPlacementHighlights();

      // Find the cell container
      const cellCont = this._cellContainers.find(
        c => c.getData('cellId') === cell.id
      );
      if (cellCont) {
        this._playDeployAnimation(cellCont, cell, monster.typeId, () => {
          this._rebuildHand();
        });
      } else {
        this._rebuildHand();
      }
    } else {
      // Cell already has a monster — confirm swap
      this._showMonsterSwapConfirm(cell, monsterId, monster.typeId);
    }
  }
```

- [ ] **Step 5: Verify deploy animation works**

Run: `npm run dev`
Test: Go to monster list → place a monster on an empty cell. Expected: monster drops from above with bounce, cell pulses. If room matches monster type, base tile flashes and room icon bounces.

- [ ] **Step 6: Commit**

```bash
git add src/substates/DungeonMapUI.js
git commit -m "feat(p026): deploy animation with drop bounce and buff pulse effect"
```

---

### Task 6: Implement Swap Animation

**Files:**
- Modify: `src/substates/DungeonMapUI.js` — add `_playRemoveAnimation`, refactor `_showMonsterSwapConfirm`

- [ ] **Step 1: Add remove animation constants**

Add after the deploy constants:

```js
const REMOVE_DURATION   = 150;   // ms fade out
const REMOVE_SCALE      = 0.8;   // shrink target
```

- [ ] **Step 2: Add _playRemoveAnimation method**

Add after `_maybePlayBuffEffect`:

```js
  /**
   * Play monster removal animation (fade out + shrink).
   * @param {Phaser.GameObjects.Sprite|Phaser.GameObjects.Image} sprite - The monster sprite
   * @param {Function} onComplete - Called after animation finishes
   */
  _playRemoveAnimation(sprite, onComplete) {
    if (!sprite) {
      if (onComplete) onComplete();
      return;
    }
    this.scene.tweens.add({
      targets: sprite,
      alpha: 0,
      scaleX: REMOVE_SCALE,
      scaleY: REMOVE_SCALE,
      duration: REMOVE_DURATION,
      ease: 'Sine.In',
      onComplete: () => {
        sprite.destroy();
        if (onComplete) onComplete();
      },
    });
  }
```

- [ ] **Step 3: Refactor _showMonsterSwapConfirm to use animations**

Replace the `yesBtn.on('pointerdown', ...)` handler in `_showMonsterSwapConfirm` (lines 992-998):

```js
    yesBtn.on('pointerdown', (_p, _lx, _ly, event) => {
      event.stopPropagation();
      this._mapWorldContainer.remove(overlay, true);

      // Find the cell container and its current monster sprite
      const cellCont = this._cellContainers.find(
        c => c.getData('cellId') === cell.id
      );
      const oldMonsterSprite = cellCont ? cellCont.getData('monsterSprite') : null;

      // Play remove animation for old monster, then deploy new one
      this._playRemoveAnimation(oldMonsterSprite, () => {
        this.gameState.setCellMonster(cell.id, monsterId, typeId);
        this._resetSelectionState();
        this._clearPlacementHighlights();

        if (cellCont) {
          cellCont.setData('monsterSprite', null);
          this._playDeployAnimation(cellCont, cell, typeId, () => {
            this._rebuildHand();
          });
        } else {
          this._rebuildCells();
          this._rebuildHand();
        }
      });
    });
```

Also update the `noBtn` handler to use the split methods:

```js
    noBtn.on('pointerdown', (_p, _lx, _ly, event) => {
      event.stopPropagation();
      this._mapWorldContainer.remove(overlay, true);
      this._clearSelection();
    });
```

- [ ] **Step 4: Verify swap animation works**

Run: `npm run dev`
Test: Place monster A on a cell → place monster B on the same cell → confirm swap. Expected: old monster fades out, new monster drops in with bounce.

- [ ] **Step 5: Commit**

```bash
git add src/substates/DungeonMapUI.js
git commit -m "feat(p026): swap animation — fade out old monster, deploy new one"
```

---

### Task 7: Lint + Final Verification

**Files:**
- All modified files

- [ ] **Step 1: Run ESLint**

Run: `npm run lint`
Expected: 0 errors. Fix any issues.

- [ ] **Step 2: Run dev server and verify all acceptance criteria**

Run: `npm run dev`

Checklist:
1. 5 idle spritesheets + icon_trap loaded (check console for missing texture warnings)
2. No text labels on cells
3. Trap shows pixel art icon (not emoji)
4. Monsters show 40px centered with idle animation loop
5. Room icons at bottom-left, 10px
6. Deploy: drop bounce animation works
7. Buff: flash effect on matching room+monster
8. Swap: old monster fades, new deploys
9. No console errors
10. Battle flow unaffected (start a battle, verify heroes move, combat works)
11. Monster list shows monsters correctly (static sprites)

- [ ] **Step 3: QA with agent-browser screenshot**

Use agent-browser to navigate to the dungeon map with deployed monsters and capture a screenshot for visual verification.

- [ ] **Step 4: Commit any fixes**

If any fixes were needed, commit them:

```bash
git add -A
git commit -m "fix(p026): lint and QA fixes for monster/room grid display"
```
