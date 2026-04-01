---
baseline_date: "2026-04-01"
last_modified: "2026-04-01"
version: "1.0"
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
- `dungeonGrid`: null (generated per-run)
- `flipMatrix`: null (generated per-run)
- `tortureSlots`: [{unlocked: true, prisoner: null, progress: 0}, {unlocked: true, prisoner: null, progress: 0}, {unlocked: false, cost: 500}, {unlocked: false, cost: 1000}]
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
- `BootScene`: asset loading, meta-progression load
- `MainMenuScene`: start game, view bestiary
- `FlipMatrixScene`: card flip matrix (main gameplay loop)
- `DungeonMapScene`: scrollable dungeon map with grid
- `CardPickScene`: 3-pick-1 card selection (overlay)
- `BattleScene`: defense phase auto-battle
- `TortureScene`: torture chamber management
- `ResultScene`: run end summary

Scenes SHALL communicate via the shared GameState object and Phaser events.
