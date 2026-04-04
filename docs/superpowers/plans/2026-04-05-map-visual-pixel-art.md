# Map Visual Pixel Art Overhaul — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace all procedural Graphics rendering in DungeonMapUI with pixel art sprites generated via NanoBanana MCP.

**Architecture:** Generate 17 pixel art assets via NanoBanana, register them in spriteManifest, then refactor DungeonMapUI.js to use sprites instead of Graphics draw calls. Layer structure changes from flat Graphics to: bgImage → pathGfx → pathSpriteContainer → cellLayerContainer → pathOverlayContainer → forecastGfx.

**Tech Stack:** Phaser 3.87 (Canvas renderer), NanoBanana MCP (Gemini Imagen), Vite

**Spec:** `docs/superpowers/specs/2026-04-05-map-visual-pixel-art-design.md`

**[SKIP-TDD]** — Game Jam scope, no test framework configured.

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `src/data/spriteManifest.js` | Modify | Add 17 new asset entries |
| `src/substates/DungeonMapUI.js` | Modify | Replace Graphics with sprites, new layer structure |
| `public/sprites/map_bg.png` | Create | Map background texture (375x860) |
| `public/sprites/cell_*.png` (8) | Create | Cell background tiles (80x80 each) |
| `public/sprites/icon_*.png` (5) | Create | Room type icons (24x24 each) |
| `public/sprites/path_chain.png` | Create | Chain segment (24x8) |
| `public/sprites/path_arrow.png` | Create | Direction arrow (16x16) |
| `public/sprites/path_diamond.png` | Create | Fork/merge marker (16x16) |

---

### Task 1: Generate Map Background Asset

**Files:**
- Create: `public/sprites/map_bg.png`

- [ ] **Step 1: Generate map background via NanoBanana**

Use `mcp__nano-banana__generate_image` with prompt:

```
Pixel art dark stone dungeon floor texture, top-down view, 16-bit retro game style.
Dark brown and black color palette (#1a1510, #2d1b0e). Subtle natural brightness
variation across the surface. Stone tiles with cracks and moss. No characters, no
items, just floor texture. Seamless edges.
```

Size: 375x860. Save to `public/sprites/map_bg.png`.

- [ ] **Step 2: Verify the image**

```bash
file public/sprites/map_bg.png
# Expected: PNG image data, 375 x 860 (or similar dimensions to crop/resize)
```

If NanoBanana outputs a different size, use ImageMagick to resize:
```bash
magick public/sprites/map_bg.png -filter point -resize 375x860! public/sprites/map_bg.png
```

- [ ] **Step 3: Commit**

```bash
git add public/sprites/map_bg.png
git commit -m "feat(p025): add pixel art map background texture"
```

---

### Task 2: Generate Cell Background Tiles (8 images)

**Files:**
- Create: `public/sprites/cell_hatchery.png`
- Create: `public/sprites/cell_lab.png`
- Create: `public/sprites/cell_training.png`
- Create: `public/sprites/cell_dungeon.png`
- Create: `public/sprites/cell_treasury.png`
- Create: `public/sprites/cell_portal.png`
- Create: `public/sprites/cell_heart.png`
- Create: `public/sprites/cell_empty.png`

- [ ] **Step 1: Generate all 8 cell tiles via NanoBanana**

Each image is 80x80 pixels, pixel art style, transparent background, content in center 72x72 area (4px padding). Dark color palette matching `#1a1510` / `#2d1b0e` theme.

Prompts for each:

**cell_hatchery:**
```
Pixel art dungeon room tile, top-down view, 80x80px. Fleshy red cave floor with
eggshell fragments and organic matter. Dark red-brown palette. 16-bit retro style.
Transparent background, content centered. Dark fantasy theme.
```

**cell_lab:**
```
Pixel art dungeon room tile, top-down view, 80x80px. Purple magic circle drawn on
dark stone floor, glowing runes. Purple and dark brown palette. 16-bit retro style.
Transparent background, content centered. Dark fantasy theme.
```

**cell_training:**
```
Pixel art dungeon room tile, top-down view, 80x80px. Wooden plank floor with scratch
marks from weapons training. Brown and dark tan palette. 16-bit retro style.
Transparent background, content centered. Dark fantasy theme.
```

