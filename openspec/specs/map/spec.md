---
baseline_date: "2026-04-01"
last_modified: "2026-04-01"
version: "1.0"
---

# Map — Dungeon Map (Scrollable Grid)

## Requirements

### Requirement: Scrollable Parchment Map

The dungeon map SHALL be displayed as a scrollable canvas larger than the viewport, rendered on a parchment-textured background.

#### Scenario: Map viewport

GIVEN a phone screen of 375x812px
WHEN the DungeonMapScene is active
THEN the map canvas SHALL be at least 600x900px
AND the player SHALL be able to drag/pan the map with touch gestures
AND the map SHALL have inertia-based momentum scrolling
AND the HUD (top) and bottom bar SHALL remain fixed over the map

---

### Requirement: Grid Topology Generation

Each run SHALL generate a random grid topology connecting the hero portal(s) to the dungeon heart.

#### Scenario: Grid generation constraints

WHEN a new run generates a dungeon grid
THEN the grid SHALL have:
- 1-2 hero portals at the top
- 1 dungeon heart (boss room) at the bottom
- 9-12 placeable cells between portal and heart
- At least one complete path from every portal to the heart
- Cells connected by directed edges (top-to-bottom flow)
- Each cell stores: `{ id, position: {x, y}, room: null, trap: null, monster: null, connections: [cellId...] }`

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

### Requirement: Cell Interaction

Players SHALL be able to tap cells to view details and place cards/monsters.

#### Scenario: Tap empty cell

WHEN a player taps an empty cell
AND the player has cards in hand
THEN a card placement UI SHALL appear allowing selection from hand

#### Scenario: Tap occupied cell

WHEN a player taps an occupied cell
THEN a detail popup SHALL show room info, trap info, monster info, and synergy bonus
AND offer actions: [Upgrade] [Replace] [Remove Monster]

---

### Requirement: Path Visualization

Connections between cells SHALL be visually rendered as chain-link paths.

#### Scenario: Path rendering

WHEN the map is displayed
THEN each connection between cells SHALL be drawn as:
- SVG line segments (stroke: brown, 3px, 50% opacity)
- Small circle decorations along the line (simulating chain links)
- Direction indicator (subtle arrow or flow from top to bottom)

---

### Requirement: Hand Area

A fixed hand area SHALL display the player's current cards below the map.

#### Scenario: Hand display

WHEN the player has cards in hand
THEN the hand area SHALL show card thumbnails (48x48px) in a horizontally scrollable strip
AND tapping a hand card SHALL highlight it for placement
AND the hand area height SHALL be 64px, fixed above the bottom bar
