# P025: 地城地圖全面改善 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rewrite the dungeon map system with template-based topology, dual coordinates, chain-link path rendering, and 80px cells with rune icons.

**Architecture:** Replace random topology generation with 4 weighted templates (A/B/C/D). Split coordinates into logicalPos (game logic) and visualPos (rendering). Render paths as two layers: static RenderTexture (chains + arrows) and dynamic Graphics (hero forecast). Enlarge cells to 80px with rune icons and larger monster sprites.

**Tech Stack:** Phaser 3.90, Canvas renderer, ES6 modules, vanilla JS

**[SKIP-TDD]** — No test framework (Game Jam scope). Verification via `npm run lint` + visual inspection.

---

### Task 1: Create seededRandom utility

**Files:**
- Create: `src/utils/seededRandom.js`

- [ ] **Step 1: Create the seeded random module**

```javascript
// src/utils/seededRandom.js
// Mulberry32 PRNG — deterministic random from integer seed

/**
 * Create a seeded PRNG function.
 * @param {number} seed - Integer seed
 * @returns {function(): number} Returns [0, 1) on each call
 */
export function createRng(seed) {
  let s = seed | 0;
  return function () {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Hash a string into an integer seed.
 * @param {string} str
 * @returns {number}
 */
export function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return hash;
}

/**
 * Get a deterministic random value for a specific cell property.
 * @param {number} mapSeed
 * @param {string} cellId
 * @param {string} axis - 'x' or 'y'
 * @returns {number} [0, 1)
 */
export function seededCellRandom(mapSeed, cellId, axis) {
  const seed = hashString(`${mapSeed}_${cellId}_${axis}`);
  const rng = createRng(seed);
  return rng();
}
```

- [ ] **Step 2: Verify lint passes**

Run: `cd "/Users/admin/Game Jam 創業" && npx eslint src/utils/seededRandom.js`
Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add src/utils/seededRandom.js
git commit -m "feat(p025): add seededRandom utility for deterministic jitter"
```

---

### Task 2: Rewrite GridTopologyGenerator with templates

**Files:**
- Rewrite: `src/models/GridTopologyGenerator.js`

- [ ] **Step 1: Replace entire GridTopologyGenerator with template-based system**

```javascript
// src/models/GridTopologyGenerator.js
// Template-based dungeon grid topology for tower defense gameplay.
// Generates a single main path with optional split-merge branches.

import { seededCellRandom } from '../utils/seededRandom.js';

// Column X positions
const COL_X = { left: 82, center: 187, right: 292 };

// Row Y positions
const ROW_Y = [80, 220, 360, 500, 640, 780];

// --- Template Definitions ---
// connections: [sourceIndex, targetIndex] referencing flat cell array order
// colAssign: column for each cell in order ('left'|'center'|'right')

const TEMPLATE_A = {
  name: 'A_linear',
  rows: [1, 1, 1, 1, 1, 1],  // cells per row
  colAssign: ['center', 'center', 'center', 'center', 'center', 'center'],
  connections: [[0,1],[1,2],[2,3],[3,4],[4,5]],
  forkNodes: [],
  mergeNodes: [],
};

const TEMPLATE_B = {
  name: 'B_single_fork_1row',
  rows: [1, 1, 2, 1, 1, 1],  // row 2 has 2 cells (fork)
  colAssign: ['center', 'center', 'left', 'right', 'center', 'center', 'center'],
  // cells: 0=portal, 1=pre-fork, 2=branch-L, 3=branch-R, 4=merge, 5=post-merge, 6=heart
  connections: [[0,1],[1,2],[1,3],[2,4],[3,4],[4,5],[5,6]],
  forkNodes: [1],
  mergeNodes: [4],
};

const TEMPLATE_C = {
  name: 'C_single_fork_2row',
  rows: [1, 1, 2, 2, 1, 1],  // rows 2-3 each have 2 cells
  colAssign: ['center', 'center', 'left', 'right', 'left', 'right', 'center', 'center'],
  // cells: 0=portal, 1=fork, 2=branch-L1, 3=branch-R1, 4=branch-L2, 5=branch-R2, 6=merge, 7=heart
  connections: [[0,1],[1,2],[1,3],[2,4],[3,5],[4,6],[5,6],[6,7]],
  forkNodes: [1],
  mergeNodes: [6],
};

const TEMPLATE_D = {
  name: 'D_double_fork',
  rows: [1, 2, 1, 2, 1, 1],  // rows 1 and 3 have 2 cells
  colAssign: ['center', 'left', 'right', 'center', 'left', 'right', 'center', 'center'],
  // cells: 0=portal/fork1, 1=branch1-L, 2=branch1-R, 3=merge1/fork2, 4=branch2-L, 5=branch2-R, 6=merge2, 7=heart
  connections: [[0,1],[0,2],[1,3],[2,3],[3,4],[3,5],[4,6],[5,6],[6,7]],
  forkNodes: [0, 3],
  mergeNodes: [3, 6],
};