**cell_dungeon:**
```
Pixel art dungeon room tile, top-down view, 80x80px. Grey stone brick floor with
iron bar shadows. Grey and dark brown palette. 16-bit retro style. Transparent
background, content centered. Dark fantasy prison cell theme.
```

**cell_treasury:**
```
Pixel art dungeon room tile, top-down view, 80x80px. Gold-tinted stone floor tiles
with scattered coins and gems. Gold and dark brown palette. 16-bit retro style.
Transparent background, content centered. Dark fantasy treasure room.
```

**cell_portal:**
```
Pixel art magical portal tile, top-down view, 80x80px. Blue swirling vortex portal
with cyan energy ring. Blue and cyan palette on dark background. 16-bit retro style.
Transparent background, content centered. Fantasy dungeon entrance.
```

**cell_heart:**
```
Pixel art magical crystal tile, top-down view, 80x80px. Purple pulsing crystal
heart of dungeon, dark energy radiating outward. Purple and magenta palette on dark
background. 16-bit retro style. Transparent background. Fantasy dungeon core.
```

**cell_empty:**
```
Pixel art empty dungeon tile, top-down view, 80x80px. Cracked dark stone floor
with a carved question mark symbol. Grey-brown palette. 16-bit retro style.
Transparent background, content centered. Unexplored dungeon room.
```

- [ ] **Step 2: Verify all 8 images exist and are PNGs**

```bash
ls -la public/sprites/cell_*.png
# Expected: 8 files, all PNG format
```

Resize any that are not 80x80:
```bash
for f in public/sprites/cell_*.png; do
  magick "$f" -filter point -resize 80x80! "$f"
done
```

- [ ] **Step 3: Commit**

```bash
git add public/sprites/cell_*.png
git commit -m "feat(p025): add 8 pixel art cell background tiles"
```

---

### Task 3: Generate Room Icons and Path Assets (8 images)

**Files:**
- Create: `public/sprites/icon_hatchery.png` (24x24)
- Create: `public/sprites/icon_lab.png` (24x24)
- Create: `public/sprites/icon_training.png` (24x24)
- Create: `public/sprites/icon_dungeon.png` (24x24)
- Create: `public/sprites/icon_treasury.png` (24x24)
- Create: `public/sprites/path_chain.png` (24x8)
- Create: `public/sprites/path_arrow.png` (16x16)
- Create: `public/sprites/path_diamond.png` (16x16)

- [ ] **Step 1: Generate 5 room icons via NanoBanana**

Each 24x24 pixels, pixel art, transparent background.

**icon_hatchery:**
```
Pixel art icon, 24x24px. Single monster egg with cracks, dark red tones. 16-bit
retro game item icon. Transparent background. Simple, recognizable silhouette.
```

**icon_lab:**
```
Pixel art icon, 24x24px. Potion bottle with purple liquid bubbling. 16-bit retro
game item icon. Transparent background. Simple, recognizable silhouette.
```

**icon_training:**
```
Pixel art icon, 24x24px. Crossed swords, golden-brown metal. 16-bit retro game
item icon. Transparent background. Simple, recognizable silhouette.
```

**icon_dungeon:**
```
Pixel art icon, 24x24px. Small skull, grey bone color. 16-bit retro game item
icon. Transparent background. Simple, recognizable silhouette.
```

**icon_treasury:**
```
Pixel art icon, 24x24px. Gold coin with shine sparkle. 16-bit retro game item
icon. Transparent background. Simple, recognizable silhouette.
```

- [ ] **Step 2: Generate 3 path assets via NanoBanana**

**path_chain (24x8):**
```
Pixel art horizontal chain link segment, 24x8px. Iron chain links, dark brown-grey
metal. 16-bit retro style. Transparent background. Tileable horizontally.
```

**path_arrow (16x16):**
```
Pixel art directional arrow pointing right, 16x16px. Brown-gold arrow, simple
triangular shape. 16-bit retro style. Transparent background.
```

**path_diamond (16x16):**
```
Pixel art diamond shape marker, 16x16px. Gold diamond/rhombus, glowing center.
16-bit retro style. Transparent background.
```

- [ ] **Step 3: Verify and resize all 8 images**

```bash
ls -la public/sprites/icon_*.png public/sprites/path_*.png
```

Resize if needed:
```bash
for f in public/sprites/icon_*.png; do magick "$f" -filter point -resize 24x24! "$f"; done
magick public/sprites/path_chain.png -filter point -resize 24x8! public/sprites/path_chain.png
magick public/sprites/path_arrow.png -filter point -resize 16x16! public/sprites/path_arrow.png
magick public/sprites/path_diamond.png -filter point -resize 16x16! public/sprites/path_diamond.png
```

