# Map Visual Pixel Art Overhaul — Design Spec

**Date:** 2026-04-05
**Scope:** DungeonMapUI visual replacement — procedural Graphics to pixel art sprites
**Risk:** Low-Medium (visual only, no logic changes)

## Goal

Replace all procedural Graphics rendering in the dungeon map with pixel art image assets generated via NanoBanana (Gemini Imagen). Unify the visual style with the existing monster/hero sprites. Fix the background flicker caused by `Math.random()` noise.

## Art Style

- Retro pixel art, dark brown palette (`#1a1510`, `#2d1b0e`, `#CD853F`)
- Consistent with existing monster/hero sprites in `public/sprites/`
- All assets authored at 1:1 display size (no runtime scaling) to avoid sub-pixel blur
- Transparent background (PNG-24 with alpha) for all assets except `map_bg`
- No anti-aliasing — hard pixel edges only

### Asset Size Specification

| Category | Authoring Size | Display Size | Scale Factor | Notes |
|----------|---------------|-------------|-------------|-------|
| Map background | 375x860 | 375x860 | 1:1 | Opaque, no alpha |
| Cell tiles | 80x80 | 80x80 | 1:1 | Transparent BG, content fills 72x72 center (4px padding for border overlay) |
| Room icons | 24x24 | 24x24 | 1:1 | Transparent BG |
| Path chain | 24x8 | 24x8 | 1:1 | Transparent BG, tileable horizontally |
| Path arrow | 16x16 | 16x16 | 1:1 | Transparent BG, points right (rotation applied at runtime) |
| Path diamond | 16x16 | 16x16 | 1:1 | Transparent BG |

## Asset Manifest

### 1. Map Background (1 image)

| Asset Key | Description | Size | File |
|-----------|-------------|------|------|
| `map_bg` | Dark stone/dirt floor texture, pixel art, natural brightness variation | 375x860 | `public/sprites/map_bg.png` |

Replaces: `_rebuildBackground()` parchment noise (lines 247-267 of DungeonMapUI.js)

### 2. Cell Background Tiles (8 images, 80x80 each)

| Asset Key | Room Type | Visual | File |
|-----------|-----------|--------|------|
| `cell_hatchery` | hatchery (孵化室) | Fleshy red cave floor, eggshell fragments | `public/sprites/cell_hatchery.png` |
| `cell_lab` | lab (實驗室) | Purple magic circle floor | `public/sprites/cell_lab.png` |
| `cell_training` | training (訓練場) | Wooden floor, weapon rack marks | `public/sprites/cell_training.png` |
| `cell_dungeon` | dungeon (牢房) | Grey stone bricks, iron bars | `public/sprites/cell_dungeon.png` |
| `cell_treasury` | treasury (寶庫) | Gold-tinted floor tiles, scattered coins | `public/sprites/cell_treasury.png` |
| `cell_portal` | portal (入口) | Blue swirl portal | `public/sprites/cell_portal.png` |
| `cell_heart` | heart (地城之心) | Purple pulsing crystal/magic core | `public/sprites/cell_heart.png` |
| `cell_empty` | empty (未配置) | Cracked stone, question mark carved | `public/sprites/cell_empty.png` |

### 3. Room Type Icons (5 images, 24x24 each)

| Asset Key | Room Type | Visual | File |
|-----------|-----------|--------|------|
| `icon_hatchery` | hatchery | Egg | `public/sprites/icon_hatchery.png` |
| `icon_lab` | lab | Potion bottle | `public/sprites/icon_lab.png` |
| `icon_training` | training | Sword | `public/sprites/icon_training.png` |
| `icon_dungeon` | dungeon | Skull | `public/sprites/icon_dungeon.png` |
| `icon_treasury` | treasury | Coin | `public/sprites/icon_treasury.png` |

### 4. Path Assets (3 images)

| Asset Key | Description | Size | File |
|-----------|-------------|------|------|
| `path_chain` | Horizontal chain segment, tileable | 24x8 | `public/sprites/path_chain.png` |
| `path_arrow` | Directional arrow pointing right | 16x16 | `public/sprites/path_arrow.png` |
| `path_diamond` | Fork/merge diamond marker | 16x16 | `public/sprites/path_diamond.png` |

### Total: 17 images | Budget: < 500KB total

## Cell State-to-Asset Mapping

| Cell State | Sprite Key | Icon | Label | Border Overlay |
|------------|-----------|------|-------|----------------|
| `type === 'portal'` | `cell_portal` | none | '入口' | cyan glow (dynamic) |
| `type === 'heart'` | `cell_heart` | none | '地城之心' | purple glow (dynamic) |
| `!room` (empty normal) | `cell_empty` | none | '?' | none |
| `room && !trap` | `cell_{room.typeId}` | `icon_{room.typeId}` | Chinese name | brown border (default) |
| `room && trap` | `cell_{room.typeId}` | `icon_{room.typeId}` | Chinese name | dark red border + trap icon '⚠' |

Label mapping: hatchery→孵化室, lab→實驗室, training→訓練場, dungeon→牢房, treasury→寶庫

## Container & Layer Structure

```
_mapWorldContainer (scrollable)
  ├── map_bg Image (setOrigin(0,0) at position 0,0)
  ├── _pathGfx Graphics (glow lines + main path lines)
  ├── _pathSpriteContainer (chain sprites along paths)
  ├── _cellContainers[] (per cell):
  │     ├── baseSprite (cell tile, e.g. cell_hatchery)
  │     ├── defaultBorder Graphics (brown/red/glow per state)
  │     ├── highlightBorder Graphics (transient, selection/battle glow)
  │     ├── iconSprite (room icon, 24x24)
  │     ├── labelText
  │     ├── trapIcon
  │     └── monsterSprite
  ├── _pathOverlayContainer (diamond markers + arrows — ABOVE cells)
  └── _forecastGfx Graphics (dashed forecast route)
```