const TEMPLATES = [
  { template: TEMPLATE_A, weight: 10 },
  { template: TEMPLATE_B, weight: 40 },
  { template: TEMPLATE_C, weight: 30 },
  { template: TEMPLATE_D, weight: 20 },
];

export default class GridTopologyGenerator {
  /**
   * Generate a dungeon grid from a weighted random template.
   * @param {number} [mapSeed] - Optional seed for deterministic generation
   * @returns {{ cells: GridCell[], mapSeed: number, templateName: string }}
   */
  static generate(mapSeed) {
    if (mapSeed === undefined) {
      mapSeed = Math.floor(Math.random() * 2147483647);
    }

    const template = GridTopologyGenerator._selectTemplate(mapSeed);
    const mirror = GridTopologyGenerator._shouldMirror(mapSeed);
    const cells = GridTopologyGenerator._buildCells(template, mirror, mapSeed);

    return { cells, mapSeed, templateName: template.name };
  }

  static _selectTemplate(seed) {
    const totalWeight = TEMPLATES.reduce((s, t) => s + t.weight, 0);
    // Use seed to pick template deterministically
    let roll = (((seed * 1103515245 + 12345) >>> 0) / 4294967296) * totalWeight;
    for (const { template, weight } of TEMPLATES) {
      roll -= weight;
      if (roll <= 0) return template;
    }
    return TEMPLATES[0].template;
  }

  static _shouldMirror(seed) {
    return (((seed * 214013 + 2531011) >>> 0) / 4294967296) < 0.5;
  }

  static _buildCells(template, mirror, mapSeed) {
    const cells = [];
    let cellIndex = 0;
    let rowIndex = 0;

    for (const rowCount of template.rows) {
      for (let c = 0; c < rowCount; c++) {
        const colKey = template.colAssign[cellIndex];
        let col = colKey;

        // Apply mirror: swap left/right
        if (mirror && col === 'left') col = 'right';
        else if (mirror && col === 'right') col = 'left';

        const type = (rowIndex === 0) ? 'portal'
                   : (rowIndex === template.rows.length - 1) ? 'heart'
                   : 'normal';

        const logicalPos = { x: COL_X[col], y: ROW_Y[rowIndex] };

        // Compute visual jitter
        const jx = seededCellRandom(mapSeed, `cell_${cellIndex}`, 'x') * 16 - 8;
        const jy = seededCellRandom(mapSeed, `cell_${cellIndex}`, 'y') * 8 - 4;
        const visualPos = {
          x: logicalPos.x + jx,
          y: logicalPos.y + jy,
        };

        cells.push({
          id: `cell_${String(cellIndex).padStart(2, '0')}`,
          type,
          position: logicalPos,      // logicalPos (backward compat — used by hit-test)
          visualPos,                  // for rendering & hero movement
          connections: [],
          room: null,
          trap: null,
          monster: null,
        });

        cellIndex++;
      }
      rowIndex++;
    }

    // Wire connections
    for (const [srcIdx, dstIdx] of template.connections) {
      if (cells[srcIdx] && cells[dstIdx]) {
        cells[srcIdx].connections.push(cells[dstIdx].id);
      }
    }

    return cells;
  }
}
```

- [ ] **Step 2: Verify lint passes**

Run: `cd "/Users/admin/Game Jam 創業" && npx eslint src/models/GridTopologyGenerator.js`
Expected: 0 errors

- [ ] **Step 3: Quick smoke test — start dev server and check console**

Run: `npm run dev`
Navigate to game, start a new run. Check browser console for:
- `[DataManager] Loaded: {monsters: 5, heroes: 7, rooms: 5, traps: 5, drawCosts: 7}` (no errors)
- The flip matrix should still render (it doesn't depend on grid topology for display)
- Switch to 地圖 tab — verify cells appear (may look different, that's expected)

- [ ] **Step 4: Commit**

```bash
git add src/models/GridTopologyGenerator.js
git commit -m "feat(p025): rewrite GridTopologyGenerator with template-based topology"
```

---

### Task 3: Update GameState to preserve visualPos and mapSeed

**Files:**
- Modify: `src/models/GameState.js`

- [ ] **Step 1: Read GameState.js to find where dungeonGrid is created**

Read the constructor and any method that calls `GridTopologyGenerator.generate()`.

- [ ] **Step 2: Update the generation call to store mapSeed**

In `GameState` constructor or `_initDungeon` method, change:

```javascript
// Before:
this.dungeonGrid = GridTopologyGenerator.generate();

