---
baseline_date: "2026-04-01"
last_modified: "2026-04-01"
version: "1.0"
---

# Battle — Defense Phase (Auto-Battle)

## Requirements

### Requirement: Hero Generation

Heroes SHALL be generated based on the battle event type and dungeon glamour level.

#### Scenario: Hero count and type by event

| Event | Hero Count | Pool |
|-------|-----------|------|
| Normal Battle | 1-3 | 見習劍士, 光弓獵手 |
| Elite Battle | 2-4 | All 5 types |
| Boss (地宮) | 3-5 | All 5 types, guaranteed 聖騎士 |

Higher glamour increases the chance of stronger hero types appearing.

---

### Requirement: Hero Pathfinding

Heroes SHALL traverse the dungeon grid from portal to dungeon heart along the pre-defined path.

#### Scenario: Hero movement

WHEN a battle begins
THEN heroes SHALL enter from the portal in waves (staggered, not simultaneous)
AND each hero SHALL move along connected cells from top to bottom
AND movement speed SHALL be 400ms per cell (configurable)

---

### Requirement: Cell Combat Resolution

Each cell a hero enters SHALL trigger trap and monster combat.

#### Scenario: Combat sequence per cell

WHEN a hero enters a cell
THEN the following sequence SHALL execute:
1. **Trap trigger**: If cell has a trap, apply trap damage/effect immediately
2. **Monster combat**: If cell has a monster, start auto-battle loop
   - Both sides attack based on their cooldown (CD) timers
   - Monster with room synergy bonus gets enhanced stats/skills
3. **Resolution**: 
   - Hero HP <= 0 → hero defeated → 20% capture chance → add to prisoner pool
   - Monster HP <= 0 → cell is breached → hero continues to next cell
   - Hero HP > 0 AND Monster HP > 0 → combat continues until one falls

---

### Requirement: Boss (Dungeon Heart) Combat

If a hero reaches the dungeon heart, they fight the boss (player's avatar).

#### Scenario: Boss fight

WHEN a hero reaches the dungeon heart cell
THEN the hero SHALL fight the boss using the same auto-battle system
AND the boss SHALL have stats based on base + meta-progression upgrades

---

### Requirement: Boss Skill (Player Active)

The player SHALL have one active skill they can manually trigger during battle.

#### Scenario: Boss skill usage

WHEN the battle phase is active
THEN the player SHALL see a skill button at the bottom
AND tapping it SHALL deal damage to the hero currently in combat (or a targeted cell)
AND the skill SHALL have a cooldown (e.g., 10 seconds)
AND during cooldown, the button SHALL appear grayed out

---

### Requirement: Capture Mechanic

Defeated heroes have a chance to be captured.

#### Scenario: Capture roll

WHEN a hero's HP reaches 0
THEN a 20% random roll SHALL determine if the hero is captured
IF captured: hero is added to GameState.prisoners, "Captured!" text appears (gold)
IF not captured: hero simply disappears, gold reward granted

---

### Requirement: Battle UI

#### Scenario: Battle overlay elements

WHEN battle is active, the following SHALL be displayed over the dungeon map:
- Hero info bar (top): portrait, name, HP bar
- Damage popups: float up from cells (red for damage, blue for ice, green for poison)
- Boss skill button (bottom): with CD indicator
- Speed controls: [x1] [x2] [Skip]

---

### Requirement: Torture Progress Advancement

Each hero kill SHALL advance all active torture slots.

#### Scenario: Kill-driven torture progress

WHEN a hero is defeated (killed, not just captured)
THEN every occupied torture slot SHALL advance its progress by 1 unit
AND if any slot reaches its target → conversion completes