- [ ] **Step 4: Commit**

```bash
git add public/sprites/icon_*.png public/sprites/path_*.png
git commit -m "feat(p025): add pixel art room icons and path decoration assets"
```

---

### Task 4: Register Assets in spriteManifest

**Files:**
- Modify: `src/data/spriteManifest.js`

- [ ] **Step 1: Add 17 new entries to spriteManifest**

Add after the existing hero entries (line 12), before the closing `];`:

```javascript
  // Map visual assets
  { key: 'map_bg',           path: 'sprites/map_bg.png' },
  { key: 'cell_hatchery',    path: 'sprites/cell_hatchery.png' },
  { key: 'cell_lab',         path: 'sprites/cell_lab.png' },
  { key: 'cell_training',    path: 'sprites/cell_training.png' },
  { key: 'cell_dungeon',     path: 'sprites/cell_dungeon.png' },
  { key: 'cell_treasury',    path: 'sprites/cell_treasury.png' },
  { key: 'cell_portal',      path: 'sprites/cell_portal.png' },
  { key: 'cell_heart',       path: 'sprites/cell_heart.png' },
  { key: 'cell_empty',       path: 'sprites/cell_empty.png' },
  { key: 'icon_hatchery',    path: 'sprites/icon_hatchery.png' },
  { key: 'icon_lab',         path: 'sprites/icon_lab.png' },
  { key: 'icon_training',    path: 'sprites/icon_training.png' },
  { key: 'icon_dungeon',     path: 'sprites/icon_dungeon.png' },
  { key: 'icon_treasury',    path: 'sprites/icon_treasury.png' },
  { key: 'path_chain',       path: 'sprites/path_chain.png' },
  { key: 'path_arrow',       path: 'sprites/path_arrow.png' },
  { key: 'path_diamond',     path: 'sprites/path_diamond.png' },
```

- [ ] **Step 2: Verify build**

```bash
npm run build 2>&1 | tail -5
# Expected: no errors
```

- [ ] **Step 3: Commit**

```bash
git add src/data/spriteManifest.js
git commit -m "feat(p025): register 17 map pixel art assets in spriteManifest"
```

---

### Task 5: Refactor Container Layer Structure

**Files:**
- Modify: `src/substates/DungeonMapUI.js:197-228` (`_buildContainers` method)

- [ ] **Step 1: Update `_buildContainers()` to new layer order**

Replace lines 207-213 (the old bgGfx/pathGfx/forecastGfx section) with:

```javascript
    // Background image (created once, never rebuilt)
    this._mapBgImage = scene.add.image(0, 0, 'map_bg').setOrigin(0, 0);
    this._mapWorldContainer.add(this._mapBgImage);

    // Path base graphics (glow + main lines, redrawn on rebuild)
    this._pathGfx = scene.add.graphics();
    this._mapWorldContainer.add(this._pathGfx);

    // Path sprite container (chain link sprites, cleared + repopulated on rebuild)
    this._pathSpriteContainer = scene.add.container(0, 0);
    this._mapWorldContainer.add(this._pathSpriteContainer);

    // Cell layer container — holds all cell containers, ensures correct z-order
    this._cellLayerContainer = scene.add.container(0, 0);
    this._mapWorldContainer.add(this._cellLayerContainer);

    // cellContainers array — rebuilt on each refresh()
    this._cellContainers = [];

    // Path overlay container (arrows + diamonds — ABOVE cells)
    this._pathOverlayContainer = scene.add.container(0, 0);
    this._mapWorldContainer.add(this._pathOverlayContainer);

    // Forecast graphics (dashed route, dynamic per-wave)
    this._forecastGfx = scene.add.graphics();
    this._mapWorldContainer.add(this._forecastGfx);
```

Also remove the old `this._cellContainers = [];` line at 216 (now inside the block above).

Remove the old `this._bgGfx` reference — it no longer exists.

**IMPORTANT:** Update `_rebuildCells()` to add cells to `_cellLayerContainer` instead of `_mapWorldContainer`:

In `_rebuildCells()`, change:
```javascript
    // Old:
    this._mapWorldContainer.remove(c, true);
    // ...
    this._mapWorldContainer.add(cellCont);
```
To:
```javascript
    // New:
    this._cellLayerContainer.remove(c, true);
    // ...
    this._cellLayerContainer.add(cellCont);
```

This ensures cells stay inside `_cellLayerContainer`, keeping `_pathOverlayContainer` above them in z-order.

- [ ] **Step 2: Update `_rebuildBackground()` cleanup to clear new containers**

At the start of `_rebuildBackground()` (line 243), replace:

```javascript
  _rebuildBackground() {
    this._bgGfx.clear();
    this._pathGfx.clear();
```

With:

```javascript
  _rebuildBackground() {
    this._pathGfx.clear();
    this._pathSpriteContainer.removeAll(true);
    this._pathOverlayContainer.removeAll(true);
```

The `_mapBgImage` is never cleared — it persists.

- [ ] **Step 3: Remove parchment noise generation**

Delete the entire noise overlay block (lines 247-267):

```javascript
    // 1. Parchment base
    this._bgGfx.fillStyle(0x2d1b0e, 1);
    this._bgGfx.fillRect(0, 0, MAP_WORLD_W, MAP_WORLD_H);

    // Noise overlay — layered texture for parchment feel
    this._bgGfx.fillStyle(0x3d2515, 0.4);
    for (let ny = 0; ny < MAP_WORLD_H; ny += 10) {
      for (let nx = 0; nx < MAP_WORLD_W; nx += 10) {
        if (Math.random() < 0.4) {
          this._bgGfx.fillRect(nx, ny, 6, 6);
        }
      }
    }
    this._bgGfx.fillStyle(0x150d06, 0.25);
    for (let ny = 0; ny < MAP_WORLD_H; ny += 18) {
      for (let nx = 0; nx < MAP_WORLD_W; nx += 18) {
        if (Math.random() < 0.3) {
          this._bgGfx.fillRect(nx, ny, 12, 12);
        }
      }
    }
```

This entire block is replaced by `_mapBgImage`.

- [ ] **Step 4: Update `destroy()` to clean up new objects**

In the `destroy()` method (around line 188), ensure new objects are cleaned up. Add before `this._rootContainer.destroy()`:

```javascript
    if (this._mapBgImage) this._mapBgImage.destroy();
    if (this._pathSpriteContainer) this._pathSpriteContainer.destroy(true);
    if (this._cellLayerContainer) this._cellLayerContainer.destroy(true);
    if (this._pathOverlayContainer) this._pathOverlayContainer.destroy(true);
```

- [ ] **Step 5: Verify build**

```bash
npm run build 2>&1 | tail -5
```

- [ ] **Step 6: Commit**

```bash
git add src/substates/DungeonMapUI.js
git commit -m "refactor(p025): new container layer structure for pixel art sprites"
```

---

### Task 6: Replace Cell Graphics with Sprites

**Files:**
- Modify: `src/substates/DungeonMapUI.js:439-613` (`_buildCellContainer`, `_drawCellVisual`, `_drawRuneIcon`, `_getCellLabel`)

- [ ] **Step 1: Add cell sprite key helper**

Add this helper method before `_buildCellContainer`:

```javascript
  /** Get the sprite key for a cell's background tile. */
  _getCellSpriteKey(cell) {
    if (cell.type === 'portal') return 'cell_portal';
    if (cell.type === 'heart') return 'cell_heart';
    if (!cell.room) return 'cell_empty';
    const KNOWN = ['hatchery', 'lab', 'training', 'dungeon', 'treasury'];
    if (KNOWN.includes(cell.room.typeId)) return `cell_${cell.room.typeId}`;
    return 'cell_empty'; // fallback for unknown room types
  }

  /** Get the icon sprite key for a room type, or null if unknown. */
  _getRoomIconKey(roomTypeId) {
    const KNOWN = ['hatchery', 'lab', 'training', 'dungeon', 'treasury'];
    return KNOWN.includes(roomTypeId) ? `icon_${roomTypeId}` : null;
  }
```

- [ ] **Step 2: Rewrite `_buildCellContainer()`**

Replace the current `_buildCellContainer` method (lines 439-493) with:

```javascript
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

    // Room icon sprite (only for normal cells with known room types)
    if (cell.room) {
      const iconKey = this._getRoomIconKey(cell.room.typeId);
      if (iconKey) {
        const iconSprite = scene.add.image(0, -14, iconKey).setOrigin(0.5);
        cont.add(iconSprite);
      }
    }

    // Label text (below icon to avoid overlap)
    const labelStr = this._getCellLabel(cell);
    const labelText = scene.add.text(0, 6, labelStr, {
      fontSize: '14px', color: '#ffffff', fontFamily: 'monospace',
    }).setOrigin(0.5);
    cont.add(labelText);

    // Trap icon (top-right corner)
    if (cell.trap) {
      const trapIcon = scene.add.text(half - 4, -half + 4, '\u26A0', {
        fontSize: '14px', color: '#ff6600', fontFamily: 'monospace',
      }).setOrigin(1, 0);
      cont.add(trapIcon);
    }

    // Monster sprite (bottom of cell)
    if (cell.monster) {
      const monKey = `monster_${cell.monster.typeId}`;
      const monIcon = SpriteHelper.createSprite(scene, monKey, 0, 6, 54);
      cont.add(monIcon);
    }

    // Store references
    cont.setData('cellId', cell.id);
    cont.setData('defaultBorder', defaultBorder);
    cont.setData('highlightBorder', highlightBorder);

    return cont;
  }
```

- [ ] **Step 3: Replace `_drawCellVisual` with `_drawDefaultBorder`**

Delete the old `_drawCellVisual` method (lines 502-536) and replace with:

```javascript
  /** Draw the default border for a cell based on its state. */
  _drawDefaultBorder(cell, border, half) {
    const r = 8;
    border.clear();

    if (cell.type === 'portal') {
      border.lineStyle(4, 0x00FFFF, 0.4);
      border.strokeRoundedRect(-half - 3, -half - 3, CELL_SIZE + 6, CELL_SIZE + 6, r + 2);
      border.lineStyle(3, 0x00FFFF, 1);
      border.strokeRoundedRect(-half, -half, CELL_SIZE, CELL_SIZE, r);
    } else if (cell.type === 'heart') {
      border.lineStyle(4, 0x9B59B6, 0.4);
      border.strokeRoundedRect(-half - 3, -half - 3, CELL_SIZE + 6, CELL_SIZE + 6, r + 2);
      border.lineStyle(3, 0x9B59B6, 1);
      border.strokeRoundedRect(-half, -half, CELL_SIZE, CELL_SIZE, r);
    } else if (!cell.room) {
      // Empty cell — subtle dashed brown
      border.lineStyle(2, 0x8B4513, 0.4);
      border.strokeRoundedRect(-half, -half, CELL_SIZE, CELL_SIZE, r);
    } else if (cell.trap) {
      border.lineStyle(3, 0x8B0000, 1);
      border.strokeRoundedRect(-half, -half, CELL_SIZE, CELL_SIZE, r);
    } else {
      border.lineStyle(3, 0x8B4513, 1);
      border.strokeRoundedRect(-half, -half, CELL_SIZE, CELL_SIZE, r);
    }
  }
```

- [ ] **Step 4: Delete `_drawRuneIcon` method**

Remove the entire `_drawRuneIcon` method (lines 547-613). It is fully replaced by icon sprites in `_buildCellContainer`.

- [ ] **Step 5: Update `_getCellLabel` to use Chinese names**

Replace:

```javascript
  _getCellLabel(cell) {
    if (cell.type === 'portal') return '入口';
    if (cell.type === 'heart')  return '地城之心';
    if (!cell.room)             return '?';
    return cell.room.typeId;
  }
```

With:

```javascript
  _getCellLabel(cell) {
    if (cell.type === 'portal') return '入口';
    if (cell.type === 'heart')  return '地城之心';
    if (!cell.room)             return '?';
    const LABEL_MAP = {
      hatchery: '孵化室', lab: '實驗室', training: '訓練場',
      dungeon: '牢房', treasury: '寶庫',
    };
    return LABEL_MAP[cell.room.typeId] || cell.room.typeId;
  }
```

- [ ] **Step 6: Verify build**

```bash
npm run build 2>&1 | tail -5
```

- [ ] **Step 7: Commit**

```bash
git add src/substates/DungeonMapUI.js
git commit -m "feat(p025): replace cell Graphics with pixel art sprites and icons"
```

---

### Task 7: Rewrite Highlight System

**Files:**
- Modify: `src/substates/DungeonMapUI.js` — `setCellHighlight`, `_highlightValidCells`, `_stopPulseTweens`