// After:
const result = GridTopologyGenerator.generate();
this.dungeonGrid = result.cells;
this.mapSeed = result.mapSeed;
```

Note: `mapSeed` is stored for jitter reproducibility (deterministic visual layout per run), not for full state serialization — GameState is run-scoped and not persisted to localStorage.

- [ ] **Step 3: Update getCellPosition helper if it exists in GameState**

If `GameState` has a `getCell` method, ensure it returns cells with both `position` (logicalPos) and `visualPos`.

- [ ] **Step 4: Verify lint + smoke test**

Run: `npx eslint src/models/GameState.js`
Start game, open 地圖 tab, verify no console errors.

- [ ] **Step 5: Commit**

```bash
git add src/models/GameState.js
git commit -m "feat(p025): store mapSeed and visualPos in GameState"
```

---

### Task 4: Update DungeonMapUI constants and layout

**Files:**
- Modify: `src/substates/DungeonMapUI.js` (top section only)

- [ ] **Step 1: Update layout constants**

At the top of `DungeonMapUI.js`, change:

```javascript
// Before:
const MAP_WORLD_W  = 375;
const MAP_WORLD_H  = 1200;
const HAND_H       = 64;
const CELL_SIZE    = 64;
const CELL_HIT     = 80;

// After:
const MAP_WORLD_W  = 375;
const MAP_WORLD_H  = 860;
const HAND_H       = 64;
const CELL_SIZE    = 80;
const CELL_HIT     = 80;
```

- [ ] **Step 2: Update getCellPosition to return visualPos**

```javascript
/** Get cell visual position by cellId (for rendering & hero movement). */
getCellPosition(cellId) {
  const cell = this.gameState.getCell(cellId);
  if (!cell) return null;
  return cell.visualPos
    ? { x: cell.visualPos.x, y: cell.visualPos.y }
    : { x: cell.position.x, y: cell.position.y };
}

