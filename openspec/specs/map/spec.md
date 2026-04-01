---
baseline_date: "2026-04-01"
last_modified: "2026-04-01"
version: "1.1"
---

# Map — Dungeon Map (Scrollable Grid)

## Requirements

### Requirement: Scrollable Parchment Map

The dungeon map SHALL be displayed as a scrollable canvas larger than the viewport, rendered on a parchment-textured background.

#### Scenario: Map viewport and scaling

GIVEN a logical game resolution of 375x812px
WHEN the DungeonMap substate is active
THEN the following SHALL apply:

**Phaser Scale Config:**
- `mode: Phaser.Scale.FIT`
- `autoCenter: Phaser.Scale.CENTER_BOTH`
- Logical resolution 375x812, scaled to fit actual device

**Map World:**
- Map canvas SHALL be at least 375x1200px (taller than viewport for vertical scrolling)
- Scroll bounds enforced via clamping container.y within [-(mapHeight - viewportH), 0]
- HUD (top, ~48px) and bottom bar (~120px = 64px hand + 56px actions) are fixed UI layers, NOT part of the scrollable world
- Effective visible map area: ~375x644px viewport into a 375x1200+ world

**Touch Input Arbitration:**
- Pointer move > 8px from start position → treat as pan (camera scroll)
- Pointer move <= 8px and released → treat as tap (cell interaction)
- Pan SHALL use container.y offset (not camera scroll) because GameScene shares a single Phaser scene across all substates. Camera-based scroll would affect non-map substates.
- Pan SHALL have inertia-based momentum (deceleration over ~300ms)

**Performance:**
- Map background (parchment texture) and path lines SHALL be pre-rendered to a static RenderTexture
- Only cell contents (rune icons, monster sprites) are live game objects
- Avoid per-frame recalculation of all object positions

---

### Requirement: Grid Topology Generation

Each run SHALL generate a random grid topology connecting the hero portal(s) to the dungeon heart.

#### Scenario: Grid generation constraints

WHEN a new run generates a dungeon grid
THEN the grid SHALL have:
- 1 hero portal at the top (MVP; 2-portal maps are post-MVP)
- 1 dungeon heart (boss room) at the bottom
- 9-12 placeable cells between portal and heart
- At least one complete path from portal to heart
- Cells connected by directed edges (top-to-bottom flow)
- Each cell uses the GridCell schema defined in core/spec.md

#### Scenario: Hero pathfinding at branches

WHEN a hero reaches a cell with multiple outgoing connections
THEN the hero SHALL take the connection leading to the cell closest to the dungeon heart (greedy shortest-path)
AND if equidistant, choose the connection with the lowest cell index (deterministic)

#### Scenario: Cell occupancy during battle

Multiple heroes MAY occupy the same cell simultaneously. Combat resolves in arrival order (FIFO queue).

---

### Requirement: Cell Visual States

Each grid cell SHALL visually indicate its current state.

#### Scenario: Cell appearance by state

| State | Border | Background | Content |
|-------|--------|------------|---------|
| Empty | dashed, brown 40% | transparent 20% | "?" text |
| Room only | solid, brown | radial gradient | Room rune icon (SVG) |
| Room + Trap | solid, dark red | radial gradient | Room rune + trap icon (top-right) |
| Room + Monster | solid, brown | radial gradient | Room rune + monster sprite (center 70%) |
| Room + Trap + Monster | solid, dark red | radial gradient | All three layers |
| Dungeon Heart | solid, purple, glow | purple radial | Boss sprite |

---

### Requirement: Card/Monster Placement (Unified Flow)

Placement SHALL follow a consistent "select first, then place" pattern.

#### Scenario: Place a card from hand

1. Player taps a card in the hand area → card highlights (gold border)
2. Player taps a valid cell on the map → card is placed on the cell
3. If cell already has the same card type → upgrade (level +1)
4. If cell has a different card type in the same layer → prompt replace confirmation
5. Tap anywhere else or tap the highlighted card again → deselect

#### Scenario: Place a monster

1. Player opens monster list (via bottom tab or button)
2. Player taps a monster → monster highlights
3. Player taps a valid empty-monster cell → monster placed
4. If cell already has a monster → prompt swap confirmation

#### Scenario: Tap cell without selection

WHEN a player taps a cell without any card/monster selected
THEN a detail popup SHALL show room info, trap info, and monster info (read-only)
AND MVP: read-only info display with [Close] button. Post-MVP: offer actions [Upgrade] [Replace] [Remove Monster] with synergy bonus.

---

### Requirement: Path Visualization

Connections between cells SHALL be visually rendered as chain-link paths.

#### Scenario: Path rendering

WHEN the map is displayed
THEN each connection between cells SHALL be drawn as:
- Line segments (stroke: brown #8B4513, 3px, 50% opacity)
- Small circle decorations along the line (simulating chain links)
- Direction indicator (subtle arrow or darker endpoint near the downstream cell)
- Paths SHALL be pre-rendered to the static background texture

---

### Requirement: Hand Area

A fixed hand area SHALL display the player's current cards below the map.

#### Scenario: Hand display

WHEN the player has cards in hand
THEN the hand area SHALL show card thumbnails (48x48px) in a horizontally scrollable strip
AND tapping a hand card SHALL highlight it for placement (gold border glow)
AND the hand area height SHALL be 64px, fixed above the bottom action bar
AND the hand area SHALL NOT scroll with the map (fixed UI layer)