- [ ] **Step 1: Rewrite `setCellHighlight()`**

Replace the current `setCellHighlight` method (lines 80-96) with:

```javascript
  setCellHighlight(cellId, color) {
    const cont = this._cellContainers.find(c => c.getData('cellId') === cellId);
    if (!cont) return;
    const highlightBorder = cont.getData('highlightBorder');
    if (!highlightBorder) return;
    const half = CELL_SIZE / 2;

    if (color !== null) {
      highlightBorder.clear();
      highlightBorder.setAlpha(1);
      highlightBorder.lineStyle(3, color, 1);
      highlightBorder.strokeRoundedRect(-half, -half, CELL_SIZE, CELL_SIZE, 8);
      highlightBorder.setVisible(true);
    } else {
      highlightBorder.setVisible(false);
      highlightBorder.setAlpha(1);
    }
  }
```

- [ ] **Step 2: Rewrite `_highlightValidCells()` to use highlightBorder**

Replace the current `_highlightValidCells` method (lines 893-920) with:

```javascript
  _highlightValidCells() {
    this._stopPulseTweens();

    for (const cont of this._cellContainers) {
      const cellId = cont.getData('cellId');
      const cell   = this.gameState.getCell(cellId);
      if (!cell || cell.type !== 'normal') continue;

      const highlightBorder = cont.getData('highlightBorder');
      if (!highlightBorder) continue;

      // Draw green highlight border
      const half = CELL_SIZE / 2;
      highlightBorder.clear();
      highlightBorder.lineStyle(3, 0x00ff44, 1);
      highlightBorder.strokeRoundedRect(-half, -half, CELL_SIZE, CELL_SIZE, 8);
      highlightBorder.setVisible(true);

      const tween = this.scene.tweens.add({
        targets: highlightBorder,
        alpha: { from: 0.3, to: 0.8 },
        yoyo: true,
        repeat: -1,
        duration: 600,
      });
      this._pulseTweens.push(tween);
    }
  }
```

- [ ] **Step 3: Update `_clearSelection()` to hide all highlightBorders**

Find `_clearSelection()` and ensure it hides highlight borders. Add at the end of the method (before `this._rebuildHand()`):

```javascript
    // Hide all highlight borders and reset alpha
    for (const cont of this._cellContainers) {
      const hb = cont.getData('highlightBorder');
      if (hb) {
        hb.setVisible(false);
        hb.setAlpha(1);
      }
    }
```

- [ ] **Step 4: Update `clearBattleHighlights` if needed**

The existing `clearBattleHighlights` calls `_rebuildCells()` which destroys and recreates everything — this still works correctly since `_buildCellContainer` creates fresh highlightBorder instances. No change needed.

- [ ] **Step 5: Verify build**

```bash
npm run build 2>&1 | tail -5
```

- [ ] **Step 6: Commit**

```bash
git add src/substates/DungeonMapUI.js
git commit -m "refactor(p025): rewrite highlight system to use separate highlightBorder graphics"
```

---

### Task 8: Replace Path Rendering with Sprites

**Files:**
- Modify: `src/substates/DungeonMapUI.js:269-363` (path rendering in `_rebuildBackground`)

- [ ] **Step 1: Rewrite path chain/arrow/diamond rendering**

In `_rebuildBackground()`, replace the path rendering section (from `// 2. Path lines + decorations` through the fork/merge diamond block, roughly lines 269-363) with:

```javascript
    // 2. Path lines + chain sprites
    const grid = this.gameState.dungeonGrid;
    const cellMap = new Map(grid.map(c => [c.id, c]));
    const pathGfx = this._pathGfx;
    const scene = this.scene;

    for (const cell of grid) {
      for (const targetId of cell.connections) {
        const target = cellMap.get(targetId);
        if (!target) continue;

        const ax = cell.visualPos?.x ?? cell.position.x;
        const ay = cell.visualPos?.y ?? cell.position.y;
        const bx = target.visualPos?.x ?? target.position.x;
        const by = target.visualPos?.y ?? target.position.y;

        const dx = bx - ax;
        const dy = by - ay;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const angle = Math.atan2(dy, dx);

        // Glow line (wide, translucent)
        pathGfx.lineStyle(10, 0xCD853F, 0.15);
        pathGfx.beginPath();
        pathGfx.moveTo(ax, ay);
        pathGfx.lineTo(bx, by);
        pathGfx.strokePath();

        // Main path line
        pathGfx.lineStyle(6, 0xCD853F, 0.7);
        pathGfx.beginPath();
        pathGfx.moveTo(ax, ay);
        pathGfx.lineTo(bx, by);
        pathGfx.strokePath();

        // Chain sprites along path (skip 28px margins at each end)
        const startOffset = 28;
        const endOffset = 28;
        const usableDist = dist - startOffset - endOffset;

        if (usableDist > 0) {
          const chainSpacing = 24;
          const chainCount = Math.floor(usableDist / chainSpacing);
          for (let s = 0; s < chainCount; s++) {
            const t = (startOffset + s * chainSpacing + chainSpacing / 2) / dist;
            const cx = ax + dx * t;
            const cy = ay + dy * t;
            const chain = scene.add.image(cx, cy, 'path_chain')
              .setOrigin(0.5, 0.5)
              .setRotation(angle);
            this._pathSpriteContainer.add(chain);
          }
        }

        // Arrow sprite at downstream end (28px before target center)
        const arrowT = Math.max(0, 1 - endOffset / dist);
        const arrowX = ax + dx * arrowT;
        const arrowY = ay + dy * arrowT;
        const arrow = scene.add.image(arrowX, arrowY, 'path_arrow')
          .setOrigin(0.5, 0.5)
          .setRotation(angle);
        this._pathOverlayContainer.add(arrow);
      }
    }

    // 3. Fork/Merge diamond markers (in overlay, above cells)
    for (const cell of grid) {
      if (cell.connections.length > 1 || this._getIncomingCount(cell.id, grid) > 1) {
        const cx = cell.visualPos?.x ?? cell.position.x;
        const cy = cell.visualPos?.y ?? cell.position.y;
        const diamond = scene.add.image(cx, cy, 'path_diamond')
          .setOrigin(0.5, 0.5);
        this._pathOverlayContainer.add(diamond);
      }
    }
```

- [ ] **Step 2: Verify build**

```bash
npm run build 2>&1 | tail -5
```

- [ ] **Step 3: Commit**

```bash
git add src/substates/DungeonMapUI.js
git commit -m "feat(p025): replace path Graphics with chain/arrow/diamond sprites"
```

---

### Task 9: Final Cleanup and Verification

**Files:**
- Modify: `src/substates/DungeonMapUI.js` (remove dead code)

- [ ] **Step 1: Remove any remaining references to `_bgGfx`**

Search for `_bgGfx` in the file. All references should already be removed by Task 5. If any remain (e.g., in `destroy()`), remove them.

```bash
grep -n '_bgGfx' src/substates/DungeonMapUI.js
# Expected: no matches
```

- [ ] **Step 2: Remove old `_drawCellVisual` if still present**

```bash
grep -n '_drawCellVisual\|_drawRuneIcon' src/substates/DungeonMapUI.js
# Expected: no matches (both methods deleted in Task 6)
```

- [ ] **Step 3: Verify old `border` data key replaced with `defaultBorder`**

```bash
grep -n "getData('border')\|getData('bgFill')" src/substates/DungeonMapUI.js
# Expected: no matches — all replaced with 'defaultBorder' or 'highlightBorder'
```

If any remain, update them to use the new data keys.

- [ ] **Step 4: Run full build**

```bash
npm run build 2>&1 | tail -10
```

- [ ] **Step 5: Run lint**

```bash
npm run lint 2>&1 | tail -20
```

- [ ] **Step 6: Manual verification — start dev server**

```bash
npm run dev
```

Check in browser:
1. Map loads without console errors
2. Background is pixel art texture (no flickering)
3. Cells show correct tiles per room type
4. Room icons visible on cells with rooms
5. Labels show Chinese names
6. Chain sprites along paths with correct rotation
7. Arrows point downstream
8. Diamonds at fork/merge points (above cells)
9. Scroll is smooth
10. Tap a card → cells pulse green highlight → place card → highlight clears

- [ ] **Step 7: Commit final cleanup**

```bash
git add src/substates/DungeonMapUI.js
git commit -m "fix(p025): cleanup dead code from pixel art migration"
```

- [ ] **Step 8: Verify total asset size**

```bash
du -ch public/sprites/map_bg.png public/sprites/cell_*.png public/sprites/icon_*.png public/sprites/path_*.png | tail -1
# Expected: < 500KB total
```