/** Get cell logical position by cellId (for hit-test). */
getCellLogicalPosition(cellId) {
  const cell = this.gameState.getCell(cellId);
  return cell ? { x: cell.position.x, y: cell.position.y } : null;
}
```

- [ ] **Step 3: Update _handleMapTap to use logicalPos for hit-test**

In the `_handleMapTap` method, ensure cell hit detection uses `cell.position` (logical), not `cell.visualPos`:

```javascript
// In hit-test loop:
const dx = worldX - cell.position.x;  // use logicalPos
const dy = worldY - cell.position.y;
```

- [ ] **Step 3.5: Audit all cell.position visual uses in DungeonMapUI**

> **Review finding (Codex R2 P2):** `showRoomBuffIndicators()` and replace/swap confirm overlays still use `cell.position` for visual absolute positioning.

Search DungeonMapUI.js for `cell.position` used in visual rendering (not hit-test). Known locations:
- `showRoomBuffIndicators()`: `const { x, y } = cell.position;` → change to `cell.visualPos ?? cell.position`
- Replace/swap confirm overlay positioning → same migration

Keep `cell.position` for hit-test (logicalPos).

- [ ] **Step 4: Lint + verify**

Run: `npx eslint src/substates/DungeonMapUI.js`
Check no new errors.

- [ ] **Step 5: Commit**

```bash
git add src/substates/DungeonMapUI.js
git commit -m "feat(p025): update DungeonMapUI layout constants to 80px cells"
```

---

### Task 4.5: Migrate BattleUI to use visualPos for rendering

> **Review finding (Codex P1):** BattleUI reads `portalCell.position` and `heartCell.position` directly for hero spawn positions, boss-hit popups, and boss-skill text. After jitter is introduced, these will desync from rendered cell positions.

**Files:**
- Modify: `src/substates/BattleUI.js`

- [ ] **Step 1: Find all `cell.position` references in BattleUI.js**

Search for `portalCell.position`, `heartCell.position`, `cell.position` in BattleUI.js. Each one used for visual rendering must switch to `cell.visualPos ?? cell.position`.

Known locations (from review):
- Line ~182: `portalCell.position` for hero spawn position
- Line ~291: `heartCell.position` for boss damage popup
- Line ~474: `heartCell.position` for boss skill text
- Line ~485: `heartCell.position.y` for boss skill animation
- Line ~548: `heartCell.position` for another boss skill text
- Line ~584: `heartCell.position` fallback for display position

- [ ] **Step 2: Update each reference**

Pattern: replace `cell.position` with `cell.visualPos ?? cell.position` for all **visual** uses (spawn, popup, text position). Keep `cell.position` for any **logical** uses (hit-test, pathfinding).

- [ ] **Step 3: Lint + verify**

Run: `npx eslint src/substates/BattleUI.js`
Start game, trigger battle, verify hero spawns at correct visual position and boss effects render correctly.

- [ ] **Step 4: Commit**

```bash
git add src/substates/BattleUI.js
git commit -m "fix(p025): migrate BattleUI to visualPos for rendering coordinates"
```

---

### Task 5: Rewrite _rebuildBackground with two-layer path rendering

**Files:**
- Modify: `src/substates/DungeonMapUI.js` (method `_rebuildBackground`)

- [ ] **Step 1: Rewrite _rebuildBackground**

Replace the existing `_rebuildBackground` method entirely:

```javascript
_rebuildBackground() {
  const scene = this.scene;
  const rt = this._bgTexture;
  rt.clear();

  // 1. Parchment base
  const bgGfx = scene.add.graphics();
  bgGfx.fillStyle(0x2d1b0e, 1);
  bgGfx.fillRect(0, 0, MAP_WORLD_W, MAP_WORLD_H);

  // Noise overlay — subtle darker spots for texture
  bgGfx.fillStyle(0x1a1206, 0.3);
  for (let ny = 0; ny < MAP_WORLD_H; ny += 12) {
    for (let nx = 0; nx < MAP_WORLD_W; nx += 12) {
      if (Math.random() < 0.3) {
        bgGfx.fillRect(nx, ny, 8, 8);
      }
    }
  }
  rt.draw(bgGfx, 0, 0);
  bgGfx.destroy();

  // 2. Path lines + decorations
  const grid = this.gameState.dungeonGrid;
  const cellMap = new Map(grid.map(c => [c.id, c]));
  const pathGfx = scene.add.graphics();

  for (const cell of grid) {
    for (const targetId of cell.connections) {
      const target = cellMap.get(targetId);
      if (!target) continue;

      // Use visualPos for rendering
      const ax = cell.visualPos?.x ?? cell.position.x;
      const ay = cell.visualPos?.y ?? cell.position.y;
      const bx = target.visualPos?.x ?? target.position.x;
      const by = target.visualPos?.y ?? target.position.y;

      // Main path line
      pathGfx.lineStyle(4, 0x8B4513, 0.8);
      pathGfx.beginPath();
      pathGfx.moveTo(ax, ay);
      pathGfx.lineTo(bx, by);
      pathGfx.strokePath();

      // Chain link stamps along path
      const dx = bx - ax;
      const dy = by - ay;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const angle = Math.atan2(dy, dx);
      const steps = Math.floor(dist / 30);

      for (let s = 1; s < steps; s++) {
        const t = s / steps;
        const cx = ax + dx * t;
        const cy = ay + dy * t;

        // Skip near endpoints (within 5px of cell center)
        const distFromStart = dist * t;
        const distFromEnd = dist * (1 - t);
        if (distFromStart < 5 || distFromEnd < 5) continue;

        // Chain ring: stroked circle
        pathGfx.lineStyle(1.5, 0x8B4513, 0.9);
        pathGfx.strokeCircle(cx, cy, 4);
      }

      // Arrow at downstream end
      const arrowDist = 12;
      const arrowSize = 6;
      const arrowT = Math.max(0, 1 - arrowDist / dist);
      const arrowX = ax + dx * arrowT;
      const arrowY = ay + dy * arrowT;

      pathGfx.fillStyle(0x8B4513, 0.9);
      pathGfx.fillTriangle(
        arrowX + Math.cos(angle) * arrowSize,
        arrowY + Math.sin(angle) * arrowSize,
        arrowX + Math.cos(angle + 2.5) * arrowSize * 0.6,
        arrowY + Math.sin(angle + 2.5) * arrowSize * 0.6,
        arrowX + Math.cos(angle - 2.5) * arrowSize * 0.6,
        arrowY + Math.sin(angle - 2.5) * arrowSize * 0.6,
      );
    }
  }

  // 3. Fork/Merge diamond markers
  for (const cell of grid) {
    if (cell.connections.length > 1 || this._getIncomingCount(cell.id, grid) > 1) {
      const cx = cell.visualPos?.x ?? cell.position.x;
      const cy = cell.visualPos?.y ?? cell.position.y;
      pathGfx.fillStyle(0xf0c040, 0.7);
      pathGfx.fillPoints([
        { x: cx, y: cy - 8 },
        { x: cx + 6, y: cy },
        { x: cx, y: cy + 8 },
        { x: cx - 6, y: cy },
      ], true);
    }
  }

  rt.draw(pathGfx, 0, 0);
  pathGfx.destroy();
}

