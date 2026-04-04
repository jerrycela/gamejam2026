# Map Visual Pixel Art Overhaul — Design Spec

**Date:** 2026-04-05
**Scope:** DungeonMapUI full visual replacement — procedural Graphics to pixel art sprites
**Risk:** Low-Medium (visual only, no logic changes)

## Goal

Replace all procedural Graphics rendering in the dungeon map with pixel art image assets generated via NanoBanana (Gemini Imagen). Unify the visual style with the existing monster/hero sprites. Fix the background flicker caused by `Math.random()` noise.

## Art Style

- Retro pixel art, 16-32px base tile resolution
- Dark brown palette continuing current scheme (`#1a1510`, `#2d1b0e`, `#CD853F`)
- Consistent with existing monster/hero sprites in `public/sprites/`

## Asset Manifest

### 1. Map Background (1 image)

| Asset | Description | Size | File |
|-------|-------------|------|------|
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

Replaces: `_drawCellVisual()` (lines 502-536) — Graphics rounded rects with color fills

### 3. Room Type Icons (5 images, 24x24 each)

| Asset Key | Room Type | Visual | File |
|-----------|-----------|--------|------|
| `icon_hatchery` | hatchery | Egg | `public/sprites/icon_hatchery.png` |
| `icon_lab` | lab | Potion bottle | `public/sprites/icon_lab.png` |
| `icon_training` | training | Sword | `public/sprites/icon_training.png` |
| `icon_dungeon` | dungeon | Skull | `public/sprites/icon_dungeon.png` |
| `icon_treasury` | treasury | Coin | `public/sprites/icon_treasury.png` |

Replaces: `_drawRuneIcon()` (lines 547-613) — procedural line drawings

### 4. Path Assets (3 images)

| Asset Key | Description | Size | File |
|-----------|-------------|------|------|
| `path_chain` | Horizontal chain segment, tileable | 24x8 | `public/sprites/path_chain.png` |
| `path_arrow` | Directional arrow | 16x16 | `public/sprites/path_arrow.png` |
| `path_diamond` | Fork/merge diamond marker | 16x16 | `public/sprites/path_diamond.png` |

Replaces: chain ring circles (lines 304-320), arrow triangles (lines 322-337), diamond markers (lines 341-363)

### Total: 17 images

## Code Changes

### File: `src/substates/DungeonMapUI.js` (sole implementation file)

#### `_rebuildBackground()`
- Remove noise loops (Math.random flicker fix)
- Place `map_bg` as a single Image at (0,0)
- Path rendering: replace Graphics circles with `path_chain` sprites rotated along path angle, spaced every 24px
- Replace arrow triangles with `path_arrow` sprite rotated to path angle
- Replace diamond fill with `path_diamond` sprite

#### `_buildCellContainer()`
- Replace Graphics bgFill + border with a single Sprite using `cell_{typeId}` key
- For portal/heart: use `cell_portal` / `cell_heart`
- For empty (no room): use `cell_empty`
- Keep highlight border as Graphics overlay (needed for dynamic selection glow)

#### `_drawCellVisual()`
- Simplify to only handle dynamic highlight overlay (selection mode, battle mode)
- Cell base visual comes from sprite, not Graphics

#### `_drawRuneIcon()`
- Replace entire switch block with single Sprite using `icon_{typeId}` key
- Position at same (cx, cy) offset

#### `_getCellLabel()`
- Change raw typeId strings to Chinese labels:
  - hatchery → 孵化室, lab → 實驗室, training → 訓練場, dungeon → 牢房, treasury → 寶庫
- Portal/heart labels unchanged (already Chinese)

### File: `src/scenes/BootScene.js`
- Add all 17 assets to preload

### File: `src/data/spriteManifest.js`
- Add new asset entries

## Unchanged Systems

- `GridTopologyGenerator.js` — topology logic untouched
- Dual coordinate system (logicalPos / visualPos) — untouched
- Scroll/inertia/gesture logic — untouched
- Forecast dashed route — stays procedural (dynamic per-wave content)
- Hand area rendering — out of scope
- Battle mode overlays — out of scope (separate visual pass)
- HUD — out of scope

## Verification Criteria

1. All 17 images generated and loaded without console errors
2. No more background flicker on scroll/refresh
3. Each room type displays its unique tile + icon
4. Portal and Heart cells have distinct special visuals
5. Path chains render along connections with correct rotation
6. Arrows point downstream, diamonds mark fork/merge nodes
7. Pixel art style consistent across all assets
8. 60fps scroll on mobile (375x812 Canvas renderer)
9. Cell tap hit-testing still works correctly (logicalPos unchanged)
10. Monster sprites layer correctly on top of cell tiles