### Highlight Restore Contract

- `baseSprite`: never modified after creation, destroyed only on `_rebuildCells()`
- `defaultBorder`: drawn once per cell state in `_buildCellContainer()`. Only redrawn on `_rebuildCells()` or cell state change. `setCellHighlight()` never touches it.
- `highlightBorder`: separate Graphics, toggled visible/invisible for transient highlights
- `setCellHighlight(cellId, color)`: sets `highlightBorder` visible with color; `setCellHighlight(cellId, null)` hides it. Does NOT touch `baseSprite` or `defaultBorder`.

## Path Sprite Placement Rules

### Chain Segments
- Loop from start to end of each connection
- Spacing: every 24px along the path vector
- **Start margin**: skip first 28px from source cell center (avoid overlapping cell tile)
- **End margin**: skip last 28px from target cell center
- Each chain sprite: `setOrigin(0.5, 0.5)`, rotated to path angle via `setRotation(angle)`
- All chain sprites added to `_pathSpriteContainer`

### Arrow
- Placed at 28px before target cell center (same as end margin)
- `setOrigin(0.5, 0.5)`, rotated to path angle
- Added to `_pathOverlayContainer` (above cells)

### Diamond (Fork/Merge)
- Placed at cell center for cells with `connections.length > 1` or incoming count > 1
- `setOrigin(0.5, 0.5)`, no rotation
- Added to `_pathOverlayContainer` (above cells, including above monsters — acceptable since diamond is small 16x16 marker at cell center)

## Code Changes

### Files Modified

| File | Change Type | Description |
|------|------------|-------------|
| `src/substates/DungeonMapUI.js` | Major | Replace all procedural Graphics with sprites |
| `src/data/spriteManifest.js` | Minor | Add 17 new asset entries |

`BootScene.js` does NOT need changes — it already iterates `spriteManifest.js` to load assets.

### DungeonMapUI.js Changes

#### `_buildContainers()`
- Add `_pathSpriteContainer` and `_pathOverlayContainer` between path and cell layers
- Ensure layer order matches Container & Layer Structure above

#### `_rebuildBackground()`
- Remove noise loops (fixes Math.random flicker)
- `mapBgImage` created once in `_buildContainers()` via `scene.add.image(0, 0, 'map_bg').setOrigin(0, 0)` — never recreated
- On rebuild: `_pathSpriteContainer.removeAll(true)` and `_pathOverlayContainer.removeAll(true)` before repopulating (cleanup contract)
- Path rendering: keep glow + main line as Graphics via `_pathGfx.clear()` (cheap, resolution-independent)
- Replace chain circle loop with chain sprite loop (see Path Sprite Placement Rules)
- Move arrow and diamond rendering to `_pathOverlayContainer`
- All sprite positions use `cell.visualPos ?? cell.position` (dual coordinate system)

Note: Asset file paths in tables above are repo paths (`public/sprites/...`). In `spriteManifest.js`, use Vite-relative paths (`sprites/...`) matching existing manifest convention.

#### `_buildCellContainer()`
- Replace Graphics `bgFill` with `scene.add.image(0, 0, spriteKey).setOrigin(0.5)` using state-to-asset mapping
- Add `defaultBorder` Graphics + separate `highlightBorder` Graphics (initially invisible)
- Replace `_drawRuneIcon()` call with `scene.add.image(0, -10, iconKey).setOrigin(0.5)` for room icons
- Store `highlightBorder` on container data for `setCellHighlight()` access

#### `_drawCellVisual()`
- Simplify: only draws `defaultBorder` (glow for portal/heart, brown for normal, red for trap)
- No longer draws bgFill (handled by baseSprite)

#### `setCellHighlight()`
- Rewrite: toggle `highlightBorder` visibility + color instead of clearing/redrawing bgFill

#### `_drawRuneIcon()`
- Delete entire method (replaced by icon sprites in `_buildCellContainer`)

#### `_getCellLabel()`
- Map typeId to Chinese: hatchery→孵化室, lab→實驗室, training→訓練場, dungeon→牢房, treasury→寶庫

## Unchanged Systems

- `GridTopologyGenerator.js` — topology logic untouched
- Dual coordinate system (logicalPos / visualPos) — untouched
- Scroll/inertia/gesture logic — untouched
- Forecast dashed route — stays procedural (dynamic per-wave content)
- Hand area rendering — out of scope
- Battle mode overlays — out of scope
- HUD — out of scope

## Verification Criteria

1. All 17 images loaded without console errors, total asset size < 500KB
2. No background flicker on scroll/refresh (Math.random removed)
3. Each room type displays its unique tile + icon per state-to-asset mapping
4. Portal and Heart cells have distinct special visuals with glow borders
5. Path chains render along connections with correct rotation, respecting 28px margins
6. Arrows in `_pathOverlayContainer` point downstream, visible above cell tiles
7. Diamonds mark fork/merge nodes, visible above cell tiles
8. Pixel art style consistent across all assets (no anti-aliasing, no sub-pixel blur)
9. Smooth scroll on mobile (375x812 Canvas renderer) — no visible jank during continuous drag
10. Cell tap hit-testing works correctly (logicalPos unchanged)
11. Monster sprites layer correctly on top of cell tiles (within cell container, below pathOverlay)
12. Selection highlight / battle highlight restore correctly (highlightBorder contract)