/** Count incoming connections to a cell. */
_getIncomingCount(cellId, grid) {
  let count = 0;
  for (const c of grid) {
    if (c.connections.includes(cellId)) count++;
  }
  return count;
}
```

- [ ] **Step 2: Update _buildContainers to use new MAP_WORLD_H**

In `_buildContainers`, ensure the RenderTexture is created with the new 860px height:

```javascript
this._bgTexture = scene.add.renderTexture(0, 0, MAP_WORLD_W, MAP_WORLD_H);
```

- [ ] **Step 3: Add dynamic forecast layer container**

In `_buildContainers`, after adding `_bgTexture` to `_mapWorldContainer`, add:

```javascript
this._forecastGfx = scene.add.graphics();
this._mapWorldContainer.add(this._forecastGfx);
```

- [ ] **Step 4: Add public method to draw forecast overlay**

```javascript
/**
 * Draw the next wave's predicted route on the dynamic forecast layer.
 * @param {string[]} route - Array of cellIds the hero will traverse
 */
drawForecastRoute(route) {
  this._forecastGfx.clear();
  if (!route || route.length < 2) return;

  this._forecastGfx.lineStyle(3, 0x4a9eff, 0.6);

  for (let i = 0; i < route.length - 1; i++) {
    const from = this.getCellPosition(route[i]);
    const to = this.getCellPosition(route[i + 1]);
    if (!from || !to) continue;

    // Dashed line effect
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const dashLen = 8;
    const gapLen = 6;
    const steps = Math.floor(dist / (dashLen + gapLen));

    for (let s = 0; s < steps; s++) {
      const t0 = s * (dashLen + gapLen) / dist;
      const t1 = Math.min(1, (s * (dashLen + gapLen) + dashLen) / dist);
      this._forecastGfx.beginPath();
      this._forecastGfx.moveTo(from.x + dx * t0, from.y + dy * t0);
      this._forecastGfx.lineTo(from.x + dx * t1, from.y + dy * t1);
      this._forecastGfx.strokePath();
    }
  }
}

