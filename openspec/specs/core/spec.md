---
baseline_date: "2026-04-01"
last_modified: "2026-04-01"
version: "1.1"
---

# Core — Game State & Data Models

## Requirements

### Requirement: Global Game State

The game SHALL maintain a single GameState object accessible by all Phaser scenes. This object holds all mutable game data for the current run.

#### Scenario: New game initialization

WHEN a new game run begins
THEN GameState SHALL be initialized with:
- `gold`: 0
- `day`: 1
- `bossHp`: 100 (base, affected by meta-progression)
- `bossMaxHp`: 100
- `glamour`: 0 (華麗度)
- `hand`: [] (card hand)
- `prisoners`: [] (captured heroes)
- `monsters`: [initial monster pool based on unlocks]
- `dungeonGrid`: GridCell[] (generated per-run, see GridCell schema below)
- `flipMatrix`: FlipCard[][] (generated per-run, 3x5 matrix)
- `tortureSlots`: [{unlocked: true, prisoner: null, progress: 0, target: 0}, {unlocked: true, prisoner: null, progress: 0, target: 0}, {unlocked: false, cost: 500}, {unlocked: false, cost: 1000}]
  - Note: torture slots are **per-run** (reset each run). Unlocking extra slots is a single-run gold investment, NOT meta-progression.

---

### Requirement: GridCell Schema

Each cell in the dungeon grid SHALL use the following data structure:

```json
{
  "id": "cell_01",
  "position": { "x": 150, "y": 275 },
  "connections": ["cell_02", "cell_03"],
  "room": { "typeId": "hatchery", "level": 1 } | null,
  "trap": { "typeId": "fire", "level": 1 } | null,
  "monster": { "instanceId": "m_001", "typeId": "rage_demon", "currentHp": 120 } | null
}
```

- `room` and `trap` are independent layers; both can coexist on one cell
- `monster` is at most 1 per cell
- `connections` is a directed list (top-to-bottom flow toward dungeon heart)
- `drawCount`: 0 (tracks card draw cost escalation)
- `drawCosts`: [0, 50, 100, 150, 250, 350, 500]

---

### Requirement: Meta-Progression State

The game SHALL persist meta-progression data in localStorage across runs.

#### Scenario: Save meta-progression after run ends

WHEN a game run ends (victory or defeat)
THEN the following SHALL be saved to localStorage:
- `bossLevel`: integer, incremented on victory
- `unlockedRooms`: string[] of room IDs
- `unlockedTraps`: string[] of trap IDs
- `unlockedMonsters`: string[] of monster IDs
- `bestiary`: object tracking encountered heroes and monsters
- `totalRuns`: integer

#### Scenario: Load meta-progression on game start

WHEN the game application loads
THEN meta-progression data SHALL be read from localStorage
AND default values SHALL be used if no save exists

---

### Requirement: Card Draw Cost Escalation

The card draw system SHALL use a fixed cost table.

#### Scenario: Sequential draws in one run

GIVEN `drawCosts` = [0, 50, 100, 150, 250, 350, 500]
WHEN the player draws the Nth card (0-indexed)
THEN the cost SHALL be `drawCosts[min(N, drawCosts.length - 1)]`

- Draw 0: free
- Draw 1: 50 gold
- Draw 2: 100 gold
- Draw 3: 150 gold
- Draw 4: 250 gold
- Draw 5: 350 gold
- Draw 6+: 500 gold each

---

### Requirement: Data-Driven Configuration

All game entities (monsters, heroes, rooms, traps) SHALL be defined in JSON configuration files, not hardcoded.

#### Scenario: Adding a new monster type

WHEN a developer adds a new entry to `data/monsters.json`
THEN the game SHALL recognize the new monster without code changes
AND the monster SHALL appear in relevant card pools and UI

---

### Requirement: Scene Management

The game SHALL use Phaser scenes to separate major UI screens.

#### Scenario: Scene list

The following scenes SHALL exist:
- `BootScene`: asset loading, meta-progression load, main menu
- `GameScene`: the primary gameplay scene containing all substates (see below)
- `ResultScene`: run end summary, meta-progression display

`GameScene` SHALL manage the following substates via containers/modals (NOT separate Phaser scenes):
- **FlipMatrix** (default substate): card flip matrix, main gameplay loop
- **DungeonMap**: scrollable dungeon map with grid, card placement
- **CardPick**: 3-pick-1 card selection (modal overlay)
- **Battle**: defense phase auto-battle (uses DungeonMap with battle overlay)
- **Torture**: torture chamber management (modal/tab overlay)
- **MonsterList**: monster roster and placement UI

Substates SHALL share the same GameState object. Switching substates SHALL NOT require scene transitions, only container visibility toggling.

#### Scenario: Scene-Substate flow

```
BootScene → GameScene
  ├─ FlipMatrix (default)
  │   ├─ tap card → process event
  │   ├─ battle event → switch to Battle substate
  │   └─ bottom tabs → switch to DungeonMap / Torture / MonsterList
  ├─ DungeonMap
  │   ├─ tap cell → show detail / place card
  │   ├─ select hand card → tap cell to place
  │   └─ bottom tabs → switch back
  ├─ CardPick (modal over any substate)
  ├─ Battle (overlay on DungeonMap)
  └─ Torture (tab/modal)
GameScene → ResultScene (on run end)
```