/** Clear the forecast overlay. */
clearForecastRoute() {
  this._forecastGfx.clear();
}
```

- [ ] **Step 5: Lint + visual test**

Run: `npx eslint src/substates/DungeonMapUI.js`
Start game, go to 地圖 tab. Verify:
- Brown parchment background with noise texture
- Path lines with chain ring decorations
- Directional arrows on paths
- Diamond markers at fork/merge nodes

- [ ] **Step 6: Commit**

```bash
git add src/substates/DungeonMapUI.js
git commit -m "feat(p025): rewrite path rendering with chain decorations and forecast layer"
```

---

### Task 6: Rewrite cell visuals (80px + rune icons)

**Files:**
- Modify: `src/substates/DungeonMapUI.js` (methods `_drawCellVisual`, `_buildCellContainer`, `_getCellLabel`)

- [ ] **Step 1: Rewrite _drawCellVisual for 80px cells**

```javascript
_drawCellVisual(cell, border, bgFill, half) {
  const r = 8;

  if (cell.type === 'portal') {
    // Glow effect: outer ring
    border.lineStyle(4, 0x00FFFF, 0.4);
    border.strokeRoundedRect(-half - 3, -half - 3, CELL_SIZE + 6, CELL_SIZE + 6, r + 2);
    border.lineStyle(3, 0x00FFFF, 1);
    border.strokeRoundedRect(-half, -half, CELL_SIZE, CELL_SIZE, r);
    bgFill.fillStyle(0x003366, 0.6);
    bgFill.fillRoundedRect(-half, -half, CELL_SIZE, CELL_SIZE, r);
  } else if (cell.type === 'heart') {
    // Glow effect: purple outer ring
    border.lineStyle(4, 0x9B59B6, 0.4);
    border.strokeRoundedRect(-half - 3, -half - 3, CELL_SIZE + 6, CELL_SIZE + 6, r + 2);
    border.lineStyle(3, 0x9B59B6, 1);
    border.strokeRoundedRect(-half, -half, CELL_SIZE, CELL_SIZE, r);
    bgFill.fillStyle(0x4b0082, 0.7);
    bgFill.fillRoundedRect(-half, -half, CELL_SIZE, CELL_SIZE, r);
  } else if (!cell.room) {
    border.lineStyle(2, 0x8B4513, 0.4);
    border.strokeRoundedRect(-half, -half, CELL_SIZE, CELL_SIZE, r);
    bgFill.fillStyle(0x8B4513, 0.2);
    bgFill.fillRoundedRect(-half, -half, CELL_SIZE, CELL_SIZE, r);
  } else if (cell.room && cell.trap) {
    border.lineStyle(3, 0x8B0000, 1);
    border.strokeRoundedRect(-half, -half, CELL_SIZE, CELL_SIZE, r);
    bgFill.fillStyle(0x1a1a2e, 0.85);
    bgFill.fillRoundedRect(-half, -half, CELL_SIZE, CELL_SIZE, r);
  } else {
    border.lineStyle(3, 0x8B4513, 1);
    border.strokeRoundedRect(-half, -half, CELL_SIZE, CELL_SIZE, r);
    bgFill.fillStyle(0x1a1a2e, 0.85);
    bgFill.fillRoundedRect(-half, -half, CELL_SIZE, CELL_SIZE, r);
  }
}
```

- [ ] **Step 2: Update _buildCellContainer for visualPos and larger elements**

In `_buildCellContainer`, change the container position to use `visualPos`:

```javascript
_buildCellContainer(cell) {
  const scene = this.scene;
  const vp = cell.visualPos || cell.position;
  const { x, y } = vp;
  const half = CELL_SIZE / 2;

  const cont = scene.add.container(x, y);
  // ... rest stays similar but with updated sizes
```

Update label text font size from 18px to 14px, and add room name below:

```javascript
const labelStr = this._getCellLabel(cell);
const labelText = scene.add.text(0, -8, labelStr, {
  fontSize: '14px', color: '#ffffff', fontFamily: 'monospace',
}).setOrigin(0.5);
```

Update monster sprite size from 20 to 54:

```javascript
if (cell.monster) {
  const monKey = `monster_${cell.monster.typeId}`;
  monIcon = SpriteHelper.createSprite(scene, monKey, 0, 6, 54);
}
```

Update trap icon size from 10px to 14px and position:

```javascript
const trapIcon = scene.add.text(half - 4, -half + 4, trapStr, {
  fontSize: '14px', color: '#ff6600', fontFamily: 'monospace',
}).setOrigin(1, 0);
```

- [ ] **Step 3: Add rune icons for room types**

Replace the single-character room label with rune icons drawn via Graphics:

```javascript
_getCellLabel(cell) {
  if (cell.type === 'portal') return '入口';
  if (cell.type === 'heart') return '地城之心';
  if (!cell.room) return '?';
  // Show room name instead of first character
  return cell.room.typeId;
}
```

Add a helper to draw a small rune icon on the cell:

```javascript
_drawRuneIcon(graphics, roomTypeId, cx, cy) {
  const RUNE_COLORS = {
    hatchery: 0x8B0000,    // 孵化室 — gear
    lab: 0x6a3a8e,         // 研究室 — staff
    training: 0xB8860B,    // 訓練室 — sword
    dungeon: 0x555555,     // 地牢 — skull
    treasury: 0xf0c040,    // 寶藏室 — coin
  };
  const color = RUNE_COLORS[roomTypeId] || 0x8B4513;
  graphics.lineStyle(2, color, 0.8);

  // Simple geometric runes per type
  switch (roomTypeId) {
    case 'hatchery':
      // Gear shape: circle + 4 ticks
      graphics.strokeCircle(cx, cy, 10);
      for (let a = 0; a < 4; a++) {
        const angle = a * Math.PI / 2;
        graphics.beginPath();
        graphics.moveTo(cx + Math.cos(angle) * 8, cy + Math.sin(angle) * 8);
        graphics.lineTo(cx + Math.cos(angle) * 14, cy + Math.sin(angle) * 14);
        graphics.strokePath();
      }
      break;
    case 'lab':
      // Staff: vertical line + circle top
      graphics.beginPath();
      graphics.moveTo(cx, cy - 14);
      graphics.lineTo(cx, cy + 14);
      graphics.strokePath();
      graphics.strokeCircle(cx, cy - 14, 4);
      break;
    case 'training':
      // Sword: vertical line + crossguard
      graphics.beginPath();
      graphics.moveTo(cx, cy - 14);
      graphics.lineTo(cx, cy + 10);
      graphics.strokePath();
      graphics.beginPath();
      graphics.moveTo(cx - 8, cy - 2);
      graphics.lineTo(cx + 8, cy - 2);
      graphics.strokePath();
      break;
    case 'dungeon':
      // Skull: circle + jaw
      graphics.strokeCircle(cx, cy - 4, 8);
      graphics.beginPath();
      graphics.moveTo(cx - 5, cy + 4);
      graphics.lineTo(cx - 3, cy + 9);
      graphics.lineTo(cx + 3, cy + 9);
      graphics.lineTo(cx + 5, cy + 4);
      graphics.strokePath();
      break;
    case 'treasury':
      // Coin: circle + $ cross
      graphics.strokeCircle(cx, cy, 10);
      graphics.beginPath();
      graphics.moveTo(cx, cy - 7);
      graphics.lineTo(cx, cy + 7);
      graphics.strokePath();
      graphics.beginPath();
      graphics.moveTo(cx - 5, cy - 3);
      graphics.lineTo(cx + 5, cy - 3);
      graphics.strokePath();
      graphics.beginPath();
      graphics.moveTo(cx - 5, cy + 3);
      graphics.lineTo(cx + 5, cy + 3);
      graphics.strokePath();
      break;
    default:
      graphics.strokeCircle(cx, cy, 8);
  }
}
```

In `_buildCellContainer`, after drawing the background, add the rune if room exists:

```javascript
if (cell.room) {
  const runeGfx = scene.add.graphics();
  this._drawRuneIcon(runeGfx, cell.room.typeId, 0, -10);
  cont.add(runeGfx);
}
```

- [ ] **Step 4: Lint + visual test**

Run: `npx eslint src/substates/DungeonMapUI.js`
Start game, go to 地圖 tab. Verify:
- Cells are 80x80px
- Portal has cyan glow, Heart has purple glow
- Room cells show rune icons
- Monster sprites are ~54px
- Trap icons visible at top-right corner

- [ ] **Step 5: Commit**

```bash
git add src/substates/DungeonMapUI.js
git commit -m "feat(p025): 80px cells with rune icons, glow borders, larger sprites"
```

---

### Task 7: Change all scene background colors to #1a1510

**Files:**
- Modify: `src/scenes/BootScene.js`
- Modify: `src/scenes/GameScene.js`
- Modify: `src/scenes/ResultScene.js`

- [ ] **Step 1: Find and update background color in each scene**

Search for `cameras.main.setBackgroundColor` or `backgroundColor` in each file. Change all background colors to `0x1a1510`:

```javascript
// In each scene's create() method:
this.cameras.main.setBackgroundColor(0x1a1510);
```

If the background is set via Phaser config, update `src/main.js` instead:

```javascript
backgroundColor: '#1a1510',
```

- [ ] **Step 2: Lint all modified files**

Run: `npx eslint src/scenes/BootScene.js src/scenes/GameScene.js src/scenes/ResultScene.js`

- [ ] **Step 3: Visual test**

Start game. Verify dark brown background across all screens (boot, game, result).

- [ ] **Step 4: Commit**

```bash
git add src/scenes/BootScene.js src/scenes/GameScene.js src/scenes/ResultScene.js
git commit -m "fix(p025): change all scene backgrounds to #1a1510 dark brown"
```

---

### Task 8: Update hero routing in BattleManager to use pre-computed routes

**Files:**
- Modify: `src/models/BattleManager.js`

- [ ] **Step 1: Read _pickNextCell and _assignNextMove in BattleManager.js**

Understand the current movement logic (currently: pick cell with lowest distToHeart).

- [ ] **Step 2: Add route pre-computation at spawn time**

Add a method to compute a hero's full route through the grid at spawn:

```javascript
/**
 * Pre-compute a full route from portal to heart for a hero.
 * At fork nodes (cells with >1 connection), alternate based on hero index.
 * @param {number} heroIndex
 * @returns {string[]} Array of cellIds from portal to heart
 */
_computeHeroRoute(heroIndex) {
  const grid = this._gameState.dungeonGrid;
  const portalCell = grid.find(c => c.type === 'portal');
  if (!portalCell) return [];

  const cellMap = new Map(grid.map(c => [c.id, c]));
  const route = [portalCell.id];
  let currentId = portalCell.id;

  const MAX_STEPS = 20;
  for (let step = 0; step < MAX_STEPS; step++) {
    const cell = cellMap.get(currentId);
    if (!cell || cell.type === 'heart') break;
    if (!cell.connections || cell.connections.length === 0) break;

    let nextId;
    if (cell.connections.length === 1) {
      nextId = cell.connections[0];
    } else {
      // Fork: alternate based on hero index
      const branchIndex = heroIndex % cell.connections.length;
      nextId = cell.connections[branchIndex];
    }

    route.push(nextId);
    currentId = nextId;
  }

  return route;
}
```

- [ ] **Step 3: Store route on HeroInstance at spawn**

In the hero spawning code, assign the pre-computed route:

```javascript
// When creating a hero instance:
hero.route = this._computeHeroRoute(heroIndex);
hero.routeIndex = 0;
hero.currentCellId = hero.route[0];
```

- [ ] **Step 4: Update _pickNextCell to use pre-computed route**

```javascript
_pickNextCell(hero) {
  if (hero.route && hero.routeIndex < hero.route.length - 1) {
    hero.routeIndex++;
    return hero.route[hero.routeIndex];
  }
  return null;
}
```

Update `_assignNextMove` to pass the hero object instead of just currentCellId:

```javascript
_assignNextMove(hero) {
  hero.targetCellId = this._pickNextCell(hero);
  // ... rest unchanged
}
```

- [ ] **Step 5: Audit currentCellId usage for pathing decisions**

> **Review finding (Gemini P2 + Codex P2):** Other code may read `hero.currentCellId` to predict or decide future cells. All such logic must use the new `hero.route` array.

Search for `hero.currentCellId` in BattleManager.js and BattleUI.js. Verify:
- Uses for "where is the hero now" (state tracking, cell processing) → keep as-is
- Uses for "where will the hero go next" (pathing decisions) → refactor to use hero.route

- [ ] **Step 5.5: Use battle count offset for fork distribution**

> **Review finding (Codex R2 P2):** `heroIndex % branches` always sends single-hero battles to branch 0.

Add a `_battleCount` counter to BattleManager (increment in `start()`). Change fork selection to:
```javascript
const branchIndex = (heroIndex + this._battleCount) % cell.connections.length;
```
This distributes single-hero battles across branches over multiple waves.

- [ ] **Step 6: Integrate forecast route display**

> **Review finding (Codex P2 + Codex R2 P1):** `drawForecastRoute()` is defined in Task 5 but has no caller. Also, `battleManager.start()` emits `battleStart` BEFORE `BattleUI.start()` binds listeners, so an event-based approach would miss the forecast.

**Solution:** Do NOT use battleStart event for forecast. Instead:
1. Add a public getter `BattleManager.getHeroRoutes()` that returns all heroes' pre-computed routes
2. In `BattleUI.start()` (after binding listeners), call `this._battleManager.getHeroRoutes()` and pass the first hero's route to `dungeonMapUI.drawForecastRoute(route)`
3. On `battleEnd` listener in BattleUI, call `dungeonMapUI.clearForecastRoute()`

Note: Show only the first hero's route as the forecast preview (not all routes overlapping).

- [ ] **Step 7: Lint + battle test**

Run: `npx eslint src/models/BattleManager.js`
Start game, trigger a battle. Verify:
- Heroes spawn at portal and move down
- At fork points, different heroes take different branches
- All heroes eventually reach the heart (or get killed along the way)
- Forecast route (blue dashed line) appears on map at battle start
- Forecast route clears when battle ends

- [ ] **Step 8: Commit**

```bash
git add src/models/BattleManager.js src/substates/BattleUI.js
git commit -m "feat(p025): pre-computed hero routes with fork alternation and forecast display"
```

---

### Task 9: Integration testing and final polish

**Files:**
- Possibly modify: `src/substates/DungeonMapUI.js`, `src/models/BattleManager.js`

- [ ] **Step 1: Full gameplay loop test**

Play through a complete game loop:
1. Start game → flip matrix appears
2. Flip cards, trigger a battle
3. Before battle: verify forecast route (blue dashed line) shows on map
4. During battle: heroes move along paths with correct chain-link visual
5. After battle: return to flip matrix
6. Visit 地圖 tab: verify all cell types render correctly
7. Place cards on cells: verify tap-to-place still works
8. Visit 刑房, 怪物 tabs: verify they still work

- [ ] **Step 1.5: Verify camera bounds and scroll**

> **Review finding (Gemini P2):** MAP_WORLD_H shrink from 1200 to 860 may break camera bounds.

Search for `setBounds`, `MAP_WORLD_H`, and any scroll limit logic in DungeonMapUI.js. Verify:
- Camera or container bounds use the new MAP_WORLD_H (860)
- Scroll doesn't overshoot (bottom of map is reachable, can't scroll past)
- Top of map starts at correct Y position

- [ ] **Step 2: Fix any visual issues found**

Common fixes:
- Scroll bounds may need adjustment for new MAP_WORLD_H (860 vs 1200)
- Cell popup positioning may need update for 80px cells
- Hand area background color should match new theme
- Camera setBounds calls must match new world dimensions

- [ ] **Step 3: Final lint check**

Run: `cd "/Users/admin/Game Jam 創業" && npm run lint`
Expected: 0 errors

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "fix(p025): integration fixes after dungeon map overhaul"
```

---

## File Summary

| Action | File | Task |
|--------|------|------|
| **Create** | `src/utils/seededRandom.js` | 1 |
| **Rewrite** | `src/models/GridTopologyGenerator.js` | 2 |
| **Modify** | `src/models/GameState.js` | 3 |
| **Modify** | `src/substates/DungeonMapUI.js` | 4, 5, 6 |
| **Modify** | `src/substates/BattleUI.js` | 4.5, 8 |
| **Modify** | `src/scenes/BootScene.js` | 7 |
| **Modify** | `src/scenes/GameScene.js` | 7 |
| **Modify** | `src/scenes/ResultScene.js` | 7 |
| **Modify** | `src/models/BattleManager.js` | 8 |
